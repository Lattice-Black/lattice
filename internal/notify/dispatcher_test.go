package notify

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"crypto/tls"
	"encoding/hex"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"net/smtp"
	"strings"
	"testing"

	"github.com/Lattice-Black/lattice/internal/reducer"
)

func TestSlackDispatcher(t *testing.T) {
	var receivedPayload slackPayload
	var receivedContentType string

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		receivedContentType = r.Header.Get("Content-Type")
		body, _ := io.ReadAll(r.Body)
		json.Unmarshal(body, &receivedPayload)
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	dispatcher := NewSlackDispatcherWithClient(server.Client())
	config := map[string]string{"webhook_url": server.URL}

	n := Notification{
		Title:     "API is down",
		Message:   "The API server is not responding",
		Severity:  reducer.SeverityCritical,
		MonitorID: "mon-123",
	}

	err := dispatcher.Send(context.Background(), n, config)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if receivedContentType != "application/json" {
		t.Errorf("expected Content-Type application/json, got %s", receivedContentType)
	}

	if len(receivedPayload.Attachments) != 1 {
		t.Fatalf("expected 1 attachment, got %d", len(receivedPayload.Attachments))
	}

	att := receivedPayload.Attachments[0]
	if att.Title != n.Title {
		t.Errorf("expected title %q, got %q", n.Title, att.Title)
	}
	if att.Text != n.Message {
		t.Errorf("expected text %q, got %q", n.Message, att.Text)
	}
	if att.Color != "danger" {
		t.Errorf("expected color danger, got %s", att.Color)
	}
}

func TestSlackDispatcher_MissingWebhookURL(t *testing.T) {
	dispatcher := NewSlackDispatcher()
	err := dispatcher.Send(context.Background(), Notification{}, map[string]string{})
	if err == nil || !strings.Contains(err.Error(), "webhook_url is required") {
		t.Errorf("expected webhook_url error, got: %v", err)
	}
}

func TestSlackDispatcher_SeverityColors(t *testing.T) {
	tests := []struct {
		severity reducer.Severity
		color    string
	}{
		{reducer.SeverityCritical, "danger"},
		{reducer.SeverityMajor, "warning"},
		{reducer.SeverityMinor, "good"},
	}

	for _, tc := range tests {
		t.Run(string(tc.severity), func(t *testing.T) {
			color := severityToSlackColor(tc.severity)
			if color != tc.color {
				t.Errorf("expected %s, got %s", tc.color, color)
			}
		})
	}
}

func TestDiscordDispatcher(t *testing.T) {
	var receivedPayload discordPayload
	var receivedContentType string

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		receivedContentType = r.Header.Get("Content-Type")
		body, _ := io.ReadAll(r.Body)
		json.Unmarshal(body, &receivedPayload)
		w.WriteHeader(http.StatusNoContent)
	}))
	defer server.Close()

	dispatcher := NewDiscordDispatcherWithClient(server.Client())
	config := map[string]string{"webhook_url": server.URL}

	n := Notification{
		Title:     "Database recovered",
		Message:   "The database connection is restored",
		Severity:  reducer.SeverityMinor,
		MonitorID: "mon-456",
	}

	err := dispatcher.Send(context.Background(), n, config)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if receivedContentType != "application/json" {
		t.Errorf("expected Content-Type application/json, got %s", receivedContentType)
	}

	if len(receivedPayload.Embeds) != 1 {
		t.Fatalf("expected 1 embed, got %d", len(receivedPayload.Embeds))
	}

	embed := receivedPayload.Embeds[0]
	if embed.Title != n.Title {
		t.Errorf("expected title %q, got %q", n.Title, embed.Title)
	}
	if embed.Description != n.Message {
		t.Errorf("expected description %q, got %q", n.Message, embed.Description)
	}
	// Green color for minor severity
	if embed.Color != 3066993 {
		t.Errorf("expected color 3066993, got %d", embed.Color)
	}
}

func TestDiscordDispatcher_MissingWebhookURL(t *testing.T) {
	dispatcher := NewDiscordDispatcher()
	err := dispatcher.Send(context.Background(), Notification{}, map[string]string{})
	if err == nil || !strings.Contains(err.Error(), "webhook_url is required") {
		t.Errorf("expected webhook_url error, got: %v", err)
	}
}

func TestWebhookDispatcher(t *testing.T) {
	var receivedPayload webhookPayload
	var receivedContentType string

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		receivedContentType = r.Header.Get("Content-Type")
		body, _ := io.ReadAll(r.Body)
		json.Unmarshal(body, &receivedPayload)
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	dispatcher := NewWebhookDispatcherWithClient(server.Client())
	config := map[string]string{"url": server.URL}

	n := Notification{
		Title:     "Service degraded",
		Message:   "Response time is high",
		Severity:  reducer.SeverityMajor,
		MonitorID: "mon-789",
	}

	err := dispatcher.Send(context.Background(), n, config)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if receivedContentType != "application/json" {
		t.Errorf("expected Content-Type application/json, got %s", receivedContentType)
	}

	if receivedPayload.Title != n.Title {
		t.Errorf("expected title %q, got %q", n.Title, receivedPayload.Title)
	}
	if receivedPayload.Message != n.Message {
		t.Errorf("expected message %q, got %q", n.Message, receivedPayload.Message)
	}
	if receivedPayload.Severity != string(n.Severity) {
		t.Errorf("expected severity %q, got %q", n.Severity, receivedPayload.Severity)
	}
	if receivedPayload.MonitorID != n.MonitorID {
		t.Errorf("expected monitorID %q, got %q", n.MonitorID, receivedPayload.MonitorID)
	}
}

func TestWebhookDispatcher_WithSignature(t *testing.T) {
	secret := "my-secret-key"
	var receivedSignature string
	var receivedBody []byte

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		receivedSignature = r.Header.Get("X-Lattice-Signature")
		receivedBody, _ = io.ReadAll(r.Body)
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	dispatcher := NewWebhookDispatcherWithClient(server.Client())
	config := map[string]string{
		"url":    server.URL,
		"secret": secret,
	}

	n := Notification{
		Title:     "Test notification",
		Message:   "Test message",
		Severity:  reducer.SeverityMinor,
		MonitorID: "mon-test",
	}

	err := dispatcher.Send(context.Background(), n, config)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Verify signature was sent
	if receivedSignature == "" {
		t.Fatal("expected signature header, got empty")
	}

	// Verify signature format
	if !strings.HasPrefix(receivedSignature, "sha256=") {
		t.Errorf("expected signature to start with sha256=, got %s", receivedSignature)
	}

	// Verify signature is correct
	h := hmac.New(sha256.New, []byte(secret))
	h.Write(receivedBody)
	expectedSig := "sha256=" + hex.EncodeToString(h.Sum(nil))

	if receivedSignature != expectedSig {
		t.Errorf("signature mismatch: expected %s, got %s", expectedSig, receivedSignature)
	}

	// Test VerifySignature helper
	if !VerifySignature(receivedBody, secret, receivedSignature) {
		t.Error("VerifySignature returned false for valid signature")
	}

	if VerifySignature(receivedBody, "wrong-secret", receivedSignature) {
		t.Error("VerifySignature returned true for invalid secret")
	}
}

func TestWebhookDispatcher_MissingURL(t *testing.T) {
	dispatcher := NewWebhookDispatcher()
	err := dispatcher.Send(context.Background(), Notification{}, map[string]string{})
	if err == nil || !strings.Contains(err.Error(), "url is required") {
		t.Errorf("expected url error, got: %v", err)
	}
}

func TestNtfyDispatcher(t *testing.T) {
	var receivedTitle string
	var receivedPriority string
	var receivedTags string
	var receivedBody []byte

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		receivedTitle = r.Header.Get("Title")
		receivedPriority = r.Header.Get("Priority")
		receivedTags = r.Header.Get("Tags")
		receivedBody, _ = io.ReadAll(r.Body)
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	dispatcher := NewNtfyDispatcherWithClient(server.Client())
	config := map[string]string{"url": server.URL}

	n := Notification{
		Title:     "Server alert",
		Message:   "CPU usage is high",
		Severity:  reducer.SeverityCritical,
		MonitorID: "mon-cpu",
	}

	err := dispatcher.Send(context.Background(), n, config)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if receivedTitle != n.Title {
		t.Errorf("expected title %q, got %q", n.Title, receivedTitle)
	}
	if receivedPriority != "urgent" {
		t.Errorf("expected priority urgent, got %s", receivedPriority)
	}
	if !strings.Contains(receivedTags, "warning") {
		t.Errorf("expected tags to contain warning, got %s", receivedTags)
	}
	if string(receivedBody) != n.Message {
		t.Errorf("expected body %q, got %q", n.Message, string(receivedBody))
	}
}

func TestNtfyDispatcher_WithAuth(t *testing.T) {
	token := "tk_mytoken123"
	var receivedAuth string

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		receivedAuth = r.Header.Get("Authorization")
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	dispatcher := NewNtfyDispatcherWithClient(server.Client())
	config := map[string]string{
		"url":   server.URL,
		"token": token,
	}

	err := dispatcher.Send(context.Background(), Notification{Title: "Test", Message: "Test"}, config)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	expected := "Bearer " + token
	if receivedAuth != expected {
		t.Errorf("expected auth %q, got %q", expected, receivedAuth)
	}
}

func TestNtfyDispatcher_MissingURL(t *testing.T) {
	dispatcher := NewNtfyDispatcher()
	err := dispatcher.Send(context.Background(), Notification{}, map[string]string{})
	if err == nil || !strings.Contains(err.Error(), "url is required") {
		t.Errorf("expected url error, got: %v", err)
	}
}

func TestNtfyDispatcher_SeverityPriority(t *testing.T) {
	tests := []struct {
		severity reducer.Severity
		priority string
	}{
		{reducer.SeverityCritical, "urgent"},
		{reducer.SeverityMajor, "high"},
		{reducer.SeverityMinor, "default"},
	}

	for _, tc := range tests {
		t.Run(string(tc.severity), func(t *testing.T) {
			priority := severityToNtfyPriority(tc.severity)
			if priority != tc.priority {
				t.Errorf("expected %s, got %s", tc.priority, priority)
			}
		})
	}
}

func TestRegistry_Dispatch(t *testing.T) {
	state := &reducer.State{
		NotificationChannels: map[string]reducer.NotificationChannel{
			"slack-1": {
				ID:      "slack-1",
				Type:    reducer.NotifySlack,
				Name:    "Slack Channel",
				Config:  map[string]string{},
				Enabled: true,
			},
			"discord-1": {
				ID:      "discord-1",
				Type:    reducer.NotifyDiscord,
				Name:    "Discord Channel",
				Config:  map[string]string{},
				Enabled: true,
			},
			"disabled-1": {
				ID:      "disabled-1",
				Type:    reducer.NotifySlack,
				Name:    "Disabled Channel",
				Config:  map[string]string{},
				Enabled: false,
			},
		},
	}

	registry := NewRegistry(state)

	// Create mock dispatchers that track calls
	slackCalled := false
	discordCalled := false

	mockSlack := &mockDispatcher{
		dispatcherType: reducer.NotifySlack,
		sendFunc: func(ctx context.Context, n Notification, config map[string]string) error {
			slackCalled = true
			return nil
		},
	}

	mockDiscord := &mockDispatcher{
		dispatcherType: reducer.NotifyDiscord,
		sendFunc: func(ctx context.Context, n Notification, config map[string]string) error {
			discordCalled = true
			return nil
		},
	}

	registry.Register(mockSlack)
	registry.Register(mockDiscord)

	// Test dispatching to Slack channel
	err := registry.Dispatch(context.Background(), "slack-1", Notification{Title: "Test"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !slackCalled {
		t.Error("expected slack dispatcher to be called")
	}

	// Test dispatching to Discord channel
	err = registry.Dispatch(context.Background(), "discord-1", Notification{Title: "Test"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !discordCalled {
		t.Error("expected discord dispatcher to be called")
	}

	// Test dispatching to disabled channel (should silently skip)
	slackCalled = false
	err = registry.Dispatch(context.Background(), "disabled-1", Notification{Title: "Test"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if slackCalled {
		t.Error("expected disabled channel to be skipped")
	}

	// Test dispatching to non-existent channel
	err = registry.Dispatch(context.Background(), "nonexistent", Notification{Title: "Test"})
	if err == nil || !strings.Contains(err.Error(), "not found") {
		t.Errorf("expected not found error, got: %v", err)
	}
}

func TestRegistry_Handle(t *testing.T) {
	state := &reducer.State{
		NotificationChannels: map[string]reducer.NotificationChannel{
			"slack-1": {
				ID:      "slack-1",
				Type:    reducer.NotifySlack,
				Name:    "Slack",
				Config:  map[string]string{},
				Enabled: true,
			},
		},
	}

	registry := NewRegistry(state)

	var capturedNotification Notification
	mockSlack := &mockDispatcher{
		dispatcherType: reducer.NotifySlack,
		sendFunc: func(ctx context.Context, n Notification, config map[string]string) error {
			capturedNotification = n
			return nil
		},
	}
	registry.Register(mockSlack)

	effect := reducer.SendNotification{
		ChannelID: "slack-1",
		Title:     "Server down",
		Message:   "The web server is not responding",
		Severity:  reducer.SeverityCritical,
		MonitorID: "mon-web",
	}

	err := registry.Handle(context.Background(), effect)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if capturedNotification.Title != effect.Title {
		t.Errorf("expected title %q, got %q", effect.Title, capturedNotification.Title)
	}
	if capturedNotification.Message != effect.Message {
		t.Errorf("expected message %q, got %q", effect.Message, capturedNotification.Message)
	}
	if capturedNotification.Severity != effect.Severity {
		t.Errorf("expected severity %v, got %v", effect.Severity, capturedNotification.Severity)
	}
	if capturedNotification.MonitorID != effect.MonitorID {
		t.Errorf("expected monitorID %q, got %q", effect.MonitorID, capturedNotification.MonitorID)
	}
}

func TestRegistry_Handle_IgnoresOtherEffects(t *testing.T) {
	state := &reducer.State{
		NotificationChannels: map[string]reducer.NotificationChannel{},
	}

	registry := NewRegistry(state)

	// PersistState should be ignored
	err := registry.Handle(context.Background(), reducer.PersistState{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestDispatcherTypes(t *testing.T) {
	tests := []struct {
		dispatcher Dispatcher
		expected   reducer.NotificationChannelType
	}{
		{NewSlackDispatcher(), reducer.NotifySlack},
		{NewDiscordDispatcher(), reducer.NotifyDiscord},
		{NewEmailDispatcher(), reducer.NotifyEmail},
		{NewWebhookDispatcher(), reducer.NotifyWebhook},
		{NewNtfyDispatcher(), reducer.NotifyNtfy},
	}

	for _, tc := range tests {
		t.Run(string(tc.expected), func(t *testing.T) {
			if tc.dispatcher.Type() != tc.expected {
				t.Errorf("expected type %s, got %s", tc.expected, tc.dispatcher.Type())
			}
		})
	}
}

// mockDispatcher is a test helper for mocking dispatchers.
type mockDispatcher struct {
	dispatcherType reducer.NotificationChannelType
	sendFunc       func(ctx context.Context, n Notification, config map[string]string) error
}

func (d *mockDispatcher) Type() reducer.NotificationChannelType {
	return d.dispatcherType
}

func (d *mockDispatcher) Send(ctx context.Context, n Notification, config map[string]string) error {
	if d.sendFunc != nil {
		return d.sendFunc(ctx, n, config)
	}
	return nil
}

// mockSMTPClient is a test helper for mocking SMTP.
type mockSMTPClient struct {
	authCalled   bool
	mailFrom     string
	rcptTo       []string
	dataWritten  []byte
	quitCalled   bool
	closeCalled  bool
	startTLSErr  error
	authErr      error
	mailErr      error
	rcptErr      error
	dataErr      error
	writeErr     error
	closeDataErr error
	quitErr      error
}

func (c *mockSMTPClient) Auth(a smtp.Auth) error {
	c.authCalled = true
	return c.authErr
}

func (c *mockSMTPClient) Mail(from string) error {
	c.mailFrom = from
	return c.mailErr
}

func (c *mockSMTPClient) Rcpt(to string) error {
	c.rcptTo = append(c.rcptTo, to)
	return c.rcptErr
}

func (c *mockSMTPClient) Data() (WriteCloser, error) {
	if c.dataErr != nil {
		return nil, c.dataErr
	}
	return &mockWriteCloser{client: c}, nil
}

func (c *mockSMTPClient) Quit() error {
	c.quitCalled = true
	return c.quitErr
}

func (c *mockSMTPClient) Close() error {
	c.closeCalled = true
	return nil
}

func (c *mockSMTPClient) StartTLS(config *tls.Config) error {
	return c.startTLSErr
}

type mockWriteCloser struct {
	client *mockSMTPClient
}

func (w *mockWriteCloser) Write(p []byte) (int, error) {
	if w.client.writeErr != nil {
		return 0, w.client.writeErr
	}
	w.client.dataWritten = append(w.client.dataWritten, p...)
	return len(p), nil
}

func (w *mockWriteCloser) Close() error {
	return w.client.closeDataErr
}

func TestEmailDispatcher(t *testing.T) {
	mockClient := &mockSMTPClient{}

	dispatcher := NewEmailDispatcherWithDialer(func(addr string, tlsConfig *tls.Config) (smtpClient, error) {
		return mockClient, nil
	})

	config := map[string]string{
		"smtp_host": "smtp.example.com",
		"smtp_port": "587",
		"smtp_user": "user@example.com",
		"smtp_pass": "password",
		"smtp_from": "alerts@example.com",
		"to":        "admin@example.com, ops@example.com",
	}

	n := Notification{
		Title:     "Service down",
		Message:   "The API is not responding",
		Severity:  reducer.SeverityCritical,
		MonitorID: "mon-api",
	}

	err := dispatcher.Send(context.Background(), n, config)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if !mockClient.authCalled {
		t.Error("expected Auth to be called")
	}

	if mockClient.mailFrom != "alerts@example.com" {
		t.Errorf("expected from %q, got %q", "alerts@example.com", mockClient.mailFrom)
	}

	if len(mockClient.rcptTo) != 2 {
		t.Errorf("expected 2 recipients, got %d", len(mockClient.rcptTo))
	}

	if !mockClient.quitCalled {
		t.Error("expected Quit to be called")
	}

	// Check email content
	emailStr := string(mockClient.dataWritten)
	if !strings.Contains(emailStr, "Subject: [CRITICAL] Service down") {
		t.Errorf("expected subject line with severity, got: %s", emailStr)
	}
	if !strings.Contains(emailStr, "The API is not responding") {
		t.Error("expected message body in email")
	}
}

func TestEmailDispatcher_MissingConfig(t *testing.T) {
	dispatcher := NewEmailDispatcher()

	tests := []struct {
		name   string
		config map[string]string
		errMsg string
	}{
		{
			name:   "missing smtp_host",
			config: map[string]string{},
			errMsg: "smtp_host is required",
		},
		{
			name:   "missing smtp_from",
			config: map[string]string{"smtp_host": "smtp.example.com"},
			errMsg: "smtp_from is required",
		},
		{
			name: "missing to",
			config: map[string]string{
				"smtp_host": "smtp.example.com",
				"smtp_from": "alerts@example.com",
			},
			errMsg: "to is required",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			err := dispatcher.Send(context.Background(), Notification{}, tc.config)
			if err == nil || !strings.Contains(err.Error(), tc.errMsg) {
				t.Errorf("expected error containing %q, got: %v", tc.errMsg, err)
			}
		})
	}
}

func TestParseRecipients(t *testing.T) {
	tests := []struct {
		input    string
		expected []string
	}{
		{"admin@example.com", []string{"admin@example.com"}},
		{"a@example.com, b@example.com", []string{"a@example.com", "b@example.com"}},
		{"a@example.com,b@example.com,c@example.com", []string{"a@example.com", "b@example.com", "c@example.com"}},
		{"  a@example.com  ,  b@example.com  ", []string{"a@example.com", "b@example.com"}},
		{"", nil},
		{"  ,  ,  ", nil},
	}

	for _, tc := range tests {
		result := parseRecipients(tc.input)
		if len(result) != len(tc.expected) {
			t.Errorf("input %q: expected %d recipients, got %d", tc.input, len(tc.expected), len(result))
			continue
		}
		for i, r := range result {
			if r != tc.expected[i] {
				t.Errorf("input %q: expected recipient %d to be %q, got %q", tc.input, i, tc.expected[i], r)
			}
		}
	}
}

func TestServerErrors(t *testing.T) {
	// Test that dispatchers handle server errors correctly
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer server.Close()

	n := Notification{Title: "Test", Message: "Test"}

	tests := []struct {
		name       string
		dispatcher Dispatcher
		config     map[string]string
	}{
		{
			name:       "slack",
			dispatcher: NewSlackDispatcherWithClient(server.Client()),
			config:     map[string]string{"webhook_url": server.URL},
		},
		{
			name:       "discord",
			dispatcher: NewDiscordDispatcherWithClient(server.Client()),
			config:     map[string]string{"webhook_url": server.URL},
		},
		{
			name:       "webhook",
			dispatcher: NewWebhookDispatcherWithClient(server.Client()),
			config:     map[string]string{"url": server.URL},
		},
		{
			name:       "ntfy",
			dispatcher: NewNtfyDispatcherWithClient(server.Client()),
			config:     map[string]string{"url": server.URL},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			err := tc.dispatcher.Send(context.Background(), n, tc.config)
			if err == nil {
				t.Error("expected error for 500 response")
			}
			if !strings.Contains(err.Error(), "500") {
				t.Errorf("expected error to mention status code, got: %v", err)
			}
		})
	}
}
