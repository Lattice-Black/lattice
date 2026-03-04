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
func (r *Registry) Dispatch(ctx context.Context, channelID string, n Notification) error {
	r.mu.RLock()
	defer r.mu.RUnlock()

	// Look up the channel from state
	channel, exists := r.state.NotificationChannels[channelID]
	if !exists {
		return fmt.Errorf("notification channel %q not found", channelID)
	}

	if !channel.Enabled {
		return nil // silently skip disabled channels
	}

	dispatcher, exists := r.dispatchers[channel.Type]
	if !exists {
		return fmt.Errorf("no dispatcher registered for channel type %q", channel.Type)
	}

	return dispatcher.Send(ctx, n, channel.Config)
}

// Handle implements scheduler.EffectHandler for SendNotification effects.
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

	return r.Dispatch(ctx, sn.ChannelID, n)
}

// UpdateState updates the state reference used by the registry.
func (r *Registry) UpdateState(state *reducer.State) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.state = state
}
