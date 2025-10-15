'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { PerformanceChart } from '@/components/PerformanceChart';
import { SlowestOperations } from '@/components/SlowestOperations';

const fetcher = (url: string) => fetch(url).then(r => r.json());

type TimeRange = '1h' | '6h' | '24h' | '7d';
type Interval = '1m' | '5m' | '10m' | '1h' | '1d';

export default function PerformancePage() {
  const [timeRange, setTimeRange] = useState<TimeRange>('1h');
  const [interval, setInterval] = useState<Interval>('5m');
  const [serviceFilter, setServiceFilter] = useState('');

  // Calculate start and end times based on selected range
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

  const { data, error, isLoading } = useSWR(
    `/api/v1/performance/metrics?${queryParams.toString()}`,
    fetcher,
    {
      refreshInterval: 10000, // Poll every 10 seconds
      refreshWhenHidden: false,
      refreshWhenOffline: false,
    }
  );

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Performance Monitoring</h1>
        <p className="text-gray-600 mt-2">
          Track response times and identify performance bottlenecks
        </p>
      </div>

      {/* Filters */}
      <div className="mb-6 flex gap-4 flex-wrap">
        <input
          type="text"
          placeholder="Filter by service..."
          value={serviceFilter}
          onChange={(e) => setServiceFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />

        <select
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value as TimeRange)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="1h">Last Hour</option>
          <option value="6h">Last 6 Hours</option>
          <option value="24h">Last 24 Hours</option>
          <option value="7d">Last 7 Days</option>
        </select>

        <select
          value={interval}
          onChange={(e) => setInterval(e.target.value as Interval)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="1m">1 minute</option>
          <option value="5m">5 minutes</option>
          <option value="10m">10 minutes</option>
          <option value="1h">1 hour</option>
          <option value="1d">1 day</option>
        </select>
      </div>

      {/* Summary Stats */}
      {data && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="text-sm font-medium text-gray-500">Total Requests</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">
              {data.total_requests.toLocaleString()}
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="text-sm font-medium text-gray-500">Avg Response Time</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">
              {data.buckets.length > 0
                ? Math.round(
                    data.buckets.reduce((sum: number, b: any) => sum + b.avg_duration_ms, 0) /
                      data.buckets.length
                  )
                : 0}ms
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="text-sm font-medium text-gray-500">P95 Response Time</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">
              {data.buckets.length > 0
                ? Math.round(
                    data.buckets.reduce((sum: number, b: any) => sum + b.p95_duration_ms, 0) /
                      data.buckets.length
                  )
                : 0}ms
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="text-sm font-medium text-gray-500">P99 Response Time</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">
              {data.buckets.length > 0
                ? Math.round(
                    data.buckets.reduce((sum: number, b: any) => sum + b.p99_duration_ms, 0) /
                      data.buckets.length
                  )
                : 0}ms
            </div>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          Failed to load performance data. Please try again.
        </div>
      )}

      {data && (
        <div className="space-y-6">
          {/* Chart */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <PerformanceChart buckets={data.buckets} interval={interval} />
          </div>

          {/* Slowest Operations */}
          <SlowestOperations operations={data.slowest_operations} />
        </div>
      )}
    </div>
  );
}
