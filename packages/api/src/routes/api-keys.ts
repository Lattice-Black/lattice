import { Router, Response } from 'express';
import { authenticateApiKey, AuthenticatedRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { createHash, randomBytes } from 'crypto';

/**
 * Hash API key for secure storage
 */
const hashApiKey = (key: string): string => {
  return createHash('sha256').update(key).digest('hex');
};

/**
 * Generate a new API key with the ltc_ prefix
 */
const generateApiKey = (): string => {
  const randomPart = randomBytes(32).toString('hex');
  return `ltc_${randomPart}`;
};

/**
 * Mask API key for display (show first 8 chars, rest masked)
 */
const maskApiKey = (key: string): string => {
  if (key.length <= 12) return key;
  const visible = key.substring(0, 8);
  const masked = '****...****' + key.substring(key.length - 4);
  return visible + masked;
};

/**
 * API Key management routes
 * All routes require API key authentication
 */
export const createApiKeysRouter = (): Router => {
  const router = Router();

  /**
   * GET /api-keys
   * Get current API key (masked) for authenticated user
   */
  router.get('/', authenticateApiKey, async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user?.id) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'User authentication required',
        });
        return;
      }

      const userId = req.user.id;

      // Get the most recent API key for the user
      const apiKey = await prisma.apiKey.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          createdAt: true,
          lastUsed: true,
        },
      });

      if (!apiKey) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'No API key found. Please generate one.',
          hasKey: false,
        });
      }

      // Return masked key info (we don't store the plain key, so we can't return it)
      return res.json({
        apiKey: {
          id: apiKey.id,
          name: apiKey.name,
          createdAt: apiKey.createdAt.toISOString(),
          lastUsed: apiKey.lastUsed?.toISOString() || null,
          keyPreview: 'ltc_****...****',
        },
        hasKey: true,
        message: 'API key is active. Use the refresh endpoint to generate a new one.',
      });
    } catch (error) {
      console.error('Get API key error:', error);
      return res.status(500).json({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * POST /api-keys/refresh
   * Generate a new API key and revoke the old one
   */
  router.post('/refresh', authenticateApiKey, async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user?.id) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'User authentication required',
        });
        return;
      }

      const userId = req.user.id;

      // Generate new API key
      const newApiKey = generateApiKey();
      const keyHash = hashApiKey(newApiKey);

      // Delete all existing keys for this user (revoke old keys)
      await prisma.apiKey.deleteMany({
        where: { userId },
      });

      // Create new API key record
      const newKeyRecord = await prisma.apiKey.create({
        data: {
          userId,
          keyHash,
          name: 'Default API Key',
        },
        select: {
          id: true,
          name: true,
          createdAt: true,
        },
      });

      // Return the new API key (this is the ONLY time it's visible)
      return res.json({
        apiKey: {
          id: newKeyRecord.id,
          name: newKeyRecord.name,
          key: newApiKey,
          maskedKey: maskApiKey(newApiKey),
          createdAt: newKeyRecord.createdAt.toISOString(),
        },
        message: 'New API key generated successfully. Store it securely - you won\'t be able to see it again.',
      });
    } catch (error) {
      console.error('Refresh API key error:', error);
      return res.status(500).json({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  return router;
};
