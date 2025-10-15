import { Router, Response } from 'express';
import { authenticateSupabase, AuthenticatedRequest } from '../middleware/auth';
import { supabase } from '../lib/supabase';
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
 * All routes require Supabase JWT authentication
 */
export const createApiKeysRouter = (): Router => {
  const router = Router();

  /**
   * GET /api-keys
   * Get current API key (masked) for authenticated user
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

      // Get the most recent API key for the user
      const { data: apiKey, error } = await supabase
        .from('api_keys')
        .select('id, name, created_at, last_used')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 is "no rows returned" error, which is fine
        console.error('Get API key error:', error);
        return res.status(500).json({
          error: 'Internal Server Error',
          message: 'Failed to retrieve API key',
        });
        return;
      }

      if (!apiKey) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'No API key found. Please generate one.',
          hasKey: false,
        });
        return;
      }

      // Return masked key info (we don't store the plain key, so we can't return it)
      return res.json({
        id: apiKey.id,
        name: apiKey.name,
        createdAt: apiKey.created_at,
        lastUsed: apiKey.last_used,
        hasKey: true,
        // Note: We can't show the actual key as we only store the hash
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
  router.post('/refresh', authenticateSupabase, async (req: AuthenticatedRequest, res: Response) => {
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
      const { error: deleteError } = await supabase
        .from('api_keys')
        .delete()
        .eq('user_id', userId);

      if (deleteError) {
        console.error('Delete old API keys error:', deleteError);
        // Continue anyway - we still want to create the new key
      }

      // Create new API key record
      const { data: newKeyRecord, error: createError } = await supabase
        .from('api_keys')
        .insert({
          user_id: userId,
          key_hash: keyHash,
          name: 'Default API Key',
        })
        .select('id, name, created_at')
        .single();

      if (createError || !newKeyRecord) {
        console.error('Create API key error:', createError);
        return res.status(500).json({
          error: 'Internal Server Error',
          message: 'Failed to create new API key',
        });
        return;
      }

      // Return the new API key (this is the ONLY time it's visible)
      return res.json({
        apiKey: newApiKey,
        maskedKey: maskApiKey(newApiKey),
        id: newKeyRecord.id,
        name: newKeyRecord.name,
        createdAt: newKeyRecord.created_at,
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
