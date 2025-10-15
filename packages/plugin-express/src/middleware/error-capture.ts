/**
 * Error Capture Middleware for Express
 * Captures unhandled errors and sends them to Lattice API
 */

import { Request, Response, NextFunction } from 'express';
import { parse } from 'error-stack-parser-es';
import { HTTP_HEADERS } from '@lattice.black/core';
import type { StackFrame, ErrorEvent } from '@lattice.black/core';

export interface ErrorCaptureConfig {
  serviceName: string;
  apiEndpoint: string;
  apiKey: string;
  environment?: string;
  enabled?: boolean;
}

export class ErrorCapture {
  private config: ErrorCaptureConfig;

  constructor(config: ErrorCaptureConfig) {
    this.config = {
      ...config,
      environment: config.environment || process.env['NODE_ENV'] || 'development',
      enabled: config.enabled !== false,
    };
  }

  /**
   * Express error handling middleware
   * MUST be registered AFTER all routes
   */
  middleware() {
    return async (err: Error, req: Request, _res: Response, next: NextFunction) => {
      if (!this.config.enabled) {
        return next(err);
      }

      try {
        // Capture and send error asynchronously
        this.captureError(err, {
          method: req.method,
          path: req.path,
          url: req.url,
          headers: req.headers,
          query: req.query,
          body: req.body,
          ip: req.ip,
          user_agent: req.get('user-agent'),
        }).catch(captureErr => {
          // Silently fail - don't break the app
          console.error('[Lattice ErrorCapture] Failed to send error:', captureErr);
        });
      } catch (captureErr) {
        console.error('[Lattice ErrorCapture] Failed to capture error:', captureErr);
      }

      // Always pass the error to the next handler
      next(err);
    };
  }

  /**
   * Manually capture an error
   */
  async captureError(error: Error, context?: Record<string, any>): Promise<void> {
    try {
      const stackFrames = this.parseStackTrace(error);

      const errorEvent: Partial<ErrorEvent> = {
        service_id: this.config.serviceName,
        environment: this.config.environment as 'development' | 'staging' | 'production',
        error_type: error.name || 'Error',
        message: error.message || 'Unknown error',
        stack_trace: stackFrames,
        context: context ? this.sanitizeContext(context) : undefined,
        timestamp: new Date(),
      };

      await this.sendToAPI(errorEvent);
    } catch (err) {
      console.error('[Lattice ErrorCapture] Error in captureError:', err);
    }
  }

  /**
   * Parse error stack trace
   */
  private parseStackTrace(error: Error): StackFrame[] {
    try {
      const frames = parse(error);

      return frames.map(frame => ({
        filename: frame.fileName || 'unknown',
        line_number: frame.lineNumber || 0,
        column_number: frame.columnNumber,
        function_name: frame.functionName || '<anonymous>',
      }));
    } catch (err) {
      return [{
        filename: 'unknown',
        line_number: 0,
        function_name: error.name || 'Error',
      }];
    }
  }

  /**
   * Sanitize context to remove sensitive data
   */
  private sanitizeContext(context: Record<string, any>): Record<string, any> {
    const sanitized = { ...context };

    // Remove sensitive fields
    const sensitiveFields = [
      'password',
      'passwd',
      'pwd',
      'secret',
      'api_key',
      'apiKey',
      'token',
      'authorization',
      'cookie',
      'session',
    ];

    const sanitizeObject = (obj: any): any => {
      if (obj === null || obj === undefined || typeof obj !== 'object') {
        return obj;
      }

      if (Array.isArray(obj)) {
        return obj.map(item => sanitizeObject(item));
      }

      const result: any = {};
      for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase();
        const isSensitive = sensitiveFields.some(field => lowerKey.includes(field));

        if (isSensitive) {
          result[key] = '[REDACTED]';
        } else if (typeof value === 'object') {
          result[key] = sanitizeObject(value);
        } else {
          result[key] = value;
        }
      }
      return result;
    };

    return sanitizeObject(sanitized);
  }

  /**
   * Send error event to Lattice API
   */
  private async sendToAPI(errorEvent: Partial<ErrorEvent>): Promise<void> {
    try {
      const response = await fetch(`${this.config.apiEndpoint}/errors`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [HTTP_HEADERS.API_KEY]: this.config.apiKey,
        },
        body: JSON.stringify(errorEvent),
      });

      if (!response.ok) {
        console.error(
          `[Lattice ErrorCapture] Failed to send error: ${response.status} ${response.statusText}`
        );
      }
    } catch (err) {
      console.error('[Lattice ErrorCapture] Network error sending to API:', err);
      throw err;
    }
  }
}
