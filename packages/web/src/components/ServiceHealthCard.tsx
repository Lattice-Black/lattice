'use client';

import Link from 'next/link';
import { HealthStatusBadge } from './HealthStatusBadge';

interface ServiceHealth {
  service_id: string;
  environment: string;
  total_errors: number;
  error_rate: number;
  avg_response_time: number;
  p95_response_time: number;
  slow_request_count: number;
  uptime_percentage: number;
  last_error?: Date;
  last_seen: Date;
  health_status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
}

interface ServiceHealthCardProps {
  service: ServiceHealth;
}

export function ServiceHealthCard({ service }: ServiceHealthCardProps) {
  return (
    <Link
      href={`/dashboard/health/${service.service_id}?environment=${service.environment}`}
      className="block bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow"
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{service.service_id}</h3>
          <p className="text-sm text-gray-500 mt-1">{service.environment}</p>
        </div>
        <HealthStatusBadge status={service.health_status} />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <div className="text-xs font-medium text-gray-500">Error Rate</div>
          <div className="text-lg font-bold text-gray-900 mt-1">
            {service.error_rate.toFixed(2)}%
          </div>
        </div>
        <div>
          <div className="text-xs font-medium text-gray-500">Total Errors</div>
          <div className="text-lg font-bold text-gray-900 mt-1">
            {service.total_errors.toLocaleString()}
          </div>
        </div>
        <div>
          <div className="text-xs font-medium text-gray-500">Avg Response Time</div>
          <div className="text-lg font-bold text-gray-900 mt-1">
            {service.avg_response_time}ms
          </div>
        </div>
        <div>
          <div className="text-xs font-medium text-gray-500">P95 Response Time</div>
          <div className="text-lg font-bold text-gray-900 mt-1">
            {service.p95_response_time}ms
          </div>
        </div>
      </div>

      <div className="border-t border-gray-200 pt-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">Uptime</span>
          <span className="font-semibold text-gray-900">
            {service.uptime_percentage.toFixed(2)}%
          </span>
        </div>
        <div className="flex items-center justify-between text-sm mt-2">
          <span className="text-gray-500">Last Seen</span>
          <span className="text-gray-900">
            {new Date(service.last_seen).toLocaleString()}
          </span>
        </div>
      </div>
    </Link>
  );
}
