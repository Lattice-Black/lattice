/**
 * Health Service - Service health metrics and monitoring
 */

import { pool } from '../lib/db';

export interface ServiceHealth {
  service_id: string;
  environment: string;
  total_errors: number;
  error_rate: number;
  avg_response_time: number;
  p95_response_time: number;
  slow_request_count: number;
  uptime_percentage: number;
  last_error?: Date;
  last_seen: Date;
  health_status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
}

export async function getServiceHealth(
  serviceId?: string,
  environment?: string
): Promise<ServiceHealth[]> {
  let query = `
    SELECT
      service_id,
      environment,
      total_errors,
      error_rate,
      avg_response_time,
      p95_response_time,
      slow_request_count,
      uptime_percentage,
      last_error,
      last_seen,
      health_status
    FROM service_health
    WHERE 1=1
  `;

  const params: any[] = [];
  let paramCount = 0;

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

  query += ` ORDER BY last_seen DESC`;

  const result = await pool.query(query, params);

  return result.rows.map(row => ({
    service_id: row.service_id,
    environment: row.environment,
    total_errors: parseInt(row.total_errors, 10),
    error_rate: parseFloat(row.error_rate),
    avg_response_time: parseInt(row.avg_response_time, 10),
    p95_response_time: parseInt(row.p95_response_time, 10),
    slow_request_count: parseInt(row.slow_request_count, 10),
    uptime_percentage: parseFloat(row.uptime_percentage),
    last_error: row.last_error,
    last_seen: row.last_seen,
    health_status: row.health_status,
  }));
}

export async function getHealthTimeseries(
  serviceId: string,
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

  // Get error rate over time
  const errorQuery = `
    SELECT
      time_bucket($1::interval, timestamp) AS bucket,
      COUNT(*) AS error_count
    FROM error_events
    WHERE service_id = $2
      AND timestamp >= $3
      AND timestamp <= $4
      ${environment ? 'AND environment = $5' : ''}
    GROUP BY bucket
    ORDER BY bucket
  `;

  const errorParams = environment
    ? [intervalMap[interval], serviceId, startTime, endTime, environment]
    : [intervalMap[interval], serviceId, startTime, endTime];

  const errorResult = await pool.query(errorQuery, errorParams);

  // Get performance over time
  const perfQuery = `
    SELECT
      time_bucket($1::interval, timestamp) AS bucket,
      AVG(duration_ms)::INTEGER AS avg_duration_ms,
      PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms)::INTEGER AS p95_duration_ms,
      COUNT(*) AS request_count,
      COUNT(CASE WHEN duration_ms > 3000 THEN 1 END) AS slow_count
    FROM performance_traces
    WHERE service_id = $2
      AND timestamp >= $3
      AND timestamp <= $4
    GROUP BY bucket
    ORDER BY bucket
  `;

  const perfParams = [intervalMap[interval], serviceId, startTime, endTime];
  const perfResult = await pool.query(perfQuery, perfParams);

  return {
    error_buckets: errorResult.rows.map(row => ({
      timestamp: row.bucket,
      error_count: parseInt(row.error_count, 10),
    })),
    performance_buckets: perfResult.rows.map(row => ({
      timestamp: row.bucket,
      avg_duration_ms: parseInt(row.avg_duration_ms, 10),
      p95_duration_ms: parseInt(row.p95_duration_ms, 10),
      request_count: parseInt(row.request_count, 10),
      slow_count: parseInt(row.slow_count, 10),
    })),
  };
}

export async function getSystemOverview() {
  // Get total services count
  const servicesResult = await pool.query(`
    SELECT COUNT(DISTINCT service_id) as count FROM service_health
  `);

  // Get health status breakdown
  const healthBreakdown = await pool.query(`
    SELECT
      health_status,
      COUNT(*) as count
    FROM service_health
    GROUP BY health_status
  `);

  // Get recent errors
  const recentErrors = await pool.query(`
    SELECT COUNT(*) as count
    FROM error_events
    WHERE timestamp >= NOW() - INTERVAL '1 hour'
  `);

  // Get total errors in last 24h
  const totalErrors24h = await pool.query(`
    SELECT COUNT(*) as count
    FROM error_events
    WHERE timestamp >= NOW() - INTERVAL '24 hours'
  `);

  // Get average response time
  const avgResponseTime = await pool.query(`
    SELECT AVG(duration_ms)::INTEGER as avg_ms
    FROM performance_traces
    WHERE timestamp >= NOW() - INTERVAL '1 hour'
  `);

  return {
    total_services: parseInt(servicesResult.rows[0]?.count || '0', 10),
    health_breakdown: healthBreakdown.rows.reduce((acc, row) => {
      acc[row.health_status] = parseInt(row.count, 10);
      return acc;
    }, {} as Record<string, number>),
    recent_errors_1h: parseInt(recentErrors.rows[0]?.count || '0', 10),
    total_errors_24h: parseInt(totalErrors24h.rows[0]?.count || '0', 10),
    avg_response_time_1h: parseInt(avgResponseTime.rows[0]?.avg_ms || '0', 10),
  };
}
