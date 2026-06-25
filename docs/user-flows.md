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
  → Sees signup form: email + subdomain
  → Enters email (e.g. boss@acme.com)
  → Enters desired subdomain (e.g. "acme")
  → Slug availability checked in real-time (debounced 400ms)
  → Clicks "Create Account"
  → POST /api/hosted/signup
    → Tenant created in DB (status: trial, 14-day expiry)
    → K8s resources provisioned (deployment, service, ingress, PVC)
    → Stripe checkout session created
  → Response includes checkout_url
  → User redirected to Stripe Checkout
  → Completes payment ($25/year)
  → Stripe webhook → checkout.session.completed
    → Tenant status → active
    → Stripe customer ID + subscription ID saved
  → User redirected to success.html
  → User redirected to acme.lattice.black
```

### Returning User
```
User visits hosted.lattice.black
  → Clicks "Already have an account? Retrieve access"
  → Enters email
  → POST /api/hosted/login
  → If account exists: returns dashboard URL + API key
  → User clicks through to acme.lattice.black/dashboard
  → Enters API key to log in
  → Redirected to /dashboard
```

### Using Their Status Page
```
acme.lattice.black/status    → Public status page (no auth, anyone can view)
acme.lattice.black/dashboard → Admin dashboard (requires API key)
acme.lattice.black/login     → Enter API key to access dashboard
acme.lattice.black/api/*     → REST API (same as self-hosted)

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
  → "Retrieve access" — if account was suspended (not deleted), they get their URL
  → If account was deleted, they can sign up again with same email (deleted accounts excluded from email check)
```

---

## 3. Admin (Operator) Flow

### Managing Tenants
```
Admin accesses hosted.lattice.black/api/hosted/tenants
  → Must provide X-API-Key header (admin API key from secrets)
  → Gets list of all tenants with status, email, slug

Actions:
  GET  /api/hosted/tenants/{id}          → View tenant details
  DELETE /api/hosted/tenants/{id}        → Deprovision + soft-delete
  POST /api/hosted/tenants/{id}/suspend  → Scale to 0, mark suspended
  POST /api/hosted/tenants/{id}/activate → Scale to 1, mark active
```

### Environment Isolation
```
Production:
  Namespace: hosted-lattice
  Ingress: hosted.lattice.black
  Stripe: LIVE keys (real payments)
  Tenants: {slug}.lattice.black

Staging:
  Namespace: staging-lattice
  Ingress: cloud.lattice.black
  Stripe: TEST keys (test cards only, e.g. 4242 4242 4242 4242)
  Tenants: {slug}.lattice.black (same domain, different namespace)

Note: Both environments use {slug}.lattice.black for tenant subdomains.
Traefik routes based on namespace priority. In practice, prod and staging
should not have tenants with the same slug.
```