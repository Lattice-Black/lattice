import { Application } from 'express';
import {
  Service,
  ServiceMetadataSubmission,
  ServiceStatus,
  generateId,
} from '@lattice.black/core';
import { LatticeConfig, DEFAULT_CONFIG, SubmissionResponse } from './config/types';
import { RouteAnalyzer } from './discovery/route-analyzer';
import { DependencyAnalyzer } from './discovery/dependency-analyzer';
import { ServiceNameDetector } from './discovery/service-name-detector';
import { ApiClient } from './client/api-client';
import { MetricsTracker } from './middleware/metrics-tracker';
import { HttpInterceptor } from './client/http-interceptor';
import { ErrorCapture } from './middleware/error-capture';

/**
 * Lattice Plugin for Express.js
 * Discovers routes, dependencies, and submits metadata to Lattice collector
 */
export class LatticePlugin {
  private config: Required<Omit<LatticeConfig, 'onAnalyzed' | 'onSubmitted' | 'onError' | 'packageJsonPath'>> & Pick<LatticeConfig, 'onAnalyzed' | 'onSubmitted' | 'onError' | 'packageJsonPath'>;
  private routeAnalyzer: RouteAnalyzer;
  private dependencyAnalyzer: DependencyAnalyzer;
  private serviceNameDetector: ServiceNameDetector;
  private apiClient: ApiClient;
  private metadata: ServiceMetadataSubmission | null = null;
  private submitTimer: NodeJS.Timeout | null = null;
  private metricsTracker: MetricsTracker | null = null;
  private httpInterceptor: HttpInterceptor | null = null;
  private errorCapture: ErrorCapture | null = null;

  constructor(config: LatticeConfig = {}) {
    // Merge config with defaults
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };

    // Initialize analyzers
    this.routeAnalyzer = new RouteAnalyzer();
    this.dependencyAnalyzer = new DependencyAnalyzer();
    this.serviceNameDetector = new ServiceNameDetector();

    // Initialize API client
    this.apiClient = new ApiClient(this.config.apiEndpoint, this.config.apiKey);
  }

  /**
   * Analyze Express application and discover metadata
   */
  async analyze(app: Application): Promise<ServiceMetadataSubmission> {
    if (!this.config.enabled) {
      console.log('Lattice plugin is disabled');
      return this.getEmptyMetadata();
    }

    try {
      // Detect service name
      const serviceName = this.serviceNameDetector.detectServiceName(this.config.serviceName);

      // Get package.json for version
      const pkgJson = this.getPackageJson();

      // Create service entity
      const serviceId = generateId();
      const service: Service = {
        id: serviceId,
        name: serviceName,
        version: pkgJson?.version,
        environment: this.config.environment,
        language: 'typescript',
        framework: 'express',
        runtime: `node-${process.version}`,
        status: ServiceStatus.Active,
        firstSeen: new Date(),
        lastSeen: new Date(),
        discoveredBy: {
          pluginName: '@lattice/plugin-express',
          pluginVersion: '0.1.0',
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

      console.log(
        `✅ Lattice discovered service "${serviceName}" with ${routes.length} routes and ${dependencies.length} dependencies`
      );

      // Auto-submit if enabled
      if (this.config.autoSubmit) {
        await this.submit();
      }

      // Start auto-submit interval
      this.start();

      return this.metadata;
    } catch (error) {
      this.handleError(error as Error);
      throw error;
    }
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
      throw new Error('No metadata to submit. Call analyze() first.');
    }

    try {
      const response = await this.apiClient.submitMetadata(dataToSubmit);

      // Call onSubmitted callback
      if (this.config.onSubmitted) {
        this.config.onSubmitted(response);
      }

      console.log(`✅ Lattice metadata submitted: ${response.serviceId}`);

      return response;
    } catch (error) {
      this.handleError(error as Error);
      return null;
    }
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
    return this.metadata?.service.name || 'unknown';
  }

  /**
   * Check if plugin is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
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
        this.submit().catch((error) => {
          console.error('Auto-submit failed:', error);
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
        this.config.apiKey
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
      this.errorCapture = new ErrorCapture({
        serviceName,
        apiEndpoint: this.config.apiEndpoint,
        apiKey: this.config.apiKey,
        environment: this.config.environment,
        enabled: this.config.enabled,
      });
    }
    return this.errorCapture.middleware();
  }

  /**
   * Handle errors with callback
   */
  private handleError(error: Error): void {
    if (this.config.onError) {
      this.config.onError(error);
    } else {
      console.error('Lattice error:', error);
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
    } catch (error) {
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
          pluginVersion: '0.1.0',
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

// Convenience alias
export { LatticePlugin as LatticeExpress } from './index';
