import {
  ServiceMetadataSubmission,
  ErrorEvent,
  PrivacyConfig,
  SamplingConfig,
  BatchConfig,
  BeforeSendHook,
  DEFAULT_PRIVACY_CONFIG,
  DEFAULT_SAMPLING_CONFIG,
  DEFAULT_BATCH_CONFIG,
} from '@lattice.black/core';

/**
 * Lattice plugin configuration interface
 *
 * Following industry best practices from Sentry, OpenTelemetry, and Segment:
 * - Privacy-first: PII not captured by default
 * - Configurable sampling to reduce data volume
 * - Event batching for performance
 * - beforeSend hooks for filtering/modifying events
 */
export interface LatticeConfig {
  // Service Identity
  /** Service name (auto-detected if not provided) */
  serviceName?: string;
  /** Environment (development, staging, production) */
  environment?: string;

  // API Connection
  /** Lattice API endpoint URL */
  apiEndpoint?: string;
  /** API key for authentication */
  apiKey?: string;

  // Behavior
  /** Enable/disable the plugin entirely */
  enabled?: boolean;
  /** Auto-submit metadata after analysis */
  autoSubmit?: boolean;
  /** Interval for auto-submit in milliseconds */
  submitInterval?: number;
  /** Enable debug logging */
  debug?: boolean;

  // Discovery Options
  /** Discover Express routes */
  discoverRoutes?: boolean;
  /** Discover package.json dependencies */
  discoverDependencies?: boolean;
  /** Depth for dependency analysis */
  dependencyDepth?: number;
  /** Custom path to package.json */
  packageJsonPath?: string;

  // Privacy Settings (NEW)
  /** Privacy configuration for controlling captured data */
  privacy?: Partial<PrivacyConfig>;

  // Sampling Settings (NEW)
  /** Sampling configuration to control data volume */
  sampling?: Partial<SamplingConfig>;

  // Batching Settings (NEW)
  /** Batching configuration for event submission */
  batching?: Partial<BatchConfig>;

  // Hooks (NEW)
  /** Hook to filter/modify error events before sending */
  beforeSendError?: BeforeSendHook<Partial<ErrorEvent>>;
  /** Hook to filter/modify metric events before sending */
  beforeSendMetric?: BeforeSendHook<RequestMetrics>;

  // Callbacks
  /** Called after metadata is analyzed */
  onAnalyzed?: (metadata: ServiceMetadataSubmission) => void;
  /** Called after successful submission */
  onSubmitted?: (response: SubmissionResponse) => void;
  /** Called when an error occurs */
  onError?: (error: Error) => void;
}

/**
 * Submission response from collector API
 */
export interface SubmissionResponse {
  success: boolean;
  serviceId: string;
  routesProcessed: number;
  dependenciesProcessed: number;
}

/**
 * Request metrics data structure
 */
export interface RequestMetrics {
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  timestamp: Date;
  serviceName: string;
}

/**
 * Resolved configuration with all defaults applied
 */
export interface ResolvedLatticeConfig {
  serviceName: string;
  environment: string;
  apiEndpoint: string;
  apiKey: string;
  enabled: boolean;
  autoSubmit: boolean;
  submitInterval: number;
  debug: boolean;
  discoverRoutes: boolean;
  discoverDependencies: boolean;
  dependencyDepth: number;
  packageJsonPath?: string;
  privacy: PrivacyConfig;
  sampling: SamplingConfig;
  batching: BatchConfig;
  beforeSendError?: BeforeSendHook<Partial<ErrorEvent>>;
  beforeSendMetric?: BeforeSendHook<RequestMetrics>;
  onAnalyzed?: (metadata: ServiceMetadataSubmission) => void;
  onSubmitted?: (response: SubmissionResponse) => void;
  onError?: (error: Error) => void;
}

/**
 * Default configuration values
 *
 * IMPORTANT: Privacy-first defaults
 * - Request body, headers, query params NOT captured by default
 * - All sampling rates default to 1.0 (capture all)
 */
export const DEFAULT_CONFIG: Omit<ResolvedLatticeConfig, 'beforeSendError' | 'beforeSendMetric' | 'onAnalyzed' | 'onSubmitted' | 'onError' | 'packageJsonPath'> = {
  serviceName: '',
  environment: process.env['NODE_ENV'] || 'development',
  apiEndpoint: process.env['LATTICE_API_ENDPOINT'] || 'https://lattice-production.up.railway.app/api/v1',
  apiKey: process.env['LATTICE_API_KEY'] || '',
  enabled: process.env['LATTICE_ENABLED'] !== 'false',
  autoSubmit: process.env['LATTICE_AUTO_SUBMIT'] !== 'false',
  submitInterval: parseInt(process.env['LATTICE_SUBMIT_INTERVAL'] || '300000', 10),
  debug: process.env['LATTICE_DEBUG'] === 'true',
  discoverRoutes: true,
  discoverDependencies: true,
  dependencyDepth: 1,
  privacy: DEFAULT_PRIVACY_CONFIG,
  sampling: DEFAULT_SAMPLING_CONFIG,
  batching: DEFAULT_BATCH_CONFIG,
};

/**
 * Resolve partial config with defaults
 */
export function resolveConfig(config: LatticeConfig = {}): ResolvedLatticeConfig {
  return {
    ...DEFAULT_CONFIG,
    ...config,
    privacy: {
      ...DEFAULT_PRIVACY_CONFIG,
      ...config.privacy,
    },
    sampling: {
      ...DEFAULT_SAMPLING_CONFIG,
      ...config.sampling,
    },
    batching: {
      ...DEFAULT_BATCH_CONFIG,
      ...config.batching,
    },
  };
}
