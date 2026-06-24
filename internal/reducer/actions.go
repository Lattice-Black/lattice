package reducer

import "time"

// Action is the interface all state mutations implement.
type Action interface {
	ActionType() string
}

// --- Monitor Actions ---

type CreateMonitor struct {
	ID             string
	Name           string
	URL            string
	Type           MonitorType
	Interval       time.Duration
	Timeout        time.Duration
	ExpectedStatus int
	Group          string
	Now            time.Time
}

func (a CreateMonitor) ActionType() string { return "CREATE_MONITOR" }

type UpdateMonitor struct {
	ID             string
	Name           *string
	URL            *string
	Type           *MonitorType
	Interval       *time.Duration
	Timeout        *time.Duration
	ExpectedStatus *int
	Enabled        *bool
	Group          *string
	Now            time.Time
}

func (a UpdateMonitor) ActionType() string { return "UPDATE_MONITOR" }

type DeleteMonitor struct {
	ID string
}

func (a DeleteMonitor) ActionType() string { return "DELETE_MONITOR" }

// --- Check Actions ---

type RecordCheck struct {
	ID         string
	MonitorID  string
	Status     Status
	LatencyMs  int64
	StatusCode int
	Error      string
	CheckedAt  time.Time
}

func (a RecordCheck) ActionType() string { return "RECORD_CHECK" }

// --- Incident Actions ---

type CreateIncident struct {
	ID          string
	MonitorID   string
	Title       string
	Severity    Severity
	AutoCreated bool
	Message     string // initial update message
	Now         time.Time
}

func (a CreateIncident) ActionType() string { return "CREATE_INCIDENT" }

type UpdateIncident struct {
	ID      string
	Status  IncidentStatus
	Message string
	Now     time.Time
}

func (a UpdateIncident) ActionType() string { return "UPDATE_INCIDENT" }

type ResolveIncident struct {
	ID      string
	Message string
	Now     time.Time
}

func (a ResolveIncident) ActionType() string { return "RESOLVE_INCIDENT" }

type DeleteIncident struct {
	ID string
}

func (a DeleteIncident) ActionType() string { return "DELETE_INCIDENT" }

// --- Notification Actions ---

type CreateNotificationChannel struct {
	ID      string
	Type    NotificationChannelType
	Name    string
	Config  map[string]string
	Now     time.Time
}

func (a CreateNotificationChannel) ActionType() string { return "CREATE_NOTIFICATION_CHANNEL" }

type UpdateNotificationChannel struct {
	ID      string
	Name    *string
	Config  map[string]string
	Enabled *bool
	Now     time.Time
}

func (a UpdateNotificationChannel) ActionType() string { return "UPDATE_NOTIFICATION_CHANNEL" }

type DeleteNotificationChannel struct {
	ID string
}

func (a DeleteNotificationChannel) ActionType() string { return "DELETE_NOTIFICATION_CHANNEL" }

// --- Maintenance Actions ---

type CreateMaintenanceWindow struct {
	ID          string
	MonitorID   string
	Title       string
	Description string
	StartsAt    time.Time
	EndsAt      time.Time
	Now         time.Time
}

func (a CreateMaintenanceWindow) ActionType() string { return "CREATE_MAINTENANCE_WINDOW" }

type DeleteMaintenanceWindow struct {
	ID string
}

func (a DeleteMaintenanceWindow) ActionType() string { return "DELETE_MAINTENANCE_WINDOW" }

// --- Settings Actions ---

type UpdateSettings struct {
	SiteName     *string
	LogoURL      *string
	AccentColor  *string
	CustomCSS    *string
	CustomDomain *string
}

func (a UpdateSettings) ActionType() string { return "UPDATE_SETTINGS" }