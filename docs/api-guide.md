# Lattice API Guide

Everything you need to use the Lattice API to automate monitors, incidents, notifications, and more.

## Authentication

All admin endpoints require an API key. Pass it as a header:

```
X-API-Key: lat_your_key_here
```

Or as a Bearer token:

```
Authorization: Bearer lat_your_key_here
```

Find your API key in **Dashboard → Settings** (`/dashboard/settings`).

Public endpoints (health, status page) do **not** require a key.

---

## Quick Start

Set your base URL and API key as variables so the examples are copy-pasteable:

```bash
LATTICE_URL="https://your-instance.com"
LATTICE_KEY="lat_your_key_here"
```

Test that it works:

```bash
curl "$LATTICE_URL/api/monitors" \
  -H "X-API-Key: $LATTICE_KEY"
```

---

## Monitors

### List all monitors

```bash
curl "$LATTICE_URL/api/monitors" \
  -H "X-API-Key: $LATTICE_KEY"
```

**Response** `200 OK`:

```json
[
  {
    "id": "307a53bf-b8ce-44d1-81b5-39d344c1ba2b",
    "name": "My Website",
    "url": "https://example.com",
    "type": "https",
    "interval": 60,
    "timeout": 30,
    "expected_status": 200,
    "enabled": true,
    "status": "up",
    "latency": 1302,
    "last_checked": "2026-06-25T21:03:33Z",
    "created_at": "2026-06-25T21:01:08Z",
    "updated_at": "2026-06-25T21:01:08Z"
  }
]
```

### Create a monitor

```bash
curl -X POST "$LATTICE_URL/api/monitors" \
  -H "X-API-Key: $LATTICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Website",
    "url": "https://example.com",
    "type": "https",
    "interval": 60,
    "timeout": 30,
    "expected_status": 200
  }'
```

**Fields:**

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| `name` | string | yes | — | Display name |
| `url` | string | yes | — | URL for HTTP/HTTPS, `host:port` for TCP |
| `type` | string | yes | — | `http`, `https`, `tcp`, `dns`, or `icmp` |
| `interval` | int (seconds) | no | 60 | How often to check |
| `timeout` | int (seconds) | no | 10 | Fail after this many seconds |
| `expected_status` | int | no | 200 | HTTP/HTTPS only. Status code to expect |
| `group` | string | no | — | For organizing monitors on the status page |

**Response** `201 Created` — same shape as a single monitor object (see above).

### Get a single monitor

```bash
curl "$LATTICE_URL/api/monitors/{id}" \
  -H "X-API-Key: $LATTICE_KEY"
```

### Update a monitor

All fields are optional — only included fields are changed.

```bash
curl -X PUT "$LATTICE_URL/api/monitors/{id}" \
  -H "X-API-Key: $LATTICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Website (Updated)",
    "interval": 30
  }'
```

**Fields** (all optional):

| Field | Type | Notes |
|-------|------|-------|
| `name` | string | New name |
| `url` | string | New URL |
| `type` | string | New type |
| `interval` | int (seconds) | New interval |
| `timeout` | int (seconds) | New timeout |
| `expected_status` | int | New expected status code |
| `enabled` | bool | Enable/disable the monitor |
| `group` | string | New group |

You can also use `PATCH` instead of `PUT` — same behavior.

### Delete a monitor

```bash
curl -X DELETE "$LATTICE_URL/api/monitors/{id}" \
  -H "X-API-Key: $LATTICE_KEY"
```

**Response** `204 No Content`

### Get monitor history (90 days)

```bash
curl "$LATTICE_URL/api/monitors/{id}/history" \
  -H "X-API-Key: $LATTICE_KEY"
```

**Response** `200 OK`:

```json
[
  {
    "date": "2026-06-25",
    "status": "up",
    "uptime_percent": 100
  }
]
```

---

## Incidents

### List incidents

```bash
# All incidents
curl "$LATTICE_URL/api/incidents" \
  -H "X-API-Key: $LATTICE_KEY"

# Only active
curl "$LATTICE_URL/api/incidents?status=active" \
  -H "X-API-Key: $LATTICE_KEY"

# Only resolved
curl "$LATTICE_URL/api/incidents?status=resolved" \
  -H "X-API-Key: $LATTICE_KEY"
```

**Response** `200 OK`:

```json
[
  {
    "id": "abc123",
    "title": "Deploy failed — investigating",
    "monitor_id": "307a53bf-...",
    "monitor_name": "My Website",
    "severity": "major",
    "status": "investigating",
    "updates": [
      {
        "id": "update1",
        "status": "investigating",
        "message": "Looking into the issue",
        "created_at": "2026-06-25T21:05:00Z"
      }
    ],
    "created_at": "2026-06-25T21:05:00Z"
  }
]
```

### Create an incident

```bash
curl -X POST "$LATTICE_URL/api/incidents" \
  -H "X-API-Key: $LATTICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Deploy failed — investigating",
    "severity": "major",
    "monitor_id": "307a53bf-b8ce-44d1-81b5-39d344c1ba2b",
    "message": "Checking what went wrong with the v1.2.3 deploy"
  }'
```

**Fields:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `title` | string | yes | Headline shown on status page |
| `severity` | string | yes | `minor`, `major`, or `critical` |
| `monitor_id` | string | no | Link to a specific monitor |
| `message` | string | no | Initial update message |

**Severity levels:**

- `minor` — Minor impact, most users unaffected
- `major` — Significant impact, some users affected
- `critical` — Major outage, most users affected

**Response** `201 Created` — incident object with initial update.

### Get a single incident

```bash
curl "$LATTICE_URL/api/incidents/{id}" \
  -H "X-API-Key: $LATTICE_KEY"
```

### Add an update to an incident

```bash
curl -X POST "$LATTICE_URL/api/incidents/{id}/updates" \
  -H "X-API-Key: $LATTICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "identified",
    "message": "Found the issue — bad database migration"
  }'
```

**Status values:**

| Status | Meaning |
|--------|---------|
| `investigating` | Looking into it |
| `identified` | Found the cause |
| `monitoring` | Fix deployed, watching to confirm |
| `resolved` | Fixed (use the resolve endpoint instead) |

### Resolve an incident

```bash
curl -X POST "$LATTICE_URL/api/incidents/{id}/resolve" \
  -H "X-API-Key: $LATTICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Fixed in v1.2.4"
  }'
```

### Update an incident (change status)

```bash
curl -X PUT "$LATTICE_URL/api/incidents/{id}" \
  -H "X-API-Key: $LATTICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "monitoring",
    "message": "Fix deployed, monitoring for confirmation"
  }'
```

### Delete an incident

```bash
curl -X DELETE "$LATTICE_URL/api/incidents/{id}" \
  -H "X-API-Key: $LATTICE_KEY"
```

**Response** `204 No Content`

---

## Notification Channels

### List notification channels

```bash
curl "$LATTICE_URL/api/notifications" \
  -H "X-API-Key: $LATTICE_KEY"
```

**Response** `200 OK`:

```json
[
  {
    "id": "chan1",
    "name": "Dev Team Slack",
    "type": "slack",
    "enabled": true,
    "config": {
      "webhook_url": "https://hooks.slack.com/services/..."
    },
    "created_at": "2026-06-25T21:00:00Z",
    "updated_at": "2026-06-25T21:00:00Z"
  }
]
```

### Create a notification channel

**Slack:**

```bash
curl -X POST "$LATTICE_URL/api/notifications" \
  -H "X-API-Key: $LATTICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Dev Team Slack",
    "type": "slack",
    "config": {
      "webhook_url": "https://hooks.slack.com/services/T000/B000/XXX"
    }
  }'
```

**Discord:**

```bash
curl -X POST "$LATTICE_URL/api/notifications" \
  -H "X-API-Key: $LATTICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Alerts Discord",
    "type": "discord",
    "config": {
      "webhook_url": "https://discord.com/api/webhooks/..."
    }
  }'
```

**Email:**

```bash
curl -X POST "$LATTICE_URL/api/notifications" \
  -H "X-API-Key: $LATTICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Ops Email",
    "type": "email",
    "config": {
      "to": "ops@example.com"
    }
  }'
```

**Webhook:**

```bash
curl -X POST "$LATTICE_URL/api/notifications" \
  -H "X-API-Key: $LATTICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Custom Webhook",
    "type": "webhook",
    "config": {
      "url": "https://example.com/webhook"
    }
  }'
```

**ntfy:**

```bash
curl -X POST "$LATTICE_URL/api/notifications" \
  -H "X-API-Key: $LATTICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Phone Push",
    "type": "ntfy",
    "config": {
      "url": "https://ntfy.sh/your-topic"
    }
  }'
```

**Fields:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `name` | string | yes | Display name |
| `type` | string | yes | `slack`, `discord`, `email`, `webhook`, or `ntfy` |
| `config` | object | yes | Type-specific config (see above) |

**Response** `201 Created` — notification channel object.

### Update a notification channel

```bash
curl -X PUT "$LATTICE_URL/api/notifications/{id}" \
  -H "X-API-Key: $LATTICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": false
  }'
```

**Fields** (all optional):

| Field | Type | Notes |
|-------|------|-------|
| `name` | string | New name |
| `config` | object | New config |
| `enabled` | bool | Enable/disable |

### Delete a notification channel

```bash
curl -X DELETE "$LATTICE_URL/api/notifications/{id}" \
  -H "X-API-Key: $LATTICE_KEY"
```

**Response** `204 No Content`

### Send a test notification

```bash
curl -X POST "$LATTICE_URL/api/notifications/{id}/test" \
  -H "X-API-Key: $LATTICE_KEY"
```

**Response** `200 OK`:

```json
{ "success": true }
```

---

## Maintenance Windows

### List maintenance windows

```bash
curl "$LATTICE_URL/api/maintenance" \
  -H "X-API-Key: $LATTICE_KEY"
```

**Response** `200 OK`:

```json
[
  {
    "id": "mw1",
    "monitor_id": "307a53bf-...",
    "monitor_name": "My Website",
    "title": "Database upgrade",
    "description": "Upgrading PostgreSQL to v16",
    "start_time": "2026-06-26T02:00:00Z",
    "end_time": "2026-06-26T04:00:00Z",
    "created_at": "2026-06-25T21:00:00Z"
  }
]
```

### Create a maintenance window

```bash
curl -X POST "$LATTICE_URL/api/maintenance" \
  -H "X-API-Key: $LATTICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "monitor_id": "307a53bf-b8ce-44d1-81b5-39d344c1ba2b",
    "title": "Database upgrade",
    "description": "Upgrading PostgreSQL to v16",
    "start_time": "2026-06-26T02:00:00Z",
    "end_time": "2026-06-26T04:00:00Z"
  }'
```

**Fields:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `monitor_id` | string | yes | Which monitor this applies to |
| `title` | string | yes | Shown on status page |
| `description` | string | no | Additional details |
| `start_time` | string (RFC3339) | yes | When maintenance starts |
| `end_time` | string (RFC3339) | yes | When maintenance ends |

Times must be in RFC3339 format (e.g. `2026-06-26T02:00:00Z`).

**Response** `201 Created` — maintenance window object.

### Delete a maintenance window

Maintenance windows cannot be updated. Delete and recreate if you need to change times.

```bash
curl -X DELETE "$LATTICE_URL/api/maintenance/{id}" \
  -H "X-API-Key: $LATTICE_KEY"
```

**Response** `204 No Content`

---

## Settings

### Get settings

```bash
curl "$LATTICE_URL/api/settings" \
  -H "X-API-Key: $LATTICE_KEY"
```

**Response** `200 OK`:

```json
{
  "site_name": "My Company Status",
  "logo_url": "https://example.com/logo.svg",
  "accent_color": "#4d9f5d",
  "custom_css": "",
  "custom_domain": ""
}
```

### Update settings

All fields are optional — only included fields are changed.

```bash
curl -X PUT "$LATTICE_URL/api/settings" \
  -H "X-API-Key: $LATTICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "site_name": "My Company Status",
    "accent_color": "#3b82f6"
  }'
```

**Fields** (all optional):

| Field | Type | Notes |
|-------|------|-------|
| `site_name` | string | Name shown on status page |
| `logo_url` | string | URL to logo image |
| `accent_color` | string | Hex color (e.g. `#4d9f5d`) |
| `custom_css` | string | Custom CSS injected into status page |
| `custom_domain` | string | Custom domain for status page |

---

## Public Endpoints (no API key)

### Health check

```bash
curl "$LATTICE_URL/api/health"
```

**Response** `200 OK`:

```json
{ "status": "ok" }
```

### Status page data

This is what the public status page uses. No key required.

```bash
curl "$LATTICE_URL/api/status"
```

**Response** `200 OK`:

```json
{
  "site_name": "My Company Status",
  "overall_status": "operational",
  "monitors": [
    {
      "id": "307a53bf-...",
      "name": "My Website",
      "status": "up",
      "latency": 1302,
      "uptime_90d": 100,
      "history": [
        {
          "date": "2026-06-25",
          "status": "up",
          "uptime_percent": 100
        }
      ]
    }
  ],
  "active_incidents": [],
  "past_incidents": [],
  "active_maintenance": []
}
```

**`overall_status` values:**

- `operational` — all monitors up
- `degraded` — at least one monitor degraded
- `partial_outage` — at least one monitor down
- `major_outage` — most monitors down

### Status history for a monitor

```bash
curl "$LATTICE_URL/api/status/history/{monitor_id}"
```

**Response** `200 OK`:

```json
[
  {
    "date": "2026-06-25",
    "status": "up",
    "uptime_percent": 100
  }
]
```

---

## Common Automation Recipes

### CI/CD: Post an incident when a deploy fails

```bash
#!/bin/bash
LATTICE_URL="https://your-instance.com"
LATTICE_KEY="lat_your_key_here"

# Create incident
INCIDENT=$(curl -sS -X POST "$LATTICE_URL/api/incidents" \
  -H "X-API-Key: $LATTICE_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"Deploy failed — investigating\",
    \"severity\": \"major\",
    \"monitor_id\": \"$MONITOR_ID\",
    \"message\": \"Deploy of $CI_COMMIT_SHA failed\"
  }")

# Save incident ID for later resolution
echo "$INCIDENT" | jq -r '.id' > /tmp/incident_id.txt
```

### CI/CD: Resolve when deploy succeeds

```bash
#!/bin/bash
INCIDENT_ID=$(cat /tmp/incident_id.txt)

curl -X POST "$LATTICE_URL/api/incidents/$INCIDENT_ID/resolve" \
  -H "X-API-Key: $LATTICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Fixed in '"$CI_COMMIT_SHA"'"
  }'
```

### Script: Add a monitor for a new service

```bash
#!/bin/bash
curl -X POST "$LATTICE_URL/api/monitors" \
  -H "X-API-Key: $LATTICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "'"$SERVICE_NAME"'",
    "url": "https://'"$SERVICE_DOMAIN"'",
    "type": "https",
    "interval": 60,
    "timeout": 30,
    "expected_status": 200,
    "group": "Production"
  }'
```

### Monitoring: Check if any monitors are down

```bash
#!/bin/bash
# Returns exit code 1 if any monitor is not "up"
DOWN=$(curl -sS "$LATTICE_URL/api/status" | jq '[.monitors[] | select(.status != "up")] | length')

if [ "$DOWN" -gt 0 ]; then
  echo "WARNING: $DOWN monitor(s) are not up"
  exit 1
fi

echo "All monitors operational"
```

### Schedule maintenance for a deploy window

```bash
#!/bin/bash
# Schedule 1-hour maintenance starting at 2am UTC tomorrow
START=$(date -u -d "tomorrow 02:00" +%Y-%m-%dT%H:%M:%SZ)
END=$(date -u -d "tomorrow 03:00" +%Y-%m-%dT%H:%M:%SZ)

curl -X POST "$LATTICE_URL/api/maintenance" \
  -H "X-API-Key: $LATTICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "monitor_id": "'"$MONITOR_ID"'",
    "title": "Scheduled deploy",
    "description": "Rolling out v2.0",
    "start_time": "'"$START"'",
    "end_time": "'"$END"'"
  }'
```

---

## Error Responses

All errors return JSON with an `error` field:

```json
{ "error": "unauthorized" }
```

| Status | Meaning |
|--------|---------|
| `400` | Bad request — missing or invalid fields |
| `401` | Unauthorized — missing or invalid API key |
| `404` | Not found — resource doesn't exist |
| `500` | Internal server error |

---

## Rate Limits

No rate limits are currently enforced. The API is designed for low-frequency
administrative calls (creating monitors, posting incidents) and the internal
monitor checker. Be reasonable — don't poll `/api/monitors` 100 times per second.