import { Router, Response } from 'express';
import { MetadataService } from '../services/metadata-service';
import { MetricsService } from '../services/metrics-service';
import { authenticateSupabase, AuthenticatedRequest } from '../middleware/auth';

/**
 * Service query routes for dashboard
 * All routes require authentication and filter by user_id
 */
export const createServicesRouter = (): Router => {
  const router = Router();
  const metadataService = new MetadataService();
  const metricsService = new MetricsService();

  /**
   * GET /services
   * List all services with optional filtering (user-scoped)
   * Requires Supabase JWT authentication
   */
  router.get('/', authenticateSupabase, async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user?.id) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'User authentication required',
        });
        return;
      }

      const userId = req.user.id;
      const { status, environment, framework, limit, offset } = req.query;

      const parsedLimit = limit ? parseInt(limit as string, 10) : undefined;
      const parsedOffset = offset ? parseInt(offset as string, 10) : undefined;

      const result = await metadataService.listServices(userId, {
        status: status as string | undefined,
        environment: environment as string | undefined,
        framework: framework as string | undefined,
        limit: parsedLimit,
        offset: parsedOffset,
      });

      return res.json({
        services: result.services,
        total: result.total,
        limit: parsedLimit || 50,
        offset: parsedOffset || 0,
      });
    } catch (error) {
      console.error('List services error:', error);
      return res.status(500).json({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /services/:id
   * Get service details by ID or name (user-scoped)
   * Requires Supabase JWT authentication
   */
  router.get('/:id', authenticateSupabase, async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user?.id) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'User authentication required',
        });
        return;
      }

      const userId = req.user.id;
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Service ID is required',
        });
        return;
      }

      // Try to find by ID first, then by name (both user-scoped)
      let service = await metadataService.getServiceById(id, userId);

      if (!service) {
        service = await metadataService.getServiceByName(id, userId);
      }

      if (!service) {
        return res.status(404).json({
          error: 'Not Found',
          message: `Service "${id}" not found`,
        });
        return;
      }

      return res.json(service);
    } catch (error) {
      console.error('Get service error:', error);
      return res.status(500).json({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /services/:id/metrics
   * Get metrics for a specific service (user-scoped)
   * Requires Supabase JWT authentication
   */
  router.get('/:id/metrics', authenticateSupabase, async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user?.id) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'User authentication required',
        });
        return;
      }

      const userId = req.user.id;
      const { id } = req.params;
      const { limit, offset } = req.query;

      if (!id) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Service ID is required',
        });
        return;
      }

      const parsedLimit = limit ? parseInt(limit as string, 10) : 100;
      const parsedOffset = offset ? parseInt(offset as string, 10) : 0;

      // Verify service exists and belongs to user
      let service = await metadataService.getServiceById(id, userId);
      if (!service) {
        service = await metadataService.getServiceByName(id, userId);
      }

      if (!service) {
        return res.status(404).json({
          error: 'Not Found',
          message: `Service "${id}" not found`,
        });
        return;
      }

      const result = await metricsService.getServiceMetrics(service.id, userId, {
        limit: parsedLimit,
        offset: parsedOffset,
      });

      return res.json({
        metrics: result.metrics,
        stats: result.stats,
        total: result.total,
        limit: parsedLimit,
        offset: parsedOffset,
      });
    } catch (error) {
      console.error('Get service metrics error:', error);
      return res.status(500).json({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  return router;
};
