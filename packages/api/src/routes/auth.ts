import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase';
import { authenticateSupabase, AuthenticatedRequest } from '../middleware/auth';
import { pool } from '../lib/db';

/**
 * Auth routes for user authentication
 */
export const createAuthRouter = (): Router => {
  const router = Router();

  /**
   * POST /auth/signup - Register a new user
   */
  router.post('/signup', async (req: Request, res: Response) => {
    try {
      const { email, password, fullName } = req.body;

      if (!email || !password) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Email and password are required',
        });
        return;
      }

      // Create user in Supabase Auth
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });

      if (error) {
        res.status(400).json({
          error: 'Signup Failed',
          message: error.message,
        });
        return;
      }

      if (!data.user) {
        return res.status(500).json({
          error: 'Internal Server Error',
          message: 'Failed to create user',
        });
        return;
      }

      // Create profile in database
      await pool.query(
        `INSERT INTO profiles (id, email, full_name)
         VALUES ($1, $2, $3)
         ON CONFLICT (id) DO NOTHING`,
        [data.user.id, email, fullName || null]
      );

      return res.status(201).json({
        user: {
          id: data.user.id,
          email: data.user.email,
          fullName,
        },
        session: data.session,
      });
    } catch (error) {
      console.error('Signup error:', error);
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to create user',
      });
    }
  });

  /**
   * POST /auth/login - Login with email and password
   */
  router.post('/login', async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Email and password are required',
        });
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        res.status(401).json({
          error: 'Authentication Failed',
          message: error.message,
        });
        return;
      }

      return res.json({
        user: {
          id: data.user.id,
          email: data.user.email,
        },
        session: data.session,
      });
    } catch (error) {
      console.error('Login error:', error);
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to authenticate',
      });
    }
  });

  /**
   * POST /auth/logout - Logout current user
   */
  router.post('/logout', authenticateSupabase, async (_req: Request, res: Response) => {
    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        return res.status(500).json({
          error: 'Logout Failed',
          message: error.message,
        });
        return;
      }

      return res.json({
        message: 'Successfully logged out',
      });
    } catch (error) {
      console.error('Logout error:', error);
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to logout',
      });
    }
  });

  /**
   * GET /auth/me - Get current user info
   */
  router.get('/me', authenticateSupabase, async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthenticatedRequest;

      if (!authReq.user) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'No user found',
        });
        return;
      }

      // Get full profile from database
      const result = await pool.query(
        'SELECT id, email, full_name, created_at, updated_at FROM profiles WHERE id = $1',
        [authReq.user.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'User profile not found',
        });
        return;
      }

      return res.json({
        user: result.rows[0],
      });
    } catch (error) {
      console.error('Get user error:', error);
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to get user info',
      });
    }
  });

  /**
   * POST /auth/refresh - Refresh access token
   */
  router.post('/refresh', async (req: Request, res: Response) => {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Refresh token is required',
        });
        return;
      }

      const { data, error } = await supabase.auth.refreshSession({
        refresh_token: refreshToken,
      });

      if (error) {
        res.status(401).json({
          error: 'Refresh Failed',
          message: error.message,
        });
        return;
      }

      return res.json({
        session: data.session,
      });
    } catch (error) {
      console.error('Refresh error:', error);
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to refresh token',
      });
    }
  });

  return router;
};
