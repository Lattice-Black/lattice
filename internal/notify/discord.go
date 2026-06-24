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

// DiscordDispatcher sends notifications to Discord via webhooks.
type DiscordDispatcher struct {
	client *http.Client
}

// NewDiscordDispatcher creates a new Discord dispatcher.
func NewDiscordDispatcher() *DiscordDispatcher {
	return &DiscordDispatcher{
		client: &http.Client{Timeout: 30 * time.Second},
	}
}

// NewDiscordDispatcherWithClient creates a Discord dispatcher with a custom HTTP client.
func NewDiscordDispatcherWithClient(client *http.Client) *DiscordDispatcher {
	return &DiscordDispatcher{
		client: client,
	}
}

// Type returns the notification channel type.
func (d *DiscordDispatcher) Type() reducer.NotificationChannelType {
	return reducer.NotifyDiscord
}

// discordPayload represents the Discord webhook payload.
type discordPayload struct {
	Embeds []discordEmbed `json:"embeds"`
}

type discordEmbed struct {
	Title       string       `json:"title"`
	Description string       `json:"description"`
	Color       int          `json:"color"`
	Footer      discordFooter `json:"footer,omitempty"`
}

type discordFooter struct {
	Text string `json:"text"`
}

// Send sends a notification to Discord.
func (d *DiscordDispatcher) Send(ctx context.Context, n Notification, config map[string]string) error {
	webhookURL := config["webhook_url"]
	if webhookURL == "" {
		return fmt.Errorf("discord: webhook_url is required")
	}

	color := severityToDiscordColor(n.Severity)

	payload := discordPayload{
		Embeds: []discordEmbed{
			{
				Title:       n.Title,
				Description: n.Message,
				Color:       color,
				Footer: discordFooter{
					Text: "Lattice Status",
				},
			},
		},
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("discord: failed to marshal payload: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, webhookURL, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("discord: failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := d.client.Do(req)
	if err != nil {
		return fmt.Errorf("discord: failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("discord: unexpected status code: %d", resp.StatusCode)
	}

	return nil
}

// severityToDiscordColor maps severity to Discord embed colors (decimal RGB).
func severityToDiscordColor(s reducer.Severity) int {
	switch s {
	case reducer.SeverityCritical:
		return 15158332 // #E74C3C (red)
	case reducer.SeverityMajor:
		return 15105570 // #E67E22 (orange/yellow)
	case reducer.SeverityMinor:
		return 3066993 // #2ECC71 (green)
	default:
		return 9807270 // #95A5A6 (gray)
	}
}
