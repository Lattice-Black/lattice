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

### Managing Tenants
```
Admin accesses hosted.lattice.black/api/hosted/tenants
  → Must provide X-API-Key header (admin API key from K8s secrets)
  → Gets list of all tenants with status, email, slug

Actions:
  GET    /api/hosted/tenants             → List all tenants
  GET    /api/hosted/tenants/{id}         → View tenant details
  DELETE /api/hosted/tenants/{id}         → Deprovision + soft-delete
  POST   /api/hosted/tenants/{id}/suspend  → Scale to 0, mark suspended
  POST   /api/hosted/tenants/{id}/activate → Scale to 1, mark active
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