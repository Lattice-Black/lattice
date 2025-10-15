import { Router, Request, Response } from 'express';
import { stripe, WEBHOOK_SECRET } from '../lib/stripe';
import { PaymentService } from '../services/payment-service';
import Stripe from 'stripe';

/**
 * Webhook routes for handling external service events
 */
export const createWebhooksRouter = (): Router => {
  const router = Router();
  const paymentService = new PaymentService();

  /**
   * POST /webhooks/stripe - Handle Stripe webhook events
   * Note: This endpoint needs raw body, not JSON parsed
   */
  router.post(
    '/stripe',
    async (req: Request, res: Response) => {
      try {
        if (!stripe) {
          res.status(503).json({
            error: 'Service Unavailable',
            message: 'Stripe is not configured',
          });
          return;
        }

        const signature = req.headers['stripe-signature'];

        if (!signature) {
          res.status(400).json({
            error: 'Bad Request',
            message: 'Missing stripe-signature header',
          });
          return;
        }

        if (!WEBHOOK_SECRET) {
          return res.status(500).json({
            error: 'Internal Server Error',
            message: 'Webhook secret not configured',
          });
          return;
        }

        // Verify webhook signature
        let event: Stripe.Event;
        try {
          event = stripe.webhooks.constructEvent(
            req.body,
            signature,
            WEBHOOK_SECRET
          );
        } catch (err) {
          console.error('Webhook signature verification failed:', err);
          res.status(400).json({
            error: 'Bad Request',
            message: 'Invalid signature',
          });
          return;
        }

        // Handle the event
        switch (event.type) {
          case 'checkout.session.completed': {
            const session = event.data.object as Stripe.Checkout.Session;
            console.log('Checkout session completed:', session.id);

            // Get subscription details
            if (session.subscription) {
              const subscription = await stripe.subscriptions.retrieve(
                session.subscription as string
              );
              const userId = session.metadata?.['userId'];

              if (userId) {
                await paymentService.updateSubscriptionFromWebhook(
                  subscription,
                  userId
                );
              }
            }
            break;
          }

          case 'customer.subscription.updated':
          case 'customer.subscription.created': {
            const subscription = event.data.object as Stripe.Subscription;
            console.log('Subscription updated:', subscription.id);

            // Get user ID from customer metadata
            const customer = await stripe.customers.retrieve(
              subscription.customer as string
            );

            if ('metadata' in customer && customer.metadata?.['userId']) {
              await paymentService.updateSubscriptionFromWebhook(
                subscription,
                customer.metadata['userId']
              );
            }
            break;
          }

          case 'customer.subscription.deleted': {
            const subscription = event.data.object as Stripe.Subscription;
            console.log('Subscription deleted:', subscription.id);

            // Get user ID from customer metadata
            const customer = await stripe.customers.retrieve(
              subscription.customer as string
            );

            if ('metadata' in customer && customer.metadata?.['userId']) {
              await paymentService.updateSubscriptionFromWebhook(
                subscription,
                customer.metadata['userId']
              );
            }
            break;
          }

          case 'invoice.payment_succeeded': {
            const invoice = event.data.object as Stripe.Invoice;
            console.log('Payment succeeded for invoice:', invoice.id);
            break;
          }

          case 'invoice.payment_failed': {
            const invoice = event.data.object as Stripe.Invoice;
            console.log('Payment failed for invoice:', invoice.id);
            // TODO: Send notification to user
            break;
          }

          default:
            console.log(`Unhandled event type: ${event.type}`);
        }

        // Return 200 to acknowledge receipt
        return res.json({ received: true });
      } catch (error) {
        console.error('Webhook error:', error);
        return res.status(500).json({
          error: 'Internal Server Error',
          message: 'Failed to process webhook',
        });
      }
    }
  );

  return router;
};
