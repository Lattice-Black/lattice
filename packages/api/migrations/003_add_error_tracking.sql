-- Migration: Add Error Tracking and Performance Monitoring
-- Description: Comprehensive error tracking system with time-series partitioning
-- Date: 2025-10-14

-- ============================================================================
-- EXTENSIONS
-- ============================================================================

-- Enable pg_partman for time-series table partitioning
CREATE EXTENSION IF NOT EXISTS pg_partman SCHEMA partman;

-- Enable pg_cron for scheduled jobs (partition maintenance, materialized view refresh)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ============================================================================
-- PARTITIONED TABLES (Time-Series Data)
-- ============================================================================

-- Error Events Table (partitioned by timestamp)
CREATE TABLE IF NOT EXISTS error_events (
  id TEXT PRIMARY KEY,
  service_id TEXT NOT NULL,
  environment TEXT NOT NULL CHECK (environment IN ('development', 'staging', 'production')),
  error_type TEXT NOT NULL,
  message TEXT NOT NULL,
  stack_trace JSONB NOT NULL,
  raw_stack TEXT,
  context JSONB,
  session_id TEXT,
  resolved BOOLEAN DEFAULT FALSE,
  ignored BOOLEAN DEFAULT FALSE,
  first_seen TIMESTAMPTZ NOT NULL,
  last_seen TIMESTAMPTZ NOT NULL,
  occurrence_count INTEGER DEFAULT 1,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (timestamp);

-- Performance Traces Table (partitioned by timestamp)
CREATE TABLE IF NOT EXISTS performance_traces (
  id TEXT PRIMARY KEY,
  service_id TEXT NOT NULL,
  operation_name TEXT NOT NULL,
  operation_type TEXT NOT NULL CHECK (operation_type IN ('http_request', 'db_query', 'external_call', 'custom')),
  start_time TIMESTAMPTZ NOT NULL,
  duration_ms INTEGER NOT NULL CHECK (duration_ms >= 0),
  status_code INTEGER CHECK (status_code >= 100 AND status_code <= 599),
  method TEXT,
  path TEXT,
  user_agent TEXT,
  caller_service TEXT,
  breakdown JSONB,
  metadata JSONB,
  session_id TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (timestamp);

-- Breadcrumbs Table (partitioned by timestamp)
CREATE TABLE IF NOT EXISTS breadcrumbs (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  service_id TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('navigation', 'user_action', 'http', 'console', 'state_change', 'custom')),
  level TEXT DEFAULT 'info' CHECK (level IN ('debug', 'info', 'warning', 'error')),
  message TEXT NOT NULL,
  data JSONB,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (timestamp);

-- ============================================================================
-- REGULAR TABLES
-- ============================================================================

-- Sessions Table
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  service_id TEXT NOT NULL,
  user_id TEXT,
  user_email TEXT,
  ip_address INET,
  user_agent TEXT,
  started_at TIMESTAMPTZ NOT NULL,
  last_activity_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  breadcrumb_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  metadata JSONB
);

-- Alert Rules Table
CREATE TABLE IF NOT EXISTS alert_rules (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  enabled BOOLEAN DEFAULT TRUE,
  service_id TEXT,
  environment TEXT,
  condition_type TEXT NOT NULL CHECK (condition_type IN ('error_rate', 'error_type_match', 'performance_threshold')),
  threshold JSONB NOT NULL,
  evaluation_window_minutes INTEGER DEFAULT 10 CHECK (evaluation_window_minutes >= 1 AND evaluation_window_minutes <= 60),
  notification_channels JSONB NOT NULL,
  last_triggered_at TIMESTAMPTZ,
  trigger_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Alert Notifications Table
CREATE TABLE IF NOT EXISTS alert_notifications (
  id TEXT PRIMARY KEY,
  alert_rule_id TEXT NOT NULL,
  service_id TEXT NOT NULL,
  environment TEXT NOT NULL,
  triggered_at TIMESTAMPTZ NOT NULL,
  resolved_at TIMESTAMPTZ,
  notification_status TEXT NOT NULL CHECK (notification_status IN ('pending', 'sent', 'failed', 'grouped')),
  channels_notified JSONB NOT NULL,
  grouped_count INTEGER DEFAULT 1,
  trigger_data JSONB NOT NULL,
  error_message TEXT
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Error Events Indexes
CREATE INDEX IF NOT EXISTS idx_error_events_timestamp ON error_events USING BRIN (timestamp);
CREATE INDEX IF NOT EXISTS idx_error_events_service ON error_events (service_id);
CREATE INDEX IF NOT EXISTS idx_error_events_type ON error_events (error_type);
CREATE INDEX IF NOT EXISTS idx_error_events_environment ON error_events (environment);
CREATE INDEX IF NOT EXISTS idx_error_events_resolved ON error_events (resolved) WHERE resolved = FALSE;
CREATE INDEX IF NOT EXISTS idx_error_events_context ON error_events USING GIN (context);

-- Performance Traces Indexes
CREATE INDEX IF NOT EXISTS idx_perf_traces_timestamp ON performance_traces USING BRIN (timestamp);
CREATE INDEX IF NOT EXISTS idx_perf_traces_service ON performance_traces (service_id);
CREATE INDEX IF NOT EXISTS idx_perf_traces_operation ON performance_traces (operation_name);
CREATE INDEX IF NOT EXISTS idx_perf_traces_slow ON performance_traces (duration_ms) WHERE duration_ms > 3000;

-- Breadcrumbs Indexes
CREATE INDEX IF NOT EXISTS idx_breadcrumbs_timestamp ON breadcrumbs USING BRIN (timestamp);
CREATE INDEX IF NOT EXISTS idx_breadcrumbs_session ON breadcrumbs (session_id);
CREATE INDEX IF NOT EXISTS idx_breadcrumbs_service ON breadcrumbs (service_id);

-- Sessions Indexes
CREATE INDEX IF NOT EXISTS idx_sessions_service ON sessions (service_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sessions_started ON sessions (started_at);
CREATE INDEX IF NOT EXISTS idx_sessions_active ON sessions (last_activity_at) WHERE ended_at IS NULL;

-- Alert Rules Indexes
CREATE INDEX IF NOT EXISTS idx_alert_rules_org ON alert_rules (organization_id);
CREATE INDEX IF NOT EXISTS idx_alert_rules_service ON alert_rules (service_id) WHERE service_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_alert_rules_enabled ON alert_rules (enabled) WHERE enabled = TRUE;

-- Alert Notifications Indexes
CREATE INDEX IF NOT EXISTS idx_notifications_rule ON alert_notifications (alert_rule_id);
CREATE INDEX IF NOT EXISTS idx_notifications_service ON alert_notifications (service_id);
CREATE INDEX IF NOT EXISTS idx_notifications_triggered ON alert_notifications (triggered_at);
CREATE INDEX IF NOT EXISTS idx_notifications_unresolved ON alert_notifications (resolved_at) WHERE resolved_at IS NULL;

-- ============================================================================
-- PARTITION CONFIGURATION (pg_partman)
-- ============================================================================

-- Configure error_events partitioning (daily partitions)
SELECT partman.create_parent(
  p_parent_table := 'public.error_events',
  p_control := 'timestamp',
  p_type := 'native',
  p_interval := 'daily',
  p_premake := 7
);

-- Set default retention (will be updated per organization tier)
UPDATE partman.part_config
SET retention = '90 days',
    retention_keep_table = false
WHERE parent_table = 'public.error_events';

-- Configure performance_traces partitioning (daily partitions)
SELECT partman.create_parent(
  p_parent_table := 'public.performance_traces',
  p_control := 'timestamp',
  p_type := 'native',
  p_interval := 'daily',
  p_premake := 7
);

UPDATE partman.part_config
SET retention = '90 days',
    retention_keep_table = false
WHERE parent_table = 'public.performance_traces';

-- Configure breadcrumbs partitioning (daily partitions)
SELECT partman.create_parent(
  p_parent_table := 'public.breadcrumbs',
  p_control := 'timestamp',
  p_type := 'native',
  p_interval := 'daily',
  p_premake := 7
);

UPDATE partman.part_config
SET retention = '90 days',
    retention_keep_table = false
WHERE parent_table = 'public.breadcrumbs';

-- ============================================================================
-- MATERIALIZED VIEW (Service Health)
-- ============================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS service_health AS
SELECT
  s.id AS service_id,
  s.name AS service_name,
  COALESCE(env.environment, 'unknown') AS environment,
  CASE
    WHEN COALESCE(errors.error_rate, 0) > 10 THEN 'critical'
    WHEN COALESCE(errors.error_rate, 0) > 5 OR COALESCE(perf.avg_response_time_ms, 0) > 5000 THEN 'degraded'
    ELSE 'healthy'
  END AS health_status,
  COALESCE(errors.error_rate, 0) AS error_rate,
  COALESCE(perf.avg_response_time_ms, 0) AS avg_response_time_ms,
  COALESCE(perf.request_volume, 0) AS request_volume,
  errors.last_error_at,
  NOW() AS updated_at
FROM "Service" s
CROSS JOIN LATERAL (
  SELECT DISTINCT environment
  FROM error_events
  WHERE service_id = s.id
  UNION
  SELECT DISTINCT environment
  FROM performance_traces
  WHERE service_id = s.id
  UNION
  SELECT 'unknown'
) env(environment)
LEFT JOIN LATERAL (
  SELECT
    COUNT(*)::NUMERIC / 10.0 AS error_rate,
    MAX(timestamp) AS last_error_at
  FROM error_events
  WHERE service_id = s.id
    AND environment = env.environment
    AND timestamp > NOW() - INTERVAL '10 minutes'
) errors ON TRUE
LEFT JOIN LATERAL (
  SELECT
    AVG(duration_ms)::INTEGER AS avg_response_time_ms,
    COUNT(*)::NUMERIC / 10.0 AS request_volume
  FROM performance_traces
  WHERE service_id = s.id
    AND environment = env.environment
    AND timestamp > NOW() - INTERVAL '10 minutes'
) perf ON TRUE;

-- Create unique index for concurrent refresh
CREATE UNIQUE INDEX IF NOT EXISTS idx_service_health_pk ON service_health (service_id, environment);

-- ============================================================================
-- SCHEDULED JOBS (pg_cron)
-- ============================================================================

-- Schedule partition maintenance (runs hourly)
SELECT cron.schedule(
  'partman-maintenance-errors',
  '0 * * * *',
  $$SELECT partman.run_maintenance_proc()$$
);

-- Schedule service health materialized view refresh (runs every 30 seconds)
SELECT cron.schedule(
  'refresh-service-health',
  '*/30 * * * * *',
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY service_health$$
);

-- ============================================================================
-- COMMENTS (Documentation)
-- ============================================================================

COMMENT ON TABLE error_events IS 'Stores captured error events with stack traces and context';
COMMENT ON TABLE performance_traces IS 'Stores operation timing data for performance monitoring';
COMMENT ON TABLE breadcrumbs IS 'Stores user action trails for error context';
COMMENT ON TABLE sessions IS 'Stores user session information for correlation';
COMMENT ON TABLE alert_rules IS 'Stores alert configuration rules';
COMMENT ON TABLE alert_notifications IS 'Stores alert notification history';
COMMENT ON MATERIALIZED VIEW service_health IS 'Real-time service health status (refreshed every 30s)';
