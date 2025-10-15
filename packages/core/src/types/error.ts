/**
 * Error Tracking Types
 * @module @lattice.black/core/types/error
 */

export enum ErrorType {
  TypeError = 'TypeError',
  ReferenceError = 'ReferenceError',
  SyntaxError = 'SyntaxError',
  RangeError = 'RangeError',
  URIError = 'URIError',
  EvalError = 'EvalError',
  NetworkError = 'NetworkError',
  DatabaseError = 'DatabaseError',
  AuthenticationError = 'AuthenticationError',
  AuthorizationError = 'AuthorizationError',
  ValidationError = 'ValidationError',
  NotFoundError = 'NotFoundError',
  ConflictError = 'ConflictError',
  TimeoutError = 'TimeoutError',
  UnknownError = 'UnknownError',
}

export interface StackFrame {
  /** Source file name */
  filename: string;
  /** Line number in source file */
  line_number: number;
  /** Column number in source file (optional) */
  column_number?: number;
  /** Function or method name (optional) */
  function_name?: string;
  /** Lines of code surrounding the error (optional) */
  source_context?: {
    pre: string[];
    line: string;
    post: string[];
  };
}

export interface ErrorEvent {
  /** Unique error event ID (ULID or UUID) */
  id: string;
  /** Service that reported the error */
  service_id: string;
  /** Environment where error occurred */
  environment: 'development' | 'staging' | 'production';
  /** Error class or type */
  error_type: string;
  /** Error message (sanitized) */
  message: string;
  /** Parsed stack frames */
  stack_trace: StackFrame[];
  /** Original stack trace string (optional) */
  raw_stack?: string;
  /** Additional error context */
  context?: Record<string, any>;
  /** Associated session identifier (optional) */
  session_id?: string;
  /** Whether error has been marked as resolved */
  resolved: boolean;
  /** Whether error has been marked as ignored */
  ignored: boolean;
  /** First time this error occurred */
  first_seen: Date;
  /** Most recent occurrence */
  last_seen: Date;
  /** Total number of occurrences */
  occurrence_count: number;
  /** When this event was captured */
  timestamp: Date;
}

export interface ErrorEventSummary {
  id: string;
  service_id: string;
  environment: string;
  error_type: string;
  message: string;
  occurrence_count: number;
  first_seen: Date;
  last_seen: Date;
  resolved: boolean;
  ignored: boolean;
}

export interface ErrorFingerprint {
  service_id: string;
  environment: string;
  error_type: string;
  message: string;
  top_frame_file: string;
  top_frame_line: number;
}
