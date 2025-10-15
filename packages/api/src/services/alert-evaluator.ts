/**
 * Alert Evaluator - Evaluate alert rules against current metrics
 */

import { Pool } from 'pg';
import { listAlertRules, createAlertNotification } from './alert-service';

const pool = new Pool({
  connectionString: process.env["DATABASE_URL"],
});

export async function evaluateAlertRules(): Promise<void> {
  const rules = await listAlertRules();
  const enabledRules = rules.filter(rule => rule.enabled);

  for (const rule of enabledRules) {
    try {
      await evaluateRule(rule);
    } catch (error) {
      console.error(`Failed to evaluate rule ${rule.id}:`, error);
    }
  }
}

async function evaluateRule(rule: any): Promise<void> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - rule.window_minutes * 60 * 1000);

  let metricValue: number | null = null;

  switch (rule.metric_type) {
    case 'error_rate':
      metricValue = await getErrorRate(rule.service_id, rule.environment, windowStart, now);
      break;
    case 'error_count':
      metricValue = await getErrorCount(rule.service_id, rule.environment, windowStart, now);
      break;
    case 'response_time':
      metricValue = await getAvgResponseTime(rule.service_id, windowStart, now);
      break;
    case 'uptime':
      metricValue = await getUptimePercentage(rule.service_id, rule.environment);
      break;
  }

  if (metricValue === null) {
    return;
  }

  const shouldAlert = evaluateCondition(metricValue, rule.condition, rule.threshold);

  if (shouldAlert) {
    const message = generateAlertMessage(rule, metricValue);
    await createAlertNotification(rule.id, metricValue, rule.threshold, message);
    console.log(`Alert triggered: ${message}`);
  }
}

function evaluateCondition(value: number, condition: string, threshold: number): boolean {
  switch (condition) {
    case 'gt':
      return value > threshold;
    case 'lt':
      return value < threshold;
    case 'eq':
      return value === threshold;
    default:
      return false;
  }
}

function generateAlertMessage(rule: any, value: number): string {
  const servicePart = rule.service_id ? `[${rule.service_id}]` : '[All Services]';
  const envPart = rule.environment ? `(${rule.environment})` : '';
  const conditionSymbol = rule.condition === 'gt' ? '>' : rule.condition === 'lt' ? '<' : '=';

  return `${servicePart} ${envPart} ${rule.metric_type} ${value.toFixed(2)} ${conditionSymbol} ${rule.threshold}`;
}

async function getErrorRate(
  serviceId?: string,
  environment?: string,
  start?: Date,
  end?: Date
): Promise<number> {
  let query = `
    SELECT
      COUNT(*)::numeric AS error_count,
      (SELECT COUNT(*) FROM performance_traces
       WHERE timestamp >= $1 AND timestamp <= $2
       ${serviceId ? 'AND service_id = $3' : ''}) AS total_requests
    FROM error_events
    WHERE timestamp >= $1 AND timestamp <= $2
  `;

  const params: any[] = [start, end];

  if (serviceId) {
    query += ' AND service_id = $3';
    params.push(serviceId);
  }

  if (environment) {
    query += ` AND environment = $${params.length + 1}`;
    params.push(environment);
  }

  const result = await pool.query(query, params);
  const errorCount = parseFloat(result.rows[0]?.error_count || '0');
  const totalRequests = parseFloat(result.rows[0]?.total_requests || '0');

  return totalRequests > 0 ? (errorCount / totalRequests) * 100 : 0;
}

async function getErrorCount(
  serviceId?: string,
  environment?: string,
  start?: Date,
  end?: Date
): Promise<number> {
  let query = 'SELECT COUNT(*) as count FROM error_events WHERE timestamp >= $1 AND timestamp <= $2';
  const params: any[] = [start, end];

  if (serviceId) {
    query += ' AND service_id = $3';
    params.push(serviceId);
  }

  if (environment) {
    query += ` AND environment = $${params.length + 1}`;
    params.push(environment);
  }

  const result = await pool.query(query, params);
  return parseInt(result.rows[0]?.count || '0', 10);
}

async function getAvgResponseTime(serviceId?: string, start?: Date, end?: Date): Promise<number> {
  let query = 'SELECT AVG(duration_ms)::INTEGER as avg_ms FROM performance_traces WHERE timestamp >= $1 AND timestamp <= $2';
  const params: any[] = [start, end];

  if (serviceId) {
    query += ' AND service_id = $3';
    params.push(serviceId);
  }

  const result = await pool.query(query, params);
  return parseInt(result.rows[0]?.avg_ms || '0', 10);
}

async function getUptimePercentage(serviceId?: string, environment?: string): Promise<number> {
  let query = 'SELECT uptime_percentage FROM service_health WHERE 1=1';
  const params: any[] = [];

  if (serviceId) {
    query += ' AND service_id = $1';
    params.push(serviceId);
  }

  if (environment) {
    query += ` AND environment = $${params.length + 1}`;
    params.push(environment);
  }

  query += ' LIMIT 1';

  const result = await pool.query(query, params);
  return parseFloat(result.rows[0]?.uptime_percentage || '100');
}
