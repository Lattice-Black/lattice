package scheduler

import (
	"context"
	"log"
	"math/rand"
	"sync"
	"time"

	"github.com/Lattice-Black/lattice/internal/monitor"
	"github.com/Lattice-Black/lattice/internal/reducer"
	"github.com/Lattice-Black/lattice/internal/store"
)

// EffectHandler processes side effects from the reducer.
type EffectHandler interface {
	Handle(ctx context.Context, effect reducer.SideEffect) error
}

// Scheduler manages health checks for all monitors.
type Scheduler struct {
	store         store.Store
	effectHandler EffectHandler

	mu       sync.RWMutex
	state    *reducer.State
	monitors map[string]*monitorRunner
	wg       sync.WaitGroup
}

// monitorRunner manages the check loop for a single monitor.
type monitorRunner struct {
	monitor reducer.Monitor
	checker monitor.Checker
	cancel  context.CancelFunc
}

// New creates a new Scheduler.
func New(s store.Store, state *reducer.State, handler EffectHandler) *Scheduler {
	return &Scheduler{
		store:         s,
		state:         state,
		effectHandler: handler,
		monitors:      make(map[string]*monitorRunner),
	}
}

// Start begins scheduling checks for all enabled monitors.
func (s *Scheduler) Start(ctx context.Context) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	for _, m := range s.state.Monitors {
		if m.Enabled {
			s.startMonitor(ctx, m)
		}
	}

	return nil
}

// Stop gracefully stops all monitor checks.
func (s *Scheduler) Stop() {
	s.mu.Lock()
	for _, runner := range s.monitors {
		runner.cancel()
	}
	s.monitors = make(map[string]*monitorRunner)
	s.mu.Unlock()

	s.wg.Wait()
}

// AddMonitor adds a new monitor to the scheduler.
func (s *Scheduler) AddMonitor(ctx context.Context, m reducer.Monitor) {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Stop existing runner if present
	if runner, exists := s.monitors[m.ID]; exists {
		runner.cancel()
		delete(s.monitors, m.ID)
	}

	if m.Enabled {
		s.startMonitor(ctx, m)
	}
}

// RemoveMonitor removes a monitor from the scheduler.
func (s *Scheduler) RemoveMonitor(id string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if runner, exists := s.monitors[id]; exists {
		runner.cancel()
		delete(s.monitors, id)
	}
}

// UpdateMonitor updates a monitor's configuration.
func (s *Scheduler) UpdateMonitor(ctx context.Context, m reducer.Monitor) {
	s.AddMonitor(ctx, m) // AddMonitor handles stopping the old runner
}

// Dispatch processes an action through the reducer and handles effects.
func (s *Scheduler) Dispatch(ctx context.Context, action reducer.Action) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	newState, effects, err := reducer.Reduce(*s.state, action)
	if err != nil {
		return err
	}

	*s.state = newState

	// Process side effects
	for _, effect := range effects {
		if err := s.handleEffect(ctx, effect); err != nil {
			log.Printf("error handling effect %s: %v", effect.EffectType(), err)
		}
	}

	return nil
}

func (s *Scheduler) handleEffect(ctx context.Context, effect reducer.SideEffect) error {
	switch e := effect.(type) {
	case reducer.PersistState:
		return s.persistAction(e.Action)
	default:
		if s.effectHandler != nil {
			return s.effectHandler.Handle(ctx, effect)
		}
	}
	return nil
}

func (s *Scheduler) persistAction(action reducer.Action) error {
	switch a := action.(type) {
	case reducer.CreateMonitor:
		m := s.state.Monitors[a.ID]
		return s.store.CreateMonitor(m)
	case reducer.UpdateMonitor:
		m := s.state.Monitors[a.ID]
		return s.store.UpdateMonitor(m)
	case reducer.DeleteMonitor:
		return s.store.DeleteMonitor(a.ID)
	case reducer.RecordCheck:
		check := reducer.Check{
			ID:         a.ID,
			MonitorID:  a.MonitorID,
			Status:     a.Status,
			LatencyMs:  a.LatencyMs,
			StatusCode: a.StatusCode,
			Error:      a.Error,
			CheckedAt:  a.CheckedAt,
		}
		return s.store.RecordCheck(check)
	case reducer.CreateIncident:
		inc := s.state.Incidents[a.ID]
		return s.store.CreateIncident(inc)
	case reducer.UpdateIncident:
		inc := s.state.Incidents[a.ID]
		if err := s.store.UpdateIncident(inc); err != nil {
			return err
		}
		// Also persist the incident update
		updates := s.state.IncidentUpdates[a.ID]
		if len(updates) > 0 {
			latestUpdate := updates[len(updates)-1]
			return s.store.CreateIncidentUpdate(latestUpdate)
		}
		return nil
	case reducer.ResolveIncident:
		inc := s.state.Incidents[a.ID]
		if err := s.store.UpdateIncident(inc); err != nil {
			return err
		}
		// Also persist the incident update
		updates := s.state.IncidentUpdates[a.ID]
		if len(updates) > 0 {
			latestUpdate := updates[len(updates)-1]
			return s.store.CreateIncidentUpdate(latestUpdate)
		}
		return nil
	case reducer.CreateNotificationChannel:
		ch := s.state.NotificationChannels[a.ID]
		return s.store.CreateNotificationChannel(ch)
	case reducer.DeleteNotificationChannel:
		return s.store.DeleteNotificationChannel(a.ID)
	case reducer.CreateMaintenanceWindow:
		mw := s.state.MaintenanceWindows[a.ID]
		return s.store.CreateMaintenanceWindow(mw)
	case reducer.DeleteMaintenanceWindow:
		return s.store.DeleteMaintenanceWindow(a.ID)
	case reducer.UpdateSettings:
		return s.store.UpdateSettings(s.state.Settings)
	}
	return nil
}

func (s *Scheduler) startMonitor(ctx context.Context, m reducer.Monitor) {
	runnerCtx, cancel := context.WithCancel(ctx)

	runner := &monitorRunner{
		monitor: m,
		checker: monitor.NewChecker(m.Type),
		cancel:  cancel,
	}

	s.monitors[m.ID] = runner
	s.wg.Add(1)

	go s.runMonitor(runnerCtx, runner)
}

func (s *Scheduler) runMonitor(ctx context.Context, runner *monitorRunner) {
	defer s.wg.Done()

	// Add jitter (up to 10% of interval)
	jitter := time.Duration(rand.Int63n(int64(runner.monitor.Interval / 10)))

	// Perform initial check after jitter
	select {
	case <-ctx.Done():
		return
	case <-time.After(jitter):
	}

	// Run first check immediately
	s.performCheck(ctx, runner)

	// Create ticker for subsequent checks
	ticker := time.NewTicker(runner.monitor.Interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			s.performCheck(ctx, runner)
		}
	}
}

func (s *Scheduler) performCheck(ctx context.Context, runner *monitorRunner) {
	check := runner.checker.Check(ctx, runner.monitor)

	action := reducer.RecordCheck{
		ID:         check.ID,
		MonitorID:  check.MonitorID,
		Status:     check.Status,
		LatencyMs:  check.LatencyMs,
		StatusCode: check.StatusCode,
		Error:      check.Error,
		CheckedAt:  check.CheckedAt,
	}

	if err := s.Dispatch(ctx, action); err != nil {
		log.Printf("error dispatching check for %s: %v", runner.monitor.Name, err)
	}
}

// GetState returns a copy of the current state.
func (s *Scheduler) GetState() reducer.State {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return *s.state
}
