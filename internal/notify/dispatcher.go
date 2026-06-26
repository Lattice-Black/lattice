package notify

import (
	"context"
	"fmt"
	"sync"

	"github.com/Lattice-Black/lattice/internal/reducer"
)

// Notification holds the data to send via a dispatcher.
type Notification struct {
	Title     string
	Message   string
	Severity  reducer.Severity
	MonitorID string
}

// Dispatcher sends notifications to a specific channel type.
type Dispatcher interface {
	Send(ctx context.Context, n Notification, config map[string]string) error
	Type() reducer.NotificationChannelType
}

// Registry holds all registered dispatchers and routes notifications.
// The registry holds a pointer to the scheduler's state. Because the
// scheduler replaces state contents via *s.state = newState (a struct
// assignment that isn't atomic), the registry must hold its own mutex
// and snapshot channel data before releasing the lock so dispatchers
// never read from a map that's being swapped out concurrently.
type Registry struct {
	mu          sync.RWMutex
	dispatchers map[reducer.NotificationChannelType]Dispatcher
	state       *reducer.State
}

// NewRegistry creates a new notification registry.
func NewRegistry(state *reducer.State) *Registry {
	return &Registry{
		dispatchers: make(map[reducer.NotificationChannelType]Dispatcher),
		state:       state,
	}
}

// Register adds a dispatcher to the registry.
func (r *Registry) Register(d Dispatcher) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.dispatchers[d.Type()] = d
}

// Dispatch sends a notification through the appropriate dispatcher.
// For SendNotification effects that have pre-resolved Config and ChannelType
// (populated by the scheduler), it uses those directly. Otherwise it falls
// back to looking up the channel from state.
func (r *Registry) Dispatch(ctx context.Context, channelID string, n Notification) error {
	r.mu.RLock()

	channel, exists := r.state.NotificationChannels[channelID]
	if !exists {
		r.mu.RUnlock()
		return fmt.Errorf("notification channel %q not found", channelID)
	}

	if !channel.Enabled {
		r.mu.RUnlock()
		return nil // silently skip disabled channels
	}

	dispatcher, exists := r.dispatchers[channel.Type]

	// Copy the config map so the dispatcher doesn't read from the live state
	configCopy := make(map[string]string, len(channel.Config))
	for k, v := range channel.Config {
		configCopy[k] = v
	}

	r.mu.RUnlock()

	if !exists {
		return fmt.Errorf("no dispatcher registered for channel type %q", channel.Type)
	}

	return dispatcher.Send(ctx, n, configCopy)
}

// Handle implements scheduler.EffectHandler for SendNotification effects.
// If the effect has pre-resolved Config and ChannelType (populated by the
// scheduler while holding its lock), it uses those directly. Otherwise it
// falls back to looking up the channel from state via Dispatch.
func (r *Registry) Handle(ctx context.Context, effect reducer.SideEffect) error {
	sn, ok := effect.(reducer.SendNotification)
	if !ok {
		// Not a notification effect, ignore
		return nil
	}

	n := Notification{
		Title:     sn.Title,
		Message:   sn.Message,
		Severity:  sn.Severity,
		MonitorID: sn.MonitorID,
	}

	// If the scheduler pre-resolved the channel config, use it directly.
	// This avoids reading from the shared state and prevents data races.
	if sn.Config != nil && sn.ChannelType != "" {
		r.mu.RLock()
		dispatcher, exists := r.dispatchers[sn.ChannelType]
		r.mu.RUnlock()

		if !exists {
			return fmt.Errorf("no dispatcher registered for channel type %q", sn.ChannelType)
		}

		// Check if channel is enabled
		r.mu.RLock()
		channel, chExists := r.state.NotificationChannels[sn.ChannelID]
		r.mu.RUnlock()
		if chExists && !channel.Enabled {
			return nil
		}

		return dispatcher.Send(ctx, n, sn.Config)
	}

	// Fallback: resolve from state
	return r.Dispatch(ctx, sn.ChannelID, n)
}

// UpdateState updates the state reference used by the registry.
func (r *Registry) UpdateState(state *reducer.State) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.state = state
}