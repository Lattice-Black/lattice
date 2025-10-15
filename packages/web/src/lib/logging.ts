import pino, { Logger } from 'pino'

let logger: Logger | null = null

interface LoggerConfig {
  level: string
  service: string
  environment: string
}

/**
 * Initialize global logger instance
 * - Must be called in instrumentation.ts BEFORE any other code
 * - Only works in Node.js runtime
 */
export function initLogger(config: LoggerConfig): Logger {
  if (logger) {
    return logger // Already initialized
  }

  logger = pino({
    level: config.level,
    base: {
      service: config.service,
      env: config.environment,
    },
    // Don't use pino-pretty in Next.js - it causes worker thread issues
    // Regular JSON output is fine for development
    // Format timestamps in ISO format
    timestamp: () => `,"time":"${new Date().toISOString()}"`,
  })

  return logger
}

/**
 * Get logger instance (safe - returns console-compatible object if not initialized)
 */
export function getLogger(): Logger {
  if (!logger) {
    // Fallback to console if logger not initialized
    // Cast to Logger type for TypeScript compatibility
    return console as unknown as Logger
  }
  return logger
}

/**
 * Log error with full context
 */
export function logError(context: {
  error: Error
  digest?: string
  path?: string
  method?: string
  [key: string]: unknown
}): void {
  const log = getLogger()

  log.error({
    msg: context.error.message,
    stack: context.error.stack,
    digest: context.digest,
    path: context.path,
    method: context.method,
  })
}
