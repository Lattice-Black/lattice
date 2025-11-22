import { Router, Request, Response } from 'express';
import { authenticateApiKey, AuthenticatedRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';

/**
 * Auth routes for user info
 * Authentication is handled by Auth.js in the web app
 * This router provides API key-authenticated endpoints only
 */
export const createAuthRouter = (): Router => {
  const router = Router();

  /**
   * GET /auth/me - Get current user info
   * Requires API key authentication
   */
  router.get('/me', authenticateApiKey, async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthenticatedRequest;

      if (!authReq.user?.id) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'No user found',
        });
        return;
      }

      // Get user from database
      const user = await prisma.user.findUnique({
        where: { id: authReq.user.id },
        select: {
          id: true,
          email: true,
          name: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!user) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'User not found',
        });
      }

      return res.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          createdAt: user.createdAt.toISOString(),
          updatedAt: user.updatedAt.toISOString(),
        },
      });
    } catch (error) {
      console.error('Get user error:', error);
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to get user info',
      });
    }
  });

  return router;
};
