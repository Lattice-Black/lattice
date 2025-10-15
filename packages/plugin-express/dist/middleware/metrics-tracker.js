"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetricsTracker = void 0;
const core_1 = require("@lattice.black/core");
class MetricsTracker {
    serviceName;
    apiEndpoint;
    apiKey;
    metrics = [];
    maxMetrics = 1000;
    constructor(serviceName, apiEndpoint, apiKey) {
        this.serviceName = serviceName;
        this.apiEndpoint = apiEndpoint;
        this.apiKey = apiKey;
    }
    middleware() {
        const self = this;
        console.log('[MetricsTracker] middleware() called - returning handler function');
        return (req, res, next) => {
            console.log(`[MetricsTracker] MIDDLEWARE INVOKED: ${req.method} ${req.path}`);
            const startTime = Date.now();
            const originalEnd = res.end;
            res.end = function (...args) {
                const responseTime = Date.now() - startTime;
                const headerValue = req.get(core_1.HTTP_HEADERS.ORIGIN_SERVICE) || req.get('X-Origin-Service');
                const callerServiceName = Array.isArray(headerValue) ? headerValue[0] : headerValue;
                const metric = {
                    method: req.method,
                    path: req.path,
                    statusCode: res.statusCode,
                    responseTime,
                    timestamp: new Date(),
                    callerServiceName,
                };
                self.storeMetric(metric);
                self.submitMetrics();
                return originalEnd.apply(this, args);
            };
            next();
        };
    }
    storeMetric(metric) {
        this.metrics.push(metric);
        console.log(`[MetricsTracker] Stored metric ${this.metrics.length}: ${metric.method} ${metric.path} - ${metric.statusCode} (${metric.responseTime}ms)`);
        if (this.metrics.length > this.maxMetrics) {
            this.metrics.shift();
        }
    }
    async submitMetrics() {
        if (this.metrics.length % 10 === 0) {
            const recentMetrics = this.metrics.slice(-10);
            console.log(`[MetricsTracker] Submitting ${recentMetrics.length} performance traces to ${this.apiEndpoint}/performance/traces`);
            try {
                for (const metric of recentMetrics) {
                    await fetch(`${this.apiEndpoint}/performance/traces`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            ...(this.apiKey && { [core_1.HTTP_HEADERS.API_KEY]: this.apiKey }),
                        },
                        body: JSON.stringify({
                            service_id: this.serviceName,
                            operation_name: `${metric.method} ${metric.path}`,
                            operation_type: 'http_request',
                            start_time: new Date(metric.timestamp.getTime() - metric.responseTime),
                            duration_ms: metric.responseTime,
                            status_code: metric.statusCode,
                            method: metric.method,
                            path: metric.path,
                            caller_service: metric.callerServiceName,
                        }),
                    });
                }
                console.log(`[MetricsTracker] Successfully submitted performance traces`);
            }
            catch (error) {
                console.error('[MetricsTracker] Failed to submit performance traces:', error);
            }
        }
    }
    getStats() {
        const totalRequests = this.metrics.length;
        const avgResponseTime = this.metrics.reduce((sum, m) => sum + m.responseTime, 0) / totalRequests || 0;
        const errorCount = this.metrics.filter(m => m.statusCode >= 400).length;
        const errorRate = totalRequests > 0 ? (errorCount / totalRequests) * 100 : 0;
        return {
            totalRequests,
            avgResponseTime: Math.round(avgResponseTime),
            errorCount,
            errorRate: errorRate.toFixed(2),
            recentRequests: this.metrics.slice(-10),
        };
    }
}
exports.MetricsTracker = MetricsTracker;
//# sourceMappingURL=metrics-tracker.js.map