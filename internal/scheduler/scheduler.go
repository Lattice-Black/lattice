package scheduler

import (
	"context"
	"log"
	"math/rand"
	"sync"
	"time"

	"github.com/Lattice-Black/lattice/internal/config"
	"github.com/Lattice-Black/lattice/internal/monitor"
	"github.com/Lattice-Black/lattice/internal/reducer"
	"github.com/Lattice-Black/lattice/internal/store"
	"github.com/google/uuid"
)

// EffectHandler processes side effects from the reducer.
type EffectHandler interface {
	Handle(ctx context.Context, effect reducer.SideEffect) error
}

// Scheduler manages health checks for all monitors.
type Scheduler struct {
	store         store.Store
	effectHandler EffectHandler
	retentionDays int
	ctx           context.Context // long-lived context for monitor runners

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
		retentionDays: 90,
	}
}

// SetRetentionDays configures the check history retention period.
func (s *Scheduler) SetRetentionDays(days int) {
	s.retentionDays = days
}

// SeedFromConfig populates the store and state with monitors and notifications
// defined in the YAML config that don't already exist in the database.
func (s *Scheduler) SeedFromConfig(cfg *config.Config) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	now := time.Now().UTC()

	// Seed monitors
	for _, mc := range cfg.Monitors {
		if !mc.IsEnabled() {
			continue
		}

		// Check if a monitor with the same name+url already exists
		exists := false
		for _, m := range s.state.Monitors {
			if m.Name == mc.Name && m.URL == mc.URL {
				exists = true
				break
			}
		}
		if exists {
			continue
		}

		id := uuid.New().String()
		action := reducer.CreateMonitor{
			ID:             id,
			Name:           mc.Name,
			URL:            mc.URL,
			Type:           reducer.MonitorType(mc.Type),
			Interval:       mc.ParsedInterval(),
			Timeout:        mc.ParsedTimeout(),
			ExpectedStatus: mc.ExpectedStatus,
			Group:          mc.Group,
			Now:            now,
		}

		newState, effects, err := reducer.Reduce(s.state.Clone(), action)
		if err != nil {
			log.Printf("warning: failed to seed monitor %s: %v", mc.Name, err)
			continue
		}
		*s.state = newState

		// Persist
		for range effects {
			if err := s.persistAction(action); err != nil {
				log.Printf("warning: failed to persist seeded monitor %s: %v", mc.Name, err)
			}
		}
		log.Printf("Seeded monitor from config: %s", mc.Name)
	}

	// Seed notification channels
	for _, nc := range cfg.Notifications {
		if !nc.IsEnabled() {
			continue
		}

		// Check if a channel with the same name+type already exists
		exists := false
		for _, ch := range s.state.NotificationChannels {
			if ch.Name == nc.Name && string(ch.Type) == nc.Type {
				exists = true
				break
			}
		}
		if exists {
			continue
		}

		id := uuid.New().String()
		action := reducer.CreateNotificationChannel{
			ID:     id,
			Type:   reducer.NotificationChannelType(nc.Type),
			Name:   nc.Name,
			Config: nc.Config,
			Now:    now,
		}

		newState, effects, err := reducer.Reduce(s.state.Clone(), action)
		if err != nil {
			log.Printf("warning: failed to seed notification %s: %v", nc.Name, err)
			continue
		}
		*s.state = newState

		for range effects {
			if err := s.persistAction(action); err != nil {
				log.Printf("warning: failed to persist seeded notification %s: %v", nc.Name, err)
			}
		}
		log.Printf("Seeded notification channel from config: %s", nc.Name)
	}

	return nil
}

// Start begins scheduling checks for all enabled monitors.
func (s *Scheduler) Start(ctx context.Context) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.ctx = ctx

	for _, m := range s.state.Monitors {
		if m.Enabled {
			s.startMonitor(ctx, m)
		}
	}

	// Start pruning goroutine
	go s.runPruning(ctx)

	return nil
}

// runPruning periodically removes old checks beyond the retention period.
func (s *Scheduler) runPruning(ctx context.Context) {
	ticker := time.NewTicker(1 * time.Hour)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			before := time.Now().AddDate(0, 0, -s.retentionDays)
			pruned, err := s.store.PruneChecks(before)
			if err != nil {
				log.Printf("error pruning old checks: %v", err)
			} else if pruned > 0 {
				log.Printf("Pruned %d old checks", pruned)
			}
		}
	}
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
// It uses the scheduler's long-lived context (from Start) rather than the
// request context, which would be cancelled when the HTTP response is sent.
func (s *Scheduler) AddMonitor(_ context.Context, m reducer.Monitor) {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Stop existing runner if present
	if runner, exists := s.monitors[m.ID]; exists {
		runner.cancel()
		delete(s.monitors, m.ID)
	}

	if m.Enabled {
		s.startMonitor(s.ctx, m)
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
func (s *Scheduler) UpdateMonitor(_ context.Context, m reducer.Monitor) {
	s.AddMonitor(nil, m) // AddMonitor handles stopping the old runner
}

// Dispatch processes an action through the reducer and handles effects.
// State is deep-copied before mutation to prevent concurrent access.
func (s *Scheduler) Dispatch(ctx context.Context, action reducer.Action) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Clone state so the reducer mutates a copy, not the live state
	newState, effects, err := reducer.Reduce(s.state.Clone(), action)
	if err != nil {
		return err
	}

	// Atomically swap state
	*s.state = newState

	// Process side effects
	// PersistState effects are handled synchronously (fast, local)
	// SendNotification effects are handled asynchronously (slow, network)
	for _, effect := range effects {
		switch e := effect.(type) {
		case reducer.PersistState:
			if err := s.persistAction(e.Action); err != nil {
				log.Printf("error persisting action %s: %v", e.Action.ActionType(), err)
			}
		default:
			// Handle notification effects asynchronously to avoid blocking
			if s.effectHandler != nil {
				go func(ef reducer.SideEffect) {
					if err := s.effectHandler.Handle(ctx, ef); err != nil {
						log.Printf("error handling effect %s: %v", ef.EffectType(), err)
					}
				}(effect)
			}
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
		if err := s.store.CreateIncident(inc); err != nil {
			return err
		}
		// Persist initial incident update if present
		updates := s.state.IncidentUpdates[a.ID]
		for _, u := range updates {
			if err := s.store.CreateIncidentUpdate(u); err != nil {
				return err
			}
		}
		return nil
	case reducer.UpdateIncident:
		inc := s.state.Incidents[a.ID]
		if err := s.store.UpdateIncident(inc); err != nil {
			return err
		}
		// Also persist the latest incident update
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
	case reducer.DeleteIncident:
		return s.store.DeleteIncident(a.ID)
	case reducer.CreateNotificationChannel:
		ch := s.state.NotificationChannels[a.ID]
		return s.store.CreateNotificationChannel(ch)
	case reducer.UpdateNotificationChannel:
		ch := s.state.NotificationChannels[a.ID]
		return s.store.UpdateNotificationChannel(ch)
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
	jitter := time.Duration(rand.Int63n(int64(runner.monitor.Interval/10) + 1))

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

// GetState returns a deep copy of the current state.
func (s *Scheduler) GetState() reducer.State {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.state.Clone()
}