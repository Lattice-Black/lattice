package store

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/Lattice-Black/lattice/internal/reducer"
	_ "github.com/mattn/go-sqlite3"
)

// Store defines the persistence interface for Lattice.
type Store interface {
	// Monitors
	CreateMonitor(m reducer.Monitor) error
	UpdateMonitor(m reducer.Monitor) error
	DeleteMonitor(id string) error
	GetMonitor(id string) (*reducer.Monitor, error)
	ListMonitors() ([]reducer.Monitor, error)

	// Checks
	RecordCheck(c reducer.Check) error
	GetChecks(monitorID string, since time.Time) ([]reducer.Check, error)
	GetLatestCheck(monitorID string) (*reducer.Check, error)
	PruneChecks(before time.Time) (int64, error)
	GetDailyHistory(monitorID string, days int) ([]DailyHistory, error)

	// Incidents
	CreateIncident(i reducer.Incident) error
	UpdateIncident(i reducer.Incident) error
	DeleteIncident(id string) error
	GetIncident(id string) (*reducer.Incident, error)
	ListIncidents(includeResolved bool) ([]reducer.Incident, error)
	CreateIncidentUpdate(u reducer.IncidentUpdate) error
	GetIncidentUpdates(incidentID string) ([]reducer.IncidentUpdate, error)

	// Notification Channels
	CreateNotificationChannel(ch reducer.NotificationChannel) error
	UpdateNotificationChannel(ch reducer.NotificationChannel) error
	DeleteNotificationChannel(id string) error
	GetNotificationChannel(id string) (*reducer.NotificationChannel, error)
	ListNotificationChannels() ([]reducer.NotificationChannel, error)

	// Maintenance Windows
	CreateMaintenanceWindow(mw reducer.MaintenanceWindow) error
	DeleteMaintenanceWindow(id string) error
	ListMaintenanceWindows() ([]reducer.MaintenanceWindow, error)

	// Settings
	GetSettings() (*reducer.Settings, error)
	UpdateSettings(s reducer.Settings) error

	// State
	LoadState() (*reducer.State, error)
	RecalculateConsecutiveFailures(state *reducer.State) error

	Close() error
}

// DailyHistory represents a single day's aggregated check history.
type DailyHistory struct {
	Date          string  `json:"date"`
	Status        string  `json:"status"`
	UptimePercent float64 `json:"uptime_percent"`
}

// SQLiteStore implements Store using SQLite.
type SQLiteStore struct {
	db *sql.DB
}

// New creates a new SQLiteStore at the given path and runs migrations.
func New(dbPath string) (*SQLiteStore, error) {
	db, err := sql.Open("sqlite3", dbPath+"?_foreign_keys=on")
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	// Enable WAL mode for better concurrent performance
	if _, err := db.Exec("PRAGMA journal_mode=WAL"); err != nil {
		db.Close()
		return nil, fmt.Errorf("failed to enable WAL mode: %w", err)
	}

	// Run migrations
	if err := RunMigrations(db); err != nil {
		db.Close()
		return nil, fmt.Errorf("failed to run migrations: %w", err)
	}

	return &SQLiteStore{db: db}, nil
}

// Close closes the database connection.
func (s *SQLiteStore) Close() error {
	return s.db.Close()
}

// --- Monitor Operations ---

func (s *SQLiteStore) CreateMonitor(m reducer.Monitor) error {
	_, err := s.db.Exec(`
		INSERT INTO monitors (id, name, url, type, interval_ns, timeout_ns, expected_status, enabled, group_name, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, m.ID, m.Name, m.URL, string(m.Type), int64(m.Interval), int64(m.Timeout), m.ExpectedStatus, m.Enabled, m.Group, m.CreatedAt.Format(time.RFC3339), m.UpdatedAt.Format(time.RFC3339))
	if err != nil {
		return fmt.Errorf("failed to create monitor: %w", err)
	}
	return nil
}

func (s *SQLiteStore) UpdateMonitor(m reducer.Monitor) error {
	result, err := s.db.Exec(`
		UPDATE monitors SET name = ?, url = ?, type = ?, interval_ns = ?, timeout_ns = ?, expected_status = ?, enabled = ?, group_name = ?, updated_at = ?
		WHERE id = ?
	`, m.Name, m.URL, string(m.Type), int64(m.Interval), int64(m.Timeout), m.ExpectedStatus, m.Enabled, m.Group, m.UpdatedAt.Format(time.RFC3339), m.ID)
	if err != nil {
		return fmt.Errorf("failed to update monitor: %w", err)
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("monitor not found: %s", m.ID)
	}
	return nil
}

func (s *SQLiteStore) DeleteMonitor(id string) error {
	result, err := s.db.Exec("DELETE FROM monitors WHERE id = ?", id)
	if err != nil {
		return fmt.Errorf("failed to delete monitor: %w", err)
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("monitor not found: %s", id)
	}
	return nil
}

func (s *SQLiteStore) GetMonitor(id string) (*reducer.Monitor, error) {
	row := s.db.QueryRow(`
		SELECT id, name, url, type, interval_ns, timeout_ns, expected_status, enabled, group_name, created_at, updated_at
		FROM monitors WHERE id = ?
	`, id)
	return scanMonitor(row)
}

func (s *SQLiteStore) ListMonitors() ([]reducer.Monitor, error) {
	rows, err := s.db.Query(`
		SELECT id, name, url, type, interval_ns, timeout_ns, expected_status, enabled, group_name, created_at, updated_at
		FROM monitors ORDER BY name
	`)
	if err != nil {
		return nil, fmt.Errorf("failed to list monitors: %w", err)
	}
	defer rows.Close()

	var monitors []reducer.Monitor
	for rows.Next() {
		m, err := scanMonitorRow(rows)
		if err != nil {
			return nil, err
		}
		monitors = append(monitors, *m)
	}
	return monitors, rows.Err()
}

func scanMonitor(row *sql.Row) (*reducer.Monitor, error) {
	var m reducer.Monitor
	var monitorType string
	var intervalNs, timeoutNs int64
	var enabled int
	var createdAt, updatedAt string

	err := row.Scan(&m.ID, &m.Name, &m.URL, &monitorType, &intervalNs, &timeoutNs, &m.ExpectedStatus, &enabled, &m.Group, &createdAt, &updatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to scan monitor: %w", err)
	}

	m.Type = reducer.MonitorType(monitorType)
	m.Interval = time.Duration(intervalNs)
	m.Timeout = time.Duration(timeoutNs)
	m.Enabled = enabled != 0
	m.CreatedAt = parseTime(createdAt)
	m.UpdatedAt = parseTime(updatedAt)

	return &m, nil
}

func scanMonitorRow(rows *sql.Rows) (*reducer.Monitor, error) {
	var m reducer.Monitor
	var monitorType string
	var intervalNs, timeoutNs int64
	var enabled int
	var createdAt, updatedAt string

	err := rows.Scan(&m.ID, &m.Name, &m.URL, &monitorType, &intervalNs, &timeoutNs, &m.ExpectedStatus, &enabled, &m.Group, &createdAt, &updatedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to scan monitor: %w", err)
	}

	m.Type = reducer.MonitorType(monitorType)
	m.Interval = time.Duration(intervalNs)
	m.Timeout = time.Duration(timeoutNs)
	m.Enabled = enabled != 0
	m.CreatedAt = parseTime(createdAt)
	m.UpdatedAt = parseTime(updatedAt)

	return &m, nil
}

// --- Check Operations ---

func (s *SQLiteStore) RecordCheck(c reducer.Check) error {
	_, err := s.db.Exec(`
		INSERT INTO checks (id, monitor_id, status, latency_ms, status_code, error, checked_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`, c.ID, c.MonitorID, string(c.Status), c.LatencyMs, c.StatusCode, c.Error, c.CheckedAt.Format(time.RFC3339))
	if err != nil {
		return fmt.Errorf("failed to record check: %w", err)
	}
	return nil
}

func (s *SQLiteStore) GetChecks(monitorID string, since time.Time) ([]reducer.Check, error) {
	rows, err := s.db.Query(`
		SELECT id, monitor_id, status, latency_ms, status_code, error, checked_at
		FROM checks WHERE monitor_id = ? AND checked_at >= ? ORDER BY checked_at DESC
	`, monitorID, since.Format(time.RFC3339))
	if err != nil {
		return nil, fmt.Errorf("failed to get checks: %w", err)
	}
	defer rows.Close()

	var checks []reducer.Check
	for rows.Next() {
		c, err := scanCheckRow(rows)
		if err != nil {
			return nil, err
		}
		checks = append(checks, *c)
	}
	return checks, rows.Err()
}

func (s *SQLiteStore) GetLatestCheck(monitorID string) (*reducer.Check, error) {
	row := s.db.QueryRow(`
		SELECT id, monitor_id, status, latency_ms, status_code, error, checked_at
		FROM checks WHERE monitor_id = ? ORDER BY checked_at DESC LIMIT 1
	`, monitorID)

	var c reducer.Check
	var status, checkedAt string

	err := row.Scan(&c.ID, &c.MonitorID, &status, &c.LatencyMs, &c.StatusCode, &c.Error, &checkedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get latest check: %w", err)
	}

	c.Status = reducer.Status(status)
	c.CheckedAt = parseTime(checkedAt)

	return &c, nil
}

func (s *SQLiteStore) PruneChecks(before time.Time) (int64, error) {
	result, err := s.db.Exec("DELETE FROM checks WHERE checked_at < ?", before.Format(time.RFC3339))
	if err != nil {
		return 0, fmt.Errorf("failed to prune checks: %w", err)
	}
	return result.RowsAffected()
}

// GetDailyHistory returns aggregated daily check history for a monitor.
func (s *SQLiteStore) GetDailyHistory(monitorID string, days int) ([]DailyHistory, error) {
	since := time.Now().AddDate(0, 0, -days)
	rows, err := s.db.Query(`
		SELECT
			DATE(checked_at) as date,
			CASE
				WHEN SUM(CASE WHEN status = 'down' THEN 1 ELSE 0 END) > 0 THEN 'down'
				WHEN SUM(CASE WHEN status = 'degraded' THEN 1 ELSE 0 END) > 0 THEN 'degraded'
				ELSE 'up'
			END as status,
			(CAST(SUM(CASE WHEN status = 'up' THEN 1.0 ELSE 0 END) AS REAL) / COUNT(*)) * 100 as uptime_percent
		FROM checks
		WHERE monitor_id = ? AND checked_at >= ?
		GROUP BY DATE(checked_at)
		ORDER BY date
	`, monitorID, since.Format(time.RFC3339))
	if err != nil {
		return nil, fmt.Errorf("failed to get daily history: %w", err)
	}
	defer rows.Close()

	var history []DailyHistory
	for rows.Next() {
		var h DailyHistory
		if err := rows.Scan(&h.Date, &h.Status, &h.UptimePercent); err != nil {
			return nil, fmt.Errorf("failed to scan daily history: %w", err)
		}
		history = append(history, h)
	}
	return history, rows.Err()
}

func scanCheckRow(rows *sql.Rows) (*reducer.Check, error) {
	var c reducer.Check
	var status, checkedAt string

	err := rows.Scan(&c.ID, &c.MonitorID, &status, &c.LatencyMs, &c.StatusCode, &c.Error, &checkedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to scan check: %w", err)
	}

	c.Status = reducer.Status(status)
	c.CheckedAt = parseTime(checkedAt)

	return &c, nil
}

// --- Incident Operations ---

func (s *SQLiteStore) CreateIncident(i reducer.Incident) error {
	var resolvedAt *string
	if i.ResolvedAt != nil {
		r := i.ResolvedAt.Format(time.RFC3339)
		resolvedAt = &r
	}

	_, err := s.db.Exec(`
		INSERT INTO incidents (id, monitor_id, title, severity, status, auto_created, created_at, updated_at, resolved_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, i.ID, i.MonitorID, i.Title, string(i.Severity), string(i.Status), i.AutoCreated, i.CreatedAt.Format(time.RFC3339), i.UpdatedAt.Format(time.RFC3339), resolvedAt)
	if err != nil {
		return fmt.Errorf("failed to create incident: %w", err)
	}
	return nil
}

func (s *SQLiteStore) UpdateIncident(i reducer.Incident) error {
	var resolvedAt *string
	if i.ResolvedAt != nil {
		r := i.ResolvedAt.Format(time.RFC3339)
		resolvedAt = &r
	}

	result, err := s.db.Exec(`
		UPDATE incidents SET title = ?, severity = ?, status = ?, updated_at = ?, resolved_at = ?
		WHERE id = ?
	`, i.Title, string(i.Severity), string(i.Status), i.UpdatedAt.Format(time.RFC3339), resolvedAt, i.ID)
	if err != nil {
		return fmt.Errorf("failed to update incident: %w", err)
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("incident not found: %s", i.ID)
	}
	return nil
}

func (s *SQLiteStore) DeleteIncident(id string) error {
	result, err := s.db.Exec("DELETE FROM incidents WHERE id = ?", id)
	if err != nil {
		return fmt.Errorf("failed to delete incident: %w", err)
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("incident not found: %s", id)
	}
	return nil
}

func (s *SQLiteStore) GetIncident(id string) (*reducer.Incident, error) {
	row := s.db.QueryRow(`
		SELECT id, monitor_id, title, severity, status, auto_created, created_at, updated_at, resolved_at
		FROM incidents WHERE id = ?
	`, id)
	return scanIncident(row)
}

func (s *SQLiteStore) ListIncidents(includeResolved bool) ([]reducer.Incident, error) {
	var query string
	if includeResolved {
		query = `SELECT id, monitor_id, title, severity, status, auto_created, created_at, updated_at, resolved_at FROM incidents ORDER BY created_at DESC`
	} else {
		query = `SELECT id, monitor_id, title, severity, status, auto_created, created_at, updated_at, resolved_at FROM incidents WHERE status != 'resolved' ORDER BY created_at DESC`
	}

	rows, err := s.db.Query(query)
	if err != nil {
		return nil, fmt.Errorf("failed to list incidents: %w", err)
	}
	defer rows.Close()

	var incidents []reducer.Incident
	for rows.Next() {
		i, err := scanIncidentRow(rows)
		if err != nil {
			return nil, err
		}
		incidents = append(incidents, *i)
	}
	return incidents, rows.Err()
}

func scanIncident(row *sql.Row) (*reducer.Incident, error) {
	var i reducer.Incident
	var severity, status, createdAt, updatedAt string
	var resolvedAt sql.NullString
	var autoCreated int

	err := row.Scan(&i.ID, &i.MonitorID, &i.Title, &severity, &status, &autoCreated, &createdAt, &updatedAt, &resolvedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to scan incident: %w", err)
	}

	i.Severity = reducer.Severity(severity)
	i.Status = reducer.IncidentStatus(status)
	i.AutoCreated = autoCreated != 0
	i.CreatedAt = parseTime(createdAt)
	i.UpdatedAt = parseTime(updatedAt)
	if resolvedAt.Valid {
		t := parseTime(resolvedAt.String)
		i.ResolvedAt = &t
	}

	return &i, nil
}

func scanIncidentRow(rows *sql.Rows) (*reducer.Incident, error) {
	var i reducer.Incident
	var severity, status, createdAt, updatedAt string
	var resolvedAt sql.NullString
	var autoCreated int

	err := rows.Scan(&i.ID, &i.MonitorID, &i.Title, &severity, &status, &autoCreated, &createdAt, &updatedAt, &resolvedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to scan incident: %w", err)
	}

	i.Severity = reducer.Severity(severity)
	i.Status = reducer.IncidentStatus(status)
	i.AutoCreated = autoCreated != 0
	i.CreatedAt = parseTime(createdAt)
	i.UpdatedAt = parseTime(updatedAt)
	if resolvedAt.Valid {
		t := parseTime(resolvedAt.String)
		i.ResolvedAt = &t
	}

	return &i, nil
}

// --- Incident Update Operations ---

func (s *SQLiteStore) CreateIncidentUpdate(u reducer.IncidentUpdate) error {
	_, err := s.db.Exec(`
		INSERT INTO incident_updates (id, incident_id, status, message, created_at)
		VALUES (?, ?, ?, ?, ?)
	`, u.ID, u.IncidentID, string(u.Status), u.Message, u.CreatedAt.Format(time.RFC3339))
	if err != nil {
		return fmt.Errorf("failed to create incident update: %w", err)
	}
	return nil
}

func (s *SQLiteStore) GetIncidentUpdates(incidentID string) ([]reducer.IncidentUpdate, error) {
	rows, err := s.db.Query(`
		SELECT id, incident_id, status, message, created_at
		FROM incident_updates WHERE incident_id = ? ORDER BY created_at ASC
	`, incidentID)
	if err != nil {
		return nil, fmt.Errorf("failed to get incident updates: %w", err)
	}
	defer rows.Close()

	var updates []reducer.IncidentUpdate
	for rows.Next() {
		var u reducer.IncidentUpdate
		var status, createdAt string

		err := rows.Scan(&u.ID, &u.IncidentID, &status, &u.Message, &createdAt)
		if err != nil {
			return nil, fmt.Errorf("failed to scan incident update: %w", err)
		}

		u.Status = reducer.IncidentStatus(status)
		u.CreatedAt = parseTime(createdAt)
		updates = append(updates, u)
	}
	return updates, rows.Err()
}

// --- Notification Channel Operations ---

func (s *SQLiteStore) CreateNotificationChannel(ch reducer.NotificationChannel) error {
	configJSON, err := json.Marshal(ch.Config)
	if err != nil {
		return fmt.Errorf("failed to marshal config: %w", err)
	}

	_, err = s.db.Exec(`
		INSERT INTO notification_channels (id, type, name, config, enabled, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`, ch.ID, string(ch.Type), ch.Name, string(configJSON), ch.Enabled, ch.CreatedAt.Format(time.RFC3339), ch.UpdatedAt.Format(time.RFC3339))
	if err != nil {
		return fmt.Errorf("failed to create notification channel: %w", err)
	}
	return nil
}

func (s *SQLiteStore) UpdateNotificationChannel(ch reducer.NotificationChannel) error {
	configJSON, err := json.Marshal(ch.Config)
	if err != nil {
		return fmt.Errorf("failed to marshal config: %w", err)
	}

	result, err := s.db.Exec(`
		UPDATE notification_channels SET type = ?, name = ?, config = ?, enabled = ?, updated_at = ?
		WHERE id = ?
	`, string(ch.Type), ch.Name, string(configJSON), ch.Enabled, ch.UpdatedAt.Format(time.RFC3339), ch.ID)
	if err != nil {
		return fmt.Errorf("failed to update notification channel: %w", err)
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("notification channel not found: %s", ch.ID)
	}
	return nil
}

func (s *SQLiteStore) DeleteNotificationChannel(id string) error {
	result, err := s.db.Exec("DELETE FROM notification_channels WHERE id = ?", id)
	if err != nil {
		return fmt.Errorf("failed to delete notification channel: %w", err)
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("notification channel not found: %s", id)
	}
	return nil
}

func (s *SQLiteStore) GetNotificationChannel(id string) (*reducer.NotificationChannel, error) {
	row := s.db.QueryRow(`
		SELECT id, type, name, config, enabled, created_at, updated_at
		FROM notification_channels WHERE id = ?
	`, id)

	var ch reducer.NotificationChannel
	var channelType, configJSON string
	var enabled int
	var createdAt, updatedAt string

	err := row.Scan(&ch.ID, &channelType, &ch.Name, &configJSON, &enabled, &createdAt, &updatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to scan notification channel: %w", err)
	}

	ch.Type = reducer.NotificationChannelType(channelType)
	ch.Enabled = enabled != 0
	if err := json.Unmarshal([]byte(configJSON), &ch.Config); err != nil {
		return nil, fmt.Errorf("failed to unmarshal config: %w", err)
	}
	ch.CreatedAt = parseTime(createdAt)
	ch.UpdatedAt = parseTime(updatedAt)

	return &ch, nil
}

func (s *SQLiteStore) ListNotificationChannels() ([]reducer.NotificationChannel, error) {
	rows, err := s.db.Query(`
		SELECT id, type, name, config, enabled, created_at, updated_at
		FROM notification_channels ORDER BY name
	`)
	if err != nil {
		return nil, fmt.Errorf("failed to list notification channels: %w", err)
	}
	defer rows.Close()

	var channels []reducer.NotificationChannel
	for rows.Next() {
		var ch reducer.NotificationChannel
		var channelType, configJSON string
		var enabled int
		var createdAt, updatedAt string

		err := rows.Scan(&ch.ID, &channelType, &ch.Name, &configJSON, &enabled, &createdAt, &updatedAt)
		if err != nil {
			return nil, fmt.Errorf("failed to scan notification channel: %w", err)
		}

		ch.Type = reducer.NotificationChannelType(channelType)
		ch.Enabled = enabled != 0
		if err := json.Unmarshal([]byte(configJSON), &ch.Config); err != nil {
			return nil, fmt.Errorf("failed to unmarshal config: %w", err)
		}
		ch.CreatedAt = parseTime(createdAt)
		ch.UpdatedAt = parseTime(updatedAt)
		channels = append(channels, ch)
	}
	return channels, rows.Err()
}

// --- Maintenance Window Operations ---

func (s *SQLiteStore) CreateMaintenanceWindow(mw reducer.MaintenanceWindow) error {
	_, err := s.db.Exec(`
		INSERT INTO maintenance_windows (id, monitor_id, title, description, starts_at, ends_at, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`, mw.ID, mw.MonitorID, mw.Title, mw.Description, mw.StartsAt.Format(time.RFC3339), mw.EndsAt.Format(time.RFC3339), mw.CreatedAt.Format(time.RFC3339))
	if err != nil {
		return fmt.Errorf("failed to create maintenance window: %w", err)
	}
	return nil
}

func (s *SQLiteStore) DeleteMaintenanceWindow(id string) error {
	result, err := s.db.Exec("DELETE FROM maintenance_windows WHERE id = ?", id)
	if err != nil {
		return fmt.Errorf("failed to delete maintenance window: %w", err)
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("maintenance window not found: %s", id)
	}
	return nil
}

func (s *SQLiteStore) ListMaintenanceWindows() ([]reducer.MaintenanceWindow, error) {
	rows, err := s.db.Query(`
		SELECT id, monitor_id, title, description, starts_at, ends_at, created_at
		FROM maintenance_windows ORDER BY starts_at
	`)
	if err != nil {
		return nil, fmt.Errorf("failed to list maintenance windows: %w", err)
	}
	defer rows.Close()

	var windows []reducer.MaintenanceWindow
	for rows.Next() {
		var mw reducer.MaintenanceWindow
		var startsAt, endsAt, createdAt string

		err := rows.Scan(&mw.ID, &mw.MonitorID, &mw.Title, &mw.Description, &startsAt, &endsAt, &createdAt)
		if err != nil {
			return nil, fmt.Errorf("failed to scan maintenance window: %w", err)
		}

		mw.StartsAt = parseTime(startsAt)
		mw.EndsAt = parseTime(endsAt)
		mw.CreatedAt = parseTime(createdAt)
		windows = append(windows, mw)
	}
	return windows, rows.Err()
}

// --- Settings Operations ---

func (s *SQLiteStore) GetSettings() (*reducer.Settings, error) {
	var settings reducer.Settings
	row := s.db.QueryRow(`SELECT site_name, logo_url, accent_color, custom_css, custom_domain FROM settings WHERE id = 1`)
	err := row.Scan(&settings.SiteName, &settings.LogoURL, &settings.AccentColor, &settings.CustomCSS, &settings.CustomDomain)
	if err == sql.ErrNoRows {
		// Return defaults
		return &reducer.Settings{
			SiteName:    "Lattice Status",
			AccentColor: "#4d9f5d",
		}, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get settings: %w", err)
	}
	return &settings, nil
}

func (s *SQLiteStore) UpdateSettings(settings reducer.Settings) error {
	_, err := s.db.Exec(`
		UPDATE settings SET site_name = ?, logo_url = ?, accent_color = ?, custom_css = ?, custom_domain = ?
		WHERE id = 1
	`, settings.SiteName, settings.LogoURL, settings.AccentColor, settings.CustomCSS, settings.CustomDomain)
	if err != nil {
		return fmt.Errorf("failed to update settings: %w", err)
	}
	return nil
}

// --- State Operations ---

// LoadState loads the full application state from the database.
// This is used on startup to materialize the reducer state.
func (s *SQLiteStore) LoadState() (*reducer.State, error) {
	state := reducer.NewState()

	// Load monitors
	monitors, err := s.ListMonitors()
	if err != nil {
		return nil, fmt.Errorf("failed to load monitors: %w", err)
	}
	for _, m := range monitors {
		state.Monitors[m.ID] = m
	}

	// Load incidents
	incidents, err := s.ListIncidents(true) // Include resolved
	if err != nil {
		return nil, fmt.Errorf("failed to load incidents: %w", err)
	}
	for _, i := range incidents {
		state.Incidents[i.ID] = i

		// Load incident updates
		updates, err := s.GetIncidentUpdates(i.ID)
		if err != nil {
			return nil, fmt.Errorf("failed to load incident updates: %w", err)
		}
		state.IncidentUpdates[i.ID] = updates
	}

	// Load notification channels
	channels, err := s.ListNotificationChannels()
	if err != nil {
		return nil, fmt.Errorf("failed to load notification channels: %w", err)
	}
	for _, ch := range channels {
		state.NotificationChannels[ch.ID] = ch
	}

	// Load maintenance windows
	windows, err := s.ListMaintenanceWindows()
	if err != nil {
		return nil, fmt.Errorf("failed to load maintenance windows: %w", err)
	}
	for _, mw := range windows {
		state.MaintenanceWindows[mw.ID] = mw
	}

	// Load settings
	settings, err := s.GetSettings()
	if err != nil {
		return nil, fmt.Errorf("failed to load settings: %w", err)
	}
	state.Settings = *settings

	// Recalculate consecutive failures from recent check history
	if err := s.RecalculateConsecutiveFailures(&state); err != nil {
		log.Printf("warning: failed to recalculate consecutive failures: %v", err)
	}

	return &state, nil
}

// RecalculateConsecutiveFailures looks at recent checks to rebuild the
// consecutive failure counter for each monitor.
func (s *SQLiteStore) RecalculateConsecutiveFailures(state *reducer.State) error {
	for id, m := range state.Monitors {
		if !m.Enabled {
			continue
		}
		// Get the last N checks (where N = AutoIncidentThreshold) and count
		// consecutive failures from the most recent
		checks, err := s.GetChecks(id, time.Now().Add(-24*time.Hour))
		if err != nil {
			continue
		}

		failures := 0
		for _, c := range checks { // checks are ordered DESC (newest first)
			if c.Status == reducer.StatusDown || c.Status == reducer.StatusDegraded {
				failures++
			} else {
				break // hit an "up" check, stop counting
			}
		}
		state.ConsecutiveFailures[id] = failures
	}
	return nil
}

// parseTime parses an RFC3339 time string, logging a warning on error.
func parseTime(s string) time.Time {
	t, err := time.Parse(time.RFC3339, s)
	if err != nil {
		log.Printf("warning: failed to parse time %q: %v", s, err)
		return time.Time{}
	}
	return t
}