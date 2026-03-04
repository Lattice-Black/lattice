package scheduler

import (
	"context"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"sync/atomic"
	"testing"
	"time"

	"github.com/Lattice-Black/lattice/internal/reducer"
	"github.com/Lattice-Black/lattice/internal/store"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type mockEffectHandler struct {
	effects []reducer.SideEffect
}

func (m *mockEffectHandler) Handle(ctx context.Context, effect reducer.SideEffect) error {
	m.effects = append(m.effects, effect)
	return nil
}

func newTestStore(t *testing.T) *store.SQLiteStore {
	t.Helper()
	dbPath := filepath.Join(t.TempDir(), "test.db")
	s, err := store.New(dbPath)
	require.NoError(t, err)
	t.Cleanup(func() { s.Close() })
	return s
}

func TestScheduler_StartStop(t *testing.T) {
	s := newTestStore(t)
	state := reducer.NewState()

	// Create a test HTTP server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	// Add a monitor to state
	now := time.Now().UTC()
	monitor := reducer.Monitor{
		ID:             "mon-1",
		Name:           "Test",
		URL:            server.URL,
		Type:           reducer.MonitorHTTP,
		Interval:       100 * time.Millisecond,
		Timeout:        5 * time.Second,
		ExpectedStatus: 200,
		Enabled:        true,
		CreatedAt:      now,
		UpdatedAt:      now,
	}
	state.Monitors[monitor.ID] = monitor

	// Also save to store
	require.NoError(t, s.CreateMonitor(monitor))

	handler := &mockEffectHandler{}
	scheduler := New(s, &state, handler)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Start scheduler
	err := scheduler.Start(ctx)
	require.NoError(t, err)

	// Wait for some checks to run
	time.Sleep(350 * time.Millisecond)

	// Stop scheduler
	scheduler.Stop()

	// Verify checks were recorded
	checks, err := s.GetChecks("mon-1", now.Add(-time.Hour))
	require.NoError(t, err)
	assert.GreaterOrEqual(t, len(checks), 1)
}

func TestScheduler_AddRemoveMonitor(t *testing.T) {
	s := newTestStore(t)
	state := reducer.NewState()

	var requestCount int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&requestCount, 1)
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	handler := &mockEffectHandler{}
	scheduler := New(s, &state, handler)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	err := scheduler.Start(ctx)
	require.NoError(t, err)

	// Add a monitor
	now := time.Now().UTC()
	monitor := reducer.Monitor{
		ID:             "mon-1",
		Name:           "Test",
		URL:            server.URL,
		Type:           reducer.MonitorHTTP,
		Interval:       100 * time.Millisecond,
		Timeout:        5 * time.Second,
		ExpectedStatus: 200,
		Enabled:        true,
		CreatedAt:      now,
		UpdatedAt:      now,
	}
	state.Monitors[monitor.ID] = monitor
	require.NoError(t, s.CreateMonitor(monitor))

	scheduler.AddMonitor(ctx, monitor)

	// Wait for some checks
	time.Sleep(250 * time.Millisecond)
	countBefore := atomic.LoadInt32(&requestCount)
	assert.GreaterOrEqual(t, countBefore, int32(1))

	// Remove the monitor
	scheduler.RemoveMonitor("mon-1")

	// Wait and verify no more checks
	time.Sleep(200 * time.Millisecond)
	countAfter := atomic.LoadInt32(&requestCount)

	// Should have stopped checking
	assert.Equal(t, countBefore, countAfter)

	scheduler.Stop()
}

func TestScheduler_DisabledMonitor(t *testing.T) {
	s := newTestStore(t)
	state := reducer.NewState()

	var requestCount int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&requestCount, 1)
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	// Add a disabled monitor
	now := time.Now().UTC()
	monitor := reducer.Monitor{
		ID:             "mon-1",
		Name:           "Test",
		URL:            server.URL,
		Type:           reducer.MonitorHTTP,
		Interval:       50 * time.Millisecond,
		Timeout:        5 * time.Second,
		ExpectedStatus: 200,
		Enabled:        false, // Disabled
		CreatedAt:      now,
		UpdatedAt:      now,
	}
	state.Monitors[monitor.ID] = monitor

	handler := &mockEffectHandler{}
	scheduler := New(s, &state, handler)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	err := scheduler.Start(ctx)
	require.NoError(t, err)

	// Wait
	time.Sleep(200 * time.Millisecond)

	scheduler.Stop()

	// No requests should have been made
	assert.Equal(t, int32(0), atomic.LoadInt32(&requestCount))
}

func TestScheduler_UpdateMonitor(t *testing.T) {
	s := newTestStore(t)
	state := reducer.NewState()

	var requestCount int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&requestCount, 1)
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	// Add a monitor
	now := time.Now().UTC()
	monitor := reducer.Monitor{
		ID:             "mon-1",
		Name:           "Test",
		URL:            server.URL,
		Type:           reducer.MonitorHTTP,
		Interval:       100 * time.Millisecond,
		Timeout:        5 * time.Second,
		ExpectedStatus: 200,
		Enabled:        true,
		CreatedAt:      now,
		UpdatedAt:      now,
	}
	state.Monitors[monitor.ID] = monitor
	require.NoError(t, s.CreateMonitor(monitor))

	handler := &mockEffectHandler{}
	scheduler := New(s, &state, handler)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	err := scheduler.Start(ctx)
	require.NoError(t, err)

	// Wait for initial checks
	time.Sleep(250 * time.Millisecond)

	// Update monitor to disabled
	monitor.Enabled = false
	monitor.UpdatedAt = time.Now().UTC()
	state.Monitors[monitor.ID] = monitor
	scheduler.UpdateMonitor(ctx, monitor)

	countBefore := atomic.LoadInt32(&requestCount)

	// Wait
	time.Sleep(200 * time.Millisecond)

	scheduler.Stop()

	countAfter := atomic.LoadInt32(&requestCount)
	// Should have stopped checking after update
	assert.Equal(t, countBefore, countAfter)
}

func TestScheduler_Dispatch(t *testing.T) {
	s := newTestStore(t)
	state := reducer.NewState()

	handler := &mockEffectHandler{}
	scheduler := New(s, &state, handler)

	ctx := context.Background()

	// Dispatch a CreateMonitor action
	now := time.Now().UTC()
	action := reducer.CreateMonitor{
		ID:             "mon-1",
		Name:           "Test Monitor",
		URL:            "https://example.com",
		Type:           reducer.MonitorHTTPS,
		Interval:       60 * time.Second,
		Timeout:        10 * time.Second,
		ExpectedStatus: 200,
		Now:            now,
	}

	err := scheduler.Dispatch(ctx, action)
	require.NoError(t, err)

	// Verify state was updated
	updatedState := scheduler.GetState()
	assert.Len(t, updatedState.Monitors, 1)
	assert.Equal(t, "Test Monitor", updatedState.Monitors["mon-1"].Name)

	// Verify it was persisted to DB
	m, err := s.GetMonitor("mon-1")
	require.NoError(t, err)
	require.NotNil(t, m)
	assert.Equal(t, "Test Monitor", m.Name)
}

func TestScheduler_RecordCheckPersistence(t *testing.T) {
	s := newTestStore(t)
	state := reducer.NewState()

	// Add a monitor to state
	now := time.Now().UTC()
	monitor := reducer.Monitor{
		ID:             "mon-1",
		Name:           "Test",
		URL:            "https://example.com",
		Type:           reducer.MonitorHTTPS,
		Interval:       60 * time.Second,
		Timeout:        10 * time.Second,
		ExpectedStatus: 200,
		Enabled:        true,
		CreatedAt:      now,
		UpdatedAt:      now,
	}
	state.Monitors[monitor.ID] = monitor
	require.NoError(t, s.CreateMonitor(monitor))

	handler := &mockEffectHandler{}
	scheduler := New(s, &state, handler)

	ctx := context.Background()

	// Dispatch a RecordCheck action
	checkAction := reducer.RecordCheck{
		ID:         "check-1",
		MonitorID:  "mon-1",
		Status:     reducer.StatusUp,
		LatencyMs:  150,
		StatusCode: 200,
		CheckedAt:  now,
	}

	err := scheduler.Dispatch(ctx, checkAction)
	require.NoError(t, err)

	// Verify check was persisted
	latest, err := s.GetLatestCheck("mon-1")
	require.NoError(t, err)
	require.NotNil(t, latest)
	assert.Equal(t, "check-1", latest.ID)
	assert.Equal(t, reducer.StatusUp, latest.Status)
	assert.Equal(t, int64(150), latest.LatencyMs)
}

func TestScheduler_NotificationOnFailureThreshold(t *testing.T) {
	s := newTestStore(t)
	state := reducer.NewState()

	// Add a monitor to state
	now := time.Now().UTC()
	monitor := reducer.Monitor{
		ID:             "mon-1",
		Name:           "Test",
		URL:            "https://example.com",
		Type:           reducer.MonitorHTTPS,
		Interval:       60 * time.Second,
		Timeout:        10 * time.Second,
		ExpectedStatus: 200,
		Enabled:        true,
		CreatedAt:      now,
		UpdatedAt:      now,
	}
	state.Monitors[monitor.ID] = monitor
	require.NoError(t, s.CreateMonitor(monitor))

	// Add a notification channel
	ch := reducer.NotificationChannel{
		ID:      "ch-1",
		Type:    reducer.NotifySlack,
		Name:    "Slack",
		Config:  map[string]string{"url": "https://example.com"},
		Enabled: true,
	}
	state.NotificationChannels[ch.ID] = ch
	require.NoError(t, s.CreateNotificationChannel(ch))

	handler := &mockEffectHandler{}
	scheduler := New(s, &state, handler)

	ctx := context.Background()

	// Dispatch 3 consecutive failures (threshold for notifications)
	for i := 0; i < 3; i++ {
		checkAction := reducer.RecordCheck{
			ID:         "check-" + string(rune('a'+i)),
			MonitorID:  "mon-1",
			Status:     reducer.StatusDown,
			LatencyMs:  0,
			StatusCode: 500,
			Error:      "server error",
			CheckedAt:  now.Add(time.Duration(i) * time.Minute),
		}
		err := scheduler.Dispatch(ctx, checkAction)
		require.NoError(t, err)
	}

	// Verify consecutive failures are tracked in state
	updatedState := scheduler.GetState()
	assert.Equal(t, 3, updatedState.ConsecutiveFailures["mon-1"])

	// Verify notification effect was sent
	var foundNotification bool
	for _, effect := range handler.effects {
		if _, ok := effect.(reducer.SendNotification); ok {
			foundNotification = true
			break
		}
	}
	assert.True(t, foundNotification, "expected SendNotification effect on failure threshold")
}

func TestScheduler_GetState(t *testing.T) {
	s := newTestStore(t)
	state := reducer.NewState()
	state.Settings.SiteName = "Test Site"

	handler := &mockEffectHandler{}
	scheduler := New(s, &state, handler)

	got := scheduler.GetState()
	assert.Equal(t, "Test Site", got.Settings.SiteName)
}
