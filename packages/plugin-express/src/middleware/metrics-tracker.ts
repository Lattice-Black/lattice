/**
 * Metrics Tracker Middleware for Express
 *
 * Tracks request metrics with:
 * - Configurable sampling to reduce data volume
 * - Event batching for performance
 * - Graceful shutdown support
 *
 * Following patterns from OpenTelemetry and Segment.
 */

import { Request, Response, NextFunction } from 'express';
import { HTTP_HEADERS, SamplingConfig, BatchConfig } from '@lattice.black/core';
import { EventQueue, createEventQueue } from '../utils/event-queue';
import { Sampler, createSampler } from '../utils/sampler';

/**
 * Request metrics data
 */
export interface RequestMetrics {
  method: string;
  path: string;
  statusCode: number;
  responseTime: number;
  timestamp: Date;
  callerServiceName?: string;
  serviceName: string;
}

/**
 * Metrics tracker configuration
 */
export interface MetricsTrackerConfig {
  enabled?: boolean;
  debug?: boolean;
  sampling?: Partial<SamplingConfig>;
  batching?: Partial<BatchConfig>;
}

/**
 * Metrics Tracker with batching and sampling support
 */
export class MetricsTracker {
  private readonly sampler: Sampler;
  private readonly eventQueue: EventQueue<RequestMetrics>;
  private readonly enabled: boolean;
  private readonly debug: boolean;
  private isShutdown = false;

  constructor(
    private serviceName: string,
    private apiEndpoint: string,
    private apiKey: string,
    config: MetricsTrackerConfig = {}
  ) {
    this.enabled = config.enabled !== false;
    this.debug = config.debug ?? false;

    // Create sampler
    this.sampler = createSampler({
      errors: 1.0,
      metrics: config.sampling?.metrics ?? 1.0,
      rules: config.sampling?.rules ?? [],
    });

    // Create event queue for batching
    this.eventQueue = createEventQueue<RequestMetrics>(
      async (metrics) => this.sendBatch(metrics),
      {
        maxBatchSize: config.batching?.maxBatchSize ?? 10,
        flushIntervalMs: config.batching?.flushIntervalMs ?? 5000,
        maxQueueSize: config.batching?.maxQueueSize ?? 1000,
        onError: (error) => this.log('error', `Batch send failed: ${error.message}`),
        enabled: this.enabled,
      }
    );
  }

  /**
   * Express middleware for tracking request metrics
   */
  middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!this.enabled || this.isShutdown) {
        return next();
      }

      // Check sampling before tracking
      const shouldTrack = this.sampler.shouldSample({
        eventType: 'metric',
        path: req.path,
        method: req.method,
      });

      if (!shouldTrack) {
        this.log('debug', `Skipping metric (sampled out): ${req.method} ${req.path}`);
        return next();
      }

      const startTime = Date.now();
      const originalEnd = res.end.bind(res);
      const self = this;

      // Override res.end to capture metrics after response
      res.end = function (this: Response, ...args: unknown[]): Response {
        const responseTime = Date.now() - startTime;

        // Extract caller service from distributed tracing header
        const headerValue = req.get(HTTP_HEADERS.ORIGIN_SERVICE) || req.get('X-Origin-Service');
        const callerServiceName = Array.isArray(headerValue) ? headerValue[0] : headerValue;

        const metric: RequestMetrics = {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          responseTime,
          timestamp: new Date(),
          callerServiceName,
          serviceName: self.serviceName,
        };

        // Enqueue metric asynchronously
        self.enqueueMetric(metric);

        // Call original end
        return (originalEnd as (...args: unknown[]) => Response)(...args);
      } as Response['end'];

      next();
    };
  }

  /**
   * Force flush all pending metrics
   */
  async forceFlush(): Promise<void> {
    await this.eventQueue.forceFlush();
  }

  /**
   * Shutdown metrics tracker
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

  /**
   * Get aggregated statistics
   */
  getStats() {
    const state = this.eventQueue.getState();
    return {
      queueSize: state.size,
      droppedCount: state.dropped,
      flushCount: state.flushCount,
      failedFlushCount: state.failedFlushCount,
    };
  }

  // Private methods

  /**
   * Enqueue a metric for batched submission
   */
  private enqueueMetric(metric: RequestMetrics): void {
    const queued = this.eventQueue.enqueue(metric);
    if (queued) {
      this.log('debug', `Queued metric: ${metric.method} ${metric.path} - ${metric.statusCode} (${metric.responseTime}ms)`);
    } else {
      this.log('warn', 'Metric dropped: queue full');
    }
  }

  /**
   * Send batch of metrics to API
   */
  private async sendBatch(metrics: RequestMetrics[]): Promise<void> {
    if (metrics.length === 0) {
      return;
    }

    try {
      // Transform metrics to performance traces format
      const traces = metrics.map((metric) => ({
        service_id: metric.serviceName,
        operation_name: `${metric.method} ${metric.path}`,
        operation_type: 'http_request',
        start_time: new Date(metric.timestamp.getTime() - metric.responseTime),
        duration_ms: metric.responseTime,
        status_code: metric.statusCode,
        method: metric.method,
        path: metric.path,
        caller_service: metric.callerServiceName,
      }));

      const response = await fetch(`${this.apiEndpoint}/performance/traces/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey && { [HTTP_HEADERS.API_KEY]: this.apiKey }),
        },
        body: JSON.stringify({ traces }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      this.log('debug', `Sent ${metrics.length} metrics to API`);
    } catch (error) {
      this.log('error', `Failed to send metrics: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Conditional logging based on debug mode
   */
  private log(level: 'debug' | 'warn' | 'error', message: string): void {
    const prefix = '[Lattice MetricsTracker]';

    if (level === 'error') {
      console.error(`${prefix} ${message}`);
    } else if (level === 'warn') {
      console.warn(`${prefix} ${message}`);
    } else if (this.debug) {
      console.log(`${prefix} ${message}`);
    }
  }
}
