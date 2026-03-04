package config

import (
	"fmt"
	"os"
	"time"

	"gopkg.in/yaml.v3"
)

// Config holds the complete Lattice configuration.
type Config struct {
	Server        ServerConfig         `yaml:"server"`
	Database      DatabaseConfig       `yaml:"database"`
	Monitors      []MonitorConfig      `yaml:"monitors"`
	Notifications []NotificationConfig `yaml:"notifications"`
}

// ServerConfig holds HTTP server configuration.
type ServerConfig struct {
	Port int    `yaml:"port"`
	Host string `yaml:"host"`
}

// DatabaseConfig holds SQLite database configuration.
type DatabaseConfig struct {
	Path          string `yaml:"path"`
	RetentionDays int    `yaml:"retentionDays"`
}

// MonitorConfig defines a service to monitor.
type MonitorConfig struct {
	Name           string `yaml:"name"`
	URL            string `yaml:"url"`
	Type           string `yaml:"type"`
	Interval       string `yaml:"interval"`
	Timeout        string `yaml:"timeout"`
	ExpectedStatus int    `yaml:"expectedStatus"`
	Group          string `yaml:"group"`
	Enabled        *bool  `yaml:"enabled"`
}

// NotificationConfig defines a notification channel.
type NotificationConfig struct {
	Type    string            `yaml:"type"`
	Name    string            `yaml:"name"`
	Enabled *bool             `yaml:"enabled"`
	Config  map[string]string `yaml:"config"`
}

// Load reads and parses a YAML configuration file.
func Load(path string) (*Config, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read config file: %w", err)
	}

	var cfg Config
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return nil, fmt.Errorf("failed to parse config file: %w", err)
	}

	// Apply defaults
	cfg.applyDefaults()

	// Validate
	if err := cfg.validate(); err != nil {
		return nil, err
	}

	return &cfg, nil
}

// LoadFromBytes parses YAML configuration from bytes.
func LoadFromBytes(data []byte) (*Config, error) {
	var cfg Config
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return nil, fmt.Errorf("failed to parse config: %w", err)
	}

	cfg.applyDefaults()

	if err := cfg.validate(); err != nil {
		return nil, err
	}

	return &cfg, nil
}

func (c *Config) applyDefaults() {
	// Server defaults
	if c.Server.Port == 0 {
		c.Server.Port = 8080
	}
	if c.Server.Host == "" {
		c.Server.Host = "0.0.0.0"
	}

	// Database defaults
	if c.Database.Path == "" {
		c.Database.Path = "./lattice.db"
	}
	if c.Database.RetentionDays == 0 {
		c.Database.RetentionDays = 90
	}

	// Monitor defaults
	for i := range c.Monitors {
		if c.Monitors[i].Interval == "" {
			c.Monitors[i].Interval = "60s"
		}
		if c.Monitors[i].Timeout == "" {
			c.Monitors[i].Timeout = "10s"
		}
		if c.Monitors[i].ExpectedStatus == 0 && (c.Monitors[i].Type == "http" || c.Monitors[i].Type == "https") {
			c.Monitors[i].ExpectedStatus = 200
		}
		if c.Monitors[i].Enabled == nil {
			enabled := true
			c.Monitors[i].Enabled = &enabled
		}
	}

	// Notification defaults
	for i := range c.Notifications {
		if c.Notifications[i].Enabled == nil {
			enabled := true
			c.Notifications[i].Enabled = &enabled
		}
		if c.Notifications[i].Config == nil {
			c.Notifications[i].Config = make(map[string]string)
		}
	}
}

func (c *Config) validate() error {
	// Validate server
	if c.Server.Port < 1 || c.Server.Port > 65535 {
		return fmt.Errorf("invalid server port: %d", c.Server.Port)
	}

	// Validate monitors
	for i, m := range c.Monitors {
		if m.Name == "" {
			return fmt.Errorf("monitor %d: name is required", i)
		}
		if m.URL == "" {
			return fmt.Errorf("monitor %d (%s): url is required", i, m.Name)
		}
		if m.Type == "" {
			return fmt.Errorf("monitor %d (%s): type is required", i, m.Name)
		}

		switch m.Type {
		case "http", "https", "tcp", "dns", "icmp":
			// valid
		default:
			return fmt.Errorf("monitor %d (%s): invalid type %q", i, m.Name, m.Type)
		}

		if _, err := time.ParseDuration(m.Interval); err != nil {
			return fmt.Errorf("monitor %d (%s): invalid interval %q: %w", i, m.Name, m.Interval, err)
		}

		if _, err := time.ParseDuration(m.Timeout); err != nil {
			return fmt.Errorf("monitor %d (%s): invalid timeout %q: %w", i, m.Name, m.Timeout, err)
		}
	}

	// Validate notifications
	for i, n := range c.Notifications {
		if n.Name == "" {
			return fmt.Errorf("notification %d: name is required", i)
		}
		if n.Type == "" {
			return fmt.Errorf("notification %d (%s): type is required", i, n.Name)
		}

		switch n.Type {
		case "slack", "discord", "email", "webhook", "ntfy":
			// valid
		default:
			return fmt.Errorf("notification %d (%s): invalid type %q", i, n.Name, n.Type)
		}
	}

	return nil
}

// ParsedInterval returns the parsed interval duration for a monitor.
func (m *MonitorConfig) ParsedInterval() time.Duration {
	d, _ := time.ParseDuration(m.Interval)
	return d
}

// ParsedTimeout returns the parsed timeout duration for a monitor.
func (m *MonitorConfig) ParsedTimeout() time.Duration {
	d, _ := time.ParseDuration(m.Timeout)
	return d
}

// IsEnabled returns whether the monitor is enabled (defaults to true).
func (m *MonitorConfig) IsEnabled() bool {
	if m.Enabled == nil {
		return true
	}
	return *m.Enabled
}

// IsEnabled returns whether the notification is enabled (defaults to true).
func (n *NotificationConfig) IsEnabled() bool {
	if n.Enabled == nil {
		return true
	}
	return *n.Enabled
}
