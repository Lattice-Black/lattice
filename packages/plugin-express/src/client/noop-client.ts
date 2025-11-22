/**
 * No-Op API Client
 *
 * A fallback client that silently succeeds without making any network calls.
 * Used when the SDK fails to initialize or is explicitly disabled.
 *
 * Following OpenTelemetry's pattern of returning no-op implementations
 * that never throw and never affect the host application.
 */

import type { ServiceMetadataSubmission, ErrorEvent } from '@lattice.black/core';
import type { SubmissionResponse } from '../config/types';

/**
 * Interface for Lattice API client operations
 */
export interface LatticeApiClient {
  submitMetadata(metadata: ServiceMetadataSubmission): Promise<SubmissionResponse>;
  submitErrors(errors: Partial<ErrorEvent>[]): Promise<void>;
  submitMetrics(metrics: unknown[]): Promise<void>;
  healthCheck(): Promise<boolean>;
}

/**
 * No-Op implementation of the Lattice API client
 * All methods succeed silently without performing any operations
 */
export class NoOpClient implements LatticeApiClient {
  /**
   * Returns a successful response without making network calls
   */
  async submitMetadata(_metadata: ServiceMetadataSubmission): Promise<SubmissionResponse> {
    return {
      success: true,
      serviceId: 'noop',
      routesProcessed: 0,
      dependenciesProcessed: 0,
    };
  }

  /**
   * Silently ignores error submissions
   */
  async submitErrors(_errors: Partial<ErrorEvent>[]): Promise<void> {
    // No-op: silently succeed
  }

  /**
   * Silently ignores metric submissions
   */
  async submitMetrics(_metrics: unknown[]): Promise<void> {
    // No-op: silently succeed
  }

  /**
   * Always reports healthy
   */
  async healthCheck(): Promise<boolean> {
    return true;
  }
}

/**
 * Singleton instance of the no-op client
 */
export const noOpClient = new NoOpClient();
