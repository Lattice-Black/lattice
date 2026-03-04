package notify

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/Lattice-Black/lattice/internal/reducer"
)

// WebhookDispatcher sends notifications to generic webhooks.
type WebhookDispatcher struct {
	client *http.Client
}

// NewWebhookDispatcher creates a new webhook dispatcher.
func NewWebhookDispatcher() *WebhookDispatcher {
	return &WebhookDispatcher{
		client: http.DefaultClient,
	}
}

// NewWebhookDispatcherWithClient creates a webhook dispatcher with a custom HTTP client.
func NewWebhookDispatcherWithClient(client *http.Client) *WebhookDispatcher {
	return &WebhookDispatcher{
		client: client,
	}
}

// Type returns the notification channel type.
func (d *WebhookDispatcher) Type() reducer.NotificationChannelType {
	return reducer.NotifyWebhook
}

// webhookPayload represents the JSON payload sent to webhooks.
type webhookPayload struct {
	Title     string `json:"title"`
	Message   string `json:"message"`
	Severity  string `json:"severity"`
	MonitorID string `json:"monitor_id"`
}

// Send sends a notification to a webhook endpoint.
func (d *WebhookDispatcher) Send(ctx context.Context, n Notification, config map[string]string) error {
	url := config["url"]
	if url == "" {
		return fmt.Errorf("webhook: url is required")
	}

	secret := config["secret"]

	payload := webhookPayload{
		Title:     n.Title,
		Message:   n.Message,
		Severity:  string(n.Severity),
		MonitorID: n.MonitorID,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("webhook: failed to marshal payload: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("webhook: failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	// Add HMAC signature if secret is provided
	if secret != "" {
		signature := computeHMACSHA256(body, secret)
		req.Header.Set("X-Lattice-Signature", signature)
	}

	resp, err := d.client.Do(req)
	if err != nil {
		return fmt.Errorf("webhook: failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("webhook: unexpected status code: %d", resp.StatusCode)
	}

	return nil
}

// computeHMACSHA256 computes an HMAC-SHA256 signature for the payload.
func computeHMACSHA256(payload []byte, secret string) string {
	h := hmac.New(sha256.New, []byte(secret))
	h.Write(payload)
	return "sha256=" + hex.EncodeToString(h.Sum(nil))
}

// VerifySignature verifies an HMAC-SHA256 signature.
// This is useful for webhook receivers validating incoming requests.
func VerifySignature(payload []byte, secret, signature string) bool {
	expected := computeHMACSHA256(payload, secret)
	return hmac.Equal([]byte(expected), []byte(signature))
}
