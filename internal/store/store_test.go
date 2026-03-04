package store

import (
	"path/filepath"
	"testing"
	"time"

	"github.com/Lattice-Black/lattice/internal/reducer"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newTestStore(t *testing.T) *SQLiteStore {
	t.Helper()
	dbPath := filepath.Join(t.TempDir(), "test.db")
	store, err := New(dbPath)
	require.NoError(t, err)
	t.Cleanup(func() { store.Close() })
	return store
}

func TestMonitorCRUD(t *testing.T) {
	s := newTestStore(t)
	now := time.Now().UTC().Truncate(time.Second)

	// Create
	m := reducer.Monitor{
		ID:             "mon-1",
		Name:           "Test Monitor",
		URL:            "https://example.com",
		Type:           reducer.MonitorHTTPS,
		Interval:       60 * time.Second,
		Timeout:        10 * time.Second,
		ExpectedStatus: 200,
		Enabled:        true,
		Group:          "production",
		CreatedAt:      now,
		UpdatedAt:      now,
	}
	err := s.CreateMonitor(m)
	require.NoError(t, err)

	// Read
	got, err := s.GetMonitor("mon-1")
	require.NoError(t, err)
	require.NotNil(t, got)
	assert.Equal(t, m.ID, got.ID)
	assert.Equal(t, m.Name, got.Name)
	assert.Equal(t, m.URL, got.URL)
	assert.Equal(t, m.Type, got.Type)
	assert.Equal(t, m.Interval, got.Interval)
	assert.Equal(t, m.Timeout, got.Timeout)
	assert.Equal(t, m.ExpectedStatus, got.ExpectedStatus)
	assert.Equal(t, m.Enabled, got.Enabled)
	assert.Equal(t, m.Group, got.Group)

	// List
	monitors, err := s.ListMonitors()
	require.NoError(t, err)
	assert.Len(t, monitors, 1)

	// Update
	m.Name = "Updated Monitor"
	m.Enabled = false
	m.UpdatedAt = now.Add(time.Hour)
	err = s.UpdateMonitor(m)
	require.NoError(t, err)

	got, err = s.GetMonitor("mon-1")
	require.NoError(t, err)
	assert.Equal(t, "Updated Monitor", got.Name)
	assert.False(t, got.Enabled)

	// Delete
	err = s.DeleteMonitor("mon-1")
	require.NoError(t, err)

	got, err = s.GetMonitor("mon-1")
	require.NoError(t, err)
	assert.Nil(t, got)

	// Delete non-existent
	err = s.DeleteMonitor("mon-1")
	assert.Error(t, err)
}

func TestGetMonitorNotFound(t *testing.T) {
	s := newTestStore(t)
	got, err := s.GetMonitor("nonexistent")
	require.NoError(t, err)
	assert.Nil(t, got)
}

func TestCheckOperations(t *testing.T) {
	s := newTestStore(t)
	now := time.Now().UTC().Truncate(time.Second)

	// Create a monitor first (for foreign key)
	m := reducer.Monitor{
		ID:             "mon-1",
		Name:           "Test Monitor",
		URL:            "https://example.com",
		Type:           reducer.MonitorHTTPS,
		Interval:       60 * time.Second,
		Timeout:        10 * time.Second,
		ExpectedStatus: 200,
		Enabled:        true,
		CreatedAt:      now,
		UpdatedAt:      now,
	}
	require.NoError(t, s.CreateMonitor(m))

	// Record checks
	for i := 0; i < 5; i++ {
		c := reducer.Check{
			ID:         "check-" + string(rune('a'+i)),
			MonitorID:  "mon-1",
			Status:     reducer.StatusUp,
			LatencyMs:  100 + int64(i*10),
			StatusCode: 200,
			CheckedAt:  now.Add(time.Duration(i) * time.Minute),
		}
		require.NoError(t, s.RecordCheck(c))
	}

	// Get latest check
	latest, err := s.GetLatestCheck("mon-1")
	require.NoError(t, err)
	require.NotNil(t, latest)
	assert.Equal(t, "check-e", latest.ID)
	assert.Equal(t, int64(140), latest.LatencyMs)

	// Get checks since
	checks, err := s.GetChecks("mon-1", now.Add(2*time.Minute))
	require.NoError(t, err)
	assert.Len(t, checks, 3) // checks at 2min, 3min, 4min

	// Prune old checks
	pruned, err := s.PruneChecks(now.Add(3 * time.Minute))
	require.NoError(t, err)
	assert.Equal(t, int64(3), pruned)

	// Verify remaining
	checks, err = s.GetChecks("mon-1", now)
	require.NoError(t, err)
	assert.Len(t, checks, 2)
}

func TestGetLatestCheckNotFound(t *testing.T) {
	s := newTestStore(t)
	got, err := s.GetLatestCheck("nonexistent")
	require.NoError(t, err)
	assert.Nil(t, got)
}

func TestIncidentOperations(t *testing.T) {
	s := newTestStore(t)
	now := time.Now().UTC().Truncate(time.Second)

	// Create a monitor first
	m := reducer.Monitor{
		ID:        "mon-1",
		Name:      "Test Monitor",
		URL:       "https://example.com",
		Type:      reducer.MonitorHTTPS,
		CreatedAt: now,
		UpdatedAt: now,
	}
	require.NoError(t, s.CreateMonitor(m))

	// Create incident
	i := reducer.Incident{
		ID:          "inc-1",
		MonitorID:   "mon-1",
		Title:       "Service Outage",
		Severity:    reducer.SeverityMajor,
		Status:      reducer.IncidentInvestigating,
		AutoCreated: false,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	err := s.CreateIncident(i)
	require.NoError(t, err)

	// Get incident
	got, err := s.GetIncident("inc-1")
	require.NoError(t, err)
	require.NotNil(t, got)
	assert.Equal(t, "Service Outage", got.Title)
	assert.Equal(t, reducer.SeverityMajor, got.Severity)
	assert.Nil(t, got.ResolvedAt)

	// List active incidents
	incidents, err := s.ListIncidents(false)
	require.NoError(t, err)
	assert.Len(t, incidents, 1)

	// Update incident (resolve it)
	resolvedAt := now.Add(time.Hour)
	i.Status = reducer.IncidentResolved
	i.UpdatedAt = resolvedAt
	i.ResolvedAt = &resolvedAt
	err = s.UpdateIncident(i)
	require.NoError(t, err)

	got, err = s.GetIncident("inc-1")
	require.NoError(t, err)
	assert.Equal(t, reducer.IncidentResolved, got.Status)
	require.NotNil(t, got.ResolvedAt)

	// List active incidents (should be empty)
	incidents, err = s.ListIncidents(false)
	require.NoError(t, err)
	assert.Len(t, incidents, 0)

	// List all incidents
	incidents, err = s.ListIncidents(true)
	require.NoError(t, err)
	assert.Len(t, incidents, 1)
}

func TestIncidentUpdates(t *testing.T) {
	s := newTestStore(t)
	now := time.Now().UTC().Truncate(time.Second)

	// Create monitor and incident
	m := reducer.Monitor{
		ID:        "mon-1",
		Name:      "Test Monitor",
		URL:       "https://example.com",
		Type:      reducer.MonitorHTTPS,
		CreatedAt: now,
		UpdatedAt: now,
	}
	require.NoError(t, s.CreateMonitor(m))

	i := reducer.Incident{
		ID:        "inc-1",
		MonitorID: "mon-1",
		Title:     "Service Outage",
		Severity:  reducer.SeverityMajor,
		Status:    reducer.IncidentInvestigating,
		CreatedAt: now,
		UpdatedAt: now,
	}
	require.NoError(t, s.CreateIncident(i))

	// Create incident updates
	updates := []reducer.IncidentUpdate{
		{ID: "inc-1-0", IncidentID: "inc-1", Status: reducer.IncidentInvestigating, Message: "Investigating the issue", CreatedAt: now},
		{ID: "inc-1-1", IncidentID: "inc-1", Status: reducer.IncidentIdentified, Message: "Root cause identified", CreatedAt: now.Add(10 * time.Minute)},
		{ID: "inc-1-2", IncidentID: "inc-1", Status: reducer.IncidentResolved, Message: "Issue resolved", CreatedAt: now.Add(30 * time.Minute)},
	}

	for _, u := range updates {
		require.NoError(t, s.CreateIncidentUpdate(u))
	}

	// Get updates
	got, err := s.GetIncidentUpdates("inc-1")
	require.NoError(t, err)
	assert.Len(t, got, 3)
	assert.Equal(t, "Investigating the issue", got[0].Message)
	assert.Equal(t, "Issue resolved", got[2].Message)
}

func TestNotificationChannelOperations(t *testing.T) {
	s := newTestStore(t)

	// Create channel
	ch := reducer.NotificationChannel{
		ID:      "ch-1",
		Type:    reducer.NotifySlack,
		Name:    "Slack Alerts",
		Config:  map[string]string{"webhook_url": "https://hooks.slack.com/xxx"},
		Enabled: true,
	}
	err := s.CreateNotificationChannel(ch)
	require.NoError(t, err)

	// List channels
	channels, err := s.ListNotificationChannels()
	require.NoError(t, err)
	assert.Len(t, channels, 1)
	assert.Equal(t, "Slack Alerts", channels[0].Name)
	assert.Equal(t, "https://hooks.slack.com/xxx", channels[0].Config["webhook_url"])

	// Delete channel
	err = s.DeleteNotificationChannel("ch-1")
	require.NoError(t, err)

	channels, err = s.ListNotificationChannels()
	require.NoError(t, err)
	assert.Len(t, channels, 0)

	// Delete non-existent
	err = s.DeleteNotificationChannel("ch-1")
	assert.Error(t, err)
}

func TestMaintenanceWindowOperations(t *testing.T) {
	s := newTestStore(t)
	now := time.Now().UTC().Truncate(time.Second)

	// Create monitor first
	m := reducer.Monitor{
		ID:        "mon-1",
		Name:      "Test Monitor",
		URL:       "https://example.com",
		Type:      reducer.MonitorHTTPS,
		CreatedAt: now,
		UpdatedAt: now,
	}
	require.NoError(t, s.CreateMonitor(m))

	// Create maintenance window
	mw := reducer.MaintenanceWindow{
		ID:        "mw-1",
		MonitorID: "mon-1",
		Title:     "Scheduled Maintenance",
		StartsAt:  now.Add(time.Hour),
		EndsAt:    now.Add(2 * time.Hour),
	}
	err := s.CreateMaintenanceWindow(mw)
	require.NoError(t, err)

	// List windows
	windows, err := s.ListMaintenanceWindows()
	require.NoError(t, err)
	assert.Len(t, windows, 1)
	assert.Equal(t, "Scheduled Maintenance", windows[0].Title)

	// Delete window
	err = s.DeleteMaintenanceWindow("mw-1")
	require.NoError(t, err)

	windows, err = s.ListMaintenanceWindows()
	require.NoError(t, err)
	assert.Len(t, windows, 0)

	// Delete non-existent
	err = s.DeleteMaintenanceWindow("mw-1")
	assert.Error(t, err)
}

func TestSettingsOperations(t *testing.T) {
	s := newTestStore(t)

	// Get default settings
	settings, err := s.GetSettings()
	require.NoError(t, err)
	assert.Equal(t, "Lattice Status", settings.SiteName)
	assert.Equal(t, "#4d9f5d", settings.AccentColor)

	// Update settings
	settings.SiteName = "My Status Page"
	settings.LogoURL = "https://example.com/logo.png"
	settings.AccentColor = "#ff0000"
	settings.CustomCSS = "body { font-family: sans-serif; }"
	settings.CustomDomain = "status.example.com"
	err = s.UpdateSettings(*settings)
	require.NoError(t, err)

	// Verify update
	got, err := s.GetSettings()
	require.NoError(t, err)
	assert.Equal(t, "My Status Page", got.SiteName)
	assert.Equal(t, "https://example.com/logo.png", got.LogoURL)
	assert.Equal(t, "#ff0000", got.AccentColor)
	assert.Equal(t, "body { font-family: sans-serif; }", got.CustomCSS)
	assert.Equal(t, "status.example.com", got.CustomDomain)
}

func TestLoadState(t *testing.T) {
	s := newTestStore(t)
	now := time.Now().UTC().Truncate(time.Second)

	// Create monitors
	m1 := reducer.Monitor{
		ID:        "mon-1",
		Name:      "API Server",
		URL:       "https://api.example.com",
		Type:      reducer.MonitorHTTPS,
		Enabled:   true,
		CreatedAt: now,
		UpdatedAt: now,
	}
	m2 := reducer.Monitor{
		ID:        "mon-2",
		Name:      "Database",
		URL:       "tcp://db.example.com:5432",
		Type:      reducer.MonitorTCP,
		Enabled:   true,
		CreatedAt: now,
		UpdatedAt: now,
	}
	require.NoError(t, s.CreateMonitor(m1))
	require.NoError(t, s.CreateMonitor(m2))

	// Create incidents
	inc := reducer.Incident{
		ID:        "inc-1",
		MonitorID: "mon-1",
		Title:     "API Outage",
		Severity:  reducer.SeverityCritical,
		Status:    reducer.IncidentInvestigating,
		CreatedAt: now,
		UpdatedAt: now,
	}
	require.NoError(t, s.CreateIncident(inc))

	// Create incident updates
	update := reducer.IncidentUpdate{
		ID:         "inc-1-0",
		IncidentID: "inc-1",
		Status:     reducer.IncidentInvestigating,
		Message:    "Looking into the issue",
		CreatedAt:  now,
	}
	require.NoError(t, s.CreateIncidentUpdate(update))

	// Create notification channel
	ch := reducer.NotificationChannel{
		ID:      "ch-1",
		Type:    reducer.NotifyWebhook,
		Name:    "PagerDuty",
		Config:  map[string]string{"url": "https://events.pagerduty.com/v2/enqueue"},
		Enabled: true,
	}
	require.NoError(t, s.CreateNotificationChannel(ch))

	// Create maintenance window
	mw := reducer.MaintenanceWindow{
		ID:        "mw-1",
		MonitorID: "mon-2",
		Title:     "DB Migration",
		StartsAt:  now.Add(time.Hour),
		EndsAt:    now.Add(2 * time.Hour),
	}
	require.NoError(t, s.CreateMaintenanceWindow(mw))

	// Update settings
	settings := reducer.Settings{
		SiteName:    "Production Status",
		AccentColor: "#00ff00",
	}
	require.NoError(t, s.UpdateSettings(settings))

	// Load full state
	state, err := s.LoadState()
	require.NoError(t, err)

	// Verify monitors
	assert.Len(t, state.Monitors, 2)
	assert.Equal(t, "API Server", state.Monitors["mon-1"].Name)
	assert.Equal(t, "Database", state.Monitors["mon-2"].Name)

	// Verify incidents
	assert.Len(t, state.Incidents, 1)
	assert.Equal(t, "API Outage", state.Incidents["inc-1"].Title)

	// Verify incident updates
	assert.Len(t, state.IncidentUpdates["inc-1"], 1)
	assert.Equal(t, "Looking into the issue", state.IncidentUpdates["inc-1"][0].Message)

	// Verify notification channels
	assert.Len(t, state.NotificationChannels, 1)
	assert.Equal(t, "PagerDuty", state.NotificationChannels["ch-1"].Name)

	// Verify maintenance windows
	assert.Len(t, state.MaintenanceWindows, 1)
	assert.Equal(t, "DB Migration", state.MaintenanceWindows["mw-1"].Title)

	// Verify settings
	assert.Equal(t, "Production Status", state.Settings.SiteName)
	assert.Equal(t, "#00ff00", state.Settings.AccentColor)
}

func TestMigrationsRunOnce(t *testing.T) {
	dbPath := filepath.Join(t.TempDir(), "test.db")

	// Create store (runs migrations)
	store1, err := New(dbPath)
	require.NoError(t, err)
	store1.Close()

	// Create store again (migrations should be skipped)
	store2, err := New(dbPath)
	require.NoError(t, err)
	defer store2.Close()

	// Verify migrations table has entry
	var count int
	err = store2.db.QueryRow("SELECT COUNT(*) FROM migrations").Scan(&count)
	require.NoError(t, err)
	assert.Equal(t, 1, count) // Only one migration file
}

func TestCascadeDelete(t *testing.T) {
	s := newTestStore(t)
	now := time.Now().UTC().Truncate(time.Second)

	// Create monitor
	m := reducer.Monitor{
		ID:        "mon-1",
		Name:      "Test Monitor",
		URL:       "https://example.com",
		Type:      reducer.MonitorHTTPS,
		CreatedAt: now,
		UpdatedAt: now,
	}
	require.NoError(t, s.CreateMonitor(m))

	// Create check
	c := reducer.Check{
		ID:        "check-1",
		MonitorID: "mon-1",
		Status:    reducer.StatusUp,
		CheckedAt: now,
	}
	require.NoError(t, s.RecordCheck(c))

	// Create incident
	inc := reducer.Incident{
		ID:        "inc-1",
		MonitorID: "mon-1",
		Title:     "Outage",
		Severity:  reducer.SeverityMajor,
		Status:    reducer.IncidentInvestigating,
		CreatedAt: now,
		UpdatedAt: now,
	}
	require.NoError(t, s.CreateIncident(inc))

	// Create maintenance window
	mw := reducer.MaintenanceWindow{
		ID:        "mw-1",
		MonitorID: "mon-1",
		Title:     "Maintenance",
		StartsAt:  now,
		EndsAt:    now.Add(time.Hour),
	}
	require.NoError(t, s.CreateMaintenanceWindow(mw))

	// Delete monitor (should cascade)
	err := s.DeleteMonitor("mon-1")
	require.NoError(t, err)

	// Verify cascaded deletes
	checks, err := s.GetChecks("mon-1", now.Add(-time.Hour))
	require.NoError(t, err)
	assert.Len(t, checks, 0)

	incidents, err := s.ListIncidents(true)
	require.NoError(t, err)
	assert.Len(t, incidents, 0)

	windows, err := s.ListMaintenanceWindows()
	require.NoError(t, err)
	assert.Len(t, windows, 0)
}
