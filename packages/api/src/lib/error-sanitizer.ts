/**
 * Error Sanitizer - Remove sensitive data from errors before storage
 * @module @lattice/api/lib/error-sanitizer
 */

/**
 * Patterns that indicate sensitive data
 */
const SENSITIVE_PATTERNS = [
  // Password patterns
  /password["\s]*[:=]["\s]*[^\s"]+/gi,
  /passwd["\s]*[:=]["\s]*[^\s"]+/gi,
  /pwd["\s]*[:=]["\s]*[^\s"]+/gi,

  // API Keys and tokens
  /api[_-]?key["\s]*[:=]["\s]*[^\s"]+/gi,
  /token["\s]*[:=]["\s]*[^\s"]+/gi,
  /bearer\s+[a-zA-Z0-9._-]+/gi,

  // AWS credentials
  /AKIA[0-9A-Z]{16}/g,
  /aws[_-]?secret[_-]?access[_-]?key["\s]*[:=]["\s]*[^\s"]+/gi,

  // Private keys
  /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/gi,

  // JWT tokens
  /eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/g,

  // Credit card numbers (basic pattern)
  /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g,

  // Social Security Numbers (US format)
  /\b\d{3}-\d{2}-\d{4}\b/g,

  // Email addresses (optional - can be kept for debugging)
  // /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
];

/**
 * Fields that should be completely redacted
 */
const SENSITIVE_FIELD_NAMES = [
  'password',
  'passwd',
  'pwd',
  'secret',
  'api_key',
  'apiKey',
  'token',
  'auth',
  'authorization',
  'cookie',
  'session',
  'private_key',
  'privateKey',
  'credit_card',
  'creditCard',
  'ssn',
  'social_security',
];

/**
 * Sanitize a string by replacing sensitive patterns with [REDACTED]
 */
export function sanitizeString(input: string): string {
  let sanitized = input;

  for (const pattern of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  }

  return sanitized;
}

/**
 * Sanitize an object by redacting sensitive fields
 */
export function sanitizeObject(obj: any, depth = 0): any {
  // Prevent infinite recursion
  if (depth > 5) {
    return '[MAX_DEPTH_REACHED]';
  }

  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }

  if (typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, depth + 1));
  }

  const sanitized: any = {};

  for (const [key, value] of Object.entries(obj)) {
    // Check if field name is sensitive
    const lowerKey = key.toLowerCase();
    const isSensitiveField = SENSITIVE_FIELD_NAMES.some(field =>
      lowerKey.includes(field)
    );

    if (isSensitiveField) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object') {
      sanitized[key] = sanitizeObject(value, depth + 1);
    } else if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Sanitize an error message
 */
export function sanitizeErrorMessage(message: string): string {
  return sanitizeString(message);
}

/**
 * Sanitize a stack trace
 */
export function sanitizeStackTrace(stackTrace: string): string {
  return sanitizeString(stackTrace);
}

/**
 * Sanitize error context object
 */
export function sanitizeContext(context: Record<string, any>): Record<string, any> {
  return sanitizeObject(context);
}

/**
 * Complete error sanitization
 */
export function sanitizeError(error: {
  message: string;
  stack?: string;
  context?: Record<string, any>;
}): {
  message: string;
  stack?: string;
  context?: Record<string, any>;
} {
  return {
    message: sanitizeErrorMessage(error.message),
    stack: error.stack ? sanitizeStackTrace(error.stack) : undefined,
    context: error.context ? sanitizeContext(error.context) : undefined,
  };
}
