import { ServiceMetadataSubmission } from '@lattice.black/core';
export interface LatticeNextConfig {
    serviceName: string;
    environment?: string;
    apiEndpoint?: string;
    apiKey?: string;
    enabled?: boolean;
    autoSubmit?: boolean;
    appDir?: string;
    onAnalyzed?: (metadata: ServiceMetadataSubmission) => void;
    onSubmitted?: (response: any) => void;
    onError?: (error: Error) => void;
}
export { initLatticeMonitoring, captureError, addBreadcrumb, getBreadcrumbs, clearBreadcrumbs, } from './client/browser-sdk';
export { default as GlobalError } from './error-boundary/global-error';
export { default as Error } from './error-boundary/error';
export declare class LatticeNextPlugin {
    private config;
    constructor(config: LatticeNextConfig);
    analyze(): Promise<ServiceMetadataSubmission>;
    private discoverRoutes;
    private extractHTTPMethods;
    private discoverDependencies;
    private getPackageVersion;
    private submit;
}
