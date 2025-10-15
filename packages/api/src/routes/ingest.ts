import { Router, Response } from 'express';
import { schemaValidator } from '@lattice.black/core';
import { MetadataService } from '../services/metadata-service';
import { RouteService } from '../services/route-service';
import { DependencyService } from '../services/dependency-service';
import { SubscriptionService } from '../services/subscription-service';
import { optionalAuth, AuthenticatedRequest } from '../middleware/auth';

/**
 * Ingestion routes for plugin metadata submission
 */
export const createIngestRouter = (): Router => {
  const router = Router();
  const metadataService = new MetadataService();
  const routeService = new RouteService();
  const dependencyService = new DependencyService();
  const subscriptionService = new SubscriptionService();

  /**
   * POST /ingest/metadata
   * Submit service metadata from plugins
   * Uses optional authentication - for development, allows unauthenticated requests
   * In production, use authenticateApiKey to enforce multi-tenancy
   */
  router.post('/metadata', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Get user ID if authenticated, otherwise use test user for development
      // TODO: In production, this should be required (use authenticateApiKey middleware)
      const userId = req.user?.id || 'f5ae5fd4-4fee-4f77-85f3-9aed19b7bb6f'; // test@lattice.com user for development

      // Validate request body
      const validationResult = schemaValidator.validateServiceMetadata(req.body);

      if (!validationResult.valid) {
        res.status(400).json({
          error: 'Validation failed',
          message: 'Invalid service metadata format',
          details: validationResult.errors,
        });
        return;
      }

      const { service, routes = [], dependencies = [] } = validationResult.data!;

      // Check if this is a new service (not an update)
      const existingService = await metadataService.getServiceByName(service.name, userId);
      const isNewService = !existingService;

      // If this is a new service, check tier limits
      if (isNewService) {
        const canAdd = await subscriptionService.canUserAddServices(userId, 1);
        if (!canAdd.allowed) {
          res.status(403).json({
            error: 'Service limit exceeded',
            message: canAdd.reason,
            currentCount: canAdd.currentCount,
            maxAllowed: canAdd.maxAllowed,
          });
          return;
        }
      }

      // Upsert service with user association
      const upsertedService = await metadataService.upsertService(service, userId);

      // Upsert routes
      const routesProcessed = await routeService.upsertRoutes(
        upsertedService.id,
        routes
      );

      // Upsert dependencies
      const dependenciesProcessed = await dependencyService.upsertDependencies(
        upsertedService.id,
        dependencies
      );

      // Return success response
      return res.status(200).json({
        success: true,
        serviceId: upsertedService.id,
        routesProcessed,
        dependenciesProcessed,
      });
    } catch (error) {
      console.error('Ingestion error:', error);
      return res.status(500).json({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  return router;
};
