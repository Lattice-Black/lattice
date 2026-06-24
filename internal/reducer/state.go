package reducer

// State holds the entire application state that the reducer operates on.
// In practice, this is materialized from the database on startup and
// kept in sync via the reducer pattern.
type State struct {
	Monitors             map[string]Monitor              `json:"monitors"`
	Incidents            map[string]Incident             `json:"incidents"`
	IncidentUpdates      map[string][]IncidentUpdate     `json:"incident_updates"` // keyed by incident ID
	NotificationChannels map[string]NotificationChannel  `json:"notification_channels"`
	MaintenanceWindows   map[string]MaintenanceWindow    `json:"maintenance_windows"`
	Settings             Settings                        `json:"settings"`
	// ConsecutiveFailures tracks how many consecutive failures each monitor has.
	// Used for auto-incident creation.
	ConsecutiveFailures map[string]int `json:"consecutive_failures"`
}

// NewState creates an empty initial state.
func NewState() State {
	return State{
		Monitors:             make(map[string]Monitor),
		Incidents:            make(map[string]Incident),
		IncidentUpdates:      make(map[string][]IncidentUpdate),
		NotificationChannels: make(map[string]NotificationChannel),
		MaintenanceWindows:   make(map[string]MaintenanceWindow),
		ConsecutiveFailures:  make(map[string]int),
		Settings: Settings{
			SiteName:    "Lattice Status",
			AccentColor: "#4d9f5d",
		},
	}
}

// Clone creates a deep copy of the state so the reducer can mutate
// maps without causing concurrent access issues.
func (s State) Clone() State {
	cp := State{
		Monitors:             make(map[string]Monitor, len(s.Monitors)),
		Incidents:            make(map[string]Incident, len(s.Incidents)),
		IncidentUpdates:      make(map[string][]IncidentUpdate, len(s.IncidentUpdates)),
		NotificationChannels: make(map[string]NotificationChannel, len(s.NotificationChannels)),
		MaintenanceWindows:   make(map[string]MaintenanceWindow, len(s.MaintenanceWindows)),
		ConsecutiveFailures:  make(map[string]int, len(s.ConsecutiveFailures)),
		Settings:             s.Settings,
	}

	for k, v := range s.Monitors {
		cp.Monitors[k] = v
	}
	for k, v := range s.Incidents {
		cp.Incidents[k] = v
	}
	for k, v := range s.IncidentUpdates {
		cp.IncidentUpdates[k] = append([]IncidentUpdate(nil), v...)
	}
	for k, v := range s.NotificationChannels {
		cp.NotificationChannels[k] = v
	}
	for k, v := range s.MaintenanceWindows {
		cp.MaintenanceWindows[k] = v
	}
	for k, v := range s.ConsecutiveFailures {
		cp.ConsecutiveFailures[k] = v
	}

	return cp
}

// AutoIncidentThreshold is the number of consecutive failures before
// an incident is automatically created.
const AutoIncidentThreshold = 3