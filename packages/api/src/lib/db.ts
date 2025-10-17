import { Pool } from 'pg';

/**
 * PostgreSQL connection pool (connects to Supabase or local PostgreSQL)
 */
export const pool = new Pool({
  connectionString: process.env['DATABASE_URL'],
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  ssl: process.env['DATABASE_URL']?.includes('supabase.com')
    ? { rejectUnauthorized: false }
    : false,
});

/**
 * Handle connection errors
 */
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  // Don't exit in development - just log the error
  if (process.env['NODE_ENV'] === 'production') {
    process.exit(-1);
  }
});

/**
 * Graceful shutdown - only set up once
 */
let isShuttingDown = false;

const gracefulShutdown = async () => {
  if (isShuttingDown) {
    return; // Already shutting down
  }
  isShuttingDown = true;

  try {
    await pool.end();
    console.log('Database pool closed');
  } catch (error) {
    console.error('Error closing database pool:', error);
  }
  process.exit(0);
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);
