-- Initial schema for Lattice status page
-- All times stored as RFC3339 strings

-- Track applied migrations
CREATE TABLE IF NOT EXISTS migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Monitors table
CREATE TABLE IF NOT EXISTS monitors (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    type TEXT NOT NULL,
    interval_ns INTEGER NOT NULL,
    timeout_ns INTEGER NOT NULL,
    expected_status INTEGER NOT NULL DEFAULT 200,
    enabled INTEGER NOT NULL DEFAULT 1,
    group_name TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Checks table (health check results)
CREATE TABLE IF NOT EXISTS checks (
    id TEXT PRIMARY KEY,
    monitor_id TEXT NOT NULL,
    status TEXT NOT NULL,
    latency_ms INTEGER NOT NULL,
    status_code INTEGER NOT NULL DEFAULT 0,
    error TEXT NOT NULL DEFAULT '',
    checked_at TEXT NOT NULL,
    FOREIGN KEY (monitor_id) REFERENCES monitors(id) ON DELETE CASCADE
);

-- Index for efficient check queries
CREATE INDEX IF NOT EXISTS idx_checks_monitor_id ON checks(monitor_id);
CREATE INDEX IF NOT EXISTS idx_checks_checked_at ON checks(checked_at);
CREATE INDEX IF NOT EXISTS idx_checks_monitor_checked ON checks(monitor_id, checked_at);

-- Incidents table
CREATE TABLE IF NOT EXISTS incidents (
    id TEXT PRIMARY KEY,
    monitor_id TEXT NOT NULL,
    title TEXT NOT NULL,
    severity TEXT NOT NULL,
    status TEXT NOT NULL,
    auto_created INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    resolved_at TEXT,
    FOREIGN KEY (monitor_id) REFERENCES monitors(id) ON DELETE CASCADE
);

-- Index for incident queries
CREATE INDEX IF NOT EXISTS idx_incidents_monitor_id ON incidents(monitor_id);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);

-- Incident updates table (timeline entries)
CREATE TABLE IF NOT EXISTS incident_updates (
    id TEXT PRIMARY KEY,
    incident_id TEXT NOT NULL,
    status TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE
);

-- Index for incident update queries
CREATE INDEX IF NOT EXISTS idx_incident_updates_incident_id ON incident_updates(incident_id);

-- Notification channels table
CREATE TABLE IF NOT EXISTS notification_channels (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    config TEXT NOT NULL DEFAULT '{}',
    enabled INTEGER NOT NULL DEFAULT 1
);

-- Maintenance windows table
CREATE TABLE IF NOT EXISTS maintenance_windows (
    id TEXT PRIMARY KEY,
    monitor_id TEXT NOT NULL,
    title TEXT NOT NULL,
    starts_at TEXT NOT NULL,
    ends_at TEXT NOT NULL,
    FOREIGN KEY (monitor_id) REFERENCES monitors(id) ON DELETE CASCADE
);

-- Index for maintenance window queries
CREATE INDEX IF NOT EXISTS idx_maintenance_windows_monitor_id ON maintenance_windows(monitor_id);

-- Settings table (single row)
CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    site_name TEXT NOT NULL DEFAULT 'Lattice Status',
    logo_url TEXT NOT NULL DEFAULT '',
    accent_color TEXT NOT NULL DEFAULT '#4d9f5d',
    custom_css TEXT NOT NULL DEFAULT '',
    custom_domain TEXT NOT NULL DEFAULT ''
);

-- Insert default settings row
INSERT OR IGNORE INTO settings (id) VALUES (1);
