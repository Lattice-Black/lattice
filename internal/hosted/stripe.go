package hosted

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// StripeConfig holds Stripe billing configuration.
type StripeConfig struct {
	SecretKey     string
	WebhookSecret string
	PriceID       string // The Stripe Price ID for the $9/mo plan
	SuccessURL    string // URL to redirect after payment
	CancelURL     string // URL to redirect if payment cancelled
}

// Billing handles Stripe billing operations via direct HTTP API calls.
type Billing struct {
	config      StripeConfig
	store       *Store
	provisioner *Provisioner
	httpClient  *http.Client
}

// NewBilling creates a new Stripe billing handler.
func NewBilling(cfg StripeConfig, store *Store, prov *Provisioner) *Billing {
	return &Billing{
		config:      cfg,
		store:       store,
		provisioner: prov,
		httpClient:  &http.Client{Timeout: 30 * time.Second},
	}
}

// CreateCheckoutSession creates a Stripe Checkout session for a new tenant.
// Returns the checkout URL the user should be redirected to.
func (b *Billing) CreateCheckoutSession(t Tenant) (string, error) {
	form := url.Values{}
	form.Set("mode", "subscription")
	form.Set("customer_email", t.Email)
	form.Set("line_items[0][price]", b.config.PriceID)
	form.Set("line_items[0][quantity]", "1")
	form.Set("success_url", b.config.SuccessURL+"?tenant="+t.ID)
	form.Set("cancel_url", b.config.CancelURL)
	form.Set("metadata[tenant_id]", t.ID)
	form.Set("metadata[slug]", t.Slug)

	body, err := b.stripePost("/v1/checkout/sessions", form)
	if err != nil {
		return "", fmt.Errorf("failed to create checkout session: %w", err)
	}

	var result struct {
		URL string `json:"url"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return "", fmt.Errorf("failed to parse checkout response: %w", err)
	}

	return result.URL, nil
}

// HandleWebhook processes Stripe webhook events.
func (b *Billing) HandleWebhook(payload []byte, signature string) error {
	// Verify the webhook signature
	if err := b.verifyWebhook(payload, signature); err != nil {
		return fmt.Errorf("webhook verification failed: %w", err)
	}

	var event struct {
		Type string          `json:"type"`
		Data json.RawMessage `json:"data"`
	}
	if err := json.Unmarshal(payload, &event); err != nil {
		return fmt.Errorf("failed to parse webhook payload: %w", err)
	}

	switch event.Type {
	case "checkout.session.completed":
		return b.handleCheckoutCompleted(event.Data)
	case "customer.subscription.updated":
		return b.handleSubscriptionUpdated(event.Data)
	case "customer.subscription.deleted":
		return b.handleSubscriptionDeleted(event.Data)
	case "invoice.payment_failed":
		return b.handlePaymentFailed(event.Data)
	default:
		log.Printf("Unhandled Stripe event type: %s", event.Type)
	}

	return nil
}

func (b *Billing) handleCheckoutCompleted(data json.RawMessage) error {
	var sess struct {
		Customer     string `json:"customer"`
		Subscription  string `json:"subscription"`
		Metadata     map[string]string `json:"metadata"`
	}
	if err := json.Unmarshal(data, &sess); err != nil {
		return fmt.Errorf("failed to parse checkout session: %w", err)
	}

	// Stripe wraps data in an "object" field
	var wrapper struct {
		Object json.RawMessage `json:"object"`
	}
	if err := json.Unmarshal(data, &wrapper); err == nil && len(wrapper.Object) > 0 {
		if err := json.Unmarshal(wrapper.Object, &sess); err != nil {
			return fmt.Errorf("failed to parse checkout object: %w", err)
		}
	}

	tenantID, ok := sess.Metadata["tenant_id"]
	if !ok {
		return fmt.Errorf("no tenant_id in checkout session metadata")
	}

	tenant, err := b.store.GetTenant(tenantID)
	if err != nil {
		return fmt.Errorf("failed to get tenant %s: %w", tenantID, err)
	}
	if tenant == nil {
		return fmt.Errorf("tenant %s not found", tenantID)
	}

	tenant.StripeCustomerID = sess.Customer
	tenant.StripeSubID = sess.Subscription
	tenant.Status = TenantActive
	tenant.TrialEndsAt = nil
	tenant.UpdatedAt = time.Now().UTC()

	if err := b.store.UpdateTenant(*tenant); err != nil {
		return fmt.Errorf("failed to update tenant: %w", err)
	}

	log.Printf("Tenant %s activated via Stripe checkout", tenant.Slug)
	return nil
}

func (b *Billing) handleSubscriptionUpdated(data json.RawMessage) error {
	var sub struct {
		Status   string `json:"status"`
		Customer string `json:"customer"`
	}
	var wrapper struct {
		Object json.RawMessage `json:"object"`
	}
	if err := json.Unmarshal(data, &wrapper); err == nil && len(wrapper.Object) > 0 {
		json.Unmarshal(wrapper.Object, &sub)
	} else {
		json.Unmarshal(data, &sub)
	}

	if sub.Customer == "" {
		return nil
	}

	tenant, err := b.store.GetTenantByStripeCustomer(sub.Customer)
	if err != nil || tenant == nil {
		return nil
	}

	if sub.Status == "canceled" || sub.Status == "unpaid" || sub.Status == "incomplete_expired" {
		tenant.Status = TenantSuspended
		tenant.UpdatedAt = time.Now().UTC()
		if err := b.store.UpdateTenant(*tenant); err != nil {
			return err
		}
		if err := b.provisioner.Scale(context.Background(), tenant.Slug, 0); err != nil {
			log.Printf("Warning: failed to scale down: %v", err)
		}
		log.Printf("Tenant %s suspended (subscription %s)", tenant.Slug, sub.Status)
	}

	return nil
}

func (b *Billing) handleSubscriptionDeleted(data json.RawMessage) error {
	var sub struct {
		Customer string `json:"customer"`
	}
	var wrapper struct {
		Object json.RawMessage `json:"object"`
	}
	if err := json.Unmarshal(data, &wrapper); err == nil && len(wrapper.Object) > 0 {
		json.Unmarshal(wrapper.Object, &sub)
	} else {
		json.Unmarshal(data, &sub)
	}

	if sub.Customer == "" {
		return nil
	}

	tenant, err := b.store.GetTenantByStripeCustomer(sub.Customer)
	if err != nil || tenant == nil {
		return nil
	}

	tenant.Status = TenantSuspended
	tenant.UpdatedAt = time.Now().UTC()
	if err := b.store.UpdateTenant(*tenant); err != nil {
		return err
	}
	if err := b.provisioner.Scale(context.Background(), tenant.Slug, 0); err != nil {
		log.Printf("Warning: failed to scale down: %v", err)
	}

	log.Printf("Tenant %s suspended (subscription deleted)", tenant.Slug)
	return nil
}

func (b *Billing) handlePaymentFailed(data json.RawMessage) error {
	var invoice struct {
		Customer string `json:"customer"`
	}
	var wrapper struct {
		Object json.RawMessage `json:"object"`
	}
	if err := json.Unmarshal(data, &wrapper); err == nil && len(wrapper.Object) > 0 {
		json.Unmarshal(wrapper.Object, &invoice)
	} else {
		json.Unmarshal(data, &invoice)
	}

	if invoice.Customer == "" {
		return nil
	}

	tenant, err := b.store.GetTenantByStripeCustomer(invoice.Customer)
	if err != nil || tenant == nil {
		return nil
	}

	if tenant.Status == TenantActive {
		tenant.Status = TenantSuspended
		tenant.UpdatedAt = time.Now().UTC()
		if err := b.store.UpdateTenant(*tenant); err != nil {
			return err
		}
		if err := b.provisioner.Scale(context.Background(), tenant.Slug, 0); err != nil {
			log.Printf("Warning: failed to scale down: %v", err)
		}
		log.Printf("Tenant %s suspended (payment failed)", tenant.Slug)
	}

	return nil
}

// CancelSubscription cancels a tenant's Stripe subscription.
func (b *Billing) CancelSubscription(subID string) error {
	form := url.Values{}
	_, err := b.stripePost("/v1/subscriptions/"+subID+"/cancel", form)
	return err
}

// --- Stripe HTTP helpers ---

func (b *Billing) stripePost(path string, form url.Values) ([]byte, error) {
	req, err := http.NewRequest("POST", "https://api.stripe.com"+path, strings.NewReader(form.Encode()))
	if err != nil {
		return nil, err
	}
	req.SetBasicAuth(b.config.SecretKey, "")
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := b.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return body, fmt.Errorf("stripe API error: %s: %s", resp.Status, string(body))
	}

	return body, nil
}

// verifyWebhook verifies the Stripe webhook signature.
func (b *Billing) verifyWebhook(payload []byte, signature string) error {
	// Stripe signature format: t=1234567890,v1=abc123...
	parts := strings.Split(signature, ",")
	var timestamp string
	var v1Sig string
	for _, part := range parts {
		if strings.HasPrefix(part, "t=") {
			timestamp = strings.TrimPrefix(part, "t=")
		} else if strings.HasPrefix(part, "v1=") {
			v1Sig = strings.TrimPrefix(part, "v1=")
		}
	}

	if timestamp == "" || v1Sig == "" {
		return fmt.Errorf("invalid signature format")
	}

	// Compute expected signature: HMAC-SHA256(secret, timestamp + "." + payload)
	h := hmac.New(sha256.New, []byte(b.config.WebhookSecret))
	h.Write([]byte(timestamp + "."))
	h.Write(payload)
	expected := hex.EncodeToString(h.Sum(nil))

	if !hmac.Equal([]byte(expected), []byte(v1Sig)) {
		return fmt.Errorf("signature mismatch")
	}

	return nil
}