# Lattice — Documentation Index

Lattice is a self-hosted status page and monitoring platform. Single binary, zero dependencies, beautiful by default.

## Documentation

| Document | Description |
|----------|-------------|
| [Architecture](architecture.md) | System overview, component diagram, package responsibilities, data flow, K8s topology |
| [API Spec](api-spec.md) | Full REST API reference for both self-hosted and hosted endpoints |
| [Data Models](data-models.md) | All data structures with field types, enums, and relationships |
| [Reducer Spec](reducer-spec.md) | State management pattern, all actions, side effects, auto-incident logic |
| [User Flows](user-flows.md) | End-to-end flows: signup, login, monitoring, incident management, billing lifecycle |
| [Configuration](configuration.md) | Env vars, YAML config, K8s secrets, build & deploy instructions |

## Quick Start

### Self-Hosted

```bash
docker run -d -p 8080:8080 -v lattice-data:/data \
  -e LATTICE_API_KEY=your-secret-key \
  ghcr.io/lattice-black/lattice:latest
```

Open http://localhost:8080 → status page
Go to http://localhost:8080/login → enter API key → dashboard

### Hosted (SaaS)

1. Visit https://hosted.lattice.black
2. Enter email + choose subdomain
3. Complete Stripe checkout ($25/year)
4. Your status page is live at `{slug}.lattice.black`

## Repository Structure

```
cmd/
  lattice/          # Self-hosted binary entrypoint
  hosted/           # Hosted control plane entrypoint
internal/
  api/              # REST API server (Chi router, middleware, handlers)
  config/           # YAML config loader with env var overlay
  hosted/           # Hosted control plane (server, store, provisioner, stripe, types)
  monitor/          # Health checkers (HTTP, TCP, DNS, ICMP)
  notify/           # Notification dispatchers (Slack, Discord, Email, Webhook, Ntfy)
  reducer/          # Pure state transitions (State, Action, SideEffect)
  scheduler/        # Runs checks, dispatches effects, persists state
  store/            # SQLite persistence layer with migrations
  web/              # embed.FS wrappers for compiled frontend assets
web/
  app/              # Admin dashboard + public status page (React/Tailwind/Vite)
  site/             # Marketing site (React/Tailwind/Vite)
  hosted/           # Signup page (static HTML)
k8s/
  hosted-control-plane.yaml    # Prod control plane manifest
  staging-control-plane.yaml   # Staging control plane manifest
docs/
  index.md          # This file
  architecture.md   # System design
  api-spec.md       # API reference
  data-models.md    # Data structures
  reducer-spec.md   # State management
  user-flows.md     # End-to-end flows
  configuration.md  # Config & deployment
```