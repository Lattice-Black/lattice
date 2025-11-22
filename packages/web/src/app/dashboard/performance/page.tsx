'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { PerformanceChart } from '@/components/PerformanceChart';
import { SlowestOperations } from '@/components/SlowestOperations';
import {
  Card,
  CardContent,
  Heading,
  Text,
  Input,
  Label,
  Alert,
  AlertTitle,
  AlertDescription,
} from '@duro/core';

type TimeRange = '1h' | '6h' | '24h' | '7d';
type Interval = '1m' | '5m' | '10m' | '1h' | '1d';

interface PerformanceBucket {
  timestamp: string;
  avg_duration_ms: number;
  p50_duration_ms: number;
  p95_duration_ms: number;
  p99_duration_ms: number;
  request_count: number;
}

interface SlowOperation {
  operation_name: string;
  avg_duration_ms: number;
  count: number;
}

interface PerformanceResponse {
  total_requests: number;
  buckets: PerformanceBucket[];
  slowest_operations: SlowOperation[];
}

const fetcher = async (url: string): Promise<unknown> => {
  const res = await fetch(url);
  return res.json() as Promise<unknown>;
};

export default function PerformancePage() {
  const [timeRange, setTimeRange] = useState<TimeRange>('1h');
  const [interval, setInterval] = useState<Interval>('5m');
  const [serviceFilter, setServiceFilter] = useState('');

  const getTimeRange = (range: TimeRange) => {
    const end = new Date();
    const start = new Date();

    switch (range) {
      case '1h':
        start.setHours(start.getHours() - 1);
        break;
      case '6h':
        start.setHours(start.getHours() - 6);
        break;
      case '24h':
        start.setHours(start.getHours() - 24);
        break;
      case '7d':
        start.setDate(start.getDate() - 7);
        break;
    }

    return { start, end };
  };

  const { start, end } = getTimeRange(timeRange);

  const queryParams = new URLSearchParams({
    start_time: start.toISOString(),
    end_time: end.toISOString(),
    interval,
  });

  if (serviceFilter) {
    queryParams.set('service_id', serviceFilter);
  }

  const perfResult = useSWR<PerformanceResponse>(
    `/api/v1/performance/metrics?${queryParams.toString()}`,
    fetcher as (url: string) => Promise<PerformanceResponse>,
    {
      refreshInterval: 10000,
      refreshWhenHidden: false,
      refreshWhenOffline: false,
    }
  );
  const { data, isLoading } = perfResult;

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="border-b border-gray-800 pb-8">
        <Heading level={1} className="text-4xl mb-2 tracking-tight">
          Performance Monitoring
        </Heading>
        <Text size="sm" className="text-gray-500">
          Track response times and identify performance bottlenecks
        </Text>
      </div>

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <div className="space-y-2">
          <Label htmlFor="service-filter">Service</Label>
          <Input
            id="service-filter"
            type="text"
            placeholder="Filter by service..."
            value={serviceFilter}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setServiceFilter(e.target.value)
            }
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="time-range">Time Range</Label>
          <select
            id="time-range"
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as TimeRange)}
            className="px-3 py-2 bg-black border-2 border-gray-800 text-white focus:border-white focus:outline-none"
          >
            <option value="1h">Last Hour</option>
            <option value="6h">Last 6 Hours</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="interval">Interval</Label>
          <select
            id="interval"
            value={interval}
            onChange={(e) => setInterval(e.target.value as Interval)}
            className="px-3 py-2 bg-black border-2 border-gray-800 text-white focus:border-white focus:outline-none"
          >
            <option value="1m">1 minute</option>
            <option value="5m">5 minutes</option>
            <option value="10m">10 minutes</option>
            <option value="1h">1 hour</option>
            <option value="1d">1 day</option>
          </select>
        </div>
      </div>

      {/* Summary Stats */}
      {data && (
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <Text size="sm" className="text-gray-500 uppercase tracking-wider mb-2">
                Total Requests
              </Text>
              <Text className="text-4xl font-bold text-white font-mono">
                {data.total_requests.toLocaleString()}
              </Text>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <Text size="sm" className="text-gray-500 uppercase tracking-wider mb-2">
                Avg Response Time
              </Text>
              <Text className="text-4xl font-bold text-white font-mono">
                {data.buckets.length > 0
                  ? Math.round(
                      data.buckets.reduce((sum, b) => sum + b.avg_duration_ms, 0) /
                        data.buckets.length
                    )
                  : 0}
                <span className="text-lg text-gray-500">ms</span>
              </Text>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <Text size="sm" className="text-gray-500 uppercase tracking-wider mb-2">
                P95 Response Time
              </Text>
              <Text className="text-4xl font-bold text-yellow-500 font-mono">
                {data.buckets.length > 0
                  ? Math.round(
                      data.buckets.reduce((sum, b) => sum + b.p95_duration_ms, 0) /
                        data.buckets.length
                    )
                  : 0}
                <span className="text-lg text-gray-500">ms</span>
              </Text>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <Text size="sm" className="text-gray-500 uppercase tracking-wider mb-2">
                P99 Response Time
              </Text>
              <Text className="text-4xl font-bold text-red-500 font-mono">
                {data.buckets.length > 0
                  ? Math.round(
                      data.buckets.reduce((sum, b) => sum + b.p99_duration_ms, 0) /
                        data.buckets.length
                    )
                  : 0}
                <span className="text-lg text-gray-500">ms</span>
              </Text>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="w-16 h-16 border-2 border-gray-800 relative">
            <div className="absolute inset-2 border border-gray-700 animate-pulse" />
          </div>
        </div>
      )}

      {/* Error */}
      {perfResult.error && (
        <Alert variant="error">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            Failed to load performance data. Please try again.
          </AlertDescription>
        </Alert>
      )}

      {/* Charts and Data */}
      {data && (
        <div className="space-y-6">
          <Card>
            <CardContent className="p-6">
              <PerformanceChart buckets={data.buckets} interval={interval} />
            </CardContent>
          </Card>

          <SlowestOperations operations={data.slowest_operations} />
        </div>
      )}
    </div>
  );
}
