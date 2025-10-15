/**
 * Retention Service - Tier-based data retention policies
 */

import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env["DATABASE_URL"],
});

export enum SubscriptionTier {
  Trial = 'trial',
  Free = 'free',
  Paid = 'paid',
  Enterprise = 'enterprise',
}

const RETENTION_POLICIES = {
  [SubscriptionTier.Trial]: 7, // 7 days
  [SubscriptionTier.Free]: 7, // 7 days
  [SubscriptionTier.Paid]: 90, // 90 days
  [SubscriptionTier.Enterprise]: 365, // 1 year
};

export function getRetentionDays(tier: SubscriptionTier): number {
  return RETENTION_POLICIES[tier] || RETENTION_POLICIES[SubscriptionTier.Free];
}

export async function cleanupOldData(tier: SubscriptionTier): Promise<{
  error_events_deleted: number;
  performance_traces_deleted: number;
  breadcrumbs_deleted: number;
}> {
  const retentionDays = getRetentionDays(tier);
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  console.log(`Cleaning up data older than ${cutoffDate.toISOString()} for tier: ${tier}`);

  // Delete old error events
  const errorResult = await pool.query(
    'DELETE FROM error_events WHERE timestamp < $1',
    [cutoffDate]
  );

  // Delete old performance traces
  const perfResult = await pool.query(
    'DELETE FROM performance_traces WHERE timestamp < $1',
    [cutoffDate]
  );

  // Delete old breadcrumbs
  const breadcrumbResult = await pool.query(
    'DELETE FROM breadcrumbs WHERE timestamp < $1',
    [cutoffDate]
  );

  return {
    error_events_deleted: errorResult.rowCount || 0,
    performance_traces_deleted: perfResult.rowCount || 0,
    breadcrumbs_deleted: breadcrumbResult.rowCount || 0,
  };
}

export async function getDataUsageStats() {
  // Get counts for each table
  const errorCount = await pool.query('SELECT COUNT(*) as count FROM error_events');
  const perfCount = await pool.query('SELECT COUNT(*) as count FROM performance_traces');
  const breadcrumbCount = await pool.query('SELECT COUNT(*) as count FROM breadcrumbs');

  // Get oldest and newest timestamps
  const errorRange = await pool.query(`
    SELECT
      MIN(timestamp) as oldest,
      MAX(timestamp) as newest
    FROM error_events
  `);

  const perfRange = await pool.query(`
    SELECT
      MIN(timestamp) as oldest,
      MAX(timestamp) as newest
    FROM performance_traces
  `);

  return {
    error_events: {
      count: parseInt(errorCount.rows[0]?.count || '0', 10),
      oldest: errorRange.rows[0]?.oldest,
      newest: errorRange.rows[0]?.newest,
    },
    performance_traces: {
      count: parseInt(perfCount.rows[0]?.count || '0', 10),
      oldest: perfRange.rows[0]?.oldest,
      newest: perfRange.rows[0]?.newest,
    },
    breadcrumbs: {
      count: parseInt(breadcrumbCount.rows[0]?.count || '0', 10),
    },
  };
}

export async function runRetentionCleanup(): Promise<void> {
  // In a real implementation, you'd look up the subscription tier for each account/organization
  // For now, we'll use a default tier
  const defaultTier = SubscriptionTier.Paid;

  const result = await cleanupOldData(defaultTier);

  console.log('Retention cleanup completed:', result);
}
