"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorCapture = void 0;
const error_stack_parser_es_1 = require("error-stack-parser-es");
const core_1 = require("@lattice.black/core");
class ErrorCapture {
    config;
    constructor(config) {
        this.config = {
            ...config,
            environment: config.environment || process.env['NODE_ENV'] || 'development',
            enabled: config.enabled !== false,
        };
    }
    middleware() {
        return async (err, req, _res, next) => {
            if (!this.config.enabled) {
                return next(err);
            }
            try {
                this.captureError(err, {
                    method: req.method,
                    path: req.path,
                    url: req.url,
                    headers: req.headers,
                    query: req.query,
                    body: req.body,
                    ip: req.ip,
                    user_agent: req.get('user-agent'),
                }).catch(captureErr => {
                    console.error('[Lattice ErrorCapture] Failed to send error:', captureErr);
                });
            }
            catch (captureErr) {
                console.error('[Lattice ErrorCapture] Failed to capture error:', captureErr);
            }
            next(err);
        };
    }
    async captureError(error, context) {
        try {
            const stackFrames = this.parseStackTrace(error);
            const errorEvent = {
                service_id: this.config.serviceName,
                environment: this.config.environment,
                error_type: error.name || 'Error',
                message: error.message || 'Unknown error',
                stack_trace: stackFrames,
                context: context ? this.sanitizeContext(context) : undefined,
                timestamp: new Date(),
            };
            await this.sendToAPI(errorEvent);
        }
        catch (err) {
            console.error('[Lattice ErrorCapture] Error in captureError:', err);
        }
    }
    parseStackTrace(error) {
        try {
            const frames = (0, error_stack_parser_es_1.parse)(error);
            return frames.map(frame => ({
                filename: frame.fileName || 'unknown',
                line_number: frame.lineNumber || 0,
                column_number: frame.columnNumber,
                function_name: frame.functionName || '<anonymous>',
            }));
        }
        catch (err) {
            return [{
                    filename: 'unknown',
                    line_number: 0,
                    function_name: error.name || 'Error',
                }];
        }
    }
    sanitizeContext(context) {
        const sanitized = { ...context };
        const sensitiveFields = [
            'password',
            'passwd',
            'pwd',
            'secret',
            'api_key',
            'apiKey',
            'token',
            'authorization',
            'cookie',
            'session',
        ];
        const sanitizeObject = (obj) => {
            if (obj === null || obj === undefined || typeof obj !== 'object') {
                return obj;
            }
            if (Array.isArray(obj)) {
                return obj.map(item => sanitizeObject(item));
            }
            const result = {};
            for (const [key, value] of Object.entries(obj)) {
                const lowerKey = key.toLowerCase();
                const isSensitive = sensitiveFields.some(field => lowerKey.includes(field));
                if (isSensitive) {
                    result[key] = '[REDACTED]';
                }
                else if (typeof value === 'object') {
                    result[key] = sanitizeObject(value);
                }
                else {
                    result[key] = value;
                }
            }
            return result;
        };
        return sanitizeObject(sanitized);
    }
    async sendToAPI(errorEvent) {
        try {
            const response = await fetch(`${this.config.apiEndpoint}/errors`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    [core_1.HTTP_HEADERS.API_KEY]: this.config.apiKey,
                },
                body: JSON.stringify(errorEvent),
            });
            if (!response.ok) {
                console.error(`[Lattice ErrorCapture] Failed to send error: ${response.status} ${response.statusText}`);
            }
        }
        catch (err) {
            console.error('[Lattice ErrorCapture] Network error sending to API:', err);
            throw err;
        }
    }
}
exports.ErrorCapture = ErrorCapture;
//# sourceMappingURL=error-capture.js.map