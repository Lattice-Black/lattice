package notify

import (
	"bytes"
	"context"
	"fmt"
	"net/http"

	"github.com/Lattice-Black/lattice/internal/reducer"
)

// NtfyDispatcher sends notifications via ntfy (https://ntfy.sh).
type NtfyDispatcher struct {
	client *http.Client
}

// NewNtfyDispatcher creates a new ntfy dispatcher.
func NewNtfyDispatcher() *NtfyDispatcher {
	return &NtfyDispatcher{
		client: http.DefaultClient,
	}
}

// NewNtfyDispatcherWithClient creates an ntfy dispatcher with a custom HTTP client.
func NewNtfyDispatcherWithClient(client *http.Client) *NtfyDispatcher {
	return &NtfyDispatcher{
		client: client,
	}
}

// Type returns the notification channel type.
func (d *NtfyDispatcher) Type() reducer.NotificationChannelType {
	return reducer.NotifyNtfy
}

// Send sends a notification via ntfy.
func (d *NtfyDispatcher) Send(ctx context.Context, n Notification, config map[string]string) error {
	url := config["url"]
	if url == "" {
		return fmt.Errorf("ntfy: url is required")
	}

	token := config["token"]
	priority := severityToNtfyPriority(n.Severity)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader([]byte(n.Message)))
	if err != nil {
		return fmt.Errorf("ntfy: failed to create request: %w", err)
	}

	req.Header.Set("Title", n.Title)
	req.Header.Set("Priority", priority)
	req.Header.Set("Tags", severityToNtfyTags(n.Severity))

	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}

	resp, err := d.client.Do(req)
	if err != nil {
		return fmt.Errorf("ntfy: failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("ntfy: unexpected status code: %d", resp.StatusCode)
	}

	return nil
}

// severityToNtfyPriority maps severity to ntfy priority levels.
// ntfy priorities: min, low, default, high, urgent (or 1-5)
func severityToNtfyPriority(s reducer.Severity) string {
	switch s {
	case reducer.SeverityCritical:
		return "urgent" // 5
	case reducer.SeverityMajor:
		return "high" // 4
	case reducer.SeverityMinor:
		return "default" // 3
	default:
		return "default"
	}
}

// severityToNtfyTags returns appropriate emoji tags for the severity.
func severityToNtfyTags(s reducer.Severity) string {
	switch s {
	case reducer.SeverityCritical:
		return "rotating_light,warning"
	case reducer.SeverityMajor:
		return "warning"
	case reducer.SeverityMinor:
		return "white_check_mark"
	default:
		return "information_source"
	}
}
