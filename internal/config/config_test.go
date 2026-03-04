package config

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestLoadFromBytes(t *testing.T) {
	yaml := `
server:
  port: 9000
  host: "127.0.0.1"

database:
  path: "/var/lib/lattice/data.db"
  retentionDays: 30

monitors:
  - name: "API Server"
    url: "https://api.example.com/health"
    type: "https"
    interval: "30s"
    timeout: "5s"
    expectedStatus: 200
    group: "production"

  - name: "Database"
    url: "tcp://db.example.com:5432"
    type: "tcp"
    interval: "1m"
    timeout: "10s"

notifications:
  - name: "Slack Alerts"
    type: "slack"
    config:
      webhook_url: "https://hooks.slack.com/xxx"
`

	cfg, err := LoadFromBytes([]byte(yaml))
	require.NoError(t, err)

	// Server
	assert.Equal(t, 9000, cfg.Server.Port)
	assert.Equal(t, "127.0.0.1", cfg.Server.Host)

	// Database
	assert.Equal(t, "/var/lib/lattice/data.db", cfg.Database.Path)
	assert.Equal(t, 30, cfg.Database.RetentionDays)

	// Monitors
	require.Len(t, cfg.Monitors, 2)

	assert.Equal(t, "API Server", cfg.Monitors[0].Name)
	assert.Equal(t, "https://api.example.com/health", cfg.Monitors[0].URL)
	assert.Equal(t, "https", cfg.Monitors[0].Type)
	assert.Equal(t, 30*time.Second, cfg.Monitors[0].ParsedInterval())
	assert.Equal(t, 5*time.Second, cfg.Monitors[0].ParsedTimeout())
	assert.Equal(t, 200, cfg.Monitors[0].ExpectedStatus)
	assert.Equal(t, "production", cfg.Monitors[0].Group)
	assert.True(t, cfg.Monitors[0].IsEnabled())

	assert.Equal(t, "Database", cfg.Monitors[1].Name)
	assert.Equal(t, "tcp", cfg.Monitors[1].Type)

	// Notifications
	require.Len(t, cfg.Notifications, 1)
	assert.Equal(t, "Slack Alerts", cfg.Notifications[0].Name)
	assert.Equal(t, "slack", cfg.Notifications[0].Type)
	assert.Equal(t, "https://hooks.slack.com/xxx", cfg.Notifications[0].Config["webhook_url"])
	assert.True(t, cfg.Notifications[0].IsEnabled())
}

func TestLoadFromBytesDefaults(t *testing.T) {
	yaml := `
monitors:
  - name: "API"
    url: "https://api.example.com"
    type: "https"
`

	cfg, err := LoadFromBytes([]byte(yaml))
	require.NoError(t, err)

	// Server defaults
	assert.Equal(t, 8080, cfg.Server.Port)
	assert.Equal(t, "0.0.0.0", cfg.Server.Host)

	// Database defaults
	assert.Equal(t, "./lattice.db", cfg.Database.Path)
	assert.Equal(t, 90, cfg.Database.RetentionDays)

	// Monitor defaults
	require.Len(t, cfg.Monitors, 1)
	assert.Equal(t, "60s", cfg.Monitors[0].Interval)
	assert.Equal(t, "10s", cfg.Monitors[0].Timeout)
	assert.Equal(t, 200, cfg.Monitors[0].ExpectedStatus)
	assert.True(t, cfg.Monitors[0].IsEnabled())
}

func TestLoadFromBytesDisabledMonitor(t *testing.T) {
	yaml := `
monitors:
  - name: "API"
    url: "https://api.example.com"
    type: "https"
    enabled: false
`

	cfg, err := LoadFromBytes([]byte(yaml))
	require.NoError(t, err)

	require.Len(t, cfg.Monitors, 1)
	assert.False(t, cfg.Monitors[0].IsEnabled())
}

func TestLoadFromBytesValidationErrors(t *testing.T) {
	tests := []struct {
		name string
		yaml string
		err  string
	}{
		{
			name: "invalid port",
			yaml: `server:
  port: 99999`,
			err: "invalid server port",
		},
		{
			name: "monitor missing name",
			yaml: `monitors:
  - url: "https://example.com"
    type: "https"`,
			err: "name is required",
		},
		{
			name: "monitor missing url",
			yaml: `monitors:
  - name: "API"
    type: "https"`,
			err: "url is required",
		},
		{
			name: "monitor missing type",
			yaml: `monitors:
  - name: "API"
    url: "https://example.com"`,
			err: "type is required",
		},
		{
			name: "monitor invalid type",
			yaml: `monitors:
  - name: "API"
    url: "https://example.com"
    type: "ftp"`,
			err: "invalid type",
		},
		{
			name: "monitor invalid interval",
			yaml: `monitors:
  - name: "API"
    url: "https://example.com"
    type: "https"
    interval: "invalid"`,
			err: "invalid interval",
		},
		{
			name: "monitor invalid timeout",
			yaml: `monitors:
  - name: "API"
    url: "https://example.com"
    type: "https"
    timeout: "bad"`,
			err: "invalid timeout",
		},
		{
			name: "notification missing name",
			yaml: `notifications:
  - type: "slack"`,
			err: "name is required",
		},
		{
			name: "notification missing type",
			yaml: `notifications:
  - name: "Slack"`,
			err: "type is required",
		},
		{
			name: "notification invalid type",
			yaml: `notifications:
  - name: "SMS"
    type: "sms"`,
			err: "invalid type",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := LoadFromBytes([]byte(tt.yaml))
			require.Error(t, err)
			assert.Contains(t, err.Error(), tt.err)
		})
	}
}

func TestLoadFromFile(t *testing.T) {
	yaml := `
server:
  port: 8080

monitors:
  - name: "Test"
    url: "https://test.com"
    type: "https"
`

	dir := t.TempDir()
	path := filepath.Join(dir, "config.yaml")
	err := os.WriteFile(path, []byte(yaml), 0644)
	require.NoError(t, err)

	cfg, err := Load(path)
	require.NoError(t, err)
	assert.Equal(t, 8080, cfg.Server.Port)
	require.Len(t, cfg.Monitors, 1)
	assert.Equal(t, "Test", cfg.Monitors[0].Name)
}

func TestLoadFromFileNotFound(t *testing.T) {
	_, err := Load("/nonexistent/config.yaml")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "failed to read config file")
}

func TestLoadFromFileInvalidYAML(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "config.yaml")
	err := os.WriteFile(path, []byte("not: valid: yaml: here"), 0644)
	require.NoError(t, err)

	_, err = Load(path)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "failed to parse config file")
}

func TestParsedDurations(t *testing.T) {
	m := MonitorConfig{
		Name:     "Test",
		URL:      "https://test.com",
		Type:     "https",
		Interval: "5m30s",
		Timeout:  "15s",
	}

	assert.Equal(t, 5*time.Minute+30*time.Second, m.ParsedInterval())
	assert.Equal(t, 15*time.Second, m.ParsedTimeout())
}
