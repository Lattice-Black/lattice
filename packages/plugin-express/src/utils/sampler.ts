/**
 * Sampler Utility
 *
 * Following Sentry's sampling pattern:
 * - Global sample rate for all events
 * - Rule-based sampling for specific conditions
 * - First matching rule wins
 */

import type { SamplingConfig, SamplingRule } from '@lattice.black/core';
import { DEFAULT_SAMPLING_CONFIG } from '@lattice.black/core';

/**
 * Context for sampling decisions
 */
export interface SamplingContext {
  /** Request path */
  path?: string;
  /** HTTP method */
  method?: string;
  /** Error type name */
  errorType?: string;
  /** Event type (error or metric) */
  eventType: 'error' | 'metric';
}

/**
 * Sampler class for determining whether to capture events
 */
export class Sampler {
  private readonly config: SamplingConfig;

  constructor(config?: Partial<SamplingConfig>) {
    this.config = {
      ...DEFAULT_SAMPLING_CONFIG,
      ...config,
      rules: config?.rules ?? [],
    };
  }

  /**
   * Determine if an event should be sampled (captured)
   * Returns true if the event should be captured, false to drop it
   */
  shouldSample(context: SamplingContext): boolean {
    const rate = this.getRate(context);

    // Rate of 0 means never sample
    if (rate <= 0) {
      return false;
    }

    // Rate of 1 means always sample
    if (rate >= 1) {
      return true;
    }

    // Random sampling based on rate
    return Math.random() < rate;
  }

  /**
   * Get the sample rate for a given context
   * Checks rules first, then falls back to global rate
   */
  getRate(context: SamplingContext): number {
    // Check rules in order - first match wins
    for (const rule of this.config.rules) {
      if (this.matchesRule(context, rule)) {
        return this.clampRate(rule.rate);
      }
    }

    // Fall back to global rate based on event type
    const globalRate =
      context.eventType === 'error' ? this.config.errors : this.config.metrics;

    return this.clampRate(globalRate);
  }

  /**
   * Check if context matches a sampling rule
   */
  private matchesRule(context: SamplingContext, rule: SamplingRule): boolean {
    const { match } = rule;

    // All specified conditions must match
    if (match.path !== undefined && !this.matchPath(context.path, match.path)) {
      return false;
    }

    if (match.method !== undefined && context.method?.toUpperCase() !== match.method.toUpperCase()) {
      return false;
    }

    if (match.errorType !== undefined && context.errorType !== match.errorType) {
      return false;
    }

    return true;
  }

  /**
   * Match path with wildcard support
   * Supports * for single segment and ** for multiple segments
   */
  private matchPath(actual: string | undefined, pattern: string): boolean {
    if (!actual) {
      return false;
    }

    // Exact match
    if (pattern === actual) {
      return true;
    }

    // Convert pattern to regex
    const regexPattern = pattern
      .replace(/\*\*/g, '___DOUBLE_STAR___')
      .replace(/\*/g, '[^/]+')
      .replace(/___DOUBLE_STAR___/g, '.*');

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(actual);
  }

  /**
   * Clamp rate to valid range [0, 1]
   */
  private clampRate(rate: number): number {
    return Math.min(Math.max(rate, 0), 1);
  }
}

/**
 * Create a sampler with default configuration
 */
export function createSampler(config?: Partial<SamplingConfig>): Sampler {
  return new Sampler(config);
}

/**
 * Default sampler instance that samples everything
 */
export const defaultSampler = new Sampler();
