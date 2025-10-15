/**
 * Error Routes - API endpoints for error ingestion and querying
 */

import { Router } from 'express';
import {
  storeError,
  listErrors,
  getErrorById,
  updateErrorStatus,
  getErrorStats,
} from '../services/error-service';
import { sanitizeError } from '../lib/error-sanitizer';
import type { ErrorEventInput } from '../services/error-service';

const router = Router();

/**
 * POST /errors - Ingest error event
 */
router.post('/', async (req, res) => {
  try {
    const input: ErrorEventInput = req.body;

    // Validate required fields
    if (!input.service_id || !input.environment || !input.error_type || !input.message) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Missing required fields: service_id, environment, error_type, message',
      });
    }

    if (!input.stack_trace || !Array.isArray(input.stack_trace) || input.stack_trace.length === 0) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'stack_trace must be a non-empty array',
      });
    }

    // Sanitize error before storage
    const sanitized = sanitizeError({
      message: input.message,
      stack: input.raw_stack,
      context: input.context,
    });

    const sanitizedInput: ErrorEventInput = {
      ...input,
      message: sanitized.message,
      raw_stack: sanitized.stack,
      context: sanitized.context,
    };

    const result = await storeError(sanitizedInput);

    return res.status(201).json(result);
  } catch (error) {
    console.error('Error ingestion failed:', error);
    return res.status(500).json({
      error: 'internal_error',
      message: 'Failed to ingest error event',
    });
  }
});

/**
 * GET /errors - List error events with filtering
 */
router.get('/', async (req, res) => {
  try {
    const {
      service_id,
      environment,
      error_type,
      resolved,
      search,
      start_time,
      end_time,
      limit,
      offset,
      sort: _sort = 'timestamp_desc',
    } = req.query;

    const filters = {
      service_id: service_id as string | undefined,
      environment: environment as string | undefined,
      error_type: error_type as string | undefined,
      resolved: resolved ? resolved === 'true' : undefined,
      search: search as string | undefined,
      start_time: start_time ? new Date(start_time as string) : undefined,
      end_time: end_time ? new Date(end_time as string) : undefined,
      limit: limit ? parseInt(limit as string, 10) : 50,
      offset: offset ? parseInt(offset as string, 10) : 0,
    };

    const result = await listErrors(filters);

    return res.json(result);
  } catch (error) {
    console.error('Error listing failed:', error);
    return res.status(500).json({
      error: 'internal_error',
      message: 'Failed to list errors',
    });
  }
});

/**
 * GET /errors/:id - Get error details
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const error = await getErrorById(id);

    if (!error) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Error not found',
      });
    }

    return res.json(error);
  } catch (error) {
    console.error('Error retrieval failed:', error);
    return res.status(500).json({
      error: 'internal_error',
      message: 'Failed to retrieve error',
    });
  }
});

/**
 * PATCH /errors/:id - Update error status
 */
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { resolved, ignored } = req.body;

    const updates: { resolved?: boolean; ignored?: boolean } = {};

    if (resolved !== undefined) {
      updates.resolved = Boolean(resolved);
    }

    if (ignored !== undefined) {
      updates.ignored = Boolean(ignored);
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'No valid updates provided',
      });
    }

    const result = await updateErrorStatus(id, updates);

    if (!result) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Error not found',
      });
    }

    return res.json(result);
  } catch (error) {
    console.error('Error update failed:', error);
    return res.status(500).json({
      error: 'internal_error',
      message: 'Failed to update error',
    });
  }
});

/**
 * GET /errors/stats - Get error statistics for time-series visualization
 */
router.get('/stats', async (req, res) => {
  try {
    const {
      service_id,
      environment,
      start_time,
      end_time,
      interval = '5m',
    } = req.query;

    if (!start_time || !end_time) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'start_time and end_time are required',
      });
    }

    const validIntervals = ['1m', '5m', '10m', '1h', '1d'];
    if (!validIntervals.includes(interval as string)) {
      return res.status(400).json({
        error: 'validation_error',
        message: `interval must be one of: ${validIntervals.join(', ')}`,
      });
    }

    const result = await getErrorStats(
      service_id as string | undefined,
      environment as string | undefined,
      new Date(start_time as string),
      new Date(end_time as string),
      interval as '1m' | '5m' | '10m' | '1h' | '1d'
    );

    return res.json(result);
  } catch (error) {
    console.error('Error stats failed:', error);
    return res.status(500).json({
      error: 'internal_error',
      message: 'Failed to retrieve error statistics',
    });
  }
});

export default router;
