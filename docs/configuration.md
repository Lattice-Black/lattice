# Lattice — Configuration Reference

## Self-Hosted Lattice

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `LATTICE_API_KEY` | (empty) | API key for admin routes. If empty, admin routes return 401. |
| `LATTICE_DB_PATH` | `/data/lattice.db` | Path to SQLite database file. |

### YAML Config (`lattice.yaml`)

Lattice looks for config in this order:
1. Explicit `--config` flag
2. `./lattice.yaml` (current directory)
3. `/lattice.yaml` (Docker convention)
4. Built-in defaults with env var overlay

```yaml
server:
  port: 8080
  host: "0.0.0.0"
  apiKey: "your-secret-api-key"
  corsOrigins:
    - "*"

database:
  path: "./lattice.db"
  retentionDays: 90

monitors:
  - name: "Production API"
    url: "https://api.example.com/health"
    type: "https"
    interval: "60s"
    timeout: "10s"
    expectedStatus: 200
    group: "Production"
    enabled: true

  - name: "Database"
    url: "db.example.com:5432"
    type: "tcp"
    interval: "30s"
    timeout: "5s"
    group: "Infrastructure"

notifications:
  - name: "Slack Alerts"
    type: "slack"
    enabled: true
    config:
      webhook_url: "https://hooks.slack.com/services/..."

  - name: "Email Alerts"
    type: "email"
    enabled: true
    config:
      smtp_host: "smtp.gmail.com"
      smtp_port: "587"
      smtp_user: "alerts@example.com"
      smtp_pass: "your-app-password"
      smtp_from: "Lattice Status <alerts@example.com>"
      to: "admin@example.com, ops@example.com"

  - name: "ntfy Alerts"
    type: "ntfy"
    enabled: true
    config:
      url: "https://ntfy.sh/my-topic"
      token: "tk_xxx"
```

### Monitor Types

| Type | URL Format | What it checks |
|------|-----------|----------------|
| `http` | `http://host:port/path` | HTTP status code, response time |
| `https` | `https://host/path` | HTTPS status code, response time, follows redirects |
| `tcp` | `host:port` | TCP connection succeeds |
| `dns` | `domain.com` | DNS resolution succeeds |
| `icmp` | `host-or-ip` | ICMP ping succeeds |

### Notification Types

| Type | Config Keys |
|------|------------|
| `slack` | `webhook_url` |
| `discord` | `webhook_url` |
| `email` | `smtp_host`, `smtp_port`, `smtp_user`, `smtp_pass`, `smtp_from`, `to` (comma-separated) |
| `webhook` | `url`, `secret` (optional HMAC-SHA256 signing key, sent as `X-Lattice-Signature: sha256=<hex>`) |
| `ntfy` | `url`, `token` (optional Bearer auth) |

---

## Hosted Control Plane

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `HOSTED_LISTEN_ADDR` | `:8090` | Listen address |
| `HOSTED_NAMESPACE` | `hosted-lattice` | K8s namespace for tenant deployments |
| `HOSTED_TENANT_IMAGE` | `ghcr.io/lattice-black/lattice:latest` | Docker image for tenant instances |
| `HOSTED_CLUSTER_ISSUER` | `letsencrypt-dns01` | cert-manager ClusterIssuer for TLS |
| `HOSTED_ADMIN_API_KEY` | (empty) | API key for admin routes. WARNING printed if empty. |
| `HOSTED_DB_PATH` | `/data/hosted.db` | Path to tenant SQLite database |
| `HOSTED_FRONTEND_DIR` | (empty) | Directory containing signup HTML. If empty, frontend not served. |
| `STRIPE_SECRET_KEY` | (empty) | Stripe API secret key (live or test) |
| `STRIPE_WEBHOOK_SECRET` | (empty) | Stripe webhook signing secret |
| `STRIPE_PRICE_ID` | (empty) | Stripe Price ID for the subscription plan |
| `STRIPE_SUCCESS_URL` | `https://hosted.lattice.black/success.html` | Post-checkout redirect URL |
| `STRIPE_CANCEL_URL` | `https://lattice.black/#pricing` | Checkout cancel redirect URL |

If `STRIPE_SECRET_KEY` is empty, the control plane operates in manual billing mode — tenants get a 14-day trial with no payment required, and the API key is returned directly in the signup response.

### K8s Secrets

Both prod and staging need a secret with these keys:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: lattice-hosted-secrets  # or lattice-staging-secrets
type: Opaque
stringData:
  admin-api-key: "<generated key>"
  stripe-secret-key: "sk_live_..."  # or sk_test_... for staging
  stripe-webhook-secret: "whsec_..."
  stripe-price-id: "price_..."
```

### Image Pull Secret

Tenant pods pull from `ghcr.io/lattice-black/lattice:latest`. If the package is private, a pull secret must exist in the tenant namespace:

```bash
kubectl create secret docker-registry ghcr-lattice-pull-secret \
  -n hosted-lattice \
  --docker-server=ghcr.io \
  --docker-username=<github-username> \
  --docker-password=<github-token>
```

The provisioner template references `ghcr-lattice-pull-secret` by name. When the ghcr.io package is made public, this secret is not needed.

### Storage Class

Tenant PVCs use `storageClassName: local-path`. The control plane's own PVC also uses `local-path`. This avoids Longhorn attachment issues on single-node clusters.

---

## Build & Deploy

### Building

```bash
# Self-hosted binary (includes embedded frontends)
make build      # or: CGO_ENABLED=1 go build -o lattice ./cmd/lattice

# Hosted control plane binary
CGO_ENABLED=1 go build -o hosted ./cmd/hosted

# Docker images
docker build -t lattice .                           # self-hosted
docker build -f Dockerfile.hosted -t lattice-hosted . # hosted control plane
```

### Testing

```bash
make test    # runs all Go tests (63 tests across 7 packages)
```

### CI

| Workflow | Trigger | What it does |
|----------|---------|--------------|
| `build.yml` | push, PR | Runs Go tests, builds binary, uploads artifact |
| `release.yml` | tag `v*` | Builds + pushes Docker image to `ghcr.io/lattice-black/lattice:latest` |

### Local Registry

The cluster uses a local registry at `localhost:30500`. To push images:

```bash
docker build -t localhost:30500/lattice-hosted:latest -f Dockerfile.hosted .
docker push localhost:30500/lattice-hosted:latest
kubectl rollout restart deployment/lattice-hosted -n hosted-lattice
```

### Deploying Manifests

```bash
# Prod control plane
kubectl apply -f k8s/hosted-control-plane.yaml

# Staging control plane
kubectl apply -f k8s/staging-control-plane.yaml
```