/**
 * Browser-side Error Capture SDK for Next.js
 * Captures unhandled errors and sends them to Lattice API
 */
import { BreadcrumbCategory, BreadcrumbLevel } from '@lattice.black/core';
export interface LatticeMonitoringConfig {
    apiEndpoint: string;
    apiKey: string;
    serviceName: string;
    environment?: string;
    captureUnhandledErrors?: boolean;
    captureUnhandledRejections?: boolean;
    captureBreadcrumbs?: boolean;
    captureConsole?: boolean;
    captureNavigation?: boolean;
    captureClicks?: boolean;
    maxBreadcrumbs?: number;
    enabled?: boolean;
}
interface ClientBreadcrumb {
    session_id: string;
    category: BreadcrumbCategory;
    message: string;
    level: BreadcrumbLevel;
    data?: Record<string, any>;
    timestamp: Date;
}
/**
 * Initialize Lattice monitoring
 */
export declare function initLatticeMonitoring(userConfig: LatticeMonitoringConfig): void;
/**
 * Manually capture an error
 */
export declare function captureError(error: Error, context?: Record<string, any>): void;
/**
 * Manually add a breadcrumb
 */
export declare function addBreadcrumb(category: BreadcrumbCategory, message: string, level?: BreadcrumbLevel, data?: Record<string, any>): void;
/**
 * Get current breadcrumbs
 */
export declare function getBreadcrumbs(): ClientBreadcrumb[];
/**
 * Clear breadcrumbs
 */
export declare function clearBreadcrumbs(): void;
export {};
