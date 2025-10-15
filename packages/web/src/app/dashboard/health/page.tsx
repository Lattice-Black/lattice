'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { ServiceHealthCard } from '@/components/ServiceHealthCard';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function HealthPage() {
  const [environmentFilter, setEnvironmentFilter] = useState('');

  const queryParams = new URLSearchParams();
  if (environmentFilter) queryParams.set('environment', environmentFilter);

  const { data: healthData, error: healthError, isLoading: healthLoading } = useSWR(
    `/api/v1/health/services?${queryParams.toString()}`,
    fetcher,
    {
      refreshInterval: 10000, // Poll every 10 seconds
      refreshWhenHidden: false,
      refreshWhenOffline: false,
    }
  );

  const { data: overviewData, error: overviewError, isLoading: overviewLoading } = useSWR(
    '/api/v1/health/overview',
    fetcher,
    {
      refreshInterval: 10000,
      refreshWhenHidden: false,
      refreshWhenOffline: false,
    }
  );

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">System Health</h1>
        <p className="text-gray-600 mt-2">
          Monitor service health and performance metrics
        </p>
      </div>

      {/* System Overview */}
      {overviewData && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="text-sm font-medium text-gray-500">Total Services</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">
              {overviewData.total_services}
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="text-sm font-medium text-gray-500">Healthy</div>
            <div className="text-2xl font-bold text-green-600 mt-1">
              {overviewData.health_breakdown?.healthy || 0}
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="text-sm font-medium text-gray-500">Degraded</div>
            <div className="text-2xl font-bold text-yellow-600 mt-1">
              {overviewData.health_breakdown?.degraded || 0}
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="text-sm font-medium text-gray-500">Unhealthy</div>
            <div className="text-2xl font-bold text-red-600 mt-1">
              {overviewData.health_breakdown?.unhealthy || 0}
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="text-sm font-medium text-gray-500">Errors (24h)</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">
              {overviewData.total_errors_24h?.toLocaleString()}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="mb-6">
        <select
          value={environmentFilter}
          onChange={(e) => setEnvironmentFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">All Environments</option>
          <option value="development">Development</option>
          <option value="staging">Staging</option>
          <option value="production">Production</option>
        </select>
      </div>

      {/* Loading State */}
      {healthLoading && (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      )}

      {/* Error State */}
      {healthError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          Failed to load health data. Please try again.
        </div>
      )}

      {/* Service Health Grid */}
      {healthData && (
        <>
          <div className="mb-4 text-sm text-gray-600">
            Showing {healthData.services.length} services
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {healthData.services.map((service: any) => (
              <ServiceHealthCard key={`${service.service_id}-${service.environment}`} service={service} />
            ))}
          </div>

          {healthData.services.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              No services found. Start sending metrics to see health data.
            </div>
          )}
        </>
      )}
    </div>
  );
}
