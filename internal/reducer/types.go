package reducer

import (
	"time"
)

// --- Monitor Types ---

type MonitorType string

const (
	MonitorHTTP  MonitorType = "http"
	MonitorHTTPS MonitorType = "https"
	MonitorTCP   MonitorType = "tcp"
	MonitorDNS   MonitorType = "dns"
	MonitorICMP  MonitorType = "icmp"
)

type Status string

const (
	StatusUp       Status = "up"
	StatusDown     Status = "down"
	StatusDegraded Status = "degraded"
	StatusUnknown  Status = "unknown"
)

type Monitor struct {
	ID             string        `json:"id"`
	Name           string        `json:"name"`
	URL            string        `json:"url"`
	Type           MonitorType   `json:"type"`
	Interval       time.Duration `json:"-"`
	Timeout        time.Duration `json:"-"`
	ExpectedStatus int           `json:"expected_status,omitempty"`
	Enabled        bool          `json:"enabled"`
	Group          string        `json:"group,omitempty"`
	CreatedAt      time.Time     `json:"created_at"`
	UpdatedAt      time.Time     `json:"updated_at"`
}

type Check struct {
	ID         string    `json:"id"`
	MonitorID  string    `json:"monitor_id"`
	Status     Status    `json:"status"`
	LatencyMs  int64     `json:"latency_ms"`
	StatusCode int       `json:"status_code"`
	Error      string    `json:"error,omitempty"`
	CheckedAt  time.Time `json:"checked_at"`
}

// --- Incident Types ---

type Severity string

const (
	SeverityMinor    Severity = "minor"
	SeverityMajor    Severity = "major"
	SeverityCritical Severity = "critical"
)

type IncidentStatus string

const (
	IncidentInvestigating IncidentStatus = "investigating"
	IncidentIdentified    IncidentStatus = "identified"
	IncidentMonitoring    IncidentStatus = "monitoring"
	IncidentResolved      IncidentStatus = "resolved"
)

type Incident struct {
	ID          string         `json:"id"`
	MonitorID   string         `json:"monitor_id,omitempty"`
	Title       string         `json:"title"`
	Severity    Severity       `json:"severity"`
	Status      IncidentStatus `json:"status"`
	AutoCreated bool           `json:"auto_created"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	ResolvedAt  *time.Time     `json:"resolved_at,omitempty"`
}

type IncidentUpdate struct {
	ID         string         `json:"id"`
	IncidentID string         `json:"incident_id"`
	Status     IncidentStatus `json:"status"`
	Message    string         `json:"message"`
	CreatedAt  time.Time      `json:"created_at"`
}

// --- Notification Types ---

type NotificationChannelType string

const (
	NotifySlack   NotificationChannelType = "slack"
	NotifyDiscord NotificationChannelType = "discord"
	NotifyEmail   NotificationChannelType = "email"
	NotifyWebhook NotificationChannelType = "webhook"
	NotifyNtfy    NotificationChannelType = "ntfy"
)

type NotificationChannel struct {
	ID        string                  `json:"id"`
	Type      NotificationChannelType `json:"type"`
	Name      string                  `json:"name"`
	Config    map[string]string       `json:"config"`
	Enabled   bool                    `json:"enabled"`
	CreatedAt time.Time               `json:"created_at"`
	UpdatedAt time.Time               `json:"updated_at"`
}

// --- Maintenance ---

type MaintenanceWindow struct {
	ID          string    `json:"id"`
	MonitorID   string    `json:"monitor_id"`
	Title       string    `json:"title"`
	Description string    `json:"description,omitempty"`
	StartsAt    time.Time `json:"start_time"`
	EndsAt      time.Time `json:"end_time"`
	CreatedAt   time.Time `json:"created_at"`
}

// --- Settings ---

type Settings struct {
	SiteName     string `json:"site_name"`
	LogoURL      string `json:"logo_url,omitempty"`
	AccentColor  string `json:"accent_color"`
	CustomCSS    string `json:"custom_css,omitempty"`
	CustomDomain string `json:"custom_domain,omitempty"`
}