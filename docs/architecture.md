# Lattice — Architecture Specification

## Overview

Lattice is a status page and monitoring platform with two modes of operation:

| Mode | Binary | Who runs it | URL pattern |
|------|--------|-------------|-------------|
| **Self-hosted** | `lattice` | Anyone, on their own infra | `lattice.black` (marketing) / user's own domain |
| **Hosted SaaS** | `hosted` | We run it on our K8s cluster | `hosted.lattice.black` (signup) → `{slug}.lattice.black` (per tenant) |

The self-hosted binary is the core product — a single Go binary with an embedded SQLite database, embedded web UI, and zero external dependencies. The hosted control plane is a separate binary that provisions and manages self-hosted Lattice instances as K8s tenants, handles Stripe billing, and serves the signup page.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        lattice.black (domain)                       │
│                                                                     │
│  ┌──────────────┐    ┌───────────────────┐    ┌──────────────────┐ │
│  │ Marketing    │    │ Hosted Control     │    │ Tenant Instances │ │
│  │ Site         │    │ Plane (hosted)     │    │ (lattice binary) │ │
│  │              │    │                    │    │                   │ │
│  │ • Hero       │    │ • Signup page      │    │ • {slug}.lattice  │ │
│  │ • Features   │    │ • Stripe checkout  │    │   .black          │ │
│  │ • Pricing    │    │ • Tenant DB        │    │ • Status page     │ │
│  │ • Docs links │    │ • K8s provisioning │    │ • Dashboard       │ │
│  │              │    │ • Admin API        │    │ • Monitors        │ │
│  │ (lattice     │    │ (hosted.lattice    │    │ • Incidents       │ │
│  │  binary,     │    │  .black)           │    │ • Notifications   │ │
│  │  embedded    │    │                    │    │                   │ │
│  │  site)       │    │ Provisioner →      │    │ (lattice binary,  │ │
│  │              │    │   kubectl apply     │    │  one pod per      │ │
│  │              │    │   per tenant       │    │  tenant)          │ │
│  └──────────────┘    └───────────────────┘    └──────────────────┘ │
│         ↑                       ↑                        ↑          │
│    Traefik ingress         Traefik ingress        Traefik ingress  │
│    apps namespace          hosted-lattice          {slug} tenant   │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

## Components

### 1. Self-Hosted Lattice Binary (`cmd/lattice/main.go`)

**Image:** `ghcr.io/lattice-black/lattice:latest`
**Port:** 8080

The core product. A single Go binary that serves everything:

- **Embedded marketing site** (React/Tailwind) — served at `/`, built from `web/site/`
- **Embedded admin dashboard** (React/Tailwind) — served at `/dashboard/*`, built from `web/app/`
- **Public status page** — served at `/status`, same React app
- **REST API** — served at `/api/*`
- **SQLite database** — stored at `/data/lattice.db` (or configured path)

#### Core Packages

| Package | Responsibility |
|---------|---------------|
| `internal/reducer` | Pure state transitions: `(State, Action) → (State, []SideEffect)`. No I/O. All types defined here. |
| `internal/store` | SQLite persistence layer. Schema migrations, CRUD for monitors/incidents/notifications/maintenance/settings/checks. |
| `internal/config` | YAML config loader with env var overlay. Defines monitors and notification channels as code. |
| `internal/monitor` | Health checkers for HTTP, HTTPS, TCP, DNS, ICMP. Returns `Check` results. |
| `internal/scheduler` | Runs checkers on intervals, feeds results through the reducer, dispatches side effects (persist, notify, prune). |
| `internal/api` | Chi router with REST endpoints. Public routes (health, status) and authenticated routes (everything else). |
| `internal/notify` | Notification dispatchers: Slack, Discord, Email, Webhook, Ntfy. |
| `internal/web` | `embed.FS` wrappers for the compiled frontend assets. |

#### Data Flow: Monitor Check

```
Scheduler timer fires
  → Checker.HealthCheck(monitor)        // network call, returns Check
  → reducer.Reduce(state, RecordCheck)  // pure function, returns new state + effects
  → scheduler dispatches effects:
      → PersistState(action)             // write to SQLite
      → PruneOldChecks(monitorID)        // delete old check history
      → SendNotification(...)            // if threshold met or recovery
  → State updated in memory
```

#### Data Flow: User Creates Monitor

```
POST /api/monitors (with X-API-Key)
  → api.handleCreateMonitor
  → reducer.Reduce(state, CreateMonitor)  // validate, assign ID
  → store.SaveMonitor(monitor)           // persist
  → scheduler.AddMonitor(monitor)        // start ticking
  → 201 Created with monitor JSON
```

#### Authentication

The self-hosted binary uses a single API key for all admin operations:
- Set via `LATTICE_API_KEY` env var or `server.apiKey` in `lattice.yaml`
- Sent as `X-API-Key` header or `Authorization: Bearer <key>`
- Stored in browser `localStorage` by the dashboard SPA
- If empty, all admin routes return 401 (locked down)

Public routes (no auth): `GET /api/health`, `GET /api/status`, `GET /api/status/history/{id}`

### 2. Hosted Control Plane (`cmd/hosted/main.go`)

**Image:** `localhost:30500/lattice-hosted:latest` (local registry)
**Port:** 8090

A separate Go binary that manages the hosted SaaS offering:

- **Signup page** — static HTML at `/`, served from `web/hosted/`
- **Public API** — signup, slug check, login/retrieve access
- **Stripe webhooks** — checkout completed, subscription lifecycle
- **Admin API** — tenant CRUD, suspend/activate (requires admin API key)
- **SQLite tenant DB** — stored at `/data/hosted.db`

#### Hosted Packages

| Package | Responsibility |
|---------|---------------|
| `internal/hosted/server` | Chi router, HTTP handlers for all endpoints |
| `internal/hosted/store` | SQLite persistence for tenants. Partial unique index on slug. Auto-migration. |
| `internal/hosted/provisioner` | Renders K8s manifests and applies them via `kubectl`. Per-tenant deployment + service + ingress + PVC. |
| `internal/hosted/stripe` | Stripe API client (direct HTTP, no SDK). Checkout sessions, webhook verification, subscription lifecycle. |
| `internal/hosted/types` | Tenant, SignupRequest, SignupResponse structs. |

### 3. Frontend Applications

| App | Source | Built Into | Routes |
|-----|--------|------------|--------|
| Marketing site | `web/site/` | `lattice` binary via `embed.FS` | `/` |
| Admin dashboard | `web/app/` | `lattice` binary via `embed.FS` | `/dashboard/*`, `/status`, `/login` |
| Hosted signup | `web/hosted/` | `hosted` binary via `http.FileServer` | `/` (signup), `/success.html` |

The marketing site and dashboard are **embedded** into the `lattice` binary at build time using `go:embed`. The hosted signup page is served from disk (simpler, no build step needed).

## Database Schemas

### Self-Hosted Lattice (`lattice.db`)

Managed by `internal/store/migrations.go`. Tables:

- **monitors** — id, name, url, type, interval, timeout, expected_status, enabled, group, created_at, updated_at
- **checks** — id, monitor_id, status, latency_ms, status_code, error, checked_at
- **incidents** — id, monitor_id, title, severity, status, auto_created, created_at, updated_at, resolved_at
- **incident_updates** — id, incident_id, status, message, created_at
- **notification_channels** — id, type, name, config (JSON), enabled, created_at, updated_at
- **maintenance_windows** — id, monitor_id, title, description, start_time, end_time, created_at
- **settings** — key/value (site_name, logo_url, accent_color, custom_css, custom_domain)

### Hosted Control Plane (`hosted.db`)

Managed by `internal/hosted/store.go`. Single table:

- **tenants** — id, email, slug, api_key, status, stripe_customer_id, stripe_sub_id, trial_ends_at, created_at, updated_at, suspended_at
  - Partial unique index: `slug` must be unique `WHERE status != 'deleted'`
  - Soft-delete: `status` set to `'deleted'`, row retained
  - `GetTenantByEmail` and `SlugExists` both exclude deleted tenants

## Kubernetes Deployment

### Namespaces

| Namespace | What lives here |
|-----------|----------------|
| `apps` | Marketing site (`lattice` deployment, `lattice.black`) |
| `hosted-lattice` | Prod control plane + tenant instances |
| `staging-lattice` | Staging control plane + test tenants |

### Prod Control Plane (`k8s/hosted-control-plane.yaml`)

```
Namespace: hosted-lattice
Deployment: lattice-hosted (1 replica, image: localhost:30500/lattice-hosted:latest)
Service: lattice-hosted (:80 → :8090)
Ingress: hosted.lattice.black (TLS via cert-manager, traefik)
PVC: hosted-data (500Mi, local-path)
RBAC: ServiceAccount + Role + RoleBinding (namespace-scoped)
Secrets: lattice-hosted-secrets (admin-api-key, stripe-secret-key, stripe-webhook-secret, stripe-price-id)
Image Pull Secret: ghcr-lattice-pull-secret (for tenant pods to pull lattice image)
```

### Staging Control Plane (`k8s/staging-control-plane.yaml`)

Identical structure but:
- Namespace: `staging-lattice`
- Ingress: `cloud.lattice.black`
- Stripe: test mode keys
- Separate secrets: `lattice-staging-secrets`

### Per-Tenant Provisioning (runtime)

When a tenant signs up, the provisioner creates:

```
PVC: lattice-{slug} (100Mi, local-path, labels: app=lattice-{slug})
Deployment: lattice-{slug} (1 replica, image: ghcr.io/lattice-black/lattice:latest)
  - env: LATTICE_API_KEY={generated}, LATTICE_DB_PATH=/data/lattice.db
  - imagePullSecrets: ghcr-lattice-pull-secret
  - readinessProbe: GET /api/health
  - resources: 25m/32Mi → 200m/128Mi
Service: lattice-{slug} (:80 → :8080)
Ingress: {slug}.lattice.black (TLS via cert-manager, traefik)
```

Deprovisioning deletes all resources by label selector: `kubectl delete deployment,service,ingress,pvc,secret -l app=lattice-{slug}`.