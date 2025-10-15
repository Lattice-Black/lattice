/**
 * Alert Service - Alert rule management and evaluation
 */

import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env["DATABASE_URL"],
});

export interface AlertRule {
  id: string;
  name: string;
  service_id?: string;
  environment?: string;
  metric_type: 'error_rate' | 'response_time' | 'error_count' | 'uptime';
  condition: 'gt' | 'lt' | 'eq';
  threshold: number;
  window_minutes: number;
  notification_channels: string[];
  enabled: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface AlertNotification {
  id: string;
  alert_rule_id: string;
  triggered_at: Date;
  metric_value: number;
  threshold: number;
  message: string;
  acknowledged: boolean;
  acknowledged_at?: Date;
  acknowledged_by?: string;
}

export async function createAlertRule(input: Omit<AlertRule, 'id' | 'created_at' | 'updated_at'>): Promise<AlertRule> {
  const id = `alert_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const now = new Date();

  const result = await pool.query(
    `INSERT INTO alert_rules (
      id, name, service_id, environment, metric_type, condition,
      threshold, window_minutes, notification_channels, enabled, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)
    RETURNING *`,
    [
      id,
      input.name,
      input.service_id,
      input.environment,
      input.metric_type,
      input.condition,
      input.threshold,
      input.window_minutes,
      JSON.stringify(input.notification_channels),
      input.enabled,
      now,
    ]
  );

  return mapAlertRule(result.rows[0]);
}

export async function listAlertRules(serviceId?: string, environment?: string): Promise<AlertRule[]> {
  let query = 'SELECT * FROM alert_rules WHERE 1=1';
  const params: any[] = [];
  let paramCount = 0;

  if (serviceId) {
    paramCount++;
    query += ` AND (service_id = $${paramCount} OR service_id IS NULL)`;
    params.push(serviceId);
  }

  if (environment) {
    paramCount++;
    query += ` AND (environment = $${paramCount} OR environment IS NULL)`;
    params.push(environment);
  }

  query += ' ORDER BY created_at DESC';

  const result = await pool.query(query, params);
  return result.rows.map(mapAlertRule);
}

export async function getAlertRule(id: string): Promise<AlertRule | null> {
  const result = await pool.query('SELECT * FROM alert_rules WHERE id = $1', [id]);
  return result.rows.length > 0 ? mapAlertRule(result.rows[0]) : null;
}

export async function updateAlertRule(
  id: string,
  updates: Partial<Omit<AlertRule, 'id' | 'created_at' | 'updated_at'>>
): Promise<AlertRule | null> {
  const setClauses: string[] = [];
  const params: any[] = [];
  let paramCount = 0;

  if (updates.name !== undefined) {
    paramCount++;
    setClauses.push(`name = $${paramCount}`);
    params.push(updates.name);
  }

  if (updates.threshold !== undefined) {
    paramCount++;
    setClauses.push(`threshold = $${paramCount}`);
    params.push(updates.threshold);
  }

  if (updates.enabled !== undefined) {
    paramCount++;
    setClauses.push(`enabled = $${paramCount}`);
    params.push(updates.enabled);
  }

  if (updates.notification_channels !== undefined) {
    paramCount++;
    setClauses.push(`notification_channels = $${paramCount}`);
    params.push(JSON.stringify(updates.notification_channels));
  }

  if (setClauses.length === 0) {
    return getAlertRule(id);
  }

  paramCount++;
  setClauses.push(`updated_at = $${paramCount}`);
  params.push(new Date());

  paramCount++;
  params.push(id);

  const query = `
    UPDATE alert_rules
    SET ${setClauses.join(', ')}
    WHERE id = $${paramCount}
    RETURNING *
  `;

  const result = await pool.query(query, params);
  return result.rows.length > 0 ? mapAlertRule(result.rows[0]) : null;
}

export async function deleteAlertRule(id: string): Promise<boolean> {
  const result = await pool.query('DELETE FROM alert_rules WHERE id = $1', [id]);
  return result.rowCount !== null && result.rowCount > 0;
}

export async function createAlertNotification(
  alertRuleId: string,
  metricValue: number,
  threshold: number,
  message: string
): Promise<AlertNotification> {
  const id = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const now = new Date();

  const result = await pool.query(
    `INSERT INTO alert_notifications (
      id, alert_rule_id, triggered_at, metric_value, threshold, message, acknowledged
    ) VALUES ($1, $2, $3, $4, $5, $6, false)
    RETURNING *`,
    [id, alertRuleId, now, metricValue, threshold, message]
  );

  return mapAlertNotification(result.rows[0]);
}

export async function listAlertNotifications(
  alertRuleId?: string,
  acknowledged?: boolean,
  limit: number = 50
): Promise<AlertNotification[]> {
  let query = 'SELECT * FROM alert_notifications WHERE 1=1';
  const params: any[] = [];
  let paramCount = 0;

  if (alertRuleId) {
    paramCount++;
    query += ` AND alert_rule_id = $${paramCount}`;
    params.push(alertRuleId);
  }

  if (acknowledged !== undefined) {
    paramCount++;
    query += ` AND acknowledged = $${paramCount}`;
    params.push(acknowledged);
  }

  query += ` ORDER BY triggered_at DESC LIMIT $${paramCount + 1}`;
  params.push(limit);

  const result = await pool.query(query, params);
  return result.rows.map(mapAlertNotification);
}

export async function acknowledgeAlert(id: string, acknowledgedBy: string): Promise<AlertNotification | null> {
  const result = await pool.query(
    `UPDATE alert_notifications
     SET acknowledged = true, acknowledged_at = $1, acknowledged_by = $2
     WHERE id = $3
     RETURNING *`,
    [new Date(), acknowledgedBy, id]
  );

  return result.rows.length > 0 ? mapAlertNotification(result.rows[0]) : null;
}

function mapAlertRule(row: any): AlertRule {
  return {
    id: row.id,
    name: row.name,
    service_id: row.service_id,
    environment: row.environment,
    metric_type: row.metric_type,
    condition: row.condition,
    threshold: parseFloat(row.threshold),
    window_minutes: parseInt(row.window_minutes, 10),
    notification_channels: row.notification_channels,
    enabled: row.enabled,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapAlertNotification(row: any): AlertNotification {
  return {
    id: row.id,
    alert_rule_id: row.alert_rule_id,
    triggered_at: row.triggered_at,
    metric_value: parseFloat(row.metric_value),
    threshold: parseFloat(row.threshold),
    message: row.message,
    acknowledged: row.acknowledged,
    acknowledged_at: row.acknowledged_at,
    acknowledged_by: row.acknowledged_by,
  };
}
