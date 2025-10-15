import { Router } from 'express';
import { createIngestRouter } from './ingest';
import { createServicesRouter } from './services';
import { createMetricsRouter } from './metrics';
import { createAuthRouter } from './auth';
import { createBillingRouter } from './billing';
import { createWebhooksRouter } from './webhooks';
import { createApiKeysRouter } from './api-keys';
import errorsRouter from './errors';
import performanceRouter from './performance';
import breadcrumbsRouter from './breadcrumbs';
import healthRouter from './health';
import alertsRouter from './alerts';

/**
 * Main API router
 */
export const createApiRouter = (): Router => {
  const router = Router();

  // Health check endpoint
  router.get('/health', (_req, res) => {
    return res.json({
      status: 'ok',
      version: '1.0.0',
      schemaVersion: '1.0.0',
      timestamp: new Date().toISOString(),
    });
  });

  // Register routes
  router.use('/auth', createAuthRouter());
  router.use('/billing', createBillingRouter());
  router.use('/webhooks', createWebhooksRouter());
  router.use('/ingest', createIngestRouter());
  router.use('/services', createServicesRouter());
  router.use('/metrics', createMetricsRouter());
  router.use('/api-keys', createApiKeysRouter());
  router.use('/errors', errorsRouter);
  router.use('/performance', performanceRouter);
  router.use('/breadcrumbs', breadcrumbsRouter);
  router.use('/health', healthRouter);
  router.use('/alerts', alertsRouter);

  // TODO: Register additional routes
  // router.use('/graph', graphRouter);
  // router.use('/routes', routesRouter);
  // router.use('/dependencies', dependenciesRouter);

  return router;
};
