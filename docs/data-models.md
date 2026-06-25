# Lattice — Data Models

## Self-Hosted Lattice

### Monitor

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Production API",
  "url": "https://api.example.com/health",
  "type": "https",
  "interval": "60s",
  "timeout": "10s",
  "expected_status": 200,
  "enabled": true,
  "group": "Production",
  "created_at": "2026-06-24T23:00:00Z",
  "updated_at": "2026-06-24T23:00:00Z"
}
```

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | Generated on create |
| `name` | string | Required |
| `url` | string | Required. Format depends on type |
| `type` | enum | `http`, `https`, `tcp`, `dns`, `icmp` |
| `interval` | duration | Default `60s`. Min `10s` |
| `timeout` | duration | Default `10s` |
| `expected_status` | int | HTTP status code. Default `200` |
| `enabled` | bool | Default `true` |
| `group` | string | Optional, for organizing monitors |

### Check

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "monitor_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "up",
  "latency_ms": 45,
  "status_code": 200,
  "error": "",
  "checked_at": "2026-06-24T23:00:00Z"
}
```

| Field | Type | Notes |
|-------|------|-------|
| `status` | enum | `up`, `down`, `degraded`, `unknown` |
| `latency_ms` | int64 | Round-trip time |
| `status_code` | int | HTTP status (for HTTP/HTTPS) |
| `error` | string | Error message if status is `down` |

### Incident

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440002",
  "monitor_id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "API Outage",
  "severity": "major",
  "status": "investigating",
  "auto_created": false,
  "created_at": "2026-06-24T23:00:00Z",
  "updated_at": "2026-06-24T23:00:00Z",
  "resolved_at": null
}
```

| Field | Type | Notes |
|-------|------|-------|
| `severity` | enum | `minor`, `major`, `critical` |
| `status` | enum | `investigating`, `identified`, `monitoring`, `resolved` |
| `auto_created` | bool | `true` if created by threshold logic, `false` if manual |
| `resolved_at` | timestamp \| null | Set when status becomes `resolved` |

### IncidentUpdate

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440003",
  "incident_id": "550e8400-e29b-41d4-a716-446655440002",
  "status": "identified",
  "message": "Found the root cause, deploying fix",
  "created_at": "2026-06-24T23:05:00Z"
}
```

### NotificationChannel

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440004",
  "type": "slack",
  "name": "Slack Alerts",
  "config": {
    "webhook_url": "https://hooks.slack.com/services/..."
  },
  "enabled": true,
  "created_at": "2026-06-24T23:00:00Z",
  "updated_at": "2026-06-24T23:00:00Z"
}
```

Config is a `map[string]string` — keys depend on type:
- **slack**: `webhook_url`
- **discord**: `webhook_url`
- **email**: `smtp_host`, `smtp_port`, `smtp_user`, `smtp_pass`, `smtp_from`, `to`
- **webhook**: `url`, `secret` (optional)
- **ntfy**: `url`, `token` (optional)

### MaintenanceWindow

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440005",
  "monitor_id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Scheduled maintenance",
  "description": "Upgrading database",
  "start_time": "2026-06-25T02:00:00Z",
  "end_time": "2026-06-25T04:00:00Z",
  "created_at": "2026-06-24T23:00:00Z"
}
```

### Settings

```json
{
  "site_name": "My Status Page",
  "logo_url": "",
  "accent_color": "#4d9f5d",
  "custom_css": "",
  "custom_domain": ""
}
```

---

## Hosted Control Plane

### Tenant

```json
{
  "id": "tnt_05c86a4b-3bc",
  "email": "boss@acme.com",
  "slug": "acme",
  "status": "active",
  "trial_ends_at": "2026-07-08T23:00:00Z",
  "created_at": "2026-06-24T23:00:00Z",
  "updated_at": "2026-06-24T23:00:00Z",
  "suspended_at": null
}
```

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | Format: `tnt_` + 12-char UUID prefix |
| `email` | string | Lowercase, trimmed |
| `slug` | string | Subdomain: `{slug}.lattice.black`. Regex: `^[a-z0-9]([a-z0-9-]{1,30}[a-z0-9])?$` |
| `api_key` | string | Format: `lat_` + UUID. Never exposed in JSON (`json:"-"`) |
| `status` | enum | `trial`, `active`, `suspended`, `deleted` |
| `stripe_customer_id` | string | Set after checkout completion. Hidden in JSON. |
| `stripe_sub_id` | string | Set after checkout completion. Hidden in JSON. |
| `trial_ends_at` | timestamp \| null | 14 days from signup. Null after activation. |
| `suspended_at` | timestamp \| null | Set when status becomes `suspended`. |

**Status transitions:**
```
trial → active     (checkout.session.completed webhook)
trial → suspended   (payment failure or admin action)
active → suspended  (payment failure or admin action)
suspended → active  (admin action, scales pod back to 1)
any → deleted       (admin delete, K8s resources removed, subscription cancelled)
```

### SignupRequest

```json
{
  "email": "you@company.com",
  "slug": "acme"
}
```

### SignupResponse (no Stripe)

```json
{
  "tenant_id": "tnt_05c86a4b-3bc",
  "tenant_url": "https://acme.lattice.black",
  "dashboard_url": "https://acme.lattice.black/dashboard",
  "api_key": "lat_550e8400-e29b-41d4-a716-446655440000",
  "status": "trial",
  "trial_ends_at": "2026-07-08T23:00:00Z"
}
```

### SignupResponse (with Stripe)

```json
{
  "tenant_id": "tnt_05c86a4b-3bc",
  "checkout_url": "https://checkout.stripe.com/c/pay/cs_test_...",
  "tenant_url": "https://acme.lattice.black",
  "status": "trial",
  "trial_ends_at": "2026-07-08T23:00:00Z"
}
```

Note: API key is not returned in the Stripe flow — the tenant dashboard authenticates with the API key set in the K8s deployment env var. The user retrieves it via the login endpoint.