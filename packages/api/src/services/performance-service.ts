/**
 * Performance Service - Handle performance trace storage and metrics
 */

import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env["DATABASE_URL"],
});

export interface PerformanceTraceInput {
  service_id: string;
  operation_name: string;
  operation_type: 'http_request' | 'db_query' | 'external_call' | 'custom';
  start_time: Date;
  duration_ms: number;
  status_code?: number;
  method?: string;
  path?: string;
  user_agent?: string;
  caller_service?: string;
  breakdown?: any;
  metadata?: any;
  session_id?: string;
}

export async function storePerformanceTrace(input: PerformanceTraceInput) {
  const id = `perf_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  await pool.query(
    `INSERT INTO performance_traces (
      id, service_id, operation_name, operation_type, start_time, duration_ms,
      status_code, method, path, user_agent, caller_service, breakdown, metadata, session_id, timestamp
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())`,
    [
      id,
      input.service_id,
      input.operation_name,
      input.operation_type,
      input.start_time,
      input.duration_ms,
      input.status_code,
      input.method,
      input.path,
      input.user_agent,
      input.caller_service,
      input.breakdown ? JSON.stringify(input.breakdown) : null,
      input.metadata ? JSON.stringify(input.metadata) : null,
      input.session_id,
    ]
  );

  return { id, is_slow: input.duration_ms > 3000 };
}

export async function getPerformanceMetrics(
  serviceId?: string,
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
      AVG(duration_ms)::INTEGER AS avg_duration_ms,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY duration_ms)::INTEGER AS p50_duration_ms,
      PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms)::INTEGER AS p95_duration_ms,
      PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY duration_ms)::INTEGER AS p99_duration_ms,
      COUNT(*) AS request_count
    FROM performance_traces
    WHERE timestamp >= $2 AND timestamp <= $3
  `;

  const params: any[] = [intervalMap[interval], startTime, endTime];

  if (serviceId) {
    query += ` AND service_id = $4`;
    params.push(serviceId);
  }

  query += ` GROUP BY bucket ORDER BY bucket`;

  const result = await pool.query(query, params);

  return {
    buckets: result.rows.map(row => ({
      timestamp: row.bucket,
      avg_duration_ms: parseInt(row.avg_duration_ms, 10),
      p50_duration_ms: parseInt(row.p50_duration_ms, 10),
      p95_duration_ms: parseInt(row.p95_duration_ms, 10),
      p99_duration_ms: parseInt(row.p99_duration_ms, 10),
      request_count: parseInt(row.request_count, 10),
    })),
    slowest_operations: await getSlowestOperations(serviceId, startTime, endTime),
    total_requests: result.rows.reduce((sum, row) => sum + parseInt(row.request_count, 10), 0),
  };
}

async function getSlowestOperations(
  serviceId?: string,
  startTime?: Date,
  endTime?: Date
) {
  let query = `
    SELECT
      operation_name,
      AVG(duration_ms)::INTEGER AS avg_duration_ms,
      COUNT(*) AS count
    FROM performance_traces
    WHERE timestamp >= $1 AND timestamp <= $2
  `;

  const params: any[] = [startTime, endTime];

  if (serviceId) {
    query += ` AND service_id = $3`;
    params.push(serviceId);
  }

  query += `
    GROUP BY operation_name
    ORDER BY avg_duration_ms DESC
    LIMIT 10
  `;

  const result = await pool.query(query, params);

  return result.rows.map(row => ({
    operation_name: row.operation_name,
    avg_duration_ms: parseInt(row.avg_duration_ms, 10),
    count: parseInt(row.count, 10),
  }));
}
