# Lattice — User Flows

## 1. Self-Hosted User Flow

### Getting Started
```
User visits lattice.black
  → Reads marketing site
  → Clicks "Self-Host" (nav) or scrolls to "Getting Started"
  → Follows docs: docker run -d -p 8080:8080 -v lattice-data:/data ghcr.io/lattice-black/lattice:latest
  → Opens http://localhost:8080 → sees status page (empty)
  → Goes to /login
  → Enters API key (set via LATTICE_API_KEY env var)
  → Redirected to /dashboard
```

### Configuring Monitors
```
Dashboard → Monitors tab
  → "Add Monitor"
  → Fill in: name, URL, type (HTTP/HTTPS/TCP/DNS/ICMP), interval, timeout
  → Save
  → Monitor appears in list, scheduler starts checking immediately
  → Status page (/status) updates to show the new monitor
```

### Incident Management
```
Option A — Automatic:
  Monitor fails N consecutive checks (threshold: 3)
    → Scheduler calls reducer.RecordCheck
    → Reducer detects threshold, auto-creates incident
    → SendNotification effect dispatched to all enabled channels
    → Status page shows active incident

Option B — Manual:
  Dashboard → Incidents tab
    → "New Incident"
    → Select monitor, set title, severity, initial message
    → Create
    → Add updates over time (investigating → identified → monitoring)
    → Resolve when fixed (adds resolved timestamp)
```

### Maintenance Windows
```
Dashboard → Maintenance tab
  → "Schedule Maintenance"
  → Select monitor, set title, time window
  → During the window: monitor failures are suppressed (no incidents, no notifications)
  → Window expires automatically
```

### Notifications
```
Dashboard → Notifications tab
  → "Add Channel"
  → Choose type: Slack, Discord, Email, Webhook, Ntfy
  → Fill in config (webhook URL, SMTP settings, etc.)
  → Save
  → "Test" button sends a test notification
  → Channel receives alerts when monitors go down or recover
```

---

## 2. Hosted SaaS User Flow

### Signup

```
User visits lattice.black
  → Clicks "Start Free Trial" (hero CTA or nav)
  → Redirected to hosted.lattice.black
  → Sees signup form: email + password + subdomain
  → Enters email (e.g. boss@acme.com)
  → Enters password (min 8 chars, stored as bcrypt hash)
  → Enters desired subdomain (e.g. "acme")
  → Subdomain suffix is dynamically shown (e.g. ".lattice.black" for prod,
    ".staging.lattice.black" for staging — fetched from /api/hosted/config)
  → Slug availability checked in real-time (debounced 400ms)
  → Clicks "Create Account"
  → POST /api/hosted/signup { email, password, slug }
    → Password hashed with bcrypt
    → Tenant created in DB (status: trial, 14-day expiry)
    → K8s resources provisioned (deployment, service, ingress, PVC)
    → Stripe checkout session created (if Stripe configured)
  → Response includes checkout_url
  → User redirected to Stripe Checkout
  → Completes payment ($25/year)
  → Stripe webhook → checkout.session.completed
    → Tenant status → active
    → Stripe customer ID + subscription ID saved
  → User redirected to success.html
  → User redirected to acme.lattice.black/login?key={api_key}
  → Dashboard auto-detects ?key= param, verifies it, stores in localStorage
  → User lands on acme.lattice.black/dashboard (auto-logged in)
```

### Returning User (Sign In)

```
User visits hosted.lattice.black
  → Clicks "Sign in" (if already has an account)
  → Enters email + password
  → POST /api/hosted/login { email, password }
    → Server looks up tenant by email
    → Verifies password with bcrypt.CompareHashAndPassword
    → Returns: { exists: true, dashboard_url, api_key, status }
  → Frontend displays dashboard URL + API key
  → Auto-redirect to {slug}.lattice.black/login?key={api_key}
  → Dashboard auto-logs in with the API key
  → User lands on their dashboard

Security:
  - Password verified server-side with bcrypt
  - If email not found: returns { exists: false } (no email enumeration)
  - If password wrong: returns 400 "invalid email or password"
  - API key is only returned after successful authentication
```

### Using Their Status Page

```
{slug}.lattice.black/status     → Public status page (no auth, anyone can view)
{slug}.lattice.black/dashboard  → Admin dashboard (requires API key)
{slug}.lattice.black/login      → Enter API key manually, or auto-login via ?key= param
{slug}.lattice.black/api/*      → REST API (same as self-hosted)

All data is isolated per tenant:
  - Separate SQLite database (/data/lattice.db in the tenant's PVC)
  - Separate API key (generated at signup)
  - Separate K8s deployment (1 pod, 100Mi PVC)
  - Separate TLS cert (via cert-manager)
```

### Subscription Lifecycle

```
Payment succeeds → tenant active, pod running
Payment fails    → Stripe webhook → tenant suspended, pod scaled to 0
                  → Status page goes offline (no pods to serve traffic)
Subscription cancelled → tenant suspended, pod scaled to 0
Admin deletes tenant → K8s resources removed, subscription cancelled, DB row soft-deleted

If tenant wants to come back:
  → Visit hosted.lattice.black
  → "Sign in" — if account was suspended (not deleted), they can log in
  → If account was deleted, they can sign up again with same email
    (deleted accounts are excluded from email uniqueness check)
```

---

## 3. Admin (Operator) Flow

### Bootstrap (First-Time Setup)
```
On startup, if HOSTED_BOOTSTRAP_ADMIN_EMAIL and HOSTED_BOOTSTRAP_ADMIN_PASSWORD
are set and no admin users exist:
  → Create a super_admin with those credentials
  → Log message: "Bootstrapped super admin: {email}"

If bootstrap env vars are not set:
  → Admin routes require API key (HOSTED_ADMIN_API_KEY) for automation/CI
  → Admin users must be created via the admin UI (if at least one admin exists)
  → Or directly in the SQLite DB
```

### Admin Login (Session-Based)
```
Admin visits hosted.lattice.black/admin
  → Redirected to /admin/login
  → Enters email + password
  → POST /api/hosted/admin/login
    → Server verifies bcrypt password hash
    → Creates admin_session in DB (token, admin_id, expires_at, ip)
    → Sets httpOnly, SameSite=Strict cookie (lattice_admin_session)
    → Returns admin user profile
  → Frontend stores admin in React state
  → Redirected to /admin (tenant list)

Session details:
  - Cookie: lattice_admin_session (httpOnly, SameSite=Strict, Secure in prod)
  - Duration: 24 hours with sliding renewal (extended on each request)
  - Revocable: logout deletes session from DB; admin deletion cascades sessions
  - CSRF protection: SameSite=Strict + X-Requested-With header on mutations
```

### Managing Tenants (Admin UI)
```
Admin navigates to /admin (Tenants page)
  → Search/filter by email, slug, or ID
  → Filter by status (trial, active, suspended, all)
  → Click tenant slug → Tenant Detail page

Actions available:
  Search          GET    /api/hosted/tenants             → List (with filter)
  View            GET    /api/hosted/tenants/{id}         → Details
  Edit            PUT    /api/hosted/tenants/{id}         → Update email/slug/status
  Suspend         POST   /api/hosted/tenants/{id}/suspend  → Scale to 0, mark suspended
  Activate        POST   /api/hosted/tenants/{id}/activate → Scale to 1, mark active
  Delete          DELETE /api/hosted/tenants/{id}         → Deprovision + soft-delete
  Reset API Key   POST   /api/hosted/tenants/{id}/reset-key → New key, re-provision
  Reset Password  POST   /api/hosted/tenants/{id}/reset-password → Temp password
  Extend Trial    POST   /api/hosted/tenants/{id}/extend-trial → Add days

All actions are logged to the audit log.
```

### Managing Admin Users (Super Admin Only)
```
Super admin navigates to /admin/users
  → List all admin users with role, created date, last login
  → Create new admin (email, password, role: admin/super_admin)
  → Delete admin (prevents self-deletion and last super_admin deletion)

API:
  GET    /api/hosted/admin/users         → List admins
  POST   /api/hosted/admin/users         → Create admin
  DELETE /api/hosted/admin/users/{id}    → Remove admin
```

### Audit Log
```
Any admin navigates to /admin/audit
  → View recent admin actions (time, admin, action, target, details)
  → Paginated (100 entries default)

API:
  GET    /api/hosted/admin/audit         → List audit logs
```

### Automation / CI Access (API Key)
```
For scripts and CI pipelines, the admin API also accepts the
HOSTED_ADMIN_API_KEY via X-API-Key or Authorization: Bearer header.
API key auth is treated as super_admin (full access).
No session cookie is set for API key auth.

Example:
  curl -H "X-API-Key: $ADMIN_KEY" https://hosted.lattice.black/api/hosted/tenants
```

---

## 4. Environment Isolation (Staging vs Production)

```
Production:
  Namespace:            hosted-lattice
  Control plane URL:    hosted.lattice.black
  Base domain:          lattice.black
  Tenant URL pattern:   {slug}.lattice.black
  Stripe:               LIVE keys (real payments)
  DB:                   /data/hosted.db (PVC: hosted-data)
  Secrets:              lattice-hosted-secrets

Staging:
  Namespace:            staging-lattice
  Control plane URL:    cloud.lattice.black
  Base domain:          staging.lattice.black
  Tenant URL pattern:   {slug}.staging.lattice.black
  Stripe:               TEST keys (test cards only, e.g. 4242 4242 4242 4242)
  DB:                   /data/hosted.db (PVC: staging-hosted-data)
  Secrets:              lattice-staging-secrets
```

### How isolation works:

1. **Separate namespaces** — Prod tenants live in `hosted-lattice`, staging tenants in `staging-lattice`. RBAC is namespace-scoped. The prod control plane can only manage resources in `hosted-lattice`, staging only in `staging-lattice`.

2. **Separate base domains** — Prod tenants get `{slug}.lattice.black`, staging tenants get `{slug}.staging.lattice.black`. This is controlled by the `HOSTED_BASE_DOMAIN` env var. The provisioner uses this domain when creating the K8s ingress. No domain collisions are possible.

3. **Separate databases** — Each control plane has its own SQLite DB in its own PVC. A tenant in the staging DB is completely invisible to the prod control plane (and vice versa).

4. **Separate Stripe accounts/modes** — Prod uses live Stripe keys, staging uses test keys. Stripe webhooks point to different URLs (`hosted.lattice.black/api/hosted/stripe/webhook` vs `cloud.lattice.black/api/hosted/stripe/webhook`).

5. **Separate K8s secrets** — `lattice-hosted-secrets` (prod) vs `lattice-staging-secrets` (staging). Each holds its own admin API key, Stripe keys, and webhook secrets.