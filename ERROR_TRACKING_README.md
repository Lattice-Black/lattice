# Lattice Error Tracking & Performance Monitoring

Comprehensive Sentry-like error tracking, performance monitoring, and alerting system for Lattice.

## Overview

This implementation provides enterprise-grade observability features:

- **Error Tracking**: Capture, aggregate, and monitor errors across all services
- **Performance Monitoring**: Track response times, identify bottlenecks, measure p50/p95/p99
- **Breadcrumb Timeline**: User context trail for debugging
- **Health Monitoring**: Service health dashboard with uptime and error rates
- **Alerting**: Configurable alerts for errors, performance, and uptime
- **Tiered Data Retention**: 7 days (trial/free), 90 days (paid), 1 year (enterprise)

## Architecture

### Database Schema
- **error_events**: Partitioned by day using pg_partman, aggregated by fingerprint
- **performance_traces**: Partitioned traces with TimescaleDB time_bucket aggregation
- **breadcrumbs**: User activity trail linked to error sessions
- **service_health**: Materialized view refreshed every 5 minutes
- **alert_rules**: Configurable alert conditions
- **alert_notifications**: Triggered alerts with acknowledgment tracking

### Technology Stack
- **Backend**: TypeScript + Express
- **Frontend**: Next.js 14 + React + Tailwind CSS
- **Database**: PostgreSQL with pg_partman, pg_cron, TimescaleDB
- **Charting**: Chart.js + react-chartjs-2
- **Real-time**: SWR with polling (Vercel serverless compatible)

## Usage

### 1. Express Integration

\`\`\`typescript
import { LatticePlugin } from '@lattice.black/plugin-express';

const lattice = new LatticePlugin({
  serviceName: 'my-api',
  apiEndpoint: 'https://lattice.example.com/api/v1',
  apiKey: process.env.LATTICE_API_KEY,
  environment: 'production',
});

// Error capture
app.use(lattice.errorHandler());

// Performance tracking
app.use(lattice.middleware());
\`\`\`

### 2. Next.js Integration

\`\`\`typescript
// app/layout.tsx
'use client';

import { initLatticeMonitoring } from '@lattice.black/plugin-nextjs';
import { useEffect } from 'react';

export default function RootLayout({ children }) {
  useEffect(() => {
    initLatticeMonitoring({
      apiEndpoint: 'https://lattice.example.com/api/v1',
      apiKey: process.env.NEXT_PUBLIC_LATTICE_API_KEY!,
      serviceName: 'my-nextjs-app',
      environment: 'production',
      captureBreadcrumbs: true,
      captureConsole: true,
      captureNavigation: true,
      captureClicks: true,
    });
  }, []);

  return children;
}
\`\`\`

### 3. Manual Error Capture

\`\`\`typescript
import { captureError, addBreadcrumb } from '@lattice.black/plugin-nextjs';

// Add breadcrumb
addBreadcrumb('http', 'Fetching user profile', 'info', {
  userId: '123',
  endpoint: '/api/user/123',
});

// Capture error
try {
  await fetchUserProfile(userId);
} catch (error) {
  captureError(error, { userId, action: 'fetch_profile' });
}
\`\`\`

### 4. Creating Alert Rules

Via dashboard at `/dashboard/alerts` or API:

\`\`\`typescript
POST /api/v1/alerts/rules
{
  "name": "High Error Rate Alert",
  "service_id": "my-api",
  "environment": "production",
  "metric_type": "error_rate",
  "condition": "gt",
  "threshold": 5.0,
  "window_minutes": 5,
  "notification_channels": ["email"],
  "enabled": true
}
\`\`\`

## Dashboard Pages

- **Errors** (`/dashboard/errors`): Error list with filtering, detail view with stack traces
- **Performance** (`/dashboard/performance`): Response time charts, slowest operations
- **Health** (`/dashboard/health`): Service health overview, uptime metrics
- **Alerts** (`/dashboard/alerts`): Alert rule configuration, notification history

## API Endpoints

### Errors
- `POST /api/v1/errors` - Ingest error event
- `GET /api/v1/errors` - List errors with filters
- `GET /api/v1/errors/:id` - Get error detail with breadcrumbs
- `PATCH /api/v1/errors/:id` - Update error status (resolved/ignored)

### Performance
- `POST /api/v1/performance/traces` - Ingest performance trace
- `GET /api/v1/performance/metrics` - Get aggregated metrics

### Breadcrumbs
- `POST /api/v1/breadcrumbs` - Batch ingest breadcrumbs
- `GET /api/v1/breadcrumbs/session/:session_id` - Get session breadcrumbs

### Health
- `GET /api/v1/health/services` - Get service health metrics
- `GET /api/v1/health/overview` - Get system overview
- `GET /api/v1/health/services/:service_id/timeseries` - Get health time series

### Alerts
- `POST /api/v1/alerts/rules` - Create alert rule
- `GET /api/v1/alerts/rules` - List alert rules
- `PATCH /api/v1/alerts/rules/:id` - Update alert rule
- `DELETE /api/v1/alerts/rules/:id` - Delete alert rule
- `GET /api/v1/alerts/notifications` - List alert notifications
- `POST /api/v1/alerts/notifications/:id/acknowledge` - Acknowledge alert

## Database Maintenance

### Partitioning
Partitions are automatically created 7 days in advance via pg_partman. Maintenance runs hourly via pg_cron.

### Materialized View Refresh
`service_health` view refreshes every 5 minutes via pg_cron.

### Data Retention
Automatic cleanup based on subscription tier:
- Trial/Free: 7 days
- Paid: 90 days
- Enterprise: 1 year

To manually trigger cleanup:
\`\`\`typescript
import { runRetentionCleanup } from './services/retention-service';
await runRetentionCleanup();
\`\`\`

## Performance Optimization

- **Partitioned Tables**: Daily partitions reduce query times on large datasets
- **BRIN Indexes**: 99% storage savings on timestamp columns
- **Materialized Views**: Pre-aggregated health metrics
- **In-Memory Cache**: 30-60s TTL on frequently accessed endpoints
- **Connection Pooling**: PostgreSQL connection pool

## Security

- **Data Sanitization**: Removes passwords, API keys, tokens, JWT, AWS keys
- **API Key Authentication**: Required for all ingest endpoints
- **Environment Isolation**: Separate data by environment (dev/staging/prod)

## Migration

Database migration file: `packages/api/migrations/003_add_error_tracking.sql`

Run migrations:
\`\`\`bash
psql $DATABASE_URL < packages/api/migrations/003_add_error_tracking.sql
\`\`\`

## Development

### Build
\`\`\`bash
yarn build
\`\`\`

### Run API
\`\`\`bash
cd packages/api
yarn dev
\`\`\`

### Run Web Dashboard
\`\`\`bash
cd packages/web
yarn dev
\`\`\`

## Production Checklist

- [ ] Run database migration
- [ ] Set up pg_cron for maintenance
- [ ] Configure retention policy for your tier
- [ ] Set LATTICE_API_KEY environment variable
- [ ] Enable source maps in production (for accurate stack traces)
- [ ] Set up alert notification channels
- [ ] Configure CORS for your domains
- [ ] Set up Redis for caching (replace in-memory cache)
- [ ] Monitor partition creation and cleanup
- [ ] Set up backup for alert_rules and alert_notifications

## Future Enhancements

- Email notifications for alerts (SendGrid/Postmark integration)
- Webhook notifications for alerts
- Slack/Discord integrations
- Source map support for minified JavaScript
- User session replay
- Custom dashboards
- Query performance insights
- Distributed tracing (OpenTelemetry)
- Rate limiting per service
- Multi-tenant support
