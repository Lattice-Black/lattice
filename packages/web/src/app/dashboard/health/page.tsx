'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { ServiceHealthCard } from '@/components/ServiceHealthCard';
import {
  Card,
  CardContent,
  Heading,
  Text,
  Label,
  Alert,
  AlertTitle,
  AlertDescription,
} from '@duro/core';

type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

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
  health_status: HealthStatus;
}

interface HealthBreakdown {
  healthy: number;
  degraded: number;
  unhealthy: number;
  unknown: number;
}

interface HealthResponse {
  services: ServiceHealth[];
}

interface OverviewResponse {
  total_services: number;
  health_breakdown?: HealthBreakdown;
  total_errors_24h?: number;
}

const fetcher = async (url: string): Promise<unknown> => {
  const res = await fetch(url);
  return res.json() as Promise<unknown>;
};

export default function HealthPage() {
  const [environmentFilter, setEnvironmentFilter] = useState('');

  const queryParams = new URLSearchParams();
  if (environmentFilter) queryParams.set('environment', environmentFilter);

  const healthResult = useSWR<HealthResponse>(
    `/api/v1/health/services?${queryParams.toString()}`,
    fetcher as (url: string) => Promise<HealthResponse>,
    {
      refreshInterval: 10000,
      refreshWhenHidden: false,
      refreshWhenOffline: false,
    }
  );
  const { data: healthData, isLoading: healthLoading } = healthResult;

  const { data: overviewData } = useSWR<OverviewResponse>(
    '/api/v1/health/overview',
    fetcher as (url: string) => Promise<OverviewResponse>,
    {
      refreshInterval: 10000,
      refreshWhenHidden: false,
      refreshWhenOffline: false,
    }
  );

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="border-b border-gray-800 pb-8">
        <Heading level={1} className="text-4xl mb-2 tracking-tight">
          System Health
        </Heading>
        <Text size="sm" className="text-gray-500">
          Monitor service health and performance metrics
        </Text>
      </div>

      {/* System Overview */}
      {overviewData && (
        <div className="grid grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-6">
              <Text size="sm" className="text-gray-500 uppercase tracking-wider mb-2">
                Total Services
              </Text>
              <Text className="text-4xl font-bold text-white font-mono">
                {overviewData.total_services}
              </Text>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <Text size="sm" className="text-gray-500 uppercase tracking-wider mb-2">
                Healthy
              </Text>
              <Text className="text-4xl font-bold text-green-500 font-mono">
                {overviewData.health_breakdown?.healthy || 0}
              </Text>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <Text size="sm" className="text-gray-500 uppercase tracking-wider mb-2">
                Degraded
              </Text>
              <Text className="text-4xl font-bold text-yellow-500 font-mono">
                {overviewData.health_breakdown?.degraded || 0}
              </Text>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <Text size="sm" className="text-gray-500 uppercase tracking-wider mb-2">
                Unhealthy
              </Text>
              <Text className="text-4xl font-bold text-red-500 font-mono">
                {overviewData.health_breakdown?.unhealthy || 0}
              </Text>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <Text size="sm" className="text-gray-500 uppercase tracking-wider mb-2">
                Errors (24h)
              </Text>
              <Text className="text-4xl font-bold text-white font-mono">
                {overviewData.total_errors_24h?.toLocaleString() || '0'}
              </Text>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="space-y-2">
        <Label htmlFor="env-filter">Environment</Label>
        <select
          id="env-filter"
          value={environmentFilter}
          onChange={(e) => setEnvironmentFilter(e.target.value)}
          className="px-3 py-2 bg-black border-2 border-gray-800 text-white focus:border-white focus:outline-none"
        >
          <option value="">All Environments</option>
          <option value="development">Development</option>
          <option value="staging">Staging</option>
          <option value="production">Production</option>
        </select>
      </div>

      {/* Loading State */}
      {healthLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="w-16 h-16 border-2 border-gray-800 relative">
            <div className="absolute inset-2 border border-gray-700 animate-pulse" />
          </div>
        </div>
      )}

      {/* Error State */}
      {healthResult.error && (
        <Alert variant="error">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            Failed to load health data. Please try again.
          </AlertDescription>
        </Alert>
      )}

      {/* Service Health Grid */}
      {healthData && (
        <div className="space-y-4">
          <Text size="sm" className="text-gray-500 font-mono">
            Showing {healthData.services.length} services
          </Text>
          <div className="grid grid-cols-3 gap-6">
            {healthData.services.map((service) => (
              <ServiceHealthCard
                key={`${service.service_id}-${service.environment}`}
                service={service}
              />
            ))}
          </div>

          {healthData.services.length === 0 && (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="w-24 h-24 border-2 border-gray-800 mb-6 mx-auto relative">
                  <div className="absolute inset-4 border border-gray-800" />
                </div>
                <Heading level={3} className="mb-2">
                  No Services Found
                </Heading>
                <Text size="sm" className="text-gray-500 font-mono">
                  Start sending metrics to see health data
                </Text>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
