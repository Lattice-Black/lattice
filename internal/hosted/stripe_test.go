package hosted

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestStripeWebhookVerification(t *testing.T) {
	secret := "whsec_test_secret"

	s := newTestStore(t)
	billing := NewBilling(StripeConfig{
		SecretKey:     "sk_test_fake",
		WebhookSecret: secret,
		PriceID:       "price_fake",
	}, s, nil)

	// Build a valid Stripe webhook payload
	payload := map[string]interface{}{
		"type": "checkout.session.completed",
		"data": map[string]interface{}{
			"object": map[string]interface{}{
				"customer":     "cus_test123",
				"subscription": "sub_test123",
				"metadata": map[string]interface{}{
					"tenant_id": "tnt_test123",
				},
			},
		},
	}
	payloadBytes, _ := json.Marshal(payload)

	timestamp := time.Now().Unix()
	sig := computeStripeSignature(secret, timestamp, payloadBytes)
	signature := "t=" + intToStr(timestamp) + ",v1=" + sig

	// Create a tenant first
	now := time.Now().UTC()
	tenant := Tenant{
		ID:           "tnt_test123",
		Email:        "test@example.com",
		Slug:         "test-slug",
		APIKey:       "lat_abcd1234",
		PasswordHash: "$2a$10$somehash",
		Status:       TenantTrial,
		CreatedAt:    now,
		UpdatedAt:    now,
	}
	require.NoError(t, s.CreateTenant(tenant))

	// Handle the webhook
	err := billing.HandleWebhook(payloadBytes, signature)
	require.NoError(t, err)

	// Verify tenant was activated
	got, err := s.GetTenant("tnt_test123")
	require.NoError(t, err)
	assert.Equal(t, TenantActive, got.Status)
	assert.Equal(t, "cus_test123", got.StripeCustomerID)
	assert.Equal(t, "sub_test123", got.StripeSubID)
	assert.Nil(t, got.TrialEndsAt)
}

func TestStripeWebhook_BadSignature(t *testing.T) {
	s := newTestStore(t)
	billing := NewBilling(StripeConfig{
		SecretKey:     "sk_test_fake",
		WebhookSecret: "whsec_test_secret",
	}, s, nil)

	payload := []byte(`{"type":"test","data":{}}`)
	err := billing.HandleWebhook(payload, "t=123,v1=invalid")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "signature")
}

func TestStripeWebhook_NoSignature(t *testing.T) {
	s := newTestStore(t)
	billing := NewBilling(StripeConfig{
		SecretKey:     "sk_test_fake",
		WebhookSecret: "whsec_test_secret",
	}, s, nil)

	payload := []byte(`{"type":"test","data":{}}`)
	err := billing.HandleWebhook(payload, "")
	assert.Error(t, err)
}

func TestStripeWebhook_UnhandledEventType(t *testing.T) {
	secret := "whsec_test_secret"
	s := newTestStore(t)
	billing := NewBilling(StripeConfig{
		SecretKey:     "sk_test_fake",
		WebhookSecret: secret,
	}, s, nil)

	payload := []byte(`{"type":"some.unknown.event","data":{"object":{}}}`)
	timestamp := time.Now().Unix()
	sig := computeStripeSignature(secret, timestamp, payload)
	signature := "t=" + intToStr(timestamp) + ",v1=" + sig

	// Should not error, just log and return nil
	err := billing.HandleWebhook(payload, signature)
	assert.NoError(t, err)
}

// computeStripeSignature computes the HMAC-SHA256 signature for a Stripe webhook.
func computeStripeSignature(secret string, timestamp int64, payload []byte) string {
	h := hmac.New(sha256.New, []byte(secret))
	h.Write([]byte(intToStr(timestamp) + "."))
	h.Write(payload)
	return hex.EncodeToString(h.Sum(nil))
}

func intToStr(n int64) string {
	if n == 0 {
		return "0"
	}
	var buf [20]byte
	i := len(buf)
	neg := n < 0
	if neg {
		n = -n
	}
	for n > 0 {
		i--
		buf[i] = byte('0' + n%10)
		n /= 10
	}
	if neg {
		i--
		buf[i] = '-'
	}
	return string(buf[i:])
}

func TestHandleStripeWebhook_NotConfigured(t *testing.T) {
	// When billing is nil, the webhook endpoint should return 503
	cfg := Config{
		ListenAddr:  "",
		DBPath:      ":memory:",
		BaseDomain:  "test.example",
		AdminAPIKey: "admin-key",
	}

	server, err := NewServer(cfg)
	require.NoError(t, err)
	defer server.Close()

	req := httptest.NewRequest(http.MethodPost, "/api/hosted/stripe/webhook", nil)
	w := httptest.NewRecorder()
	server.Handler().ServeHTTP(w, req)

	assert.Equal(t, http.StatusServiceUnavailable, w.Code)
}