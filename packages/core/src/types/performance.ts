/**
 * Performance Monitoring Types
 * @module @lattice.black/core/types/performance
 */

export enum OperationType {
  HttpRequest = 'http_request',
  DbQuery = 'db_query',
  ExternalCall = 'external_call',
  Custom = 'custom',
}

export interface PerformanceSubOperation {
  /** Name of the sub-operation */
  name: string;
  /** Duration in milliseconds */
  duration_ms: number;
  /** Additional details about the operation */
  details?: Record<string, any>;
}

export interface PerformanceBreakdown {
  /** Array of sub-operations with timing data */
  sub_operations: PerformanceSubOperation[];
}

export interface PerformanceTrace {
  /** Unique trace ID (ULID or UUID) */
  id: string;
  /** Service that reported the trace */
  service_id: string;
  /** Name or identifier of the operation */
  operation_name: string;
  /** Type of operation */
  operation_type: OperationType;
  /** When operation started */
  start_time: Date;
  /** Total duration in milliseconds */
  duration_ms: number;
  /** HTTP status code (if applicable) */
  status_code?: number;
  /** HTTP method (if applicable) */
  method?: string;
  /** Request path (if applicable) */
  path?: string;
  /** Client user agent (optional) */
  user_agent?: string;
  /** Service that initiated this operation (optional) */
  caller_service?: string;
  /** Timing breakdown for sub-operations (optional) */
  breakdown?: PerformanceBreakdown;
  /** Additional trace metadata */
  metadata?: Record<string, any>;
  /** Associated session identifier (optional) */
  session_id?: string;
  /** When trace was captured */
  timestamp: Date;
}

export interface PerformanceTraceSummary {
  id: string;
  service_id: string;
  operation_name: string;
  operation_type: OperationType;
  duration_ms: number;
  status_code?: number;
  timestamp: Date;
}

export interface PerformanceMetrics {
  /** Average duration in milliseconds */
  avg_duration_ms: number;
  /** P50 (median) duration */
  p50_duration_ms: number;
  /** P95 duration */
  p95_duration_ms: number;
  /** P99 duration */
  p99_duration_ms: number;
  /** Total request count */
  request_count: number;
  /** Timestamp bucket for time-series data */
  timestamp: Date;
}

export interface SlowestOperation {
  /** Operation name */
  operation_name: string;
  /** Average duration in milliseconds */
  avg_duration_ms: number;
  /** Number of times this operation was executed */
  count: number;
}
