/**
 * Error Capture Middleware for Express
 *
 * Captures unhandled errors and sends them to Lattice API with:
 * - Privacy-first data capture (no PII by default)
 * - Configurable sampling to reduce data volume
 * - Event batching for performance
 * - beforeSend hook for filtering/modifying events
 *
 * Following Sentry and OpenTelemetry patterns.
 */

import { Request, Response, NextFunction } from 'express';
import { parse } from 'error-stack-parser-es';
import {
  HTTP_HEADERS,
  PrivacyConfig,
  DEFAULT_PRIVACY_CONFIG,
  BeforeSendHook,
} from '@lattice.black/core';
import type { StackFrame, ErrorEvent } from '@lattice.black/core';
import { EventQueue, createEventQueue } from '../utils/event-queue';
import { Sampler, createSampler } from '../utils/sampler';
import {
  scrubHeaders,
  scrubQueryParams,
  scrubRequestBody,
  createDataScrubber,
} from '../utils/data-scrubber';
import { safeAsync } from '../utils/safe-wrapper';
import type { ResolvedLatticeConfig } from '../config/types';

/**
 * Error capture configuration
 */
export interface ErrorCaptureConfig {
  serviceName: string;
  apiEndpoint: string;
  apiKey: string;
  environment?: string;
  enabled?: boolean;
  debug?: boolean;
  privacy?: Partial<PrivacyConfig>;
  sampling?: {
    errors?: number;
    rules?: Array<{
      match: { path?: string; method?: string; errorType?: string };
      rate: number;
    }>;
  };
  batching?: {
    maxBatchSize?: number;
    flushIntervalMs?: number;
    maxQueueSize?: number;
  };
  beforeSend?: BeforeSendHook<Partial<ErrorEvent>>;
}

/**
 * Resolved error capture configuration with defaults
 */
interface ResolvedErrorCaptureConfig {
  serviceName: string;
  apiEndpoint: string;
  apiKey: string;
  environment: 'development' | 'staging' | 'production';
  enabled: boolean;
  debug: boolean;
  privacy: PrivacyConfig;
}

/**
 * Error Capture class with batching, sampling, and privacy controls
 */
export class ErrorCapture {
  private readonly config: ResolvedErrorCaptureConfig;
  private readonly sampler: Sampler;
  private readonly eventQueue: EventQueue<Partial<ErrorEvent>>;
  private readonly beforeSend?: BeforeSendHook<Partial<ErrorEvent>>;
  private isShutdown = false;

  constructor(config: ErrorCaptureConfig) {
    // Resolve configuration with defaults
    this.config = {
      serviceName: config.serviceName,
      apiEndpoint: config.apiEndpoint.replace(/\/$/, ''),
      apiKey: config.apiKey,
      environment: (config.environment || process.env['NODE_ENV'] || 'development') as
        | 'development'
        | 'staging'
        | 'production',
      enabled: config.enabled !== false,
      debug: config.debug ?? false,
      privacy: {
        ...DEFAULT_PRIVACY_CONFIG,
        ...config.privacy,
      },
    };

    this.beforeSend = config.beforeSend;

    // Create sampler
    this.sampler = createSampler({
      errors: config.sampling?.errors ?? 1.0,
      metrics: 1.0,
      rules: config.sampling?.rules ?? [],
    });

    // Create event queue for batching
    this.eventQueue = createEventQueue<Partial<ErrorEvent>>(
      async (events) => this.sendBatch(events),
      {
        maxBatchSize: config.batching?.maxBatchSize ?? 10,
        flushIntervalMs: config.batching?.flushIntervalMs ?? 5000,
        maxQueueSize: config.batching?.maxQueueSize ?? 1000,
        onError: (error) => this.log('error', `Batch send failed: ${error.message}`),
        enabled: this.config.enabled,
      }
    );
  }

  /**
   * Express error handling middleware
   * MUST be registered AFTER all routes
   */
  middleware() {
    return async (err: Error, req: Request, _res: Response, next: NextFunction) => {
      if (!this.config.enabled || this.isShutdown) {
        return next(err);
      }

      // Check sampling
      const shouldCapture = this.sampler.shouldSample({
        eventType: 'error',
        path: req.path,
        method: req.method,
        errorType: err.name,
      });

      if (!shouldCapture) {
        this.log('debug', `Dropping error (sampled out): ${err.name}`);
        return next(err);
      }

      // Capture error asynchronously - never block the response
      safeAsync(
        () => this.captureError(err, this.buildRequestContext(req)),
        undefined,
        'ErrorCapture.middleware'
      ).catch(() => {
        // Error already logged by safeAsync
      });

      // Always pass the error to the next handler
      next(err);
    };
  }

  /**
   * Manually capture an error
   */
  async captureError(error: Error, context?: Record<string, unknown>): Promise<void> {
    if (!this.config.enabled || this.isShutdown) {
      return;
    }

    try {
      const stackFrames = this.parseStackTrace(error);
      const scrubber = createDataScrubber(this.config.privacy);

      let errorEvent: Partial<ErrorEvent> = {
        service_id: this.config.serviceName,
        environment: this.config.environment,
        error_type: error.name || 'Error',
        message: scrubber.scrubString(error.message || 'Unknown error'),
        stack_trace: stackFrames,
        context: context ? scrubber.scrub(context as Record<string, unknown>) : undefined,
        timestamp: new Date(),
      };

      // Call beforeSend hook if provided
      if (this.beforeSend) {
        const result = await safeAsync(
          () => Promise.resolve(this.beforeSend!(errorEvent)),
          errorEvent,
          'ErrorCapture.beforeSend'
        );

        if (result === null) {
          this.log('debug', `Error dropped by beforeSend hook: ${error.name}`);
          return;
        }

        errorEvent = result;
      }

      // Enqueue for batched submission
      const queued = this.eventQueue.enqueue(errorEvent);
      if (!queued) {
        this.log('warn', 'Error dropped: queue full');
      }
    } catch (err) {
      this.log('error', `Error in captureError: ${(err as Error).message}`);
    }
  }

  /**
   * Force flush all pending errors
   */
  async forceFlush(): Promise<void> {
    await this.eventQueue.forceFlush();
  }

  /**
   * Shutdown error capture
   */
  shutdown(): void {
    this.isShutdown = true;
    this.eventQueue.shutdown();
  }

  /**
   * Get queue state for monitoring
   */
  getState() {
    return this.eventQueue.getState();
  }

  // Private methods

  /**
   * Build request context respecting privacy settings
   */
  private buildRequestContext(req: Request): Record<string, unknown> {
    const context: Record<string, unknown> = {
      method: req.method,
      path: req.path,
      url: req.url,
    };

    // Only add user agent (always considered safe)
    const userAgent = req.get('user-agent');
    if (userAgent) {
      context['user_agent'] = userAgent;
    }

    // Conditionally add headers based on privacy config
    if (this.config.privacy.captureRequestHeaders || this.config.privacy.safeHeaders.length > 0) {
      const headers = scrubHeaders(
        req.headers as Record<string, string | string[] | undefined>,
        this.config.privacy
      );
      if (Object.keys(headers).length > 0) {
        context['headers'] = headers;
      }
    }

    // Conditionally add query params
    if (this.config.privacy.captureQueryParams && req.query) {
      const query = scrubQueryParams(
        req.query as Record<string, unknown>,
        this.config.privacy
      );
      if (query) {
        context['query'] = query;
      }
    }

    // Conditionally add request body
    if (this.config.privacy.captureRequestBody && req.body) {
      const body = scrubRequestBody(req.body, this.config.privacy);
      if (body !== undefined) {
        context['body'] = body;
      }
    }

    // Conditionally add IP address
    if (this.config.privacy.captureIpAddress && req.ip) {
      context['ip'] = req.ip;
    }

    return context;
  }

  /**
   * Parse error stack trace
   */
  private parseStackTrace(error: Error): StackFrame[] {
    try {
      const frames = parse(error);

      return frames.map((frame) => ({
        filename: frame.fileName || 'unknown',
        line_number: frame.lineNumber || 0,
        column_number: frame.columnNumber,
        function_name: frame.functionName || '<anonymous>',
      }));
    } catch {
      return [
        {
          filename: 'unknown',
          line_number: 0,
          function_name: error.name || 'Error',
        },
      ];
    }
  }

  /**
   * Send batch of errors to API
   */
  private async sendBatch(errors: Partial<ErrorEvent>[]): Promise<void> {
    if (errors.length === 0) {
      return;
    }

    try {
      const response = await fetch(`${this.config.apiEndpoint}/errors/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [HTTP_HEADERS.API_KEY]: this.config.apiKey,
        },
        body: JSON.stringify({ errors }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      this.log('debug', `Sent ${errors.length} errors to API`);
    } catch (error) {
      this.log('error', `Failed to send errors: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Conditional logging based on debug mode
   */
  private log(level: 'debug' | 'warn' | 'error', message: string): void {
    const prefix = '[Lattice ErrorCapture]';

    if (level === 'error') {
      console.error(`${prefix} ${message}`);
    } else if (level === 'warn') {
      console.warn(`${prefix} ${message}`);
    } else if (this.config.debug) {
      console.log(`${prefix} ${message}`);
    }
  }
}

/**
 * Create error capture from full Lattice config
 */
export function createErrorCapture(config: ResolvedLatticeConfig): ErrorCapture {
  return new ErrorCapture({
    serviceName: config.serviceName,
    apiEndpoint: config.apiEndpoint,
    apiKey: config.apiKey,
    environment: config.environment,
    enabled: config.enabled,
    debug: config.debug,
    privacy: config.privacy,
    sampling: config.sampling,
    batching: config.batching,
    beforeSend: config.beforeSendError,
  });
}
