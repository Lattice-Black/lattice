package reducer

// SideEffect represents an effect that should be executed after a state transition.
// Effects are NOT executed by the reducer -- they are returned and dispatched by the runtime.
// This keeps the reducer pure and testable.
type SideEffect interface {
	EffectType() string
}

// PersistState tells the runtime to write the new state to the database.
type PersistState struct {
	Action Action // The action that caused this state change
}

func (e PersistState) EffectType() string { return "PERSIST_STATE" }

// SendNotification tells the runtime to send a notification.
// Config and ChannelType are populated by the scheduler before dispatching
// so the registry doesn't need to read from the shared state (avoiding a race).
type SendNotification struct {
	ChannelID   string
	ChannelType NotificationChannelType // populated by scheduler
	Config      map[string]string       // snapshot populated by scheduler
	Title       string
	Message     string
	Severity    Severity
	MonitorID   string
}

func (e SendNotification) EffectType() string { return "SEND_NOTIFICATION" }


