/**
 * SDK Configuration Types
 * @module @lattice.black/core/types/sdk-config
 *
 * These types define the configuration options for Lattice SDK plugins,
 * following industry best practices from OpenTelemetry, Sentry, and Segment.
 */

import type { ErrorEvent } from './error';

/**
 * Privacy configuration for controlling what data is captured
 * Following Sentry's "sendDefaultPii: false" pattern
 */
export interface PrivacyConfig {
  /** Capture request body content (default: false) */
  captureRequestBody: boolean;
  /** Capture request headers (default: false, only safe headers) */
  captureRequestHeaders: boolean;
  /** Capture URL query parameters (default: false) */
  captureQueryParams: boolean;
  /** Capture client IP address (default: false) */
  captureIpAddress: boolean;
  /** Whitelist of headers to capture when captureRequestHeaders is false */
  safeHeaders: string[];
  /** Additional field names to redact beyond defaults */
  additionalPiiFields: string[];
}

/**
 * Default privacy configuration - privacy-first by default
 */
export const DEFAULT_PRIVACY_CONFIG: PrivacyConfig = {
  captureRequestBody: false,
  captureRequestHeaders: false,
  captureQueryParams: false,
  captureIpAddress: false,
  safeHeaders: [
    'content-type',
    'accept',
    'accept-language',
    'user-agent',
    'x-request-id',
    'x-correlation-id',
  ],
  additionalPiiFields: [],
};

/**
 * Default list of sensitive field names to always redact
 */
export const DEFAULT_SENSITIVE_FIELDS = [
  // Authentication
  'password',
  'passwd',
  'pwd',
  'secret',
  'token',
  'api_key',
  'apiKey',
  'api-key',
  'authorization',
  'auth',
  'bearer',
  'jwt',
  'access_token',
  'accessToken',
  'refresh_token',
  'refreshToken',
  'x-api-key',
  // Session
  'cookie',
  'session',
  'sessionId',
  'session_id',
  // Personal
  'ssn',
  'social_security',
  'socialSecurity',
  'credit_card',
  'creditCard',
  'card_number',
  'cardNumber',
  'cvv',
  'cvc',
  'pin',
  'private_key',
  'privateKey',
  'secret_key',
  'secretKey',
] as const;

/**
 * Regex patterns for detecting sensitive data in values
 */
export const SENSITIVE_PATTERNS = [
  // Credit card numbers (with optional spaces/dashes)
  /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g,
  // SSN (XXX-XX-XXXX)
  /\b\d{3}[- ]?\d{2}[- ]?\d{4}\b/g,
  // Bearer tokens
  /Bearer\s+[A-Za-z0-9\-._~+\/]+=*/gi,
  // JWT tokens (three base64 segments)
  /eyJ[A-Za-z0-9_-]*\.eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*/g,
  // Basic auth
  /Basic\s+[A-Za-z0-9+\/]+=*/gi,
] as const;

/**
 * Sampling rule for conditional sample rates
 */
export interface SamplingRule {
  /** Match conditions */
  match: {
    /** URL path pattern (supports wildcards) */
    path?: string;
    /** HTTP method */
    method?: string;
    /** Error type name */
    errorType?: string;
  };
  /** Sample rate for matching events (0.0 to 1.0) */
  rate: number;
}

/**
 * Sampling configuration
 */
export interface SamplingConfig {
  /** Global error sample rate (0.0 to 1.0, default: 1.0) */
  errors: number;
  /** Global metrics sample rate (0.0 to 1.0, default: 1.0) */
  metrics: number;
  /** Specific sampling rules (evaluated in order, first match wins) */
  rules: SamplingRule[];
}

/**
 * Default sampling configuration - capture everything
 */
export const DEFAULT_SAMPLING_CONFIG: SamplingConfig = {
  errors: 1.0,
  metrics: 1.0,
  rules: [],
};

/**
 * Batching configuration for event submission
 */
export interface BatchConfig {
  /** Maximum events per batch (default: 10) */
  maxBatchSize: number;
  /** Flush interval in milliseconds (default: 5000) */
  flushIntervalMs: number;
  /** Maximum queue size before dropping events (default: 1000) */
  maxQueueSize: number;
}

/**
 * Default batching configuration
 */
export const DEFAULT_BATCH_CONFIG: BatchConfig = {
  maxBatchSize: 10,
  flushIntervalMs: 5000,
  maxQueueSize: 1000,
};

/**
 * Result type for beforeSend hook
 * Return null to drop the event, or modified event to send
 */
export type BeforeSendResult<T> = T | null;

/**
 * beforeSend hook for filtering/modifying events before submission
 * Following Sentry's beforeSend pattern
 */
export type BeforeSendHook<T = ErrorEvent> = (
  event: T
) => BeforeSendResult<T> | Promise<BeforeSendResult<T>>;

/**
 * Generic event type for SDK events
 */
export interface SDKEvent {
  type: 'error' | 'metric' | 'metadata';
  timestamp: Date;
  data: unknown;
}

/**
 * SDK lifecycle state
 */
export enum SDKState {
  /** Not yet initialized */
  Uninitialized = 'uninitialized',
  /** Initializing */
  Initializing = 'initializing',
  /** Ready to capture events */
  Ready = 'ready',
  /** Shutting down */
  ShuttingDown = 'shutting_down',
  /** Shut down, no longer accepting events */
  Shutdown = 'shutdown',
  /** Failed to initialize */
  Failed = 'failed',
}
