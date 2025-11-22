/**
 * Lattice Core Constants
 */

/**
 * API endpoints
 */
export const API_ENDPOINTS = {
  INGEST_METADATA: '/ingest/metadata',
  SERVICES: '/services',
  SERVICE_DETAIL: (id: string) => `/services/${id}`,
  GRAPH: '/graph',
  GRAPH_DEPENDENCIES: (id: string) => `/graph/dependencies/${id}`,
  GRAPH_DEPENDENTS: (id: string) => `/graph/dependents/${id}`,
  ROUTES: '/routes',
  DEPENDENCIES: '/dependencies',
  METRICS_STREAM: '/metrics/stream',
  HEALTH: '/health',
  SCHEMA: (version: string) => `/schemas/${version}`,
} as const;

/**
 * Default API configuration
 */
export const API_CONFIG = {
  DEFAULT_ENDPOINT: 'https://lattice-production.up.railway.app/api/v1',
  DEFAULT_TIMEOUT: 5000,
  DEFAULT_RETRY_ATTEMPTS: 3,
} as const;

/**
 * Schema versions
 */
export const SCHEMA_VERSIONS = {
  CURRENT: '1.0.0',
  SUPPORTED: ['1.0.0'],
} as const;

/**
 * HTTP headers
 */
export const HTTP_HEADERS = {
  API_KEY: 'X-Lattice-API-Key',
  TRACE_ID: 'X-Trace-ID',
  ORIGIN_SERVICE: 'X-Origin-Service',
  SCHEMA_VERSION: 'X-Lattice-Schema-Version',
} as const;

/**
 * Service status values
 */
export const SERVICE_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  UNKNOWN: 'unknown',
} as const;

/**
 * Service health status values
 */
export const HEALTH_STATUS = {
  HEALTHY: 'healthy',
  DEGRADED: 'degraded',
  CRITICAL: 'critical',
} as const;

export type HealthStatus = typeof HEALTH_STATUS[keyof typeof HEALTH_STATUS];

/**
 * Default configuration values
 */
export const DEFAULTS = {
  SUBMIT_INTERVAL: 300000, // 5 minutes
  INACTIVE_THRESHOLD: 3600000, // 1 hour
  DEPENDENCY_DEPTH: 1,
  SERVICE_NAME_FALLBACK: 'unknown-service',
} as const;

/**
 * Environment variable names
 */
export const ENV_VARS = {
  LATTICE_API_ENDPOINT: 'LATTICE_API_ENDPOINT',
  LATTICE_API_KEY: 'LATTICE_API_KEY',
  LATTICE_SERVICE_NAME: 'LATTICE_SERVICE_NAME',
  LATTICE_ENABLED: 'LATTICE_ENABLED',
  LATTICE_AUTO_SUBMIT: 'LATTICE_AUTO_SUBMIT',
  LATTICE_SUBMIT_INTERVAL: 'LATTICE_SUBMIT_INTERVAL',
  SERVICE_NAME: 'SERVICE_NAME',
  NODE_ENV: 'NODE_ENV',
} as const;

/**
 * Event batching configuration limits
 */
export const BATCH_LIMITS = {
  /** Minimum batch size */
  MIN_BATCH_SIZE: 1,
  /** Maximum batch size */
  MAX_BATCH_SIZE: 100,
  /** Minimum flush interval (1 second) */
  MIN_FLUSH_INTERVAL: 1000,
  /** Maximum flush interval (30 seconds) */
  MAX_FLUSH_INTERVAL: 30000,
  /** Minimum queue size */
  MIN_QUEUE_SIZE: 10,
  /** Maximum queue size */
  MAX_QUEUE_SIZE: 10000,
} as const;

/**
 * Shutdown configuration
 */
export const SHUTDOWN_CONFIG = {
  /** Default timeout for forceFlush in milliseconds */
  DEFAULT_FLUSH_TIMEOUT: 5000,
  /** Default timeout for shutdown in milliseconds */
  DEFAULT_SHUTDOWN_TIMEOUT: 10000,
} as const;
