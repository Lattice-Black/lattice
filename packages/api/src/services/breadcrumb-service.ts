/**
 * Breadcrumb Service - Handle breadcrumb storage and retrieval
 */

import { pool } from '../lib/db';
import type { Breadcrumb, BreadcrumbCategory, BreadcrumbLevel } from '@lattice.black/core';

export interface BreadcrumbInput {
  session_id: string;
  category: BreadcrumbCategory;
  message: string;
  level: BreadcrumbLevel;
  data?: any;
}

export async function storeBreadcrumbs(breadcrumbs: BreadcrumbInput[]) {
  if (breadcrumbs.length === 0) {
    return { stored: 0 };
  }

  const values: any[] = [];
  const placeholders: string[] = [];

  breadcrumbs.forEach((breadcrumb, index) => {
    const id = `bc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const baseIndex = index * 6;

    placeholders.push(
      `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5}, $${baseIndex + 6}, NOW())`
    );

    values.push(
      id,
      breadcrumb.session_id,
      breadcrumb.category,
      breadcrumb.message,
      breadcrumb.level,
      breadcrumb.data ? JSON.stringify(breadcrumb.data) : null
    );
  });

  const query = `
    INSERT INTO breadcrumbs (
      id, session_id, category, message, level, data, timestamp
    ) VALUES ${placeholders.join(', ')}
  `;

  await pool.query(query, values);

  return { stored: breadcrumbs.length };
}

export async function getBreadcrumbsBySession(
  sessionId: string,
  limit: number = 100
): Promise<Breadcrumb[]> {
  const result = await pool.query(
    `SELECT
      id, session_id, category, message, level, data, timestamp
    FROM breadcrumbs
    WHERE session_id = $1
    ORDER BY timestamp ASC
    LIMIT $2`,
    [sessionId, limit]
  );

  return result.rows.map(row => ({
    id: row.id,
    session_id: row.session_id,
    category: row.category,
    message: row.message,
    level: row.level,
    data: row.data,
    timestamp: row.timestamp,
  }));
}

export async function getBreadcrumbsByTimeRange(
  startTime: Date,
  endTime: Date,
  sessionId?: string,
  limit: number = 1000
): Promise<Breadcrumb[]> {
  let query = `
    SELECT
      id, session_id, category, message, level, data, timestamp
    FROM breadcrumbs
    WHERE timestamp >= $1 AND timestamp <= $2
  `;

  const params: any[] = [startTime, endTime];

  if (sessionId) {
    query += ` AND session_id = $3`;
    params.push(sessionId);
  }

  query += ` ORDER BY timestamp DESC LIMIT $${params.length + 1}`;
  params.push(limit);

  const result = await pool.query(query, params);

  return result.rows.map(row => ({
    id: row.id,
    session_id: row.session_id,
    category: row.category,
    message: row.message,
    level: row.level,
    data: row.data,
    timestamp: row.timestamp,
  }));
}
