import { Request, Response, NextFunction } from 'express';
import { HTTP_HEADERS } from '@lattice.black/core';
import { prisma } from '../lib/prisma';
import { createHash } from 'crypto';

/**
 * Extended request type with user information
 */
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string;
    [key: string]: unknown;
  };
  authenticated?: boolean;
}

/**
 * Hash API key for secure comparison
 */
const hashApiKey = (key: string): string => {
  return createHash('sha256').update(key).digest('hex');
};

/**
 * API key authentication middleware
 * Looks up API key in database using Prisma and attaches user to request
 */
export const authenticateApiKey = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const apiKey = req.header(HTTP_HEADERS.API_KEY);

  if (!apiKey) {
    res.status(401).json({
      error: 'Unauthorized',
      message: `Missing ${HTTP_HEADERS.API_KEY} header`,
    });
    return;
  }

  try {
    // Hash the provided API key
    const keyHash = hashApiKey(apiKey);

    // Look up API key in database using Prisma
    const apiKeyRecord = await prisma.apiKey.findUnique({
      where: { keyHash },
      select: { id: true, userId: true },
    });

    if (!apiKeyRecord) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid API key',
      });
      return;
    }

    // Update last_used timestamp asynchronously (don't wait for it)
    void prisma.apiKey.update({
      where: { id: apiKeyRecord.id },
      data: { lastUsed: new Date() },
    }).catch((error) => {
      console.error('Failed to update API key last_used:', error);
    });

    // Attach user to request
    (req as AuthenticatedRequest).user = {
      id: apiKeyRecord.userId,
    };
    (req as AuthenticatedRequest).authenticated = true;

    next();
  } catch (error) {
    console.error('API key authentication error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to authenticate API key',
    });
  }
};

/**
 * Optional authentication - doesn't reject requests without auth
 */
export const optionalAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  const apiKey = req.header(HTTP_HEADERS.API_KEY);

  if (apiKey) {
    try {
      const keyHash = hashApiKey(apiKey);
      const apiKeyRecord = await prisma.apiKey.findUnique({
        where: { keyHash },
        select: { userId: true },
      });

      if (apiKeyRecord) {
        (req as AuthenticatedRequest).user = {
          id: apiKeyRecord.userId,
        };
        (req as AuthenticatedRequest).authenticated = true;
      }
    } catch {
      // Silently fail for optional auth
    }
  }

  next();
};
