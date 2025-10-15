/**
 * Health Routes - API endpoints for service health monitoring
 */

import { Router } from 'express';
import {
  getServiceHealth,
  getHealthTimeseries,
  getSystemOverview,
} from '../services/health-service';
import { cacheMiddleware } from '../lib/cache';

const router = Router();

router.get('/services', cacheMiddleware(30), async (req, res) => {
  try {
    const { service_id, environment } = req.query;

    const health = await getServiceHealth(
      service_id as string | undefined,
      environment as string | undefined
    );

    return res.json({ services: health, count: health.length });
  } catch (error) {
    console.error('Failed to get service health:', error);
    return res.status(500).json({ error: 'internal_error', message: 'Failed to retrieve health data' });
  }
});

router.get('/services/:service_id/timeseries', async (req, res) => {
  try {
    const { service_id } = req.params;
    const { environment, start_time, end_time, interval = '5m' } = req.query;

    if (!start_time || !end_time) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'start_time and end_time are required',
      });
    }

    const data = await getHealthTimeseries(
      service_id,
      environment as string | undefined,
      new Date(start_time as string),
      new Date(end_time as string),
      interval as '1m' | '5m' | '10m' | '1h' | '1d'
    );

    return res.json(data);
  } catch (error) {
    console.error('Failed to get health timeseries:', error);
    return res.status(500).json({ error: 'internal_error', message: 'Failed to retrieve timeseries data' });
  }
});

router.get('/overview', cacheMiddleware(10), async (_req, res) => {
  try {
    const overview = await getSystemOverview();
    return res.json(overview);
  } catch (error) {
    console.error('Failed to get system overview:', error);
    return res.status(500).json({ error: 'internal_error', message: 'Failed to retrieve overview data' });
  }
});

export default router;
