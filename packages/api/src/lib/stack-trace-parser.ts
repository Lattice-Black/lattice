/**
 * Stack Trace Parser - Parse Error.stack using error-stack-parser-es
 * @module @lattice/api/lib/stack-trace-parser
 */

import { parse } from 'error-stack-parser-es';
import type { StackFrame as CoreStackFrame } from '@lattice.black/core';

/**
 * Parse Error object to extract stack frames
 */
export function parseStackTrace(error: Error): CoreStackFrame[] {
  try {
    const frames = parse(error);

    return frames.map(frame => ({
      filename: frame.fileName || 'unknown',
      line_number: frame.lineNumber || 0,
      column_number: frame.columnNumber,
      function_name: frame.functionName || '<anonymous>',
    }));
  } catch (err) {
    // If parsing fails, return a single frame from the error
    return [{
      filename: 'unknown',
      line_number: 0,
      function_name: error.name || 'Error',
    }];
  }
}

/**
 * Parse raw stack trace string
 */
export function parseStackString(stack: string): CoreStackFrame[] {
  try {
    // Create a temporary error with the stack string
    const tempError = new Error();
    tempError.stack = stack;

    return parseStackTrace(tempError);
  } catch (err) {
    // Fallback: manually parse stack trace lines
    return parseStackManually(stack);
  }
}

/**
 * Manual stack trace parsing fallback
 */
function parseStackManually(stack: string): CoreStackFrame[] {
  const lines = stack.split('\n');
  const frames: CoreStackFrame[] = [];

  for (const line of lines) {
    // Skip the error message line
    if (!line.trim().startsWith('at ')) {
      continue;
    }

    // Common patterns:
    // at functionName (filename:line:column)
    // at filename:line:column
    // at functionName (filename)

    const match = line.match(/at\s+(?:(.+?)\s+\()?(.+?):(\d+)(?::(\d+))?\)?/);

    if (match) {
      const [, functionName, filename, line, column] = match;

      frames.push({
        filename: filename || 'unknown',
        line_number: line ? parseInt(line, 10) : 0,
        column_number: column ? parseInt(column, 10) : undefined,
        function_name: functionName?.trim() || '<anonymous>',
      });
    }
  }

  return frames.length > 0 ? frames : [{
    filename: 'unknown',
    line_number: 0,
    function_name: 'Error',
  }];
}

/**
 * Extract the top stack frame (most immediate caller)
 */
export function getTopFrame(frames: CoreStackFrame[]): CoreStackFrame | null {
  return frames.length > 0 && frames[0] ? frames[0] : null;
}

/**
 * Calculate error fingerprint for aggregation
 */
export function calculateErrorFingerprint(
  serviceId: string,
  environment: string,
  errorType: string,
  message: string,
  frames: CoreStackFrame[]
): string {
  const topFrame = getTopFrame(frames);

  // Create a unique fingerprint by combining:
  // - service_id
  // - environment
  // - error_type
  // - message (first 100 chars to handle variations)
  // - top stack frame (file + line)

  const messageTruncated = message.substring(0, 100);
  const topFrameInfo = topFrame
    ? `${topFrame.filename}:${topFrame.line_number}`
    : 'unknown';

  const fingerprintString = [
    serviceId,
    environment,
    errorType,
    messageTruncated,
    topFrameInfo,
  ].join('|');

  // Simple hash function (for demo - consider crypto.createHash in production)
  let hash = 0;
  for (let i = 0; i < fingerprintString.length; i++) {
    const char = fingerprintString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  return Math.abs(hash).toString(16);
}
