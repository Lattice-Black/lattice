# Lattice — API Specification

## Self-Hosted Lattice API

Base URL: `http://localhost:8080` (or configured host/port)
Auth: `X-API-Key` header or `Authorization: Bearer <key>` on all admin routes.

### Public Routes (no auth)

#### `GET /api/health`
Returns 200 if the service is healthy.

**Response:**
```json
{ "status": "healthy", "timestamp": "2026-06-24T23:00:00Z" }
```

#### `GET /api/status`
Returns the public status page data — all monitors with their current status, active incidents, and overall status.

**Response:**
```json
{
  "site_name": "My Status Page",
  "overall_status": "up",
  "monitors": [
    {
      "id": "uuid",
      "name": "Production API",
      "status": "up",
      "latency_ms": 45,
      "group": "Production",
      "history": [
        { "status": "up", "checked_at": "2026-06-24T22:55:00Z" },
        { "status": "up", "checked_at": "2026-06-24T22:56:00Z" }
      ]
    }
  ],
  "incidents": [
    {
      "id": "uuid",
      "title": "API Degradation",
      "severity": "major",
      "status": "monitoring",
      "created_at": "2026-06-24T22:00:00Z"
    }
  ]
}
```

#### `GET /api/status/history/{monitorId}`
Returns check history for a specific monitor.

**Query params:** `limit` (default: 100, max: 1000)

**Response:**
```json
{
  "monitor_id": "uuid",
  "checks": [
    {
      "id": "uuid",
      "status": "up",
      "latency_ms": 45,
      "status_code": 200,
      "error": "",
      "checked_at": "2026-06-24T22:55:00Z"
    }
  ]
}
```

---

### Admin Routes (require API key)

#### Monitors

##### `POST /api/monitors`
Create a new monitor.

**Request:**
```json
{
  "name": "Production API",
  "url": "https://api.example.com/health",
  "type": "https",
  "interval": "60s",
  "timeout": "10s",
  "expected_status": 200,
  "group": "Production",
  "enabled": true
}
```

**Response:** `201 Created`
```json
{
  "id": "uuid",
  "name": "Production API",
  "url": "https://api.example.com/health",
  "type": "https",
  "interval": "60s",
  "timeout": "10s",
  "expected_status": 200,
  "group": "Production",
  "enabled": true,
  "created_at": "2026-06-24T23:00:00Z",
  "updated_at": "2026-06-24T23:00:00Z"
}
```

**Validation:**
- `name` — required
- `url` — required
- `type` — required, one of: `http`, `https`, `tcp`, `dns`, `icmp`
- `interval` — duration string (e.g. `60s`, `5m`), default `60s`
- `timeout` — duration string, default `10s`
- `expected_status` — integer HTTP status, default `200`

##### `GET /api/monitors`
List all monitors.

**Response:** Array of monitor objects.

##### `GET /api/monitors/{id}`
Get a single monitor.

##### `PUT /api/monitors/{id}`
Replace a monitor. Same body as POST.

##### `PATCH /api/monitors/{id}`
Partially update a monitor. All fields optional.

##### `DELETE /api/monitors/{id}`
Delete a monitor. Also cascades to checks, incidents, and maintenance windows.

##### `GET /api/monitors/{id}/history`
Get check history for a monitor. Same format as `/api/status/history/{id}`.

---

#### Incidents

##### `POST /api/incidents`
Create a manual incident.

**Request:**
```json
{
  "monitor_id": "uuid",
  "title": "API Outage",
  "severity": "critical",
  "message": "Investigating elevated error rates"
}
```

**Response:** `201 Created`
```json
{
  "id": "uuid",
  "monitor_id": "uuid",
  "title": "API Outage",
  "severity": "critical",
  "status": "investigating",
  "auto_created": false,
  "created_at": "2026-06-24T23:00:00Z",
  "updated_at": "2026-06-24T23:00:00Z"
}
```

**Severity values:** `minor`, `major`, `critical`
**Status values:** `investigating`, `identified`, `monitoring`, `resolved`

##### `GET /api/incidents`
List incidents. **Query param:** `status` (filter by status).

##### `GET /api/incidents/{id}`
Get a single incident with its updates.

##### `PUT /api/incidents/{id}`
Update incident (title, severity).

##### `POST /api/incidents/{id}/updates`
Add a status update to an incident.

**Request:**
```json
{
  "status": "identified",
  "message": "Found the root cause, deploying fix"
}
```

##### `POST /api/incidents/{id}/resolve`
Resolve an incident. Optionally include a final message.

**Request:**
```json
{
  "message": "Issue resolved, services back to normal"
}
```

##### `DELETE /api/incidents/{id}`
Delete an incident.

---

#### Notifications

##### `POST /api/notifications`
Create a notification channel.

**Request (Slack example):**
```json
{
  "type": "slack",
  "name": "Slack Alerts",
  "config": {
    "webhook_url": "https://hooks.slack.com/services/..."
  },
  "enabled": true
}
```

**Types and config keys:**
| Type | Required config keys |
|------|---------------------|
| `slack` | `webhook_url` |
| `discord` | `webhook_url` |
| `email` | `smtp_host`, `smtp_port`, `smtp_user`, `smtp_pass`, `smtp_from`, `to` |
| `webhook` | `url`, `secret` (optional, for HMAC signing) |
| `ntfy` | `url`, `token` (optional) |

##### `GET /api/notifications`
List notification channels.

##### `GET /api/notifications/{id}`
Get a channel.

##### `PUT /api/notifications/{id}`
Update a channel.

##### `DELETE /api/notifications/{id}`
Delete a channel.

##### `POST /api/notifications/{id}/test`
Send a test notification through the channel.

---

#### Maintenance Windows

##### `POST /api/maintenance`
Create a maintenance window.

**Request:**
```json
{
  "monitor_id": "uuid",
  "title": "Scheduled maintenance",
  "description": "Upgrading database",
  "start_time": "2026-06-25T02:00:00Z",
  "end_time": "2026-06-25T04:00:00Z"
}
```

During an active maintenance window, the affected monitor's failures do not trigger incidents or notifications.

##### `GET /api/maintenance`
List maintenance windows.

##### `GET /api/maintenance/{id}`
Get a window.

##### `PUT /api/maintenance/{id}`
Update a window.

##### `DELETE /api/maintenance/{id}`
Delete a window.

---

#### Settings

##### `GET /api/settings`
Get site settings.

**Response:**
```json
{
  "site_name": "My Status Page",
  "logo_url": "",
  "accent_color": "#4d9f5d",
  "custom_css": "",
  "custom_domain": ""
}
```

##### `PUT /api/settings`
Update settings. All fields optional.

---

## Hosted Control Plane API

Base URL: `https://hosted.lattice.black` (prod) or `https://cloud.lattice.black` (staging)

### Public Routes

#### `GET /api/hosted/signup`
Returns pricing info for the signup page.

**Response:**
```json
{
  "price_yearly": 25,
  "trial_days": 14,
  "available_features": [
    "unlimited_monitors",
    "unlimited_status_pages",
    "90_day_history",
    "all_notifications",
    "incident_management",
    "custom_domain",
    "priority_support"
  ]
}
```

#### `POST /api/hosted/signup`
Create a new tenant account.

**Request:**
```json
{
  "email": "you@company.com",
  "slug": "acme"
}
```

**Response (with Stripe configured):** `201 Created`
```json
{
  "tenant_id": "tnt_abc123",
  "checkout_url": "https://checkout.stripe.com/...",
  "tenant_url": "https://acme.lattice.black",
  "status": "trial",
  "trial_ends_at": "2026-07-08T23:00:00Z"
}
```

**Response (no Stripe, manual billing):** `201 Created`
```json
{
  "tenant_id": "tnt_abc123",
  "tenant_url": "https://acme.lattice.black",
  "dashboard_url": "https://acme.lattice.black/dashboard",
  "api_key": "lat_uuid",
  "status": "trial",
  "trial_ends_at": "2026-07-08T23:00:00Z"
}
```

**Validation:**
- `email` — required, must contain `@`, must not belong to an existing (non-deleted) account
- `slug` — required, regex `^[a-z0-9]([a-z0-9-]{1,30}[a-z0-9])?$`, must not be taken

**Side effects:**
1. Tenant row inserted into SQLite (status: `trial`, 14-day trial end)
2. If Stripe configured: checkout session created, tenant must complete payment
3. K8s resources provisioned (deployment, service, ingress, PVC) via `kubectl apply`
4. Tenant pod starts pulling `ghcr.io/lattice-black/lattice:latest`

#### `GET /api/hosted/check-slug/{slug}`
Check if a slug is available.

**Response:**
```json
{
  "available": true,
  "slug": "acme",
  "url": "acme.lattice.black"
}
```

#### `POST /api/hosted/login`
Retrieve access info for an existing account by email.

**Request:**
```json
{
  "email": "you@company.com"
}
```

**Response (account found):** `200 OK`
```json
{
  "exists": true,
  "tenant_url": "https://acme.lattice.black",
  "dashboard_url": "https://acme.lattice.black/dashboard",
  "api_key": "lat_uuid",
  "status": "trial"
}
```

**Response (no account):** `200 OK`
```json
{
  "exists": false
}
```

Note: Only returns non-deleted tenants. Deleted accounts are treated as non-existent.

#### `POST /api/hosted/stripe/webhook`
Receives Stripe webhook events. Verified via HMAC-SHA256 signature.

**Handled events:**
| Event | Action |
|-------|--------|
| `checkout.session.completed` | Activate tenant, set Stripe customer/sub IDs, provision if not already |
| `customer.subscription.updated` | If status is `canceled`/`unpaid`/`incomplete_expired`: suspend tenant, scale to 0 |
| `customer.subscription.deleted` | Suspend tenant, scale to 0 |
| `invoice.payment_failed` | Suspend tenant, scale to 0 |

---

### Admin Routes (require admin API key via `X-API-Key` header)

#### `GET /api/hosted/tenants`
List all non-deleted tenants.

**Query param:** `status` — filter by status (`trial`, `active`, `suspended`)

**Response:**
```json
[
  {
    "id": "tnt_abc123",
    "email": "you@company.com",
    "slug": "acme",
    "status": "active",
    "trial_ends_at": "2026-07-08T23:00:00Z",
    "created_at": "2026-06-24T23:00:00Z",
    "updated_at": "2026-06-24T23:00:00Z"
  }
]
```

Note: `api_key`, `stripe_customer_id`, and `stripe_sub_id` are never exposed in JSON (tagged with `json:"-"`).

#### `GET /api/hosted/tenants/{id}`
Get a single tenant.

#### `DELETE /api/hosted/tenants/{id}`
Soft-delete a tenant. Side effects:
1. K8s resources deprovisioned (deployment, service, ingress, PVC, TLS secret)
2. Stripe subscription cancelled (if exists)
3. Tenant status set to `deleted` in DB (row retained, slug can be reused)

#### `POST /api/hosted/tenants/{id}/suspend`
Suspend a tenant. Scales K8s deployment to 0 replicas. Status → `suspended`.

#### `POST /api/hosted/tenants/{id}/activate`
Reactivate a tenant. Scales K8s deployment to 1 replica. Status → `active`.