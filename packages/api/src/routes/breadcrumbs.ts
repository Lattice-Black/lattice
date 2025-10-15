/**
 * Breadcrumbs Routes - API endpoints for breadcrumb ingestion and retrieval
 */

import { Router } from 'express';
import {
  storeBreadcrumbs,
  getBreadcrumbsBySession,
  getBreadcrumbsByTimeRange,
} from '../services/breadcrumb-service';

const router = Router();

router.post('/', async (req, res) => {
  try {
    const { breadcrumbs } = req.body;

    if (!Array.isArray(breadcrumbs)) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'breadcrumbs must be an array',
      });
    }

    // Validate each breadcrumb
    for (const breadcrumb of breadcrumbs) {
      if (!breadcrumb.session_id || !breadcrumb.category || !breadcrumb.message || !breadcrumb.level) {
        return res.status(400).json({
          error: 'validation_error',
          message: 'Each breadcrumb must have session_id, category, message, and level',
        });
      }
    }

    const result = await storeBreadcrumbs(breadcrumbs);
    return res.status(201).json(result);
  } catch (error) {
    console.error('Breadcrumb ingestion failed:', error);
    return res.status(500).json({ error: 'internal_error', message: 'Failed to ingest breadcrumbs' });
  }
});

router.get('/session/:session_id', async (req, res) => {
  try {
    const { session_id } = req.params;
    const limit = req.query["limit"] ? parseInt(req.query["limit"] as string, 10) : 100;

    const breadcrumbs = await getBreadcrumbsBySession(session_id, limit);
    return res.json({ breadcrumbs, count: breadcrumbs.length });
  } catch (error) {
    console.error('Failed to retrieve breadcrumbs:', error);
    return res.status(500).json({ error: 'internal_error', message: 'Failed to retrieve breadcrumbs' });
  }
});

router.get('/', async (req, res) => {
  try {
    const { start_time, end_time, session_id, limit } = req.query;

    if (!start_time || !end_time) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'start_time and end_time are required',
      });
    }

    const breadcrumbs = await getBreadcrumbsByTimeRange(
      new Date(start_time as string),
      new Date(end_time as string),
      session_id as string | undefined,
      limit ? parseInt(limit as string, 10) : 1000
    );

    return res.json({ breadcrumbs, count: breadcrumbs.length });
  } catch (error) {
    console.error('Failed to retrieve breadcrumbs:', error);
    return res.status(500).json({ error: 'internal_error', message: 'Failed to retrieve breadcrumbs' });
  }
});

export default router;
