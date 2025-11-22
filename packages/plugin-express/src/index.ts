import { Application } from 'express';
import {
  Service,
  ServiceMetadataSubmission,
  ServiceStatus,
  generateId,
  SDKState,
} from '@lattice.black/core';
import {
  LatticeConfig,
  ResolvedLatticeConfig,
  resolveConfig,
  SubmissionResponse,
} from './config/types';
import { RouteAnalyzer } from './discovery/route-analyzer';
import { DependencyAnalyzer } from './discovery/dependency-analyzer';
import { ServiceNameDetector } from './discovery/service-name-detector';
import { ApiClient } from './client/api-client';
import { NoOpClient, type LatticeApiClient } from './client/noop-client';
import { MetricsTracker } from './middleware/metrics-tracker';
import { HttpInterceptor } from './client/http-interceptor';
import { ErrorCapture, createErrorCapture } from './middleware/error-capture';
import { safeAsync } from './utils/safe-wrapper';

/**
 * Lattice Plugin for Express.js
 *
 * Discovers routes, dependencies, and submits metadata to Lattice collector.
 *
 * Features:
 * - Privacy-first data capture (no PII by default)
 * - Configurable sampling to reduce data volume
 * - Event batching for performance
 * - beforeSend hooks for filtering/modifying events
 * - Graceful shutdown with forceFlush
 * - No-op fallback on initialization failure
 *
 * Following patterns from OpenTelemetry, Sentry, and Segment.
 */
export class LatticePlugin {
  private config: ResolvedLatticeConfig;
  private routeAnalyzer: RouteAnalyzer;
  private dependencyAnalyzer: DependencyAnalyzer;
  private serviceNameDetector: ServiceNameDetector;
  private apiClient: LatticeApiClient;
  private metadata: ServiceMetadataSubmission | null = null;
  private submitTimer: NodeJS.Timeout | null = null;
  private metricsTracker: MetricsTracker | null = null;
  private httpInterceptor: HttpInterceptor | null = null;
  private errorCapture: ErrorCapture | null = null;
  private state: SDKState = SDKState.Uninitialized;
  private initError: Error | null = null;

  constructor(config: LatticeConfig = {}) {
    try {
      this.state = SDKState.Initializing;

      // Resolve config with defaults
      this.config = resolveConfig(config);

      // Initialize analyzers
      this.routeAnalyzer = new RouteAnalyzer();
      this.dependencyAnalyzer = new DependencyAnalyzer();
      this.serviceNameDetector = new ServiceNameDetector();

      // Initialize API client (or no-op if disabled)
      if (this.config.enabled) {
        this.apiClient = new ApiClient(this.config.apiEndpoint, this.config.apiKey);
      } else {
        this.apiClient = new NoOpClient();
      }

      this.state = SDKState.Ready;
      this.log('debug', 'Plugin initialized successfully');
    } catch (error) {
      // Fail gracefully - use no-op client
      this.state = SDKState.Failed;
      this.initError = error as Error;
      this.apiClient = new NoOpClient();
      this.routeAnalyzer = new RouteAnalyzer();
      this.dependencyAnalyzer = new DependencyAnalyzer();
      this.serviceNameDetector = new ServiceNameDetector();
      this.config = resolveConfig({});

      this.log('error', `Initialization failed: ${(error as Error).message}`);
    }
  }

  /**
   * Analyze Express application and discover metadata
   */
  async analyze(app: Application): Promise<ServiceMetadataSubmission> {
    if (!this.config.enabled || this.state === SDKState.Failed) {
      this.log('debug', 'Plugin is disabled or failed, returning empty metadata');
      return this.getEmptyMetadata();
    }

    const result = await safeAsync(
      async () => {
        // Detect service name
        const serviceName = this.serviceNameDetector.detectServiceName(this.config.serviceName);

        // Store detected service name in config for use by other components
        this.config.serviceName = serviceName;

        // Get package.json for version
        const pkgJson = this.getPackageJson();

        // Create service entity
        const serviceId = generateId();
        const service: Service = {
          id: serviceId,
          name: serviceName,
          version: pkgJson?.version,
          environment: this.config.environment as 'development' | 'staging' | 'production',
          language: 'typescript',
          framework: 'express',
          runtime: `node-${process.version}`,
          status: ServiceStatus.Active,
          firstSeen: new Date(),
          lastSeen: new Date(),
          discoveredBy: {
            pluginName: '@lattice/plugin-express',
            pluginVersion: '0.2.0',
            schemaVersion: '1.0.0',
          },
        };

        // Discover routes
        const routes = this.config.discoverRoutes
          ? this.routeAnalyzer.analyzeRoutes(app, serviceId)
          : [];

        // Discover dependencies
        const dependencies = this.config.discoverDependencies
          ? this.dependencyAnalyzer.analyzeDependencies(serviceId, this.config.packageJsonPath)
          : [];

        // Create metadata submission
        this.metadata = {
          service,
          routes,
          dependencies,
        };

        // Call onAnalyzed callback
        if (this.config.onAnalyzed) {
          this.config.onAnalyzed(this.metadata);
        }

        this.log(
          'info',
          `Discovered service "${serviceName}" with ${routes.length} routes and ${dependencies.length} dependencies`
        );

        // Auto-submit if enabled
        if (this.config.autoSubmit) {
          await this.submit();
        }

        // Start auto-submit interval
        this.start();

        return this.metadata;
      },
      this.getEmptyMetadata(),
      'LatticePlugin.analyze'
    );

    return result;
  }

  /**
   * Submit metadata to Lattice collector API
   */
  async submit(metadata?: ServiceMetadataSubmission): Promise<SubmissionResponse | null> {
    if (!this.config.enabled) {
      return null;
    }

    const dataToSubmit = metadata || this.metadata;

    if (!dataToSubmit) {
      this.log('warn', 'No metadata to submit. Call analyze() first.');
      return null;
    }

    const result = await safeAsync(
      async () => {
        const response = await this.apiClient.submitMetadata(dataToSubmit);

        // Call onSubmitted callback
        if (this.config.onSubmitted) {
          this.config.onSubmitted(response);
        }

        this.log('debug', `Metadata submitted: ${response.serviceId}`);

        return response;
      },
      null,
      'LatticePlugin.submit'
    );

    return result;
  }

  /**
   * Get current metadata
   */
  getMetadata(): ServiceMetadataSubmission | null {
    return this.metadata;
  }

  /**
   * Get service name
   */
  getServiceName(): string {
    return this.metadata?.service.name || this.config.serviceName || 'unknown';
  }

  /**
   * Check if plugin is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Get SDK state
   */
  getState(): SDKState {
    return this.state;
  }

  /**
   * Get initialization error if any
   */
  getInitError(): Error | null {
    return this.initError;
  }

  /**
   * Start auto-submit interval
   */
  start(): void {
    if (!this.config.enabled || !this.config.autoSubmit || this.submitTimer) {
      return;
    }

    this.submitTimer = setInterval(() => {
      if (this.metadata) {
        // Update lastSeen timestamp
        this.metadata.service.lastSeen = new Date();
        this.submit().catch(() => {
          // Error already logged by safeAsync
        });
      }
    }, this.config.submitInterval);

    // Ensure timer doesn't prevent process from exiting
    this.submitTimer.unref();
  }

  /**
   * Stop auto-submit interval
   */
  stop(): void {
    if (this.submitTimer) {
      clearInterval(this.submitTimer);
      this.submitTimer = null;
    }
  }

  /**
   * Force flush all pending events
   * Call this before shutdown to ensure all data is sent
   */
  async forceFlush(timeoutMs?: number): Promise<void> {
    this.log('debug', 'Force flushing all pending events');

    const promises: Promise<void>[] = [];

    if (this.errorCapture) {
      promises.push(this.errorCapture.forceFlush());
    }

    if (this.metricsTracker) {
      promises.push(this.metricsTracker.forceFlush());
    }

    // Wait for all flushes with timeout
    if (timeoutMs) {
      await Promise.race([
        Promise.allSettled(promises),
        new Promise((resolve) => setTimeout(resolve, timeoutMs)),
      ]);
    } else {
      await Promise.allSettled(promises);
    }
  }

  /**
   * Graceful shutdown
   * Stops accepting new events, flushes pending data, and cleans up resources
   */
  async shutdown(timeoutMs: number = 10000): Promise<void> {
    if (this.state === SDKState.ShuttingDown || this.state === SDKState.Shutdown) {
      return;
    }

    this.state = SDKState.ShuttingDown;
    this.log('debug', 'Shutting down...');

    // Stop accepting new events
    this.stop();

    // Flush pending data
    await this.forceFlush(timeoutMs);

    // Clean up resources
    if (this.errorCapture) {
      this.errorCapture.shutdown();
    }

    if (this.metricsTracker) {
      this.metricsTracker.shutdown();
    }

    this.state = SDKState.Shutdown;
    this.log('debug', 'Shutdown complete');
  }

  /**
   * Create metrics tracking middleware
   * Can be called before or after analyze() - uses configured service name
   */
  createMetricsMiddleware() {
    if (!this.metricsTracker) {
      // Use configured service name, or detected name if available
      const serviceName = this.serviceNameDetector.detectServiceName(this.config.serviceName);
      this.metricsTracker = new MetricsTracker(
        serviceName,
        this.config.apiEndpoint,
        this.config.apiKey,
        {
          enabled: this.config.enabled,
          debug: this.config.debug,
          sampling: this.config.sampling,
          batching: this.config.batching,
        }
      );
    }
    return this.metricsTracker.middleware();
  }

  /**
   * Get HTTP interceptor for outgoing requests
   * Automatically injects X-Origin-Service header for distributed tracing
   *
   * Usage:
   * ```typescript
   * const http = lattice.getHttpClient();
   *
   * // Use wrapped fetch
   * const response = await http.fetch('http://other-service/api/users');
   *
   * // Or get headers for axios/other clients
   * const headers = http.getTracingHeaders();
   * axios.get('http://other-service/api/users', { headers });
   * ```
   */
  getHttpClient(): HttpInterceptor {
    if (!this.httpInterceptor) {
      const serviceName = this.serviceNameDetector.detectServiceName(this.config.serviceName);
      this.httpInterceptor = new HttpInterceptor(serviceName);
    }
    return this.httpInterceptor;
  }

  /**
   * Create error capture middleware
   * MUST be registered AFTER all routes as an error handler
   *
   * Usage:
   * ```typescript
   * app.use(lattice.errorHandler());
   * ```
   */
  errorHandler() {
    if (!this.errorCapture) {
      const serviceName = this.serviceNameDetector.detectServiceName(this.config.serviceName);

      // Create error capture with full config
      this.errorCapture = createErrorCapture({
        ...this.config,
        serviceName,
      });
    }
    return this.errorCapture.middleware();
  }

  /**
   * Manually capture an error
   */
  async captureError(error: Error, context?: Record<string, unknown>): Promise<void> {
    if (!this.errorCapture) {
      // Create error capture on first use
      const serviceName = this.serviceNameDetector.detectServiceName(this.config.serviceName);
      this.errorCapture = createErrorCapture({
        ...this.config,
        serviceName,
      });
    }

    await this.errorCapture.captureError(error, context);
  }

  /**
   * Get the resolved configuration
   */
  getConfig(): Readonly<ResolvedLatticeConfig> {
    return this.config;
  }

  // Private methods

  /**
   * Conditional logging
   */
  private log(level: 'debug' | 'info' | 'warn' | 'error', message: string): void {
    const prefix = '[Lattice]';

    if (level === 'error') {
      console.error(`${prefix} ${message}`);
      if (this.config.onError) {
        this.config.onError(new Error(message));
      }
    } else if (level === 'warn') {
      console.warn(`${prefix} ${message}`);
    } else if (level === 'info') {
      console.log(`${prefix} ✅ ${message}`);
    } else if (this.config.debug) {
      console.log(`${prefix} ${message}`);
    }
  }

  /**
   * Get package.json content
   */
  private getPackageJson(): { version?: string; name?: string } | null {
    try {
      const fs = require('fs');
      const path = require('path');
      const pkgPath = path.join(process.cwd(), 'package.json');

      if (fs.existsSync(pkgPath)) {
        return JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      }
    } catch {
      // Ignore
    }
    return null;
  }

  /**
   * Get empty metadata structure
   */
  private getEmptyMetadata(): ServiceMetadataSubmission {
    return {
      service: {
        id: generateId(),
        name: 'disabled',
        language: 'typescript',
        framework: 'express',
        status: ServiceStatus.Unknown,
        firstSeen: new Date(),
        lastSeen: new Date(),
        discoveredBy: {
          pluginName: '@lattice/plugin-express',
          pluginVersion: '0.2.0',
          schemaVersion: '1.0.0',
        },
      },
      routes: [],
      dependencies: [],
    };
  }
}

// Re-export types and utilities for convenience
export * from './config/types';
export { HttpInterceptor } from './client/http-interceptor';
export { ErrorCapture } from './middleware/error-capture';
export { NoOpClient, type LatticeApiClient } from './client/noop-client';
export { EventQueue, createEventQueue } from './utils/event-queue';
export { Sampler, createSampler } from './utils/sampler';
export { DataScrubber, createDataScrubber } from './utils/data-scrubber';
export {
  safeAsync,
  safeSync,
  createSafeAsyncWrapper,
  createSafeSyncWrapper,
} from './utils/safe-wrapper';

// Convenience alias
export { LatticePlugin as LatticeExpress } from './index';
