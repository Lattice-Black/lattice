/**
 * Lattice Core Types - Unified data model for service discovery and error tracking
 */

// Service Discovery Types
export * from './service';
export * from './route';
export * from './dependency';
export * from './connection';
export * from './plugin';

// Error Tracking Types
export * from './error';
export * from './performance';
export * from './breadcrumb';
export * from './session';
export * from './alert';

// SDK Configuration Types
export * from './sdk-config';

/**
 * Service metadata submission payload
 * Used by plugins to submit discovered metadata to the collector API
 */
export interface ServiceMetadataSubmission {
  service: import('./service').Service;
  routes?: import('./route').Route[];
  dependencies?: import('./dependency').Dependency[];
}
