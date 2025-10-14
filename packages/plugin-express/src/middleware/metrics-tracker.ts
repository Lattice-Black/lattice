import { Request, Response, NextFunction } from 'express';
import { HTTP_HEADERS } from '@lattice.black/core';

export interface RequestMetrics {
  method: string;
  path: string;
  statusCode: number;
  responseTime: number;
  timestamp: Date;
  callerServiceName?: string;
}

export class MetricsTracker {
  private metrics: RequestMetrics[] = [];
  private maxMetrics = 1000; // Keep last 1000 requests

  constructor(
    private serviceName: string,
    private apiEndpoint: string,
    private apiKey: string
  ) {}

  middleware() {
    const self = this;
    console.log('[MetricsTracker] middleware() called - returning handler function');
    return (req: Request, res: Response, next: NextFunction) => {
      console.log(`[MetricsTracker] MIDDLEWARE INVOKED: ${req.method} ${req.path}`);
      const startTime = Date.now();

      // Capture the original end function
      const originalEnd = res.end;

      // Override res.end to capture metrics
      res.end = function (...args: any[]): Response {
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
        };

        // Store metric
        self.storeMetric(metric);

        // Submit to API periodically
        self.submitMetrics();

        // Call original end
        return (originalEnd as any).apply(this, args);
      };

      next();
    };
  }

  private storeMetric(metric: RequestMetrics) {
    this.metrics.push(metric);
    console.log(`[MetricsTracker] Stored metric ${this.metrics.length}: ${metric.method} ${metric.path} - ${metric.statusCode} (${metric.responseTime}ms)`);

    // Keep only last N metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift();
    }
  }

  private async submitMetrics() {
    // Submit every 10 requests
    if (this.metrics.length % 10 === 0) {
      const metricsToSend = [...this.metrics];
      console.log(`[MetricsTracker] Submitting ${metricsToSend.length} metrics to ${this.apiEndpoint}/metrics`);

      try {
        const response = await fetch(`${this.apiEndpoint}/metrics`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(this.apiKey && { [HTTP_HEADERS.API_KEY]: this.apiKey }),
          },
          body: JSON.stringify({
            serviceName: this.serviceName,
            metrics: metricsToSend.slice(-10), // Send last 10
          }),
        });
        const result = await response.json();
        console.log(`[MetricsTracker] Submission result:`, result);
      } catch (error) {
        // Silently fail - don't break the app
        console.error('[MetricsTracker] Failed to submit metrics:', error);
      }
    }
  }

  getStats() {
    const totalRequests = this.metrics.length;
    const avgResponseTime = this.metrics.reduce((sum, m) => sum + m.responseTime, 0) / totalRequests || 0;
    const errorCount = this.metrics.filter(m => m.statusCode >= 400).length;
    const errorRate = totalRequests > 0 ? (errorCount / totalRequests) * 100 : 0;

    return {
      totalRequests,
      avgResponseTime: Math.round(avgResponseTime),
      errorCount,
      errorRate: errorRate.toFixed(2),
      recentRequests: this.metrics.slice(-10),
    };
  }
}
