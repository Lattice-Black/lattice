# @lattice.black/plugin-express

Express.js plugin for [Lattice](https://github.com/Lattice-Black/lattice) - automatic service discovery, error tracking, and metrics collection for microservices.

## Features

- **Automatic Route Discovery** - Discovers all Express routes and endpoints
- **Dependency Analysis** - Analyzes package.json dependencies
- **Error Tracking** - Captures and reports errors with stack traces
- **Request Metrics** - Tracks response times and status codes
- **Privacy-First** - No PII captured by default (following Sentry patterns)
- **Configurable Sampling** - Reduce data volume with sampling rules
- **Event Batching** - Efficient batched submissions
- **Graceful Shutdown** - Proper cleanup with `forceFlush()` and `shutdown()`

## Installation

```bash
npm install @lattice.black/plugin-express
# or
yarn add @lattice.black/plugin-express
```

## Quick Start

```typescript
import express from 'express';
import { LatticePlugin } from '@lattice.black/plugin-express';

const app = express();

// Initialize Lattice
const lattice = new LatticePlugin({
  serviceName: 'my-api',
  apiKey: process.env.LATTICE_API_KEY,
});

// Add metrics middleware BEFORE routes
app.use(lattice.createMetricsMiddleware());

// Your routes
app.get('/users', (req, res) => res.json({ users: [] }));
app.post('/users', (req, res) => res.json({ id: 1 }));

// Add error handler AFTER routes
app.use(lattice.errorHandler());

// Analyze and start
lattice.analyze(app).then(() => {
  app.listen(3000, () => console.log('Server running'));
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  await lattice.shutdown();
  process.exit(0);
});
```

## Configuration

### Full Configuration Options

```typescript
import { LatticePlugin } from '@lattice.black/plugin-express';

const lattice = new LatticePlugin({
  // Service Identity
  serviceName: 'my-api',              // Auto-detected if not provided
  environment: 'production',          // 'development' | 'staging' | 'production'

  // API Connection
  apiEndpoint: 'https://your-lattice-api.com/api/v1',
  apiKey: process.env.LATTICE_API_KEY,

  // Behavior
  enabled: true,                      // Enable/disable entirely
  autoSubmit: true,                   // Auto-submit metadata after analysis
  submitInterval: 300000,             // Auto-submit interval (5 minutes)
  debug: false,                       // Enable debug logging

  // Discovery
  discoverRoutes: true,               // Discover Express routes
  discoverDependencies: true,         // Analyze package.json
  packageJsonPath: './package.json',  // Custom package.json path

  // Privacy Settings (NEW in 0.2.0)
  privacy: {
    captureRequestBody: false,        // Don't capture request bodies
    captureRequestHeaders: false,     // Only capture safe headers
    captureQueryParams: false,        // Don't capture query params
    captureIpAddress: false,          // Don't capture IP addresses
    safeHeaders: ['content-type', 'accept', 'user-agent'],
    additionalPiiFields: ['customSecret'], // Extra fields to redact
  },

  // Sampling (NEW in 0.2.0)
  sampling: {
    errors: 1.0,                      // Capture 100% of errors
    metrics: 0.1,                     // Capture 10% of metrics
    rules: [
      { match: { path: '/health' }, rate: 0.01 },     // 1% for health checks
      { match: { path: '/api/**' }, rate: 0.5 },     // 50% for API routes
      { match: { errorType: 'ValidationError' }, rate: 0.1 },
    ],
  },

  // Batching (NEW in 0.2.0)
  batching: {
    maxBatchSize: 10,                 // Events per batch
    flushIntervalMs: 5000,            // Flush every 5 seconds
    maxQueueSize: 1000,               // Max queued events (backpressure)
  },

  // Hooks (NEW in 0.2.0)
  beforeSendError: (event) => {
    // Return null to drop the event
    if (event.message?.includes('ignore-this')) return null;
    // Or modify and return
    return event;
  },

  // Callbacks
  onAnalyzed: (metadata) => console.log('Analyzed:', metadata),
  onSubmitted: (response) => console.log('Submitted:', response),
  onError: (error) => console.error('Error:', error),
});
```

### Environment Variables

```bash
LATTICE_API_ENDPOINT=https://your-lattice-api.com/api/v1
LATTICE_API_KEY=your-api-key
LATTICE_SERVICE_NAME=my-api
LATTICE_ENABLED=true
LATTICE_AUTO_SUBMIT=true
LATTICE_SUBMIT_INTERVAL=300000
LATTICE_DEBUG=false
```

## Privacy-First Design

Following [Sentry's](https://docs.sentry.io/platforms/javascript/data-management/sensitive-data/) privacy patterns, **no PII is captured by default**:

```typescript
// Default: Privacy-first (no sensitive data captured)
const lattice = new LatticePlugin({
  serviceName: 'my-api',
});

// Opt-in to capture more data
const lattice = new LatticePlugin({
  serviceName: 'my-api',
  privacy: {
    captureRequestBody: true,    // Opt-in to capture bodies
    captureRequestHeaders: true, // Opt-in to capture all headers
    captureQueryParams: true,    // Opt-in to capture query params
  },
});
```

### Automatic PII Scrubbing

Even when capturing data, sensitive fields are automatically redacted:

- Passwords, secrets, tokens, API keys
- Authorization headers, cookies, sessions
- Credit card numbers, SSNs (pattern matching)
- JWT tokens, Bearer tokens

## Sampling

Reduce data volume with configurable sampling:

```typescript
const lattice = new LatticePlugin({
  sampling: {
    errors: 1.0,    // Capture all errors (important!)
    metrics: 0.1,   // Only 10% of metrics

    // Rule-based sampling (first match wins)
    rules: [
      { match: { path: '/health' }, rate: 0.01 },
      { match: { path: '/api/v1/**' }, rate: 0.2 },
      { match: { errorType: 'ValidationError' }, rate: 0.5 },
    ],
  },
});
```

## Event Batching

Events are batched for efficient network usage:

```typescript
const lattice = new LatticePlugin({
  batching: {
    maxBatchSize: 20,       // Send when 20 events queued
    flushIntervalMs: 10000, // Or every 10 seconds
    maxQueueSize: 2000,     // Drop events if queue exceeds this
  },
});
```

## Lifecycle Management

### Graceful Shutdown

Always call `shutdown()` before process exit:

```typescript
process.on('SIGTERM', async () => {
  await lattice.shutdown();  // Flushes pending events
  process.exit(0);
});
```

### Manual Flush

Force send all pending events:

```typescript
await lattice.forceFlush(5000); // 5 second timeout
```

## beforeSend Hooks

Filter or modify events before sending:

```typescript
const lattice = new LatticePlugin({
  beforeSendError: (event) => {
    // Drop internal errors
    if (event.message?.includes('INTERNAL')) return null;
    // Or modify
    delete event.context?.sensitiveField;
    return event;
  },
});
```

## Manual Error Capture

```typescript
try {
  await riskyOperation();
} catch (error) {
  await lattice.captureError(error, { userId: user.id });
}
```

## Distributed Tracing

```typescript
const http = lattice.getHttpClient();

// Wrapped fetch with tracing headers
const response = await http.fetch('http://other-service/api/users');

// Or get headers for axios
const headers = http.getTracingHeaders();
await axios.get('http://other-service/api', { headers });
```

## API Reference

| Method | Description |
|--------|-------------|
| `analyze(app)` | Discover routes and dependencies |
| `submit(metadata?)` | Submit metadata to API |
| `start()` | Start auto-submit interval |
| `stop()` | Stop auto-submit interval |
| `forceFlush(timeout?)` | Force send all pending events |
| `shutdown(timeout?)` | Graceful shutdown |
| `createMetricsMiddleware()` | Create metrics middleware |
| `errorHandler()` | Create error handler middleware |
| `captureError(error, context?)` | Manually capture an error |
| `getHttpClient()` | Get HTTP client with tracing |
| `getMetadata()` | Get current service metadata |
| `getServiceName()` | Get detected service name |
| `isEnabled()` | Check if plugin is enabled |
| `getState()` | Get SDK state |
| `getConfig()` | Get resolved configuration |

## Migration from 0.1.x

### Breaking Changes

None! The 0.2.0 release is backwards compatible.

### New Defaults (Privacy-First)

- Request body, headers, and query params are **no longer captured by default**
- Events are now **batched** (10 events or 5 seconds)

### Recommended Updates

Add shutdown handling for graceful cleanup:

```typescript
process.on('SIGTERM', () => lattice.shutdown());
```

## License

MIT
