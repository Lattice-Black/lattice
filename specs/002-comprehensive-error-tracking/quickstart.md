# Quick Start: Error Tracking and Performance Monitoring

**Feature**: Comprehensive Error Tracking and Performance Monitoring
**Last Updated**: 2025-10-14

---

## Overview

Lattice provides comprehensive error tracking and performance monitoring across your entire application stack—from browser clients to backend services. This guide will get you up and running in under 10 minutes.

**What you'll get:**
- Automatic error capture with full stack traces
- Performance monitoring for slow operations
- User context breadcrumbs for debugging
- Real-time health dashboard
- Configurable alerts for critical issues

---

## Prerequisites

- Lattice API running (see main README)
- Valid API key for your organization
- Service already registered with Lattice

---

## Step 1: Install Dependencies

### For Express.js Applications

```bash
# Already included in @lattice.black/plugin-express
yarn add @lattice.black/plugin-express
```

### For Next.js Applications

```bash
# Already included in @lattice.black/plugin-nextjs
yarn add @lattice.black/plugin-nextjs
```

### Additional Dependencies (for custom integrations)

```bash
# If building custom error capture
yarn add error-stack-parser-es
```

---

## Step 2: Enable Error Tracking

### Express.js Setup

Error tracking is automatically enabled when you use the Lattice Express plugin. Just ensure the error capture middleware is registered:

```typescript
// src/index.ts
import { LatticeExpress } from '@lattice.black/plugin-express';

const lattice = new LatticeExpress({
  serviceName: 'my-api-server',
  apiEndpoint: 'https://api.lattice.black/v1',
  apiKey: process.env.LATTICE_API_KEY,
  environment: process.env.NODE_ENV || 'development',
});

const app = express();

// Apply Lattice middleware (includes error capture)
app.use(lattice.middleware());

// Your routes here
app.get('/api/users', async (req, res) => {
  // Any errors thrown here will be automatically captured
  const users = await fetchUsers();
  res.json(users);
});

// Error handling middleware MUST be last
app.use(lattice.errorHandler());

app.listen(3000);
```

### Next.js Setup (App Router)

Create error boundaries to capture client-side errors:

```typescript
// app/error.tsx
'use client';

import { useEffect } from 'react';
import { captureError } from '@lattice.black/plugin-nextjs';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Capture error to Lattice
    captureError(error, {
      environment: process.env.NODE_ENV,
      context: {
        digest: error.digest,
        page: 'root',
      },
    });
  }, [error]);

  return (
    <div>
      <h2>Something went wrong!</h2>
      <button onClick={() => reset()}>Try again</button>
    </div>
  );
}
```

For global errors:

```typescript
// app/global-error.tsx
'use client';

import { useEffect } from 'react';
import { captureError } from '@lattice.black/plugin-nextjs';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    captureError(error, {
      environment: process.env.NODE_ENV,
      context: { digest: error.digest, page: 'global' },
    });
  }, [error]);

  return (
    <html>
      <body>
        <h2>Something went wrong!</h2>
        <button onClick={() => reset()}>Try again</button>
      </body>
    </html>
  );
}
```

### Browser SDK (for non-Next.js apps)

```typescript
// src/monitoring.ts
import { initLatticeMonitoring } from '@lattice.black/plugin-nextjs/browser';

// Initialize monitoring
initLatticeMonitoring({
  apiEndpoint: 'https://api.lattice.black/v1',
  apiKey: process.env.NEXT_PUBLIC_LATTICE_API_KEY!,
  serviceName: 'web-app',
  environment: process.env.NODE_ENV || 'development',

  // Automatically capture unhandled errors
  captureUnhandledErrors: true,

  // Automatically capture unhandled promise rejections
  captureUnhandledRejections: true,

  // Track user interactions as breadcrumbs
  autoBreadcrumbs: {
    navigation: true,
    clicks: true,
    console: true,
    fetch: true,
  },
});
```

Add to your app entry point:

```typescript
// app/layout.tsx
import './monitoring';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>{children}</body>
    </html>
  );
}
```

---

## Step 3: Add Manual Error Capture (Optional)

For errors you want to explicitly capture:

### Server-side (Express)

```typescript
import { captureError } from '@lattice.black/plugin-express';

try {
  await riskyOperation();
} catch (error) {
  // Capture error with additional context
  captureError(error as Error, {
    context: {
      operation: 'riskyOperation',
      userId: req.user.id,
      requestId: req.id,
    },
  });

  // Still handle the error normally
  res.status(500).json({ error: 'Operation failed' });
}
```

### Client-side (Next.js/Browser)

```typescript
import { captureError } from '@lattice.black/plugin-nextjs';

try {
  await apiCall();
} catch (error) {
  captureError(error as Error, {
    context: {
      api: 'fetchUsers',
      timestamp: Date.now(),
    },
  });

  setError('Failed to load users');
}
```

---

## Step 4: Track User Context with Breadcrumbs

Breadcrumbs help you understand what led to an error. They're automatically tracked for common events, but you can add custom breadcrumbs:

```typescript
import { addBreadcrumb } from '@lattice.black/plugin-nextjs';

// Track a custom user action
addBreadcrumb({
  category: 'user_action',
  message: 'User submitted checkout form',
  level: 'info',
  data: {
    cartTotal: 49.99,
    itemCount: 3,
  },
});

// Track a state change
addBreadcrumb({
  category: 'state_change',
  message: 'User preferences updated',
  level: 'info',
  data: {
    preference: 'theme',
    value: 'dark',
  },
});

// Track an important operation
addBreadcrumb({
  category: 'custom',
  message: 'Report generation started',
  level: 'info',
  data: {
    reportType: 'monthly',
    dateRange: '2025-09-01 to 2025-09-30',
  },
});
```

---

## Step 5: View Errors in Dashboard

Navigate to the Lattice dashboard to see captured errors:

```
https://lattice.black/dashboard/errors
```

**Dashboard features:**
- **Error List**: See all errors sorted by most recent
- **Filtering**: Filter by service, environment, error type
- **Search**: Search error messages and stack traces
- **Error Details**: Click any error to see:
  - Complete stack trace with source line numbers
  - User context and breadcrumbs
  - First seen / last seen timestamps
  - Occurrence count
  - Session information

---

## Step 6: Monitor Performance

Performance monitoring is enabled automatically with the metrics middleware:

### View Performance Metrics

```
https://lattice.black/dashboard/performance
```

**What's tracked:**
- API endpoint response times
- Database query durations
- External API call latencies
- Request volume and throughput

### View Service Health

```
https://lattice.black/dashboard/health
```

**Health indicators:**
- 🟢 **Healthy**: Error rate ≤ 5/min, response time < 5s
- 🟡 **Degraded**: Error rate 5-10/min or response time 5-10s
- 🔴 **Critical**: Error rate > 10/min or response time > 10s

---

## Step 7: Configure Alerts

Set up alerts to be notified when critical issues occur:

### Via Dashboard UI

1. Navigate to `https://lattice.black/dashboard/alerts`
2. Click "Create Alert Rule"
3. Configure:
   - **Name**: "High Error Rate - API Server"
   - **Condition**: Error rate > 10 per minute
   - **Service**: Select your service
   - **Environment**: Production
   - **Evaluation Window**: 10 minutes
   - **Notification Channels**: Email, Slack, etc.

### Via API

```typescript
const response = await fetch('https://api.lattice.black/v1/alerts/rules', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Lattice-Api-Key': process.env.LATTICE_API_KEY!,
  },
  body: JSON.stringify({
    name: 'High Error Rate - API Server',
    description: 'Alert when error rate exceeds 10 per minute',
    service_id: 'my-api-server',
    environment: 'production',
    condition_type: 'error_rate',
    threshold: {
      errors_per_minute: 10,
      comparison: 'greater_than',
    },
    evaluation_window_minutes: 10,
    notification_channels: [
      {
        type: 'email',
        address: 'ops@example.com',
      },
    ],
  }),
});

const rule = await response.json();
console.log('Alert rule created:', rule.id);
```

---

## Common Alert Configurations

### 1. High Error Rate

```json
{
  "condition_type": "error_rate",
  "threshold": {
    "errors_per_minute": 10,
    "comparison": "greater_than"
  }
}
```

### 2. Specific Error Types

```json
{
  "condition_type": "error_type_match",
  "threshold": {
    "error_types": [
      "DatabaseConnectionError",
      "OutOfMemoryError"
    ]
  }
}
```

### 3. Performance Degradation

```json
{
  "condition_type": "performance_threshold",
  "threshold": {
    "avg_response_time_ms": 5000,
    "comparison": "greater_than"
  }
}
```

---

## Data Retention

Lattice retains monitoring data based on your subscription tier:

| Tier | Retention Period |
|------|-----------------|
| **Trial/Free** | 7 days |
| **Paid** | 90 days |
| **Enterprise** | 1 year |

Older data is automatically cleaned up. Export important data before it expires.

---

## Troubleshooting

### Errors not appearing in dashboard

**Check:**
1. ✅ API key is valid and not expired
2. ✅ Service is registered with Lattice
3. ✅ Environment is set correctly
4. ✅ Lattice API endpoint is reachable
5. ✅ Error middleware is properly registered (after routes)

**Debug:**
```typescript
// Enable debug logging
const lattice = new LatticeExpress({
  // ... other config
  debug: true, // Logs all capture attempts
});
```

### Stack traces missing line numbers

**Solution:** Enable source maps in your build:

```json
// tsconfig.json
{
  "compilerOptions": {
    "sourceMap": true,
    "inlineSources": true
  }
}
```

```json
// package.json
{
  "scripts": {
    "start": "node --enable-source-maps dist/index.js"
  }
}
```

### Performance overhead concerns

**Lattice adds < 5ms overhead per request:**
- Error capture: ~1ms (only on errors)
- Performance tracking: ~2ms (async submission)
- Breadcrumb tracking: ~1ms (buffered)

**Optimization tips:**
- Breadcrumbs are limited to 100 per session (oldest discarded)
- Metrics are batched (submitted every 10 requests)
- All API calls are non-blocking (fire-and-forget)

---

## Next Steps

- 📖 Read the [full documentation](../spec.md) for detailed feature information
- 🏗️ Review the [data model](../data-model.md) to understand stored data
- 🔌 Explore [API contracts](../contracts/) for custom integrations
- 🎯 Check out [implementation plan](../plan.md) if contributing

---

## Support

Need help? Check these resources:

- 📚 [API Documentation](https://docs.lattice.black)
- 💬 [Discord Community](https://discord.gg/lattice)
- 🐛 [Report Issues](https://github.com/lattice/issues)
- 📧 Email: support@lattice.black

---

**You're all set!** Errors and performance metrics will now be automatically captured and visible in your Lattice dashboard.
