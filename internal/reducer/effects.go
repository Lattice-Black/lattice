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
type SendNotification struct {
	ChannelID string
	Title     string
	Message   string
	Severity  Severity
	MonitorID string
}

func (e SendNotification) EffectType() string { return "SEND_NOTIFICATION" }

// PruneOldChecks tells the runtime to delete checks older than the retention period.
type PruneOldChecks struct {
	MonitorID    string
	RetentionDays int
}

func (e PruneOldChecks) EffectType() string { return "PRUNE_OLD_CHECKS" }
