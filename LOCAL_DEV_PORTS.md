# Local Development Port Configuration

All local development ports have been updated to use the 8100+ range to avoid conflicts with common development patterns (3000, 3001, etc.).

## Port Assignments

| Service | Port | URL | Notes |
|---------|------|-----|-------|
| **API Server** | 8100 | http://localhost:8100 | Main Lattice API |
| **Demo Express App** | 8101 | http://localhost:8101 | Example Express service |
| **Order Service** | 8102 | http://localhost:8102 | Example microservice |
| **Demo Next.js App** | 8103 | http://localhost:8103 | Example Next.js app |
| **Web Dashboard** | 8110 | http://localhost:8110 | Lattice web dashboard |

## Starting Services

### API Server
```bash
cd packages/api
yarn dev
# Runs on http://localhost:8100
```

### Web Dashboard
```bash
cd packages/web
yarn dev
# Runs on http://localhost:8110
```

### Demo Express App
```bash
cd examples/demo-express-app
yarn dev
# Runs on http://localhost:8101
```

### Order Service
```bash
cd examples/order-service
yarn dev
# Runs on http://localhost:8102
```

### Demo Next.js App
```bash
cd examples/demo-nextjs-app
yarn dev
# Runs on http://localhost:8103
```

## Important URLs

- **API Health Check**: http://localhost:8100/api/v1/health
- **Web Dashboard**: http://localhost:8110/dashboard
- **Stripe Webhook Listener**: `yarn stripe:listen` (forwards to 8100)

## Environment Variables

All `.env` and `.env.local` files have been updated with the new ports:

### packages/api/.env
```bash
PORT=8100
ALLOWED_ORIGINS="http://localhost:8101,http://localhost:8100,http://localhost:8110"
```

### packages/web/.env.local
```bash
NEXT_PUBLIC_API_URL=http://localhost:8100/api/v1
```

## Service Dependencies

The demo apps are configured to communicate with each other:

- **Demo Express App** (8101) → calls **Order Service** (8102)
- All services → report to **API Server** (8100)
- **Web Dashboard** (8110) → queries **API Server** (8100)

## Troubleshooting

If you encounter port conflicts:

1. Check what's running on a port:
   ```bash
   lsof -i :8100
   ```

2. Kill a process on a port:
   ```bash
   lsof -ti :8100 | xargs kill
   ```

3. Use a different port temporarily:
   ```bash
   PORT=8200 yarn dev
   ```

## Notes

- These ports are only for local development
- Production deployments will use standard ports (80/443) or environment-specific configuration
- The 8100+ range was chosen to minimize conflicts with:
  - Common dev servers (3000-3010)
  - Database servers (5432, 6379, etc.)
  - Other common services
