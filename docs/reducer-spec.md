# Lattice — Reducer & State Specification

## Design Philosophy

Lattice uses a **reducer pattern** for all state mutations. This is the same architectural pattern used by Redux/Elm:

```
(State, Action) → (State, []SideEffect)
```

The reducer is **pure** — no I/O, no database writes, no network calls. Side effects (persisting to the database, sending notifications) are returned as data for the runtime (scheduler) to execute. This makes the entire system:

- **Deterministic** — same input always produces same output
- **Testable** — no mocking needed, just call `Reduce` and assert on the returned state
- **Traceable** — every state change has a clear cause (the action)

## State

```go
type State struct {
    Monitors             map[string]Monitor
    Checks               map[string][]Check          // keyed by monitor ID
    Incidents            map[string]Incident
    IncidentUpdates      map[string][]IncidentUpdate  // keyed by incident ID
    NotificationChannels map[string]NotificationChannel
    MaintenanceWindows   map[string]MaintenanceWindow
    Settings             Settings
}
```

## Actions

Every state mutation is an `Action` implementing `ActionType() string`.

### Monitor Actions

| Action | Fields | Effect |
|--------|--------|--------|
| `CreateMonitor` | ID, Name, URL, Type, Interval, Timeout, ExpectedStatus, Group, Now | Adds monitor to state. Returns `PersistState`. |
| `UpdateMonitor` | ID, Name*, URL*, Type*, Interval*, Timeout*, ExpectedStatus*, Enabled*, Group*, Now | Updates monitor fields. Returns `PersistState`. Scheduler is notified to update the ticker. |
| `DeleteMonitor` | ID | Removes monitor + all related checks, incidents, maintenance windows. Returns `PersistState`. |
| `RecordCheck` | ID, MonitorID, Status, LatencyMs, StatusCode, Error, CheckedAt | Appends check to history. Updates monitor's current status. If failures exceed threshold (3), auto-creates incident + `SendNotification`. On recovery, resolves incident + `SendNotification`. Returns `PersistState` + `PruneOldChecks` + optionally `SendNotification`. |

### Incident Actions

| Action | Fields | Effect |
|--------|--------|--------|
| `CreateIncident` | ID, MonitorID, Title, Severity, AutoCreated, Message, Now | Creates incident + initial update. Returns `PersistState` + `SendNotification` (if auto-created). |
| `UpdateIncident` | ID, Status, Message, Now | Appends incident update. Returns `PersistState`. |
| `ResolveIncident` | ID, Message, Now | Sets status to resolved, sets resolved_at. Returns `PersistState` + `SendNotification` (recovery). |
| `DeleteIncident` | ID | Removes incident + all updates. Returns `PersistState`. |

### Notification Actions

| Action | Fields | Effect |
|--------|--------|--------|
| `CreateNotificationChannel` | ID, Type, Name, Config, Now | Adds channel to state. Returns `PersistState`. |
| `UpdateNotificationChannel` | ID, Name*, Config*, Enabled*, Now | Updates channel. Returns `PersistState`. |
| `DeleteNotificationChannel` | ID | Removes channel. Returns `PersistState`. |

### Maintenance Actions

| Action | Fields | Effect |
|--------|--------|--------|
| `CreateMaintenanceWindow` | ID, MonitorID, Title, Description, StartsAt, EndsAt, Now | Adds window. Returns `PersistState`. |
| `DeleteMaintenanceWindow` | ID | Removes window. Returns `PersistState`. |

### Settings Actions

| Action | Fields | Effect |
|--------|--------|--------|
| `UpdateSettings` | SiteName*, LogoURL*, AccentColor*, CustomCSS*, CustomDomain* | Updates settings. Returns `PersistState`. |

## Side Effects

| Effect | Dispatched by | Executed by |
|--------|--------------|-------------|
| `PersistState` | Most actions | Scheduler → `store.SaveMonitor()`, `store.RecordCheck()`, etc. |
| `SendNotification` | Incident create/resolve, check threshold/recovery | Scheduler → `notify.Registry.Handle()` → appropriate dispatcher |
| `PruneOldChecks` | `RecordCheck` | Scheduler → `store.DeleteChecksBefore(monitorID, cutoff)` |

## Auto-Incident Logic

When `RecordCheck` is processed:

```
if check.Status == Down:
    monitor.ConsecutiveFailures++
    if monitor.ConsecutiveFailures >= 3 && !monitor.HasActiveIncident:
        → Create incident (auto_created: true, severity: major)
        → SendNotification to all enabled channels
else if check.Status == Up:
    if monitor.ConsecutiveFailures >= 3:  // was failing, now recovered
        → Resolve existing incident
        → SendNotification (recovery) to all enabled channels
    monitor.ConsecutiveFailures = 0
```

## Maintenance Window Suppression

When `RecordCheck` is processed, if the monitor has an **active** maintenance window (current time is between `start_time` and `end_time`):

- Failures are recorded in check history but do **not** increment `ConsecutiveFailures`
- No auto-incident is created
- No notification is sent
- The check still appears in the status page (shows the down status)