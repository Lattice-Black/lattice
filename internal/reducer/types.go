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
	Interval       time.Duration `json:"interval"`
	Timeout        time.Duration `json:"timeout"`
	ExpectedStatus int           `json:"expectedStatus"`
	Enabled        bool          `json:"enabled"`
	Group          string        `json:"group"`
	CreatedAt      time.Time     `json:"createdAt"`
	UpdatedAt      time.Time     `json:"updatedAt"`
}

type Check struct {
	ID         string        `json:"id"`
	MonitorID  string        `json:"monitorId"`
	Status     Status        `json:"status"`
	LatencyMs  int64         `json:"latencyMs"`
	StatusCode int           `json:"statusCode"`
	Error      string        `json:"error,omitempty"`
	CheckedAt  time.Time     `json:"checkedAt"`
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
	MonitorID   string         `json:"monitorId"`
	Title       string         `json:"title"`
	Severity    Severity       `json:"severity"`
	Status      IncidentStatus `json:"status"`
	AutoCreated bool           `json:"autoCreated"`
	CreatedAt   time.Time      `json:"createdAt"`
	UpdatedAt   time.Time      `json:"updatedAt"`
	ResolvedAt  *time.Time     `json:"resolvedAt,omitempty"`
}

type IncidentUpdate struct {
	ID         string         `json:"id"`
	IncidentID string         `json:"incidentId"`
	Status     IncidentStatus `json:"status"`
	Message    string         `json:"message"`
	CreatedAt  time.Time      `json:"createdAt"`
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
	ID      string                  `json:"id"`
	Type    NotificationChannelType `json:"type"`
	Name    string                  `json:"name"`
	Config  map[string]string       `json:"config"`
	Enabled bool                    `json:"enabled"`
}

// --- Maintenance ---

type MaintenanceWindow struct {
	ID        string    `json:"id"`
	MonitorID string    `json:"monitorId"`
	Title     string    `json:"title"`
	StartsAt  time.Time `json:"startsAt"`
	EndsAt    time.Time `json:"endsAt"`
}

// --- Settings ---

type Settings struct {
	SiteName    string `json:"siteName"`
	LogoURL     string `json:"logoUrl,omitempty"`
	AccentColor string `json:"accentColor"`
	CustomCSS   string `json:"customCss,omitempty"`
	CustomDomain string `json:"customDomain,omitempty"`
}
