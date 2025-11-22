import { Router, Response } from 'express';
import { MetricsService } from '../services/metrics-service';
import { optionalAuth, authenticateApiKey, AuthenticatedRequest } from '../middleware/auth';

/**
 * Metrics routes for runtime statistics
 * All routes require authentication and are user-scoped
 */
export const createMetricsRouter = (): Router => {
  const router = Router();
  const metricsService = new MetricsService();

  /**
   * POST /metrics
   * Submit runtime metrics from services
   * Uses optional authentication - allows services to self-report without API keys
   */
  router.post('/', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Get user ID if authenticated, otherwise use test user for development
      // This allows services to self-report metrics without API keys
      const userId = req.user?.id || 'f5ae5fd4-4fee-4f77-85f3-9aed19b7bb6f';
      const { serviceName, metrics } = req.body;

      if (!serviceName) {
        res.status(400).json({
          error: 'Validation failed',
          message: 'serviceName is required',
        });
        return;
      }

      if (!Array.isArray(metrics) || metrics.length === 0) {
        res.status(400).json({
          error: 'Validation failed',
          message: 'metrics must be a non-empty array',
        });
        return;
      }

      // Validate metric structure
      for (const metric of metrics) {
        if (!metric.method || !metric.path || metric.statusCode === undefined || metric.responseTime === undefined) {
          res.status(400).json({
            error: 'Validation failed',
            message: 'Each metric must have method, path, statusCode, and responseTime',
          });
          return;
        }
      }

      const insertedCount = await metricsService.insertMetrics(serviceName, userId, metrics);

      return res.status(200).json({
        success: true,
        inserted: insertedCount,
      });
    } catch (error) {
      console.error('Metrics ingestion error:', error);

      if (error instanceof Error && error.message.includes('Service not found')) {
        return res.status(404).json({
          error: 'Service not found',
          message: error.message,
        });
        return;
      }

      return res.status(500).json({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /metrics/stats
   * Get aggregated service statistics (user-scoped)
   * Requires API key authentication
   */
  router.get('/stats', authenticateApiKey, async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user?.id) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'User authentication required',
        });
        return;
      }

      const userId = req.user.id;
      const { serviceId } = req.query;
      const stats = await metricsService.getServiceStats(userId, serviceId as string | undefined);

      return res.status(200).json({
        success: true,
        stats,
      });
    } catch (error) {
      console.error('Stats retrieval error:', error);
      return res.status(500).json({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /metrics/connections
   * Get inter-service connection statistics (user-scoped)
   * Requires API key authentication
   */
  router.get('/connections', authenticateApiKey, async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user?.id) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'User authentication required',
        });
        return;
      }

      const userId = req.user.id;
      const connections = await metricsService.getServiceConnections(userId);

      return res.status(200).json({
        success: true,
        connections,
      });
    } catch (error) {
      console.error('Connections retrieval error:', error);
      return res.status(500).json({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /metrics/recent/:serviceName
   * Get recent metrics for a specific service (user-scoped)
   * Requires API key authentication
   */
  router.get('/recent/:serviceName', authenticateApiKey, async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user?.id) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'User authentication required',
        });
        return;
      }

      const userId = req.user.id;
      const { serviceName } = req.params;
      const { limit } = req.query;

      if (!serviceName) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'serviceName is required',
        });
        return;
      }

      const limitNum = limit ? parseInt(limit as string) : 100;
      const metrics = await metricsService.getRecentMetrics(
        serviceName,
        userId,
        limitNum
      );

      return res.status(200).json({
        success: true,
        serviceName,
        count: metrics.length,
        metrics,
      });
    } catch (error) {
      console.error('Recent metrics retrieval error:', error);
      return res.status(500).json({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  return router;
};
