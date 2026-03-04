# Lattice

**Self-hosted status page & monitoring.** Single binary, zero dependencies, beautiful by default.

> The status page for people who self-host everything else.

## Quick Start

```bash
docker run -d -p 8080:8080 -v lattice-data:/data ghcr.io/lattice-black/lattice:latest
```

Open http://localhost:8080

## Features

- **Single binary** -- no database to install, no Redis, no external dependencies
- **Beautiful status page** -- dark theme, responsive, customizable branding
- **HTTP/HTTPS/TCP/DNS monitoring** -- check your services from inside your network
- **Incident management** -- create, update, resolve with full timeline
- **Notifications** -- Slack, Discord, email, webhooks, ntfy
- **Maintenance windows** -- suppress alerts during planned downtime
- **YAML config** -- define monitors as code, or use the web UI
- **Kubernetes native** -- optional cluster health monitoring (coming soon)

## Architecture

Lattice uses a reducer pattern at its core. Every state mutation flows through pure functions:

```
(State, Action) -> (State, SideEffects)
```

This makes the entire system deterministic and testable. Side effects (notifications, database writes) are dispatched by the runtime, not the reducer.

## Development

```bash
make test    # Run all tests
make build   # Build the binary
make run     # Build and run
```

## License

MIT
