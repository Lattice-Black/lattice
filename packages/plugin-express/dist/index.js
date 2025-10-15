"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LatticeExpress = exports.ErrorCapture = exports.HttpInterceptor = exports.LatticePlugin = void 0;
const tslib_1 = require("tslib");
const core_1 = require("@lattice.black/core");
const types_1 = require("./config/types");
const route_analyzer_1 = require("./discovery/route-analyzer");
const dependency_analyzer_1 = require("./discovery/dependency-analyzer");
const service_name_detector_1 = require("./discovery/service-name-detector");
const api_client_1 = require("./client/api-client");
const metrics_tracker_1 = require("./middleware/metrics-tracker");
const http_interceptor_1 = require("./client/http-interceptor");
const error_capture_1 = require("./middleware/error-capture");
class LatticePlugin {
    config;
    routeAnalyzer;
    dependencyAnalyzer;
    serviceNameDetector;
    apiClient;
    metadata = null;
    submitTimer = null;
    metricsTracker = null;
    httpInterceptor = null;
    errorCapture = null;
    constructor(config = {}) {
        this.config = {
            ...types_1.DEFAULT_CONFIG,
            ...config,
        };
        this.routeAnalyzer = new route_analyzer_1.RouteAnalyzer();
        this.dependencyAnalyzer = new dependency_analyzer_1.DependencyAnalyzer();
        this.serviceNameDetector = new service_name_detector_1.ServiceNameDetector();
        this.apiClient = new api_client_1.ApiClient(this.config.apiEndpoint, this.config.apiKey);
    }
    async analyze(app) {
        if (!this.config.enabled) {
            console.log('Lattice plugin is disabled');
            return this.getEmptyMetadata();
        }
        try {
            const serviceName = this.serviceNameDetector.detectServiceName(this.config.serviceName);
            const pkgJson = this.getPackageJson();
            const serviceId = (0, core_1.generateId)();
            const service = {
                id: serviceId,
                name: serviceName,
                version: pkgJson?.version,
                environment: this.config.environment,
                language: 'typescript',
                framework: 'express',
                runtime: `node-${process.version}`,
                status: core_1.ServiceStatus.Active,
                firstSeen: new Date(),
                lastSeen: new Date(),
                discoveredBy: {
                    pluginName: '@lattice/plugin-express',
                    pluginVersion: '0.1.0',
                    schemaVersion: '1.0.0',
                },
            };
            const routes = this.config.discoverRoutes
                ? this.routeAnalyzer.analyzeRoutes(app, serviceId)
                : [];
            const dependencies = this.config.discoverDependencies
                ? this.dependencyAnalyzer.analyzeDependencies(serviceId, this.config.packageJsonPath)
                : [];
            this.metadata = {
                service,
                routes,
                dependencies,
            };
            if (this.config.onAnalyzed) {
                this.config.onAnalyzed(this.metadata);
            }
            console.log(`✅ Lattice discovered service "${serviceName}" with ${routes.length} routes and ${dependencies.length} dependencies`);
            if (this.config.autoSubmit) {
                await this.submit();
            }
            this.start();
            return this.metadata;
        }
        catch (error) {
            this.handleError(error);
            throw error;
        }
    }
    async submit(metadata) {
        if (!this.config.enabled) {
            return null;
        }
        const dataToSubmit = metadata || this.metadata;
        if (!dataToSubmit) {
            throw new Error('No metadata to submit. Call analyze() first.');
        }
        try {
            const response = await this.apiClient.submitMetadata(dataToSubmit);
            if (this.config.onSubmitted) {
                this.config.onSubmitted(response);
            }
            console.log(`✅ Lattice metadata submitted: ${response.serviceId}`);
            return response;
        }
        catch (error) {
            this.handleError(error);
            return null;
        }
    }
    getMetadata() {
        return this.metadata;
    }
    getServiceName() {
        return this.metadata?.service.name || 'unknown';
    }
    isEnabled() {
        return this.config.enabled;
    }
    start() {
        if (!this.config.enabled || !this.config.autoSubmit || this.submitTimer) {
            return;
        }
        this.submitTimer = setInterval(() => {
            if (this.metadata) {
                this.metadata.service.lastSeen = new Date();
                this.submit().catch((error) => {
                    console.error('Auto-submit failed:', error);
                });
            }
        }, this.config.submitInterval);
        this.submitTimer.unref();
    }
    stop() {
        if (this.submitTimer) {
            clearInterval(this.submitTimer);
            this.submitTimer = null;
        }
    }
    createMetricsMiddleware() {
        if (!this.metricsTracker) {
            const serviceName = this.serviceNameDetector.detectServiceName(this.config.serviceName);
            this.metricsTracker = new metrics_tracker_1.MetricsTracker(serviceName, this.config.apiEndpoint, this.config.apiKey);
        }
        return this.metricsTracker.middleware();
    }
    getHttpClient() {
        if (!this.httpInterceptor) {
            const serviceName = this.serviceNameDetector.detectServiceName(this.config.serviceName);
            this.httpInterceptor = new http_interceptor_1.HttpInterceptor(serviceName);
        }
        return this.httpInterceptor;
    }
    errorHandler() {
        if (!this.errorCapture) {
            const serviceName = this.serviceNameDetector.detectServiceName(this.config.serviceName);
            this.errorCapture = new error_capture_1.ErrorCapture({
                serviceName,
                apiEndpoint: this.config.apiEndpoint,
                apiKey: this.config.apiKey,
                environment: this.config.environment,
                enabled: this.config.enabled,
            });
        }
        return this.errorCapture.middleware();
    }
    handleError(error) {
        if (this.config.onError) {
            this.config.onError(error);
        }
        else {
            console.error('Lattice error:', error);
        }
    }
    getPackageJson() {
        try {
            const fs = require('fs');
            const path = require('path');
            const pkgPath = path.join(process.cwd(), 'package.json');
            if (fs.existsSync(pkgPath)) {
                return JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
            }
        }
        catch (error) {
        }
        return null;
    }
    getEmptyMetadata() {
        return {
            service: {
                id: (0, core_1.generateId)(),
                name: 'disabled',
                language: 'typescript',
                framework: 'express',
                status: core_1.ServiceStatus.Unknown,
                firstSeen: new Date(),
                lastSeen: new Date(),
                discoveredBy: {
                    pluginName: '@lattice/plugin-express',
                    pluginVersion: '0.1.0',
                    schemaVersion: '1.0.0',
                },
            },
            routes: [],
            dependencies: [],
        };
    }
}
exports.LatticePlugin = LatticePlugin;
tslib_1.__exportStar(require("./config/types"), exports);
var http_interceptor_2 = require("./client/http-interceptor");
Object.defineProperty(exports, "HttpInterceptor", { enumerable: true, get: function () { return http_interceptor_2.HttpInterceptor; } });
var error_capture_2 = require("./middleware/error-capture");
Object.defineProperty(exports, "ErrorCapture", { enumerable: true, get: function () { return error_capture_2.ErrorCapture; } });
var index_1 = require("./index");
Object.defineProperty(exports, "LatticeExpress", { enumerable: true, get: function () { return index_1.LatticePlugin; } });
//# sourceMappingURL=index.js.map