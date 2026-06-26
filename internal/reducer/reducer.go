package reducer

import (
	"fmt"
	"time"
)

// Reduce applies an action to the current state and returns the new state
// plus any side effects that should be executed.
// This function is PURE -- no I/O, no database, no network.
// All side effects are returned as data for the runtime to execute.
//
// The caller MUST pass a cloned state if it needs to preserve the original.
func Reduce(state State, action Action) (State, []SideEffect, error) {
	switch a := action.(type) {
	case CreateMonitor:
		return reduceCreateMonitor(state, a)
	case UpdateMonitor:
		return reduceUpdateMonitor(state, a)
	case DeleteMonitor:
		return reduceDeleteMonitor(state, a)
	case RecordCheck:
		return reduceRecordCheck(state, a)
	case CreateIncident:
		return reduceCreateIncident(state, a)
	case UpdateIncident:
		return reduceUpdateIncident(state, a)
	case ResolveIncident:
		return reduceResolveIncident(state, a)
	case DeleteIncident:
		return reduceDeleteIncident(state, a)
	case CreateNotificationChannel:
		return reduceCreateNotificationChannel(state, a)
	case UpdateNotificationChannel:
		return reduceUpdateNotificationChannel(state, a)
	case DeleteNotificationChannel:
		return reduceDeleteNotificationChannel(state, a)
	case CreateMaintenanceWindow:
		return reduceCreateMaintenanceWindow(state, a)
	case DeleteMaintenanceWindow:
		return reduceDeleteMaintenanceWindow(state, a)
	case UpdateSettings:
		return reduceUpdateSettings(state, a)
	default:
		return state, nil, fmt.Errorf("unknown action type: %T", action)
	}
}

func reduceCreateMonitor(state State, a CreateMonitor) (State, []SideEffect, error) {
	if _, exists := state.Monitors[a.ID]; exists {
		return state, nil, fmt.Errorf("monitor %s already exists", a.ID)
	}
	if a.Name == "" {
		return state, nil, fmt.Errorf("monitor name is required")
	}
	if a.URL == "" {
		return state, nil, fmt.Errorf("monitor URL is required")
	}

	m := Monitor{
		ID:             a.ID,
		Name:           a.Name,
		URL:            a.URL,
		Type:           a.Type,
		Interval:       a.Interval,
		Timeout:        a.Timeout,
		ExpectedStatus: a.ExpectedStatus,
		Enabled:        true,
		Group:          a.Group,
		CreatedAt:      a.Now,
		UpdatedAt:      a.Now,
	}

	// Default timeout
	if m.Timeout == 0 {
		m.Timeout = 10 * time.Second
	}
	// Default interval
	if m.Interval == 0 {
		m.Interval = 60 * time.Second
	}
	// Default expected status for HTTP
	if m.ExpectedStatus == 0 && (m.Type == MonitorHTTP || m.Type == MonitorHTTPS) {
		m.ExpectedStatus = 200
	}

	state.Monitors[a.ID] = m
	state.ConsecutiveFailures[a.ID] = 0

	return state, []SideEffect{PersistState{Action: a}}, nil
}

func reduceUpdateMonitor(state State, a UpdateMonitor) (State, []SideEffect, error) {
	m, exists := state.Monitors[a.ID]
	if !exists {
		return state, nil, fmt.Errorf("monitor %s not found", a.ID)
	}

	if a.Name != nil {
		m.Name = *a.Name
	}
	if a.URL != nil {
		m.URL = *a.URL
	}
	if a.Type != nil {
		m.Type = *a.Type
	}
	if a.Interval != nil {
		m.Interval = *a.Interval
	}
	if a.Timeout != nil {
		m.Timeout = *a.Timeout
	}
	if a.ExpectedStatus != nil {
		m.ExpectedStatus = *a.ExpectedStatus
	}
	if a.Enabled != nil {
		m.Enabled = *a.Enabled
	}
	if a.Group != nil {
		m.Group = *a.Group
	}
	m.UpdatedAt = a.Now

	state.Monitors[a.ID] = m
	return state, []SideEffect{PersistState{Action: a}}, nil
}

func reduceDeleteMonitor(state State, a DeleteMonitor) (State, []SideEffect, error) {
	if _, exists := state.Monitors[a.ID]; !exists {
		return state, nil, fmt.Errorf("monitor %s not found", a.ID)
	}
	delete(state.Monitors, a.ID)
	delete(state.ConsecutiveFailures, a.ID)

	// Clean up associated incidents and their updates from in-memory state.
	// The database handles cascade deletion, but the in-memory state needs
	// to be cleaned up manually.
	for id, inc := range state.Incidents {
		if inc.MonitorID == a.ID {
			delete(state.Incidents, id)
			delete(state.IncidentUpdates, id)
		}
	}

	// Clean up maintenance windows for this monitor
	for id, mw := range state.MaintenanceWindows {
		if mw.MonitorID == a.ID {
			delete(state.MaintenanceWindows, id)
		}
	}

	return state, []SideEffect{PersistState{Action: a}}, nil
}

func reduceRecordCheck(state State, a RecordCheck) (State, []SideEffect, error) {
	monitor, exists := state.Monitors[a.MonitorID]
	if !exists {
		return state, nil, fmt.Errorf("monitor %s not found", a.MonitorID)
	}

	effects := []SideEffect{PersistState{Action: a}}

	if a.Status == StatusDown || a.Status == StatusDegraded {
		state.ConsecutiveFailures[a.MonitorID]++

		// Check if we should auto-create an incident
		if state.ConsecutiveFailures[a.MonitorID] == AutoIncidentThreshold {
			// Only if there's no active incident for this monitor
			if !hasActiveIncident(state, a.MonitorID) {
				// Check if monitor is in a maintenance window
				if !isInMaintenanceWindow(state, a.MonitorID, a.CheckedAt) {
					// Add notification effects for all enabled channels
					for _, ch := range state.NotificationChannels {
						if ch.Enabled {
							effects = append(effects, SendNotification{
								ChannelID: ch.ID,
								Title:     fmt.Sprintf("%s is down", monitor.Name),
								Message:   fmt.Sprintf("Monitor %s (%s) has failed %d consecutive checks. Last error: %s", monitor.Name, monitor.URL, AutoIncidentThreshold, a.Error),
								Severity:  SeverityMajor,
								MonitorID: a.MonitorID,
							})
						}
					}
				}
			}
		}
	} else if a.Status == StatusUp {
		wasDown := state.ConsecutiveFailures[a.MonitorID] >= AutoIncidentThreshold
		state.ConsecutiveFailures[a.MonitorID] = 0

		// If monitor recovered and had an active incident, notify
		if wasDown {
			for _, ch := range state.NotificationChannels {
				if ch.Enabled {
					effects = append(effects, SendNotification{
						ChannelID: ch.ID,
						Title:     fmt.Sprintf("%s is back up", monitor.Name),
						Message:   fmt.Sprintf("Monitor %s (%s) has recovered.", monitor.Name, monitor.URL),
						Severity:  SeverityMinor,
						MonitorID: a.MonitorID,
					})
				}
			}
		}
	}

	return state, effects, nil
}

func reduceCreateIncident(state State, a CreateIncident) (State, []SideEffect, error) {
	if _, exists := state.Incidents[a.ID]; exists {
		return state, nil, fmt.Errorf("incident %s already exists", a.ID)
	}

	inc := Incident{
		ID:          a.ID,
		MonitorID:   a.MonitorID,
		Title:       a.Title,
		Severity:    a.Severity,
		Status:      IncidentInvestigating,
		AutoCreated: a.AutoCreated,
		CreatedAt:   a.Now,
		UpdatedAt:   a.Now,
	}

	state.Incidents[a.ID] = inc

	// Create initial update if message is provided
	if a.Message != "" {
		update := IncidentUpdate{
			ID:         fmt.Sprintf("%s-0", a.ID),
			IncidentID: a.ID,
			Status:     IncidentInvestigating,
			Message:    a.Message,
			CreatedAt:  a.Now,
		}
		state.IncidentUpdates[a.ID] = append(state.IncidentUpdates[a.ID], update)
	}

	effects := []SideEffect{PersistState{Action: a}}

	// Notify all channels
	for _, ch := range state.NotificationChannels {
		if ch.Enabled {
			effects = append(effects, SendNotification{
				ChannelID: ch.ID,
				Title:     fmt.Sprintf("Incident: %s", a.Title),
				Message:   fmt.Sprintf("New %s incident created for monitor %s", a.Severity, a.MonitorID),
				Severity:  a.Severity,
				MonitorID: a.MonitorID,
			})
		}
	}

	return state, effects, nil
}

func reduceUpdateIncident(state State, a UpdateIncident) (State, []SideEffect, error) {
	inc, exists := state.Incidents[a.ID]
	if !exists {
		return state, nil, fmt.Errorf("incident %s not found", a.ID)
	}
	if inc.Status == IncidentResolved {
		return state, nil, fmt.Errorf("incident %s is already resolved", a.ID)
	}

	inc.Status = a.Status
	inc.UpdatedAt = a.Now
	state.Incidents[a.ID] = inc

	update := IncidentUpdate{
		ID:         fmt.Sprintf("%s-%d", a.ID, len(state.IncidentUpdates[a.ID])),
		IncidentID: a.ID,
		Status:     a.Status,
		Message:    a.Message,
		CreatedAt:  a.Now,
	}
	state.IncidentUpdates[a.ID] = append(state.IncidentUpdates[a.ID], update)

	return state, []SideEffect{PersistState{Action: a}}, nil
}

func reduceResolveIncident(state State, a ResolveIncident) (State, []SideEffect, error) {
	inc, exists := state.Incidents[a.ID]
	if !exists {
		return state, nil, fmt.Errorf("incident %s not found", a.ID)
	}
	if inc.Status == IncidentResolved {
		return state, nil, fmt.Errorf("incident %s is already resolved", a.ID)
	}

	inc.Status = IncidentResolved
	inc.UpdatedAt = a.Now
	inc.ResolvedAt = &a.Now
	state.Incidents[a.ID] = inc

	update := IncidentUpdate{
		ID:         fmt.Sprintf("%s-%d", a.ID, len(state.IncidentUpdates[a.ID])),
		IncidentID: a.ID,
		Status:     IncidentResolved,
		Message:    a.Message,
		CreatedAt:  a.Now,
	}
	state.IncidentUpdates[a.ID] = append(state.IncidentUpdates[a.ID], update)

	effects := []SideEffect{PersistState{Action: a}}

	// Notify resolution
	for _, ch := range state.NotificationChannels {
		if ch.Enabled {
			effects = append(effects, SendNotification{
				ChannelID: ch.ID,
				Title:     fmt.Sprintf("Resolved: %s", inc.Title),
				Message:   a.Message,
				Severity:  inc.Severity,
				MonitorID: inc.MonitorID,
			})
		}
	}

	return state, effects, nil
}

func reduceDeleteIncident(state State, a DeleteIncident) (State, []SideEffect, error) {
	if _, exists := state.Incidents[a.ID]; !exists {
		return state, nil, fmt.Errorf("incident %s not found", a.ID)
	}
	delete(state.Incidents, a.ID)
	delete(state.IncidentUpdates, a.ID)
	return state, []SideEffect{PersistState{Action: a}}, nil
}

func reduceCreateNotificationChannel(state State, a CreateNotificationChannel) (State, []SideEffect, error) {
	if _, exists := state.NotificationChannels[a.ID]; exists {
		return state, nil, fmt.Errorf("notification channel %s already exists", a.ID)
	}

	ch := NotificationChannel{
		ID:        a.ID,
		Type:      a.Type,
		Name:      a.Name,
		Config:    a.Config,
		Enabled:   true,
		CreatedAt: a.Now,
		UpdatedAt: a.Now,
	}

	state.NotificationChannels[a.ID] = ch
	return state, []SideEffect{PersistState{Action: a}}, nil
}

func reduceUpdateNotificationChannel(state State, a UpdateNotificationChannel) (State, []SideEffect, error) {
	ch, exists := state.NotificationChannels[a.ID]
	if !exists {
		return state, nil, fmt.Errorf("notification channel %s not found", a.ID)
	}

	if a.Name != nil {
		ch.Name = *a.Name
	}
	if a.Config != nil {
		ch.Config = a.Config
	}
	if a.Enabled != nil {
		ch.Enabled = *a.Enabled
	}
	ch.UpdatedAt = a.Now

	state.NotificationChannels[a.ID] = ch
	return state, []SideEffect{PersistState{Action: a}}, nil
}

func reduceDeleteNotificationChannel(state State, a DeleteNotificationChannel) (State, []SideEffect, error) {
	if _, exists := state.NotificationChannels[a.ID]; !exists {
		return state, nil, fmt.Errorf("notification channel %s not found", a.ID)
	}
	delete(state.NotificationChannels, a.ID)
	return state, []SideEffect{PersistState{Action: a}}, nil
}

func reduceCreateMaintenanceWindow(state State, a CreateMaintenanceWindow) (State, []SideEffect, error) {
	if _, exists := state.MaintenanceWindows[a.ID]; exists {
		return state, nil, fmt.Errorf("maintenance window %s already exists", a.ID)
	}

	mw := MaintenanceWindow{
		ID:          a.ID,
		MonitorID:   a.MonitorID,
		Title:       a.Title,
		Description: a.Description,
		StartsAt:    a.StartsAt,
		EndsAt:      a.EndsAt,
		CreatedAt:   a.Now,
	}

	state.MaintenanceWindows[a.ID] = mw
	return state, []SideEffect{PersistState{Action: a}}, nil
}

func reduceDeleteMaintenanceWindow(state State, a DeleteMaintenanceWindow) (State, []SideEffect, error) {
	if _, exists := state.MaintenanceWindows[a.ID]; !exists {
		return state, nil, fmt.Errorf("maintenance window %s not found", a.ID)
	}
	delete(state.MaintenanceWindows, a.ID)
	return state, []SideEffect{PersistState{Action: a}}, nil
}

func reduceUpdateSettings(state State, a UpdateSettings) (State, []SideEffect, error) {
	if a.SiteName != nil {
		state.Settings.SiteName = *a.SiteName
	}
	if a.LogoURL != nil {
		state.Settings.LogoURL = *a.LogoURL
	}
	if a.AccentColor != nil {
		state.Settings.AccentColor = *a.AccentColor
	}
	if a.CustomCSS != nil {
		state.Settings.CustomCSS = *a.CustomCSS
	}
	if a.CustomDomain != nil {
		state.Settings.CustomDomain = *a.CustomDomain
	}
	return state, []SideEffect{PersistState{Action: a}}, nil
}

// --- Helper functions ---

func hasActiveIncident(state State, monitorID string) bool {
	for _, inc := range state.Incidents {
		if inc.MonitorID == monitorID && inc.Status != IncidentResolved {
			return true
		}
	}
	return false
}

func isInMaintenanceWindow(state State, monitorID string, now time.Time) bool {
	for _, mw := range state.MaintenanceWindows {
		if mw.MonitorID == monitorID && now.After(mw.StartsAt) && now.Before(mw.EndsAt) {
			return true
		}
	}
	return false
}