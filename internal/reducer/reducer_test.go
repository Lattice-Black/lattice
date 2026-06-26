package reducer

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

var testNow = time.Date(2026, 3, 4, 0, 0, 0, 0, time.UTC)

func TestCreateMonitor(t *testing.T) {
	state := NewState()

	action := CreateMonitor{
		ID:   "mon-1",
		Name: "API Health",
		URL:  "https://api.example.com/health",
		Type: MonitorHTTP,
		Now:  testNow,
	}

	newState, effects, err := Reduce(state, action)
	require.NoError(t, err)

	assert.Len(t, newState.Monitors, 1)
	assert.Equal(t, "API Health", newState.Monitors["mon-1"].Name)
	assert.Equal(t, true, newState.Monitors["mon-1"].Enabled)
	assert.Equal(t, 200, newState.Monitors["mon-1"].ExpectedStatus) // default for HTTP
	assert.Equal(t, time.Duration(60_000_000_000), newState.Monitors["mon-1"].Interval) // default 60s
	assert.Equal(t, time.Duration(10_000_000_000), newState.Monitors["mon-1"].Timeout)  // default 10s
	assert.Len(t, effects, 1)
	assert.IsType(t, PersistState{}, effects[0])
}

func TestCreateMonitor_DuplicateID(t *testing.T) {
	state := NewState()
	state.Monitors["mon-1"] = Monitor{ID: "mon-1", Name: "Existing"}

	_, _, err := Reduce(state, CreateMonitor{ID: "mon-1", Name: "Dup", URL: "http://x", Now: testNow})
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "already exists")
}

func TestCreateMonitor_MissingName(t *testing.T) {
	state := NewState()
	_, _, err := Reduce(state, CreateMonitor{ID: "mon-1", URL: "http://x", Now: testNow})
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "name is required")
}

func TestCreateMonitor_MissingURL(t *testing.T) {
	state := NewState()
	_, _, err := Reduce(state, CreateMonitor{ID: "mon-1", Name: "Test", Now: testNow})
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "URL is required")
}

func TestUpdateMonitor(t *testing.T) {
	state := NewState()
	state.Monitors["mon-1"] = Monitor{ID: "mon-1", Name: "Old Name", URL: "http://old", Enabled: true}

	newName := "New Name"
	disabled := false
	newState, _, err := Reduce(state, UpdateMonitor{
		ID:      "mon-1",
		Name:    &newName,
		Enabled: &disabled,
		Now:     testNow,
	})
	require.NoError(t, err)
	assert.Equal(t, "New Name", newState.Monitors["mon-1"].Name)
	assert.Equal(t, false, newState.Monitors["mon-1"].Enabled)
	assert.Equal(t, "http://old", newState.Monitors["mon-1"].URL) // unchanged
}

func TestUpdateMonitor_NotFound(t *testing.T) {
	state := NewState()
	_, _, err := Reduce(state, UpdateMonitor{ID: "nope", Now: testNow})
	assert.Error(t, err)
}

func TestDeleteMonitor(t *testing.T) {
	state := NewState()
	state.Monitors["mon-1"] = Monitor{ID: "mon-1"}
	state.ConsecutiveFailures["mon-1"] = 5

	newState, _, err := Reduce(state, DeleteMonitor{ID: "mon-1"})
	require.NoError(t, err)
	assert.Len(t, newState.Monitors, 0)
	assert.NotContains(t, newState.ConsecutiveFailures, "mon-1")
}

func TestRecordCheck_Up(t *testing.T) {
	state := NewState()
	state.Monitors["mon-1"] = Monitor{ID: "mon-1", Name: "API", URL: "http://api"}

	newState, effects, err := Reduce(state, RecordCheck{
		ID: "chk-1", MonitorID: "mon-1", Status: StatusUp,
		LatencyMs: 42, StatusCode: 200, CheckedAt: testNow,
	})
	require.NoError(t, err)
	assert.Equal(t, 0, newState.ConsecutiveFailures["mon-1"])
	assert.Len(t, effects, 1) // PersistState only
}

func TestRecordCheck_Down_IncrementsFailures(t *testing.T) {
	state := NewState()
	state.Monitors["mon-1"] = Monitor{ID: "mon-1", Name: "API", URL: "http://api"}

	newState, _, err := Reduce(state, RecordCheck{
		ID: "chk-1", MonitorID: "mon-1", Status: StatusDown,
		Error: "connection refused", CheckedAt: testNow,
	})
	require.NoError(t, err)
	assert.Equal(t, 1, newState.ConsecutiveFailures["mon-1"])
}

func TestRecordCheck_AutoIncidentThreshold(t *testing.T) {
	state := NewState()
	state.Monitors["mon-1"] = Monitor{ID: "mon-1", Name: "API", URL: "http://api"}
	state.NotificationChannels["slack-1"] = NotificationChannel{
		ID: "slack-1", Type: NotifySlack, Enabled: true,
	}
	state.ConsecutiveFailures["mon-1"] = AutoIncidentThreshold - 1

	_, effects, err := Reduce(state, RecordCheck{
		ID: "chk-1", MonitorID: "mon-1", Status: StatusDown,
		Error: "timeout", CheckedAt: testNow,
	})
	require.NoError(t, err)

	// Should have PersistState + SendNotification
	assert.Len(t, effects, 2)
	assert.IsType(t, SendNotification{}, effects[1])
	notif := effects[1].(SendNotification)
	assert.Contains(t, notif.Title, "is down")
}

func TestRecordCheck_NoAutoIncident_DuringMaintenance(t *testing.T) {
	state := NewState()
	state.Monitors["mon-1"] = Monitor{ID: "mon-1", Name: "API", URL: "http://api"}
	state.NotificationChannels["slack-1"] = NotificationChannel{
		ID: "slack-1", Type: NotifySlack, Enabled: true,
	}
	state.ConsecutiveFailures["mon-1"] = AutoIncidentThreshold - 1
	state.MaintenanceWindows["mw-1"] = MaintenanceWindow{
		ID: "mw-1", MonitorID: "mon-1",
		StartsAt: testNow.Add(-1 * time.Hour),
		EndsAt:   testNow.Add(1 * time.Hour),
	}

	_, effects, err := Reduce(state, RecordCheck{
		ID: "chk-1", MonitorID: "mon-1", Status: StatusDown,
		Error: "timeout", CheckedAt: testNow,
	})
	require.NoError(t, err)

	// Only PersistState, no notification during maintenance
	assert.Len(t, effects, 1)
}

func TestRecordCheck_Recovery_Notifies(t *testing.T) {
	state := NewState()
	state.Monitors["mon-1"] = Monitor{ID: "mon-1", Name: "API", URL: "http://api"}
	state.NotificationChannels["slack-1"] = NotificationChannel{
		ID: "slack-1", Type: NotifySlack, Enabled: true,
	}
	state.ConsecutiveFailures["mon-1"] = AutoIncidentThreshold // was down

	newState, effects, err := Reduce(state, RecordCheck{
		ID: "chk-1", MonitorID: "mon-1", Status: StatusUp,
		LatencyMs: 50, StatusCode: 200, CheckedAt: testNow,
	})
	require.NoError(t, err)
	assert.Equal(t, 0, newState.ConsecutiveFailures["mon-1"])
	assert.Len(t, effects, 2) // PersistState + SendNotification
	notif := effects[1].(SendNotification)
	assert.Contains(t, notif.Title, "back up")
}

func TestCreateIncident(t *testing.T) {
	state := NewState()
	state.Monitors["mon-1"] = Monitor{ID: "mon-1"}

	newState, effects, err := Reduce(state, CreateIncident{
		ID: "inc-1", MonitorID: "mon-1", Title: "API Down",
		Severity: SeverityCritical, AutoCreated: false, Now: testNow,
	})
	require.NoError(t, err)
	assert.Len(t, newState.Incidents, 1)
	assert.Equal(t, IncidentInvestigating, newState.Incidents["inc-1"].Status)
	assert.Len(t, effects, 1) // PersistState only (no notification channels)
}

func TestCreateIncident_WithNotifications(t *testing.T) {
	state := NewState()
	state.Monitors["mon-1"] = Monitor{ID: "mon-1"}
	state.NotificationChannels["ntfy-1"] = NotificationChannel{
		ID: "ntfy-1", Type: NotifyNtfy, Enabled: true,
	}

	_, effects, err := Reduce(state, CreateIncident{
		ID: "inc-1", MonitorID: "mon-1", Title: "API Down",
		Severity: SeverityCritical, Now: testNow,
	})
	require.NoError(t, err)
	assert.Len(t, effects, 2) // PersistState + SendNotification
}

func TestUpdateIncident(t *testing.T) {
	state := NewState()
	state.Incidents["inc-1"] = Incident{
		ID: "inc-1", Status: IncidentInvestigating,
	}

	newState, _, err := Reduce(state, UpdateIncident{
		ID: "inc-1", Status: IncidentIdentified,
		Message: "Found the root cause", Now: testNow,
	})
	require.NoError(t, err)
	assert.Equal(t, IncidentIdentified, newState.Incidents["inc-1"].Status)
	assert.Len(t, newState.IncidentUpdates["inc-1"], 1)
	assert.Equal(t, "Found the root cause", newState.IncidentUpdates["inc-1"][0].Message)
}

func TestUpdateIncident_AlreadyResolved(t *testing.T) {
	state := NewState()
	state.Incidents["inc-1"] = Incident{
		ID: "inc-1", Status: IncidentResolved,
	}

	_, _, err := Reduce(state, UpdateIncident{
		ID: "inc-1", Status: IncidentMonitoring, Now: testNow,
	})
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "already resolved")
}

func TestResolveIncident(t *testing.T) {
	state := NewState()
	state.Incidents["inc-1"] = Incident{
		ID: "inc-1", MonitorID: "mon-1", Title: "API Down",
		Status: IncidentIdentified, Severity: SeverityMajor,
	}

	newState, _, err := Reduce(state, ResolveIncident{
		ID: "inc-1", Message: "Deployed fix", Now: testNow,
	})
	require.NoError(t, err)
	assert.Equal(t, IncidentResolved, newState.Incidents["inc-1"].Status)
	assert.NotNil(t, newState.Incidents["inc-1"].ResolvedAt)
}

func TestUpdateSettings(t *testing.T) {
	state := NewState()

	name := "My Status"
	color := "#ff0000"
	newState, _, err := Reduce(state, UpdateSettings{
		SiteName: &name, AccentColor: &color,
	})
	require.NoError(t, err)
	assert.Equal(t, "My Status", newState.Settings.SiteName)
	assert.Equal(t, "#ff0000", newState.Settings.AccentColor)
}

func TestMaintenanceWindow(t *testing.T) {
	state := NewState()

	newState, _, err := Reduce(state, CreateMaintenanceWindow{
		ID: "mw-1", MonitorID: "mon-1", Title: "Upgrade",
		StartsAt: testNow, EndsAt: testNow.Add(2 * time.Hour),
	})
	require.NoError(t, err)
	assert.Len(t, newState.MaintenanceWindows, 1)

	newState, _, err = Reduce(newState, DeleteMaintenanceWindow{ID: "mw-1"})
	require.NoError(t, err)
	assert.Len(t, newState.MaintenanceWindows, 0)
}

func TestNotificationChannel(t *testing.T) {
	state := NewState()

	newState, _, err := Reduce(state, CreateNotificationChannel{
		ID: "ch-1", Type: NotifySlack, Name: "alerts",
		Config: map[string]string{"webhook_url": "https://hooks.slack.com/xxx"},
		Now:    testNow,
	})
	require.NoError(t, err)
	assert.Len(t, newState.NotificationChannels, 1)

	newState, _, err = Reduce(newState, DeleteNotificationChannel{ID: "ch-1"})
	require.NoError(t, err)
	assert.Len(t, newState.NotificationChannels, 0)
}

func TestDeleteMonitor_CleansUpIncidentsAndMaintenance(t *testing.T) {
	state := NewState()
	state.Monitors["mon-1"] = Monitor{ID: "mon-1", Name: "API"}
	state.ConsecutiveFailures["mon-1"] = 5

	// Add an incident for this monitor
	state.Incidents["inc-1"] = Incident{ID: "inc-1", MonitorID: "mon-1", Title: "Outage"}
	state.IncidentUpdates["inc-1"] = []IncidentUpdate{{ID: "inc-1-0", IncidentID: "inc-1"}}

	// Add a maintenance window for this monitor
	state.MaintenanceWindows["mw-1"] = MaintenanceWindow{ID: "mw-1", MonitorID: "mon-1"}

	newState, _, err := Reduce(state, DeleteMonitor{ID: "mon-1"})
	require.NoError(t, err)
	assert.Len(t, newState.Monitors, 0)
	assert.NotContains(t, newState.ConsecutiveFailures, "mon-1")
	assert.Len(t, newState.Incidents, 0, "incidents should be cleaned up")
	assert.Len(t, newState.IncidentUpdates, 0, "incident updates should be cleaned up")
	assert.Len(t, newState.MaintenanceWindows, 0, "maintenance windows should be cleaned up")
}

func TestReducer_UnknownAction(t *testing.T) {
	state := NewState()
	_, _, err := Reduce(state, unknownAction{})
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "unknown action type")
}

type unknownAction struct{}
func (a unknownAction) ActionType() string { return "UNKNOWN" }
