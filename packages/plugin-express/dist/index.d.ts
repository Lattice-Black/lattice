import { Application } from 'express';
import { ServiceMetadataSubmission } from '@lattice.black/core';
import { LatticeConfig, SubmissionResponse } from './config/types';
import { HttpInterceptor } from './client/http-interceptor';
export declare class LatticePlugin {
    private config;
    private routeAnalyzer;
    private dependencyAnalyzer;
    private serviceNameDetector;
    private apiClient;
    private metadata;
    private submitTimer;
    private metricsTracker;
    private httpInterceptor;
    private errorCapture;
    constructor(config?: LatticeConfig);
    analyze(app: Application): Promise<ServiceMetadataSubmission>;
    submit(metadata?: ServiceMetadataSubmission): Promise<SubmissionResponse | null>;
    getMetadata(): ServiceMetadataSubmission | null;
    getServiceName(): string;
    isEnabled(): boolean;
    start(): void;
    stop(): void;
    createMetricsMiddleware(): (req: import("express").Request, res: import("express").Response, next: import("express").NextFunction) => void;
    getHttpClient(): HttpInterceptor;
    errorHandler(): (err: Error, req: import("express").Request, _res: import("express").Response, next: import("express").NextFunction) => Promise<void>;
    private handleError;
    private getPackageJson;
    private getEmptyMetadata;
}
export * from './config/types';
export { HttpInterceptor } from './client/http-interceptor';
export { ErrorCapture } from './middleware/error-capture';
export { LatticePlugin as LatticeExpress } from './index';
//# sourceMappingURL=index.d.ts.map