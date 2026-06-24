package notify

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/Lattice-Black/lattice/internal/reducer"
)

// SlackDispatcher sends notifications to Slack via incoming webhooks.
type SlackDispatcher struct {
	client *http.Client
}

// NewSlackDispatcher creates a new Slack dispatcher.
func NewSlackDispatcher() *SlackDispatcher {
	return &SlackDispatcher{
		client: &http.Client{Timeout: 30 * time.Second},
	}
}

// NewSlackDispatcherWithClient creates a Slack dispatcher with a custom HTTP client.
func NewSlackDispatcherWithClient(client *http.Client) *SlackDispatcher {
	return &SlackDispatcher{
		client: client,
	}
}

// Type returns the notification channel type.
func (d *SlackDispatcher) Type() reducer.NotificationChannelType {
	return reducer.NotifySlack
}

// slackPayload represents the Slack webhook payload.
type slackPayload struct {
	Attachments []slackAttachment `json:"attachments"`
}

type slackAttachment struct {
	Color  string `json:"color"`
	Title  string `json:"title"`
	Text   string `json:"text"`
	Footer string `json:"footer,omitempty"`
}

// Send sends a notification to Slack.
func (d *SlackDispatcher) Send(ctx context.Context, n Notification, config map[string]string) error {
	webhookURL := config["webhook_url"]
	if webhookURL == "" {
		return fmt.Errorf("slack: webhook_url is required")
	}

	color := severityToSlackColor(n.Severity)

	payload := slackPayload{
		Attachments: []slackAttachment{
			{
				Color:  color,
				Title:  n.Title,
				Text:   n.Message,
				Footer: "Lattice Status",
			},
		},
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("slack: failed to marshal payload: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, webhookURL, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("slack: failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := d.client.Do(req)
	if err != nil {
		return fmt.Errorf("slack: failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("slack: unexpected status code: %d", resp.StatusCode)
	}

	return nil
}

// severityToSlackColor maps severity to Slack attachment colors.
func severityToSlackColor(s reducer.Severity) string {
	switch s {
	case reducer.SeverityCritical:
		return "danger" // red
	case reducer.SeverityMajor:
		return "warning" // yellow
	case reducer.SeverityMinor:
		return "good" // green
	default:
		return "#808080" // gray for unknown
	}
}
