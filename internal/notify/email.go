package notify

import (
	"context"
	"crypto/tls"
	"fmt"
	"net/smtp"
	"strconv"
	"strings"

	"github.com/Lattice-Black/lattice/internal/reducer"
)

// EmailDispatcher sends notifications via SMTP email.
type EmailDispatcher struct {
	// dialFunc allows injecting a custom dialer for testing
	dialFunc func(addr string, tlsConfig *tls.Config) (smtpClient, error)
}

// smtpClient is an interface for SMTP operations (for testing).
type smtpClient interface {
	Auth(a smtp.Auth) error
	Mail(from string) error
	Rcpt(to string) error
	Data() (WriteCloser, error)
	Quit() error
	Close() error
	StartTLS(config *tls.Config) error
}

// WriteCloser is an interface for the data writer.
type WriteCloser interface {
	Write(p []byte) (n int, err error)
	Close() error
}

// realSMTPClient wraps *smtp.Client to implement smtpClient.
type realSMTPClient struct {
	*smtp.Client
}

func (c *realSMTPClient) Data() (WriteCloser, error) {
	return c.Client.Data()
}

// NewEmailDispatcher creates a new email dispatcher.
func NewEmailDispatcher() *EmailDispatcher {
	return &EmailDispatcher{
		dialFunc: defaultDial,
	}
}

// NewEmailDispatcherWithDialer creates an email dispatcher with a custom dialer.
func NewEmailDispatcherWithDialer(dialFunc func(addr string, tlsConfig *tls.Config) (smtpClient, error)) *EmailDispatcher {
	return &EmailDispatcher{
		dialFunc: dialFunc,
	}
}

// defaultDial establishes a connection to the SMTP server.
func defaultDial(addr string, tlsConfig *tls.Config) (smtpClient, error) {
	// Try TLS connection first
	conn, err := tls.Dial("tcp", addr, tlsConfig)
	if err == nil {
		client, err := smtp.NewClient(conn, strings.Split(addr, ":")[0])
		if err != nil {
			conn.Close()
			return nil, err
		}
		return &realSMTPClient{client}, nil
	}

	// Fall back to plain connection with STARTTLS
	client, err := smtp.Dial(addr)
	if err != nil {
		return nil, err
	}

	// Try STARTTLS if available
	if ok, _ := client.Extension("STARTTLS"); ok {
		if err := client.StartTLS(tlsConfig); err != nil {
			client.Close()
			return nil, err
		}
	}

	return &realSMTPClient{client}, nil
}

// Type returns the notification channel type.
func (d *EmailDispatcher) Type() reducer.NotificationChannelType {
	return reducer.NotifyEmail
}

// Send sends a notification via email.
func (d *EmailDispatcher) Send(ctx context.Context, n Notification, config map[string]string) error {
	host := config["smtp_host"]
	if host == "" {
		return fmt.Errorf("email: smtp_host is required")
	}

	portStr := config["smtp_port"]
	if portStr == "" {
		portStr = "587" // default to submission port
	}
	port, err := strconv.Atoi(portStr)
	if err != nil {
		return fmt.Errorf("email: invalid smtp_port: %w", err)
	}

	from := config["smtp_from"]
	if from == "" {
		return fmt.Errorf("email: smtp_from is required")
	}

	toList := config["to"]
	if toList == "" {
		return fmt.Errorf("email: to is required")
	}
	recipients := parseRecipients(toList)
	if len(recipients) == 0 {
		return fmt.Errorf("email: no valid recipients")
	}

	user := config["smtp_user"]
	pass := config["smtp_pass"]

	addr := fmt.Sprintf("%s:%d", host, port)

	tlsConfig := &tls.Config{
		ServerName: host,
	}

	client, err := d.dialFunc(addr, tlsConfig)
	if err != nil {
		return fmt.Errorf("email: failed to connect: %w", err)
	}
	defer client.Close()

	// Authenticate if credentials are provided
	if user != "" && pass != "" {
		auth := smtp.PlainAuth("", user, pass, host)
		if err := client.Auth(auth); err != nil {
			return fmt.Errorf("email: authentication failed: %w", err)
		}
	}

	// Set sender
	if err := client.Mail(from); err != nil {
		return fmt.Errorf("email: failed to set sender: %w", err)
	}

	// Set recipients
	for _, rcpt := range recipients {
		if err := client.Rcpt(rcpt); err != nil {
			return fmt.Errorf("email: failed to add recipient %q: %w", rcpt, err)
		}
	}

	// Write message
	w, err := client.Data()
	if err != nil {
		return fmt.Errorf("email: failed to open data writer: %w", err)
	}

	subject := n.Title
	body := n.Message
	severityLabel := strings.ToUpper(string(n.Severity))

	msg := fmt.Sprintf("From: %s\r\n"+
		"To: %s\r\n"+
		"Subject: [%s] %s\r\n"+
		"MIME-Version: 1.0\r\n"+
		"Content-Type: text/plain; charset=utf-8\r\n"+
		"\r\n"+
		"%s\r\n"+
		"\r\n"+
		"--\r\n"+
		"Lattice Status\r\n",
		from,
		strings.Join(recipients, ", "),
		severityLabel,
		subject,
		body,
	)

	if _, err := w.Write([]byte(msg)); err != nil {
		return fmt.Errorf("email: failed to write message: %w", err)
	}

	if err := w.Close(); err != nil {
		return fmt.Errorf("email: failed to close data writer: %w", err)
	}

	if err := client.Quit(); err != nil {
		// Don't fail on quit errors, message was sent
		return nil
	}

	return nil
}

// parseRecipients splits a comma-separated list of email addresses.
func parseRecipients(s string) []string {
	var result []string
	for _, r := range strings.Split(s, ",") {
		r = strings.TrimSpace(r)
		if r != "" {
			result = append(result, r)
		}
	}
	return result
}
