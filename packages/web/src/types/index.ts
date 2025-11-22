// Service types (from core package)
export interface Service {
  id: string;
  name: string;
  version?: string;
  environment?: ServiceEnvironment;
  deploymentType?: DeploymentType;
  language: string;
  framework: string;
  runtime?: string;
  description?: string;
  repository?: string;
  healthCheckUrl?: string;
  status: ServiceStatus;
  firstSeen: Date | string;
  lastSeen: Date | string;
  discoveredBy?: {
    pluginName: string;
    pluginVersion: string;
    schemaVersion: string;
  };
  metadata?: Record<string, unknown>;
  route_count?: number;
  dependency_count?: number;
}

export enum ServiceStatus {
  Active = 'active',
  Inactive = 'inactive',
  Unknown = 'unknown',
}

export enum ServiceEnvironment {
  Development = 'development',
  Staging = 'staging',
  Production = 'production',
}

export enum DeploymentType {
  Kubernetes = 'kubernetes',
  Docker = 'docker',
  Serverless = 'serverless',
  BareMetal = 'bare-metal',
}

export enum HttpMethod {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  PATCH = 'PATCH',
  DELETE = 'DELETE',
  HEAD = 'HEAD',
  OPTIONS = 'OPTIONS',
  ALL = 'ALL',
}

export interface Route {
  id: string;
  serviceId: string;
  method: HttpMethod;
  path: string;
  middlewareChain?: string[];
  handlerLocation?: HandlerLocation;
  pathParameters?: RouteParameter[];
  queryParameters?: RouteParameter[];
  description?: string;
  tags?: string[];
  avgResponseTimeMs?: number;
  callFrequency?: number;
  errorRate?: number;
  firstSeen: Date | string;
  lastSeen: Date | string;
  metadata?: Record<string, unknown>;
}

export interface HandlerLocation {
  file: string;
  line?: number;
  function?: string;
}

export interface RouteParameter {
  name: string;
  type?: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required: boolean;
  description?: string;
  example?: unknown;
}

export enum DependencyType {
  Direct = 'direct',
  Transitive = 'transitive',
  Peer = 'peer',
  Dev = 'dev',
}

export interface Dependency {
  id: string;
  serviceId: string;
  packageName: string;
  version: string;
  versionRange?: string;
  dependencyType: DependencyType;
  scope?: string;
  installedSize?: number;
  publishSize?: number;
  fileCount?: number;
  hasVulnerabilities?: boolean;
  vulnerabilityCount?: number;
  description?: string;
  license?: string;
  repository?: string;
  homepage?: string;
  firstSeen: Date | string;
  lastSeen: Date | string;
  metadata?: Record<string, unknown>;
}

// Metrics types
export interface ServiceMetricsStat {
  id: string;
  name: string;
  total_requests: number;
  avg_response_time_ms: number;
  error_rate: number;
  last_request_time: string;
}

export interface ServiceConnection {
  source_service: string;
  target_service: string;
  call_count: number;
  avg_response_time: number;
}

// API Response types
export interface ServicesListResponse {
  services: Service[];
  total: number;
  limit: number;
  offset: number;
}

export interface ServiceDetailResponse {
  id: string;
  name: string;
  version?: string;
  environment?: ServiceEnvironment;
  deploymentType?: DeploymentType;
  language: string;
  framework: string;
  runtime?: string;
  description?: string;
  repository?: string;
  healthCheckUrl?: string;
  status: ServiceStatus;
  firstSeen: Date | string;
  lastSeen: Date | string;
  discoveredBy?: {
    pluginName: string;
    pluginVersion: string;
    schemaVersion: string;
  };
  metadata?: Record<string, unknown>;
  routes?: Route[];
  dependencies?: Dependency[];
}

export interface MetricsStatsResponse {
  stats: ServiceMetricsStat[];
}

export interface MetricsConnectionsResponse {
  connections: ServiceConnection[];
}

export interface ServiceMetric {
  method: string;
  path: string;
  status_code: number;
  response_time_ms: number;
  timestamp: string;
  caller_service_name?: string;
}

export interface RecentMetricsResponse {
  success: boolean;
  serviceName: string;
  count: number;
  metrics: ServiceMetric[];
}

// Error tracking types
export interface ErrorItem {
  id: string;
  error_type: string;
  message: string;
  service_id: string;
  environment: string;
  occurrence_count: number;
  first_seen: string;
  last_seen: string;
  resolved: boolean;
  ignored: boolean;
}

export interface Breadcrumb {
  id?: string;
  session_id: string;
  category: string;
  message: string;
  level: string;
  data?: Record<string, unknown>;
  timestamp: string | Date;
}

export interface StackFrame {
  filename: string;
  line_number: number;
  column_number?: number;
  function_name?: string;
}

export interface ErrorDetail extends ErrorItem {
  stack_trace?: StackFrame[];
  breadcrumbs?: Breadcrumb[];
  context?: Record<string, unknown>;
}
