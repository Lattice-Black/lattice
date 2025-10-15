import { Router, Request, Response } from 'express';
import { authenticateSupabase, AuthenticatedRequest } from '../middleware/auth';
import { PaymentService } from '../services/payment-service';
import { SubscriptionService } from '../services/subscription-service';
import { getTierLimits } from '../lib/tiers';

type PaidTier = 'basic' | 'pro' | 'enterprise';

/**
 * Billing and payment routes
 */
export const createBillingRouter = (): Router => {
  const router = Router();
  const paymentService = new PaymentService();
  const subscriptionService = new SubscriptionService();

  /**
   * POST /billing/checkout - Create a checkout session
   */
  router.post(
    '/checkout',
    authenticateSupabase,
    async (req: Request, res: Response) => {
      try {
        const authReq = req as AuthenticatedRequest;
        const { tier, successUrl, cancelUrl } = req.body;

        if (!authReq.user) {
          res.status(401).json({
            error: 'Unauthorized',
            message: 'User not authenticated',
          });
          return;
        }

        if (!tier || !successUrl || !cancelUrl) {
          res.status(400).json({
            error: 'Bad Request',
            message: 'tier, successUrl, and cancelUrl are required',
          });
          return;
        }

        if (!['basic', 'pro', 'enterprise'].includes(tier)) {
          res.status(400).json({
            error: 'Bad Request',
            message: 'Invalid tier. Must be basic, pro, or enterprise',
          });
          return;
        }

        const checkoutUrl = await paymentService.createCheckoutSession(
          authReq.user.id,
          tier as PaidTier,
          successUrl,
          cancelUrl
        );

        return res.json({
          url: checkoutUrl,
        });
      } catch (error) {
        console.error('Checkout error:', error);
        return res.status(500).json({
          error: 'Internal Server Error',
          message:
            error instanceof Error ? error.message : 'Failed to create checkout session',
        });
      }
    }
  );

  /**
   * POST /billing/portal - Create a billing portal session
   */
  router.post(
    '/portal',
    authenticateSupabase,
    async (req: Request, res: Response) => {
      try {
        const authReq = req as AuthenticatedRequest;
        const { returnUrl } = req.body;

        if (!authReq.user) {
          res.status(401).json({
            error: 'Unauthorized',
            message: 'User not authenticated',
          });
          return;
        }

        if (!returnUrl) {
          res.status(400).json({
            error: 'Bad Request',
            message: 'returnUrl is required',
          });
          return;
        }

        const portalUrl = await paymentService.createBillingPortalSession(
          authReq.user.id,
          returnUrl
        );

        return res.json({
          url: portalUrl,
        });
      } catch (error) {
        console.error('Billing portal error:', error);
        return res.status(500).json({
          error: 'Internal Server Error',
          message:
            error instanceof Error ? error.message : 'Failed to create portal session',
        });
      }
    }
  );

  /**
   * GET /billing/subscription - Get current subscription status with usage
   */
  router.get(
    '/subscription',
    authenticateSupabase,
    async (req: Request, res: Response) => {
      try {
        const authReq = req as AuthenticatedRequest;

        if (!authReq.user) {
          res.status(401).json({
            error: 'Unauthorized',
            message: 'User not authenticated',
          });
          return;
        }

        // Get subscription info
        const subscription = await subscriptionService.getUserSubscription(
          authReq.user.id
        );

        // Get usage stats
        const serviceCount = await subscriptionService.getUserServiceCount(
          authReq.user.id
        );

        // Get tier limits
        const tier = subscription?.tier || 'free';
        const limits = getTierLimits(tier);

        return res.json({
          ...subscription,
          tier,
          usage: {
            services: {
              current: serviceCount,
              limit: limits.maxServices,
              unlimited: limits.maxServices === Infinity,
            },
          },
          features: {
            advancedMetrics: limits.advancedMetrics,
            realTimeMonitoring: limits.realTimeMonitoring,
            customIntegrations: limits.customIntegrations,
            advancedAnalytics: limits.advancedAnalytics,
            customSLA: limits.customSLA,
            onPremiseDeployment: limits.onPremiseDeployment,
          },
        });
      } catch (error) {
        console.error('Get subscription error:', error);
        return res.status(500).json({
          error: 'Internal Server Error',
          message: 'Failed to get subscription status',
        });
      }
    }
  );

  /**
   * POST /billing/cancel - Cancel current subscription
   */
  router.post(
    '/cancel',
    authenticateSupabase,
    async (req: Request, res: Response) => {
      try {
        const authReq = req as AuthenticatedRequest;

        if (!authReq.user) {
          res.status(401).json({
            error: 'Unauthorized',
            message: 'User not authenticated',
          });
          return;
        }

        await paymentService.cancelSubscription(authReq.user.id);

        return res.json({
          message: 'Subscription cancelled successfully',
        });
      } catch (error) {
        console.error('Cancel subscription error:', error);
        return res.status(500).json({
          error: 'Internal Server Error',
          message:
            error instanceof Error ? error.message : 'Failed to cancel subscription',
        });
      }
    }
  );

  return router;
};
