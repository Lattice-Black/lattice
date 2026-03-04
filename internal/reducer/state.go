package reducer

// State holds the entire application state that the reducer operates on.
// In practice, this is materialized from the database on startup and
// kept in sync via the reducer pattern.
type State struct {
	Monitors              map[string]Monitor              `json:"monitors"`
	Incidents             map[string]Incident             `json:"incidents"`
	IncidentUpdates       map[string][]IncidentUpdate     `json:"incidentUpdates"` // keyed by incident ID
	NotificationChannels  map[string]NotificationChannel  `json:"notificationChannels"`
	MaintenanceWindows    map[string]MaintenanceWindow    `json:"maintenanceWindows"`
	Settings              Settings                        `json:"settings"`
	// ConsecutiveFailures tracks how many consecutive failures each monitor has.
	// Used for auto-incident creation.
	ConsecutiveFailures   map[string]int                  `json:"consecutiveFailures"`
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

// AutoIncidentThreshold is the number of consecutive failures before
// an incident is automatically created.
const AutoIncidentThreshold = 3
