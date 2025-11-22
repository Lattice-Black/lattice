/**
 * Safe Wrapper Utilities
 *
 * Following OpenTelemetry and Sentry patterns:
 * - SDK operations should NEVER throw unhandled exceptions
 * - Failed operations return safe fallback values
 * - Errors are logged but don't crash the host application
 */

export type ErrorHandler = (error: Error, context?: string) => void;

/**
 * Default error handler that logs to console
 */
export const defaultErrorHandler: ErrorHandler = (error, context) => {
  const prefix = context ? `[Lattice SDK - ${context}]` : '[Lattice SDK]';
  console.error(`${prefix} ${error.message}`);
};

/**
 * Options for safe wrapper functions
 */
export interface SafeWrapperOptions<T> {
  /** Value to return if the operation fails */
  fallback: T;
  /** Error handler for logging/reporting */
  onError?: ErrorHandler;
  /** Context string for error messages */
  context?: string;
  /** Whether to log errors (default: true in non-production) */
  logErrors?: boolean;
}

/**
 * Wraps an async function to never throw
 * Returns the fallback value on any error
 *
 * @example
 * ```typescript
 * const safeSubmit = createSafeAsyncWrapper(
 *   async (data) => await apiClient.submit(data),
 *   { fallback: null, context: 'submit' }
 * );
 *
 * // This will never throw, returns null on error
 * const result = await safeSubmit(someData);
 * ```
 */
export function createSafeAsyncWrapper<TArgs extends unknown[], TReturn>(
  fn: (...args: TArgs) => Promise<TReturn>,
  { fallback, onError = defaultErrorHandler, context, logErrors = true }: SafeWrapperOptions<TReturn>
): (...args: TArgs) => Promise<TReturn> {
  return async (...args: TArgs): Promise<TReturn> => {
    try {
      return await fn(...args);
    } catch (error) {
      if (logErrors && error instanceof Error) {
        onError(error, context);
      }
      return fallback;
    }
  };
}

/**
 * Wraps a synchronous function to never throw
 * Returns the fallback value on any error
 */
export function createSafeSyncWrapper<TArgs extends unknown[], TReturn>(
  fn: (...args: TArgs) => TReturn,
  { fallback, onError = defaultErrorHandler, context, logErrors = true }: SafeWrapperOptions<TReturn>
): (...args: TArgs) => TReturn {
  return (...args: TArgs): TReturn => {
    try {
      return fn(...args);
    } catch (error) {
      if (logErrors && error instanceof Error) {
        onError(error, context);
      }
      return fallback;
    }
  };
}

/**
 * Execute an async operation safely, returning the result or fallback
 *
 * @example
 * ```typescript
 * const result = await safeAsync(
 *   () => apiClient.submit(data),
 *   null,
 *   'submit'
 * );
 * ```
 */
export async function safeAsync<T>(
  fn: () => Promise<T>,
  fallback: T,
  context?: string,
  onError: ErrorHandler = defaultErrorHandler
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof Error) {
      onError(error, context);
    }
    return fallback;
  }
}

/**
 * Execute a synchronous operation safely, returning the result or fallback
 */
export function safeSync<T>(
  fn: () => T,
  fallback: T,
  context?: string,
  onError: ErrorHandler = defaultErrorHandler
): T {
  try {
    return fn();
  } catch (error) {
    if (error instanceof Error) {
      onError(error, context);
    }
    return fallback;
  }
}

/**
 * Execute an async operation with a timeout
 * Returns fallback if operation times out
 */
export async function safeAsyncWithTimeout<T>(
  fn: () => Promise<T>,
  fallback: T,
  timeoutMs: number,
  context?: string,
  onError: ErrorHandler = defaultErrorHandler
): Promise<T> {
  try {
    const result = await Promise.race([
      fn(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs)
      ),
    ]);
    return result;
  } catch (error) {
    if (error instanceof Error) {
      onError(error, context);
    }
    return fallback;
  }
}

/**
 * Type guard to check if a value is an Error
 */
export function isError(value: unknown): value is Error {
  return value instanceof Error;
}
