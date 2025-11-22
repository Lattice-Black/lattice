/**
 * Performance Routes - API endpoints for performance trace ingestion and metrics
 */

import { Router } from 'express';
import { storePerformanceTrace, getPerformanceMetrics } from '../services/performance-service';

const router = Router();

/**
 * POST /performance/traces/batch - Batch ingest performance traces
 */
router.post('/traces/batch', async (req, res) => {
  try {
    const { traces } = req.body;

    if (!Array.isArray(traces) || traces.length === 0) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'traces must be a non-empty array',
      });
    }

    const results = [];
    const failures = [];

    for (const trace of traces) {
      try {
        const result = await storePerformanceTrace(trace);
        results.push(result);
      } catch (err) {
        failures.push({ trace, error: (err as Error).message });
      }
    }

    return res.status(201).json({
      success: true,
      processed: results.length,
      failed: failures.length,
      results,
      failures: failures.length > 0 ? failures : undefined,
    });
  } catch (error) {
    console.error('Batch performance trace ingestion failed:', error);
    return res.status(500).json({
      error: 'internal_error',
      message: 'Failed to batch ingest performance traces',
    });
  }
});

/**
 * POST /performance/traces - Ingest single performance trace
 */
router.post('/traces', async (req, res) => {
  try {
    const result = await storePerformanceTrace(req.body);
    return res.status(201).json(result);
  } catch (error) {
    console.error('Performance trace ingestion failed:', error);
    return res.status(500).json({ error: 'internal_error', message: 'Failed to ingest trace' });
  }
});

router.get('/metrics', async (req, res) => {
  try {
    const { service_id, start_time, end_time, interval = '5m' } = req.query;

    if (!start_time || !end_time) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'start_time and end_time are required',
      });
    }

    const result = await getPerformanceMetrics(
      service_id as string | undefined,
      new Date(start_time as string),
      new Date(end_time as string),
      interval as '1m' | '5m' | '10m' | '1h' | '1d'
    );

    return res.json(result);
  } catch (error) {
    console.error('Performance metrics failed:', error);
    return res.status(500).json({ error: 'internal_error', message: 'Failed to retrieve metrics' });
  }
});

export default router;
