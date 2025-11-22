/**
 * Data Scrubber Utility
 *
 * Following Sentry's data scrubbing patterns:
 * - Field name-based scrubbing
 * - Pattern-based scrubbing (credit cards, SSNs, tokens)
 * - Recursive object scrubbing
 * - Configurable denylist
 */

import {
  DEFAULT_SENSITIVE_FIELDS,
  SENSITIVE_PATTERNS,
  type PrivacyConfig,
} from '@lattice.black/core';

const REDACTED = '[REDACTED]';
const MAX_DEPTH = 10;

/**
 * Create a set of lowercase sensitive field names for efficient lookup
 */
function createSensitiveFieldSet(
  additionalFields: string[] = []
): Set<string> {
  const fields = [...DEFAULT_SENSITIVE_FIELDS, ...additionalFields];
  return new Set(fields.map((f) => f.toLowerCase()));
}

/**
 * Check if a field name should be scrubbed
 */
function isSensitiveField(
  fieldName: string,
  sensitiveFields: Set<string>
): boolean {
  const lowerName = fieldName.toLowerCase();

  // Check for exact match or partial match
  for (const sensitive of sensitiveFields) {
    if (lowerName === sensitive || lowerName.includes(sensitive)) {
      return true;
    }
  }

  return false;
}

/**
 * Scrub sensitive patterns from a string value
 */
function scrubPatterns(value: string): string {
  let result = value;

  for (const pattern of SENSITIVE_PATTERNS) {
    // Create a new RegExp to reset lastIndex
    const regex = new RegExp(pattern.source, pattern.flags);
    result = result.replace(regex, REDACTED);
  }

  return result;
}

/**
 * Recursively scrub sensitive data from an object
 */
export function scrubObject(
  obj: unknown,
  sensitiveFields: Set<string>,
  depth = 0
): unknown {
  // Prevent infinite recursion
  if (depth > MAX_DEPTH) {
    return obj;
  }

  // Handle null/undefined
  if (obj === null || obj === undefined) {
    return obj;
  }

  // Handle strings - check for sensitive patterns
  if (typeof obj === 'string') {
    return scrubPatterns(obj);
  }

  // Handle primitives
  if (typeof obj !== 'object') {
    return obj;
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map((item) => scrubObject(item, sensitiveFields, depth + 1));
  }

  // Handle objects
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (isSensitiveField(key, sensitiveFields)) {
      result[key] = REDACTED;
    } else if (typeof value === 'string') {
      result[key] = scrubPatterns(value);
    } else if (typeof value === 'object' && value !== null) {
      result[key] = scrubObject(value, sensitiveFields, depth + 1);
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Data scrubber class with configurable options
 */
export class DataScrubber {
  private readonly sensitiveFields: Set<string>;

  constructor(additionalFields: string[] = []) {
    this.sensitiveFields = createSensitiveFieldSet(additionalFields);
  }

  /**
   * Scrub sensitive data from an object
   */
  scrub<T extends Record<string, unknown>>(obj: T): T {
    return scrubObject(obj, this.sensitiveFields) as T;
  }

  /**
   * Scrub sensitive patterns from a string
   */
  scrubString(value: string): string {
    return scrubPatterns(value);
  }

  /**
   * Check if a field name is sensitive
   */
  isSensitive(fieldName: string): boolean {
    return isSensitiveField(fieldName, this.sensitiveFields);
  }
}

/**
 * Create a data scrubber from privacy config
 */
export function createDataScrubber(privacy: PrivacyConfig): DataScrubber {
  return new DataScrubber(privacy.additionalPiiFields);
}

/**
 * Default data scrubber instance
 */
export const defaultScrubber = new DataScrubber();

/**
 * Scrub HTTP headers based on privacy config
 * Only returns headers in the safe list
 */
export function scrubHeaders(
  headers: Record<string, string | string[] | undefined>,
  privacy: PrivacyConfig
): Record<string, string | string[] | undefined> {
  if (!privacy.captureRequestHeaders) {
    // Only capture safe headers
    const safeSet = new Set(privacy.safeHeaders.map((h) => h.toLowerCase()));
    const result: Record<string, string | string[] | undefined> = {};

    for (const [key, value] of Object.entries(headers)) {
      if (safeSet.has(key.toLowerCase())) {
        result[key] = value;
      }
    }

    return result;
  }

  // Capture all headers but scrub sensitive ones
  const scrubber = createDataScrubber(privacy);
  return scrubber.scrub(headers as Record<string, unknown>) as Record<
    string,
    string | string[] | undefined
  >;
}

/**
 * Scrub query parameters based on privacy config
 */
export function scrubQueryParams(
  query: Record<string, unknown>,
  privacy: PrivacyConfig
): Record<string, unknown> | undefined {
  if (!privacy.captureQueryParams) {
    return undefined;
  }

  const scrubber = createDataScrubber(privacy);
  return scrubber.scrub(query);
}

/**
 * Scrub request body based on privacy config
 */
export function scrubRequestBody(
  body: unknown,
  privacy: PrivacyConfig
): unknown {
  if (!privacy.captureRequestBody) {
    return undefined;
  }

  if (typeof body !== 'object' || body === null) {
    return body;
  }

  const scrubber = createDataScrubber(privacy);
  return scrubber.scrub(body as Record<string, unknown>);
}
