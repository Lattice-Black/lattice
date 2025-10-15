/**
 * Breadcrumb Tracking Types
 * @module @lattice.black/core/types/breadcrumb
 */

export enum BreadcrumbCategory {
  Navigation = 'navigation',
  UserAction = 'user_action',
  Http = 'http',
  Console = 'console',
  StateChange = 'state_change',
  Custom = 'custom',
}

export enum BreadcrumbLevel {
  Debug = 'debug',
  Info = 'info',
  Warning = 'warning',
  Error = 'error',
}

export interface Breadcrumb {
  /** Unique breadcrumb ID (ULID or UUID) */
  id?: string;
  /** Session this breadcrumb belongs to */
  session_id: string;
  /** Service that captured the breadcrumb (optional for client-side breadcrumbs) */
  service_id?: string;
  /** Breadcrumb category */
  category: BreadcrumbCategory;
  /** Severity level */
  level: BreadcrumbLevel;
  /** Human-readable description of the event */
  message: string;
  /** Additional breadcrumb data */
  data?: Record<string, any>;
  /** When breadcrumb was captured */
  timestamp: Date;
}

export interface NavigationBreadcrumb extends Breadcrumb {
  category: BreadcrumbCategory.Navigation;
  data: {
    from: string;
    to: string;
    referrer?: string;
  };
}

export interface UserActionBreadcrumb extends Breadcrumb {
  category: BreadcrumbCategory.UserAction;
  data: {
    button_id?: string;
    button_text?: string;
    element_path?: string;
    action?: string;
  };
}

export interface HttpBreadcrumb extends Breadcrumb {
  category: BreadcrumbCategory.Http;
  data: {
    url: string;
    method: string;
    status?: number;
    duration_ms?: number;
  };
}

export interface ConsoleBreadcrumb extends Breadcrumb {
  category: BreadcrumbCategory.Console;
  data: {
    level: 'log' | 'warn' | 'error' | 'info' | 'debug';
    message: string;
    args?: any[];
  };
}

export interface StateChangeBreadcrumb extends Breadcrumb {
  category: BreadcrumbCategory.StateChange;
  data: {
    previous_state?: any;
    new_state?: any;
    state_key?: string;
  };
}
