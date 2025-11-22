# Changelog

All notable changes to Lattice packages will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2024-XX-XX

### Added

#### Privacy-First Data Capture
- **`privacy` configuration** - Control what data is captured
  - `captureRequestBody` - Opt-in to capture request bodies (default: `false`)
  - `captureRequestHeaders` - Opt-in to capture all headers (default: `false`)
  - `captureQueryParams` - Opt-in to capture query parameters (default: `false`)
  - `captureIpAddress` - Opt-in to capture IP addresses (default: `false`)
  - `safeHeaders` - Whitelist of headers to always capture
  - `additionalPiiFields` - Custom fields to redact
- **Automatic PII scrubbing** with pattern detection for:
  - Credit card numbers
  - Social Security Numbers
  - JWT tokens
  - Bearer tokens
- New sensitive field detection including: `creditCard`, `ssn`, `jwt`, `bearer`, `access_token`, `refresh_token`

#### Sampling Support
- **`sampling` configuration** - Control data volume
  - `errors` - Error sample rate (0.0 to 1.0)
  - `metrics` - Metrics sample rate (0.0 to 1.0)
  - `rules` - Rule-based sampling with path/method/errorType matching
- Wildcard path matching support (`/api/**`)

#### Event Batching
- **`batching` configuration** - Efficient event submission
  - `maxBatchSize` - Events per batch (default: 10)
  - `flushIntervalMs` - Flush interval in ms (default: 5000)
  - `maxQueueSize` - Backpressure limit (default: 1000)
- New `EventQueue` utility class for batched operations

#### Lifecycle Management
- **`forceFlush(timeout?)`** - Force send all pending events
- **`shutdown(timeout?)`** - Graceful shutdown with cleanup
- **`getState()`** - Get SDK state (Ready, ShuttingDown, Shutdown, Failed)
- **`getInitError()`** - Get initialization error if SDK failed to start

#### beforeSend Hooks
- **`beforeSendError`** - Filter/modify error events before sending
- **`beforeSendMetric`** - Filter/modify metric events before sending
- Return `null` to drop events

#### No-Op Fallback
- SDK now gracefully handles initialization failures
- Returns no-op client instead of crashing the application
- Follows OpenTelemetry patterns

#### New Utilities (Exported)
- `EventQueue` - Generic event queue with batching
- `Sampler` - Sampling utility with rule support
- `DataScrubber` - PII detection and scrubbing
- `safeAsync`, `safeSync` - Error-safe function wrappers
- `NoOpClient` - No-op API client implementation

### Changed

- **Default privacy settings are now opt-in** - Request body, headers, and query params are NOT captured by default
- **Events are now batched** - Improves network efficiency
- **Debug logging is now configurable** - Use `debug: true` to enable verbose logging
- Improved error messages and logging

### Fixed

- Timer cleanup on shutdown (prevents memory leaks)
- Console logging spam in development (now controlled by `debug` flag)

### Security

- PII is no longer captured by default (privacy-first)
- Enhanced sensitive data detection patterns
- Automatic scrubbing of credit cards, SSNs, tokens

## [0.1.4] - 2024-XX-XX

### Added
- Initial public release
- Express.js route discovery
- Dependency analysis from package.json
- Metrics tracking middleware
- Error capture middleware
- HTTP interceptor for distributed tracing
- Auto-submit interval

---

## Package Versions

| Package | Version |
|---------|---------|
| @lattice.black/core | 0.2.0 |
| @lattice.black/plugin-express | 0.2.0 |
| @lattice.black/plugin-nextjs | 0.2.2 |
