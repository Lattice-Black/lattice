# Data Model: Comprehensive Error Tracking and Performance Monitoring

**Date**: 2025-10-14
**Feature**: [spec.md](./spec.md)
**Plan**: [plan.md](./plan.md)
**Research**: [research.md](./research.md)

---

## Overview

This data model supports comprehensive error tracking, performance monitoring, user context breadcrumbs, and alerting across distributed services. The design leverages PostgreSQL native partitioning with pg_partman for time-series optimization, enabling efficient storage and querying of high-volume monitoring data.

**Storage Strategy**:
- **Time-series tables** (error_events, performance_traces, breadcrumbs): Partitioned by timestamp with pg_partman
- **Configuration tables** (alert_rules): Standard PostgreSQL tables
- **Session tracking**: Redis for real-time, PostgreSQL for persistence

---

## Entities

### 1. Error Event

Represents a single occurrence of an error captured from a monitored service.

**Table**: `error_events` (partitioned by `timestamp`)

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | Unique identifier (ULID or UUID) |
| `service_id` | TEXT | NOT NULL, FK → services.id | Service that reported the error |
| `environment` | TEXT | NOT NULL | Environment (development, staging, production) |
| `error_type` | TEXT | NOT NULL | Error class/type (e.g., "TypeError", "NetworkError") |
| `message` | TEXT | NOT NULL | Error message (sanitized) |
| `stack_trace` | JSONB | NOT NULL | Parsed stack frames (array of objects) |
| `raw_stack` | TEXT | NULL | Original stack trace string (optional) |
| `context` | JSONB | NULL | Additional error context (user info, request data) |
| `session_id` | TEXT | NULL, FK → sessions.id | Associated session identifier |
| `resolved` | BOOLEAN | DEFAULT FALSE | Whether error has been marked as resolved |
| `ignored` | BOOLEAN | DEFAULT FALSE | Whether error has been marked as ignored |
| `first_seen` | TIMESTAMPTZ | NOT NULL | First time this error occurred |
| `last_seen` | TIMESTAMPTZ | NOT NULL | Most recent occurrence |
| `occurrence_count` | INTEGER | DEFAULT 1 | Total number of occurrences |
| `timestamp` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | When this event was captured |

**Indexes**:
```sql
-- BRIN index for time-series queries (99% smaller than B-tree)
CREATE INDEX idx_error_events_timestamp ON error_events USING BRIN (timestamp);

-- B-tree indexes for filtering
CREATE INDEX idx_error_events_service ON error_events (service_id);
CREATE INDEX idx_error_events_type ON error_events (error_type);
CREATE INDEX idx_error_events_environment ON error_events (environment);
CREATE INDEX idx_error_events_resolved ON error_events (resolved) WHERE resolved = FALSE;

-- GIN index for JSONB context searches
CREATE INDEX idx_error_events_context ON error_events USING GIN (context);
```

**Partitioning Setup**:
```sql
-- Enable extensions
CREATE EXTENSION IF NOT EXISTS pg_partman SCHEMA partman;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create partitioned table
CREATE TABLE error_events (
  id TEXT PRIMARY KEY,
  service_id TEXT NOT NULL,
  environment TEXT NOT NULL,
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

-- Setup pg_partman for daily partitions
SELECT partman.create_parent(
  p_parent_table := 'public.error_events',
  p_control := 'timestamp',
  p_type := 'native',
  p_interval := 'daily',
  p_premake := 7
);

-- Configure tiered retention (managed per organization)
-- Free/Trial: 7 days
-- Paid: 90 days
-- Enterprise: 365 days
UPDATE partman.part_config
SET retention = '90 days'
WHERE parent_table = 'public.error_events';

-- Automate partition maintenance
SELECT cron.schedule(
  'partman-maintenance-errors',
  '0 * * * *',
  $$SELECT partman.run_maintenance_proc()$$
);
```

**Validation Rules** (from FR-001, FR-002, FR-005, FR-026):
- `error_type` MUST NOT be empty
- `message` MUST be sanitized to remove sensitive data (passwords, tokens, PII)
- `stack_trace` MUST contain at least one frame with `filename`, `line_number`, `function_name`
- `service_id` MUST reference an existing service
- `environment` MUST be one of: development, staging, production

**Aggregation Logic** (FR-007):
Identical errors are identified by:
```typescript
const errorFingerprint = hash({
  service_id,
  environment,
  error_type,
  message,
  stack_trace[0].filename, // Top frame
  stack_trace[0].line_number
});
```

When duplicate error occurs:
- Update `last_seen` to current timestamp
- Increment `occurrence_count`
- Do NOT create new row

**State Transitions**:
```
NEW → ACTIVE → RESOLVED
       ↓
     IGNORED
```

---

### 2. Performance Trace

Represents timing data for a monitored operation (API request, database query, etc.).

**Table**: `performance_traces` (partitioned by `timestamp`)

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | Unique identifier (ULID or UUID) |
| `service_id` | TEXT | NOT NULL, FK → services.id | Service that reported the trace |
| `operation_name` | TEXT | NOT NULL | Name of operation (e.g., "GET /api/users") |
| `operation_type` | TEXT | NOT NULL | Type (http_request, db_query, external_call) |
| `start_time` | TIMESTAMPTZ | NOT NULL | When operation started |
| `duration_ms` | INTEGER | NOT NULL | Total duration in milliseconds |
| `status_code` | INTEGER | NULL | HTTP status code (if applicable) |
| `method` | TEXT | NULL | HTTP method (if applicable) |
| `path` | TEXT | NULL | Request path (if applicable) |
| `user_agent` | TEXT | NULL | Client user agent |
| `caller_service` | TEXT | NULL | Service that initiated this operation |
| `breakdown` | JSONB | NULL | Timing breakdown for sub-operations |
| `metadata` | JSONB | NULL | Additional trace metadata |
| `session_id` | TEXT | NULL, FK → sessions.id | Associated session |
| `timestamp` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | When trace was captured |

**Indexes**:
```sql
CREATE INDEX idx_perf_traces_timestamp ON performance_traces USING BRIN (timestamp);
CREATE INDEX idx_perf_traces_service ON performance_traces (service_id);
CREATE INDEX idx_perf_traces_operation ON performance_traces (operation_name);
CREATE INDEX idx_perf_traces_slow ON performance_traces (duration_ms) WHERE duration_ms > 3000;
```

**Partitioning Setup**:
```sql
CREATE TABLE performance_traces (
  id TEXT PRIMARY KEY,
  service_id TEXT NOT NULL,
  operation_name TEXT NOT NULL,
  operation_type TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  duration_ms INTEGER NOT NULL,
  status_code INTEGER,
  method TEXT,
  path TEXT,
  user_agent TEXT,
  caller_service TEXT,
  breakdown JSONB,
  metadata JSONB,
  session_id TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (timestamp);

SELECT partman.create_parent(
  p_parent_table := 'public.performance_traces',
  p_control := 'timestamp',
  p_type := 'native',
  p_interval := 'daily',
  p_premake := 7
);
```

**Validation Rules** (from FR-003, FR-010, FR-012):
- `duration_ms` MUST be >= 0
- `operation_type` MUST be one of: http_request, db_query, external_call, custom
- If `operation_type` = "http_request", `method` and `path` are REQUIRED
- `status_code` MUST be 100-599 if provided

**Breakdown Structure** (FR-013):
```json
{
  "sub_operations": [
    {
      "name": "database_query",
      "duration_ms": 45,
      "details": { "query": "SELECT * FROM users WHERE id = ?" }
    },
    {
      "name": "external_api_call",
      "duration_ms": 230,
      "details": { "url": "https://api.stripe.com/v1/charges" }
    }
  ]
}
```

---

### 3. Breadcrumb

Represents a user action or system event that provides context before an error.

**Table**: `breadcrumbs` (partitioned by `timestamp`)

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | Unique identifier (ULID or UUID) |
| `session_id` | TEXT | NOT NULL, FK → sessions.id | Session this breadcrumb belongs to |
| `service_id` | TEXT | NOT NULL, FK → services.id | Service that captured the breadcrumb |
| `category` | TEXT | NOT NULL | Breadcrumb category (navigation, user_action, http, console, etc.) |
| `level` | TEXT | DEFAULT 'info' | Severity level (debug, info, warning, error) |
| `message` | TEXT | NOT NULL | Human-readable description |
| `data` | JSONB | NULL | Additional breadcrumb data |
| `timestamp` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | When breadcrumb was captured |

**Indexes**:
```sql
CREATE INDEX idx_breadcrumbs_timestamp ON breadcrumbs USING BRIN (timestamp);
CREATE INDEX idx_breadcrumbs_session ON breadcrumbs (session_id);
CREATE INDEX idx_breadcrumbs_service ON breadcrumbs (service_id);
```

**Partitioning Setup**:
```sql
CREATE TABLE breadcrumbs (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  service_id TEXT NOT NULL,
  category TEXT NOT NULL,
  level TEXT DEFAULT 'info',
  message TEXT NOT NULL,
  data JSONB,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (timestamp);

SELECT partman.create_parent(
  p_parent_table := 'public.breadcrumbs',
  p_control := 'timestamp',
  p_type := 'native',
  p_interval := 'daily',
  p_premake := 7
);
```

**Validation Rules** (from FR-004, FR-014):
- `category` MUST be one of: navigation, user_action, http, console, state_change, custom
- `level` MUST be one of: debug, info, warning, error
- `message` MUST NOT be empty
- Maximum 100 breadcrumbs per session (oldest are discarded)

**Category Examples**:
```typescript
// Navigation
{
  category: "navigation",
  message: "User navigated to /dashboard",
  data: { from: "/login", to: "/dashboard" }
}

// User Action
{
  category: "user_action",
  message: "Button clicked: Submit Form",
  data: { button_id: "submit-btn", form_name: "checkout" }
}

// HTTP Request
{
  category: "http",
  message: "POST /api/orders",
  data: { status: 201, duration_ms: 245 }
}
```

---

### 4. Session

Represents a user's interaction period with an application.

**Table**: `sessions`

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | Unique session identifier (ULID) |
| `service_id` | TEXT | NOT NULL, FK → services.id | Service where session occurred |
| `user_id` | TEXT | NULL | User identifier (if authenticated) |
| `user_email` | TEXT | NULL | User email (sanitized, if available) |
| `ip_address` | INET | NULL | Client IP address (hashed for privacy) |
| `user_agent` | TEXT | NULL | Browser/client user agent |
| `started_at` | TIMESTAMPTZ | NOT NULL | Session start time |
| `last_activity_at` | TIMESTAMPTZ | NOT NULL | Last activity timestamp |
| `ended_at` | TIMESTAMPTZ | NULL | Session end time (if known) |
| `duration_seconds` | INTEGER | NULL | Total session duration |
| `breadcrumb_count` | INTEGER | DEFAULT 0 | Number of breadcrumbs captured |
| `error_count` | INTEGER | DEFAULT 0 | Number of errors in this session |
| `metadata` | JSONB | NULL | Additional session metadata |

**Indexes**:
```sql
CREATE INDEX idx_sessions_service ON sessions (service_id);
CREATE INDEX idx_sessions_user ON sessions (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_sessions_started ON sessions (started_at);
CREATE INDEX idx_sessions_active ON sessions (last_activity_at) WHERE ended_at IS NULL;
```

**Validation Rules** (from FR-015):
- `id` MUST be globally unique (ULID recommended)
- `last_activity_at` MUST be >= `started_at`
- Session is considered expired if `last_activity_at` > 30 minutes ago and `ended_at` IS NULL
- `ip_address` MUST be hashed before storage for privacy

**State Transitions**:
```
ACTIVE → EXPIRED (after 30 min inactivity)
ACTIVE → ENDED (explicit end signal)
```

---

### 5. Service Health

Represents the current health status of a monitored service (derived/computed view).

**View**: `service_health` (computed from error_events and performance_traces)

| Field | Type | Description |
|-------|------|-------------|
| `service_id` | TEXT | Service identifier |
| `service_name` | TEXT | Service name |
| `environment` | TEXT | Environment |
| `health_status` | TEXT | Current health (healthy, degraded, critical) |
| `error_rate` | NUMERIC | Errors per minute (last 10 minutes) |
| `avg_response_time_ms` | INTEGER | Average response time (last 10 minutes) |
| `request_volume` | INTEGER | Requests per minute (last 10 minutes) |
| `last_error_at` | TIMESTAMPTZ | Most recent error timestamp |
| `updated_at` | TIMESTAMPTZ | When metrics were last calculated |

**Materialized View Definition**:
```sql
CREATE MATERIALIZED VIEW service_health AS
SELECT
  s.id AS service_id,
  s.name AS service_name,
  e.environment,
  CASE
    WHEN error_rate > 10 THEN 'critical'
    WHEN error_rate > 5 OR avg_response_time_ms > 5000 THEN 'degraded'
    ELSE 'healthy'
  END AS health_status,
  COALESCE(error_rate, 0) AS error_rate,
  COALESCE(avg_response_time_ms, 0) AS avg_response_time_ms,
  COALESCE(request_volume, 0) AS request_volume,
  e.last_error_at,
  NOW() AS updated_at
FROM services s
CROSS JOIN LATERAL (
  SELECT DISTINCT environment FROM error_events WHERE service_id = s.id
  UNION
  SELECT DISTINCT environment FROM performance_traces WHERE service_id = s.id
) e(environment)
LEFT JOIN LATERAL (
  SELECT
    COUNT(*) / 10.0 AS error_rate,
    MAX(timestamp) AS last_error_at
  FROM error_events
  WHERE service_id = s.id
    AND environment = e.environment
    AND timestamp > NOW() - INTERVAL '10 minutes'
) errors ON TRUE
LEFT JOIN LATERAL (
  SELECT
    AVG(duration_ms)::INTEGER AS avg_response_time_ms,
    COUNT(*) / 10.0 AS request_volume
  FROM performance_traces
  WHERE service_id = s.id
    AND timestamp > NOW() - INTERVAL '10 minutes'
) perf ON TRUE;

-- Refresh every 30 seconds via pg_cron
SELECT cron.schedule(
  'refresh-service-health',
  '*/30 * * * * *',
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY service_health$$
);

-- Create unique index for concurrent refresh
CREATE UNIQUE INDEX idx_service_health_pk ON service_health (service_id, environment);
```

**Validation Rules** (from FR-019):
- `health_status` thresholds:
  - **healthy**: error_rate <= 5/min AND avg_response_time < 5000ms
  - **degraded**: error_rate 5-10/min OR avg_response_time 5000-10000ms
  - **critical**: error_rate > 10/min OR avg_response_time > 10000ms

---

### 6. Alert Rule

Represents a configured alert that triggers notifications when conditions are met.

**Table**: `alert_rules`

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | Unique identifier (ULID or UUID) |
| `organization_id` | TEXT | NOT NULL, FK → organizations.id | Organization that owns this rule |
| `name` | TEXT | NOT NULL | Human-readable rule name |
| `description` | TEXT | NULL | Rule description |
| `enabled` | BOOLEAN | DEFAULT TRUE | Whether rule is active |
| `service_id` | TEXT | NULL, FK → services.id | Specific service (NULL = all services) |
| `environment` | TEXT | NULL | Specific environment (NULL = all environments) |
| `condition_type` | TEXT | NOT NULL | Type of condition (error_rate, error_type, performance) |
| `threshold` | JSONB | NOT NULL | Threshold configuration |
| `evaluation_window_minutes` | INTEGER | DEFAULT 10 | Time window for evaluation |
| `notification_channels` | JSONB | NOT NULL | Array of notification channels |
| `last_triggered_at` | TIMESTAMPTZ | NULL | When rule last triggered |
| `trigger_count` | INTEGER | DEFAULT 0 | Total times rule has triggered |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | When rule was created |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | When rule was last updated |

**Indexes**:
```sql
CREATE INDEX idx_alert_rules_org ON alert_rules (organization_id);
CREATE INDEX idx_alert_rules_service ON alert_rules (service_id) WHERE service_id IS NOT NULL;
CREATE INDEX idx_alert_rules_enabled ON alert_rules (enabled) WHERE enabled = TRUE;
```

**Validation Rules** (from FR-020, FR-021, FR-022):
- `condition_type` MUST be one of: error_rate, error_type_match, performance_threshold
- `threshold` structure varies by condition_type:
  - error_rate: `{ "errors_per_minute": 10 }`
  - error_type_match: `{ "error_types": ["TypeError", "NetworkError"] }`
  - performance_threshold: `{ "avg_response_time_ms": 5000 }`
- `evaluation_window_minutes` MUST be 1-60
- `notification_channels` MUST contain at least one channel

**Threshold Examples**:
```json
// Error Rate Alert
{
  "condition_type": "error_rate",
  "threshold": {
    "errors_per_minute": 10,
    "comparison": "greater_than"
  }
}

// Specific Error Type
{
  "condition_type": "error_type_match",
  "threshold": {
    "error_types": ["DatabaseConnectionError", "OutOfMemoryError"]
  }
}

// Performance Degradation
{
  "condition_type": "performance_threshold",
  "threshold": {
    "avg_response_time_ms": 5000,
    "comparison": "greater_than"
  }
}
```

**Notification Channels Structure**:
```json
[
  {
    "type": "email",
    "address": "ops@example.com"
  },
  {
    "type": "webhook",
    "url": "https://hooks.slack.com/services/..."
  }
]
```

**Alert Grouping Logic** (FR-022):
Alert is considered duplicate if:
- Same `alert_rule_id`
- Same `service_id` and `environment`
- Last triggered within `evaluation_window_minutes`

If duplicate detected:
- Suppress new notification
- Increment grouping counter
- Send summary notification after window expires

---

### 7. Alert Notification

Represents a notification sent when an alert rule is triggered.

**Table**: `alert_notifications`

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | Unique identifier (ULID or UUID) |
| `alert_rule_id` | TEXT | NOT NULL, FK → alert_rules.id | Alert rule that triggered |
| `service_id` | TEXT | NOT NULL, FK → services.id | Service that triggered alert |
| `environment` | TEXT | NOT NULL | Environment where alert triggered |
| `triggered_at` | TIMESTAMPTZ | NOT NULL | When alert was triggered |
| `resolved_at` | TIMESTAMPTZ | NULL | When condition resolved (FR-023) |
| `notification_status` | TEXT | NOT NULL | Status (pending, sent, failed, grouped) |
| `channels_notified` | JSONB | NOT NULL | Array of channels notification was sent to |
| `grouped_count` | INTEGER | DEFAULT 1 | Number of alerts grouped together |
| `trigger_data` | JSONB | NOT NULL | Snapshot of data that triggered alert |
| `error_message` | TEXT | NULL | Error message if notification failed |

**Indexes**:
```sql
CREATE INDEX idx_notifications_rule ON alert_notifications (alert_rule_id);
CREATE INDEX idx_notifications_service ON alert_notifications (service_id);
CREATE INDEX idx_notifications_triggered ON alert_notifications (triggered_at);
CREATE INDEX idx_notifications_unresolved ON alert_notifications (resolved_at) WHERE resolved_at IS NULL;
```

**State Transitions**:
```
PENDING → SENT → RESOLVED
   ↓
FAILED
   ↓
GROUPED (if duplicate detected)
```

---

## Relationships

```
organizations (existing)
  ├─ 1:N → services (existing)
  │         ├─ 1:N → error_events
  │         ├─ 1:N → performance_traces
  │         ├─ 1:N → breadcrumbs
  │         └─ 1:N → sessions
  │                   ├─ 1:N → breadcrumbs
  │                   └─ 1:N → error_events (optional)
  └─ 1:N → alert_rules
            └─ 1:N → alert_notifications
                      └─ N:1 → services
```

---

## Retention Policies (FR-030)

Data retention is managed via pg_partman partition dropping based on subscription tier:

| Tier | Retention Period | Implementation |
|------|-----------------|----------------|
| Trial/Free | 7 days | `UPDATE partman.part_config SET retention = '7 days'` |
| Paid | 90 days | `UPDATE partman.part_config SET retention = '90 days'` |
| Enterprise | 1 year | `UPDATE partman.part_config SET retention = '365 days'` |

**Retention Service Logic**:
```sql
-- Update retention based on organization's subscription tier
UPDATE partman.part_config pc
SET retention = CASE
  WHEN o.subscription_tier = 'trial' OR o.subscription_tier = 'free' THEN '7 days'
  WHEN o.subscription_tier = 'paid' THEN '90 days'
  WHEN o.subscription_tier = 'enterprise' THEN '365 days'
END
FROM organizations o
WHERE pc.parent_table IN (
  'public.error_events',
  'public.performance_traces',
  'public.breadcrumbs'
);
```

---

## Migration Strategy

### Phase 1: Create Partitioned Tables (Week 1)
1. Enable extensions (pg_partman, pg_cron)
2. Create partitioned tables (error_events, performance_traces, breadcrumbs)
3. Setup pg_partman configuration
4. Create indexes (BRIN for timestamps, B-tree for filters)
5. Schedule maintenance jobs

### Phase 2: Create Supporting Tables (Week 1)
1. Create sessions table
2. Create alert_rules table
3. Create alert_notifications table
4. Create service_health materialized view
5. Setup refresh job for materialized view

### Phase 3: Dual-Write Period (Week 2)
1. Update ingestion endpoints to write to new tables
2. Keep existing logging/metrics for comparison
3. Monitor partition creation and maintenance
4. Validate data accuracy

### Phase 4: Switch Reads (Week 3)
1. Update dashboard queries to read from partitioned tables
2. Update alert evaluation to query new tables
3. Monitor query performance
4. Adjust indexes if needed

### Phase 5: Cleanup (Week 4)
1. Drop old logging tables
2. Remove dual-write logic
3. Document final schema
4. Update API documentation

---

## Performance Considerations

**Write Performance** (SC-006: Handle 10,000 errors/minute):
- Partitioned tables enable parallel writes
- BRIN indexes have minimal write overhead
- Batch inserts reduce round-trips

**Read Performance** (SC-012: Search under 2 seconds for 1M errors):
- Partition pruning eliminates 95%+ of data for time-range queries
- BRIN indexes provide 99% storage savings
- Materialized view for service health avoids expensive aggregations

**Retention Performance**:
- Partition drops are instant (vs slow row-by-row DELETE)
- Automated via pg_cron
- No impact on active partitions

**Dashboard Performance** (SC-015: 100 services monitored):
- Materialized view refresh every 30 seconds
- Redis caching for API responses (3-5 second TTL)
- SWR polling prevents thundering herd

---

## Security Considerations

**Sensitive Data** (FR-026):
- Error messages sanitized before storage
- Stack traces scrubbed for tokens/passwords
- IP addresses hashed for privacy
- User emails encrypted at rest

**Access Control**:
- Row-Level Security (RLS) policies on all tables
- Organization-based data isolation
- Service-specific permissions

**Audit Trail**:
- All alert_rules changes logged
- Retention policy changes tracked
- Admin actions on errors (resolve/ignore) audited
