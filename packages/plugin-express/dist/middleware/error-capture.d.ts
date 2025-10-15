import { Request, Response, NextFunction } from 'express';
export interface ErrorCaptureConfig {
    serviceName: string;
    apiEndpoint: string;
    apiKey: string;
    environment?: string;
    enabled?: boolean;
}
export declare class ErrorCapture {
    private config;
    constructor(config: ErrorCaptureConfig);
    middleware(): (err: Error, req: Request, _res: Response, next: NextFunction) => Promise<void>;
    captureError(error: Error, context?: Record<string, any>): Promise<void>;
    private parseStackTrace;
    private sanitizeContext;
    private sendToAPI;
}
//# sourceMappingURL=error-capture.d.ts.map