/**
 * Session Tracking Types
 * @module @lattice.black/core/types/session
 */

export interface Session {
  /** Unique session identifier (ULID) */
  id: string;
  /** Service where session occurred */
  service_id: string;
  /** User identifier (if authenticated) */
  user_id?: string;
  /** User email (sanitized, if available) */
  user_email?: string;
  /** Client IP address (hashed for privacy) */
  ip_address?: string;
  /** Browser/client user agent */
  user_agent?: string;
  /** Session start time */
  started_at: Date;
  /** Last activity timestamp */
  last_activity_at: Date;
  /** Session end time (if known) */
  ended_at?: Date;
  /** Total session duration in seconds */
  duration_seconds?: number;
  /** Number of breadcrumbs captured */
  breadcrumb_count: number;
  /** Number of errors in this session */
  error_count: number;
  /** Additional session metadata */
  metadata?: Record<string, any>;
}

export interface SessionCreate {
  /** Service where session is occurring */
  service_id: string;
  /** User identifier (if authenticated) */
  user_id?: string;
  /** Browser/client user agent */
  user_agent?: string;
  /** Additional session metadata */
  metadata?: Record<string, any>;
}

export enum SessionStatus {
  Active = 'active',
  Expired = 'expired',
  Ended = 'ended',
}
