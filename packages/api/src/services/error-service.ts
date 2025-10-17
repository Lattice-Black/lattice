/**
 * Error Service - Handle error event storage and retrieval
 */

import { pool } from '../lib/db';
import type { StackFrame } from '@lattice.black/core';
import { getBreadcrumbsBySession } from './breadcrumb-service';

export interface ErrorEventInput {
  service_id: string;
  environment: 'development' | 'staging' | 'production';
  error_type: string;
  message: string;
  stack_trace: StackFrame[];
  raw_stack?: string;
  context?: Record<string, any>;
  session_id?: string;
}

export interface ErrorListFilters {
  service_id?: string;
  environment?: string;
  error_type?: string;
  resolved?: boolean;
  search?: string;
  start_time?: Date;
  end_time?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Calculate error fingerprint for aggregation
 */
export function calculateErrorFingerprint(
  serviceId: string,
  environment: string,
  errorType: string,
  message: string,
  frames: StackFrame[]
): string {
  const topFrame = frames.length > 0 ? frames[0] : null;
  const messageTruncated = message.substring(0, 100);
  const topFrameInfo = topFrame
    ? `${topFrame.filename}:${topFrame.line_number}`
    : 'unknown';

  const fingerprintString = [
    serviceId,
    environment,
    errorType,
    messageTruncated,
    topFrameInfo,
  ].join('|');

  let hash = 0;
  for (let i = 0; i < fingerprintString.length; i++) {
    const char = fingerprintString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }

  return Math.abs(hash).toString(16);
}

/**
 * Store error event (aggregates duplicates by fingerprint)
 */
export async function storeError(input: ErrorEventInput): Promise<{
  id: string;
  fingerprint: string;
  is_new: boolean;
  occurrence_count: number;
}> {
  const fingerprint = calculateErrorFingerprint(
    input.service_id,
    input.environment,
    input.error_type,
    input.message,
    input.stack_trace
  );

  const now = new Date();

  // Check if error with this fingerprint already exists
  const existingResult = await pool.query(
    `SELECT id, occurrence_count
     FROM error_events
     WHERE service_id = $1
       AND environment = $2
       AND error_type = $3
       AND substring(message, 1, 100) = substring($4, 1, 100)
       AND resolved = false
     LIMIT 1`,
    [input.service_id, input.environment, input.error_type, input.message]
  );

  if (existingResult.rows.length > 0) {
    // Update existing error
    const existing = existingResult.rows[0];
    const newCount = existing.occurrence_count + 1;

    await pool.query(
      `UPDATE error_events
       SET last_seen = $1,
           occurrence_count = $2
       WHERE id = $3`,
      [now, newCount, existing.id]
    );

    return {
      id: existing.id,
      fingerprint,
      is_new: false,
      occurrence_count: newCount,
    };
  } else {
    // Insert new error
    const id = `err_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    await pool.query(
      `INSERT INTO error_events (
        id, service_id, environment, error_type, message,
        stack_trace, raw_stack, context, session_id,
        resolved, ignored, first_seen, last_seen, occurrence_count, timestamp
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, false, false, $10, $10, 1, $10)`,
      [
        id,
        input.service_id,
        input.environment,
        input.error_type,
        input.message,
        JSON.stringify(input.stack_trace),
        input.raw_stack,
        input.context ? JSON.stringify(input.context) : null,
        input.session_id,
        now,
      ]
    );

    return {
      id,
      fingerprint,
      is_new: true,
      occurrence_count: 1,
    };
  }
}

/**
 * List errors with filtering
 */
export async function listErrors(filters: ErrorListFilters = {}) {
  const {
    service_id,
    environment,
    error_type,
    resolved,
    search,
    start_time,
    end_time,
    limit = 50,
    offset = 0,
  } = filters;

  let query = `
    SELECT id, service_id, environment, error_type, message,
           occurrence_count, first_seen, last_seen, resolved, ignored
    FROM error_events
    WHERE 1=1
  `;
  const params: any[] = [];
  let paramCount = 0;

  if (service_id) {
    paramCount++;
    query += ` AND service_id = $${paramCount}`;
    params.push(service_id);
  }

  if (environment) {
    paramCount++;
    query += ` AND environment = $${paramCount}`;
    params.push(environment);
  }

  if (error_type) {
    paramCount++;
    query += ` AND error_type = $${paramCount}`;
    params.push(error_type);
  }

  if (resolved !== undefined) {
    paramCount++;
    query += ` AND resolved = $${paramCount}`;
    params.push(resolved);
  }

  if (search) {
    paramCount++;
    query += ` AND (message ILIKE $${paramCount} OR error_type ILIKE $${paramCount})`;
    params.push(`%${search}%`);
  }

  if (start_time) {
    paramCount++;
    query += ` AND timestamp >= $${paramCount}`;
    params.push(start_time);
  }

  if (end_time) {
    paramCount++;
    query += ` AND timestamp <= $${paramCount}`;
    params.push(end_time);
  }

  query += ` ORDER BY last_seen DESC`;

  paramCount++;
  query += ` LIMIT $${paramCount}`;
  params.push(limit);

  paramCount++;
  query += ` OFFSET $${paramCount}`;
  params.push(offset);

  const result = await pool.query(query, params);

  // Get total count
  let countQuery = `SELECT COUNT(*) FROM error_events WHERE 1=1`;
  const countParams: any[] = [];
  let countParamCount = 0;

  if (service_id) {
    countParamCount++;
    countQuery += ` AND service_id = $${countParamCount}`;
    countParams.push(service_id);
  }

  if (environment) {
    countParamCount++;
    countQuery += ` AND environment = $${countParamCount}`;
    countParams.push(environment);
  }

  if (resolved !== undefined) {
    countParamCount++;
    countQuery += ` AND resolved = $${countParamCount}`;
    countParams.push(resolved);
  }

  const countResult = await pool.query(countQuery, countParams);
  const total = parseInt(countResult.rows[0].count, 10);

  return {
    errors: result.rows.map(row => ({
      id: row.id,
      service_id: row.service_id,
      environment: row.environment,
      error_type: row.error_type,
      message: row.message,
      occurrence_count: row.occurrence_count,
      first_seen: row.first_seen,
      last_seen: row.last_seen,
      resolved: row.resolved,
      ignored: row.ignored,
    })),
    total,
    limit,
    offset,
  };
}

/**
 * Get error by ID
 */
export async function getErrorById(id: string) {
  const result = await pool.query(
    `SELECT * FROM error_events WHERE id = $1`,
    [id]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];

  // Get breadcrumbs for this error's session
  let breadcrumbs: any[] = [];
  if (row.session_id) {
    try {
      breadcrumbs = await getBreadcrumbsBySession(row.session_id, 100);
    } catch (error) {
      console.error('Failed to fetch breadcrumbs:', error);
    }
  }

  return {
    id: row.id,
    service_id: row.service_id,
    environment: row.environment,
    error_type: row.error_type,
    message: row.message,
    stack_trace: row.stack_trace,
    raw_stack: row.raw_stack,
    context: row.context,
    session_id: row.session_id,
    resolved: row.resolved,
    ignored: row.ignored,
    first_seen: row.first_seen,
    last_seen: row.last_seen,
    occurrence_count: row.occurrence_count,
    timestamp: row.timestamp,
    breadcrumbs,
  };
}

/**
 * Update error status
 */
export async function updateErrorStatus(
  id: string,
  updates: { resolved?: boolean; ignored?: boolean }
) {
  const setClauses: string[] = [];
  const params: any[] = [];
  let paramCount = 0;

  if (updates.resolved !== undefined) {
    paramCount++;
    setClauses.push(`resolved = $${paramCount}`);
    params.push(updates.resolved);
  }

  if (updates.ignored !== undefined) {
    paramCount++;
    setClauses.push(`ignored = $${paramCount}`);
    params.push(updates.ignored);
  }

  if (setClauses.length === 0) {
    throw new Error('No updates provided');
  }

  paramCount++;
  params.push(id);

  const query = `
    UPDATE error_events
    SET ${setClauses.join(', ')}
    WHERE id = $${paramCount}
    RETURNING id, resolved, ignored
  `;

  const result = await pool.query(query, params);

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
}

/**
 * Get error statistics for time-series charts
 */
export async function getErrorStats(
  serviceId?: string,
  environment?: string,
  startTime?: Date,
  endTime?: Date,
  interval: '1m' | '5m' | '10m' | '1h' | '1d' = '5m'
) {
  const intervalMap = {
    '1m': '1 minute',
    '5m': '5 minutes',
    '10m': '10 minutes',
    '1h': '1 hour',
    '1d': '1 day',
  };

  let query = `
    SELECT
      time_bucket($1::interval, timestamp) AS bucket,
      COUNT(*) AS error_count,
      COUNT(*)::numeric / EXTRACT(EPOCH FROM $1::interval) * 60 AS error_rate
    FROM error_events
    WHERE timestamp >= $2 AND timestamp <= $3
  `;

  const params: any[] = [intervalMap[interval], startTime, endTime];
  let paramCount = 3;

  if (serviceId) {
    paramCount++;
    query += ` AND service_id = $${paramCount}`;
    params.push(serviceId);
  }

  if (environment) {
    paramCount++;
    query += ` AND environment = $${paramCount}`;
    params.push(environment);
  }

  query += ` GROUP BY bucket ORDER BY bucket`;

  const result = await pool.query(query, params);

  return {
    buckets: result.rows.map(row => ({
      timestamp: row.bucket,
      error_count: parseInt(row.error_count, 10),
      error_rate: parseFloat(row.error_rate),
    })),
    total_errors: result.rows.reduce((sum, row) => sum + parseInt(row.error_count, 10), 0),
  };
}
