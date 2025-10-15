'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { ErrorList } from '@/components/ErrorList';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function ErrorsPage() {
  const [serviceFilter, setServiceFilter] = useState('');
  const [environmentFilter, setEnvironmentFilter] = useState('');

  const queryParams = new URLSearchParams();
  if (serviceFilter) queryParams.set('service_id', serviceFilter);
  if (environmentFilter) queryParams.set('environment', environmentFilter);

  const { data, error, isLoading } = useSWR(
    `/api/v1/errors?${queryParams.toString()}`,
    fetcher,
    {
      refreshInterval: 5000, // Poll every 5 seconds
      refreshWhenHidden: false,
      refreshWhenOffline: false,
    }
  );

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Error Tracking</h1>
        <p className="text-gray-600 mt-2">
          Monitor and manage errors across your services
        </p>
      </div>

      <div className="mb-6 flex gap-4">
        <input
          type="text"
          placeholder="Filter by service..."
          value={serviceFilter}
          onChange={(e) => setServiceFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
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

      {isLoading && (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          Failed to load errors. Please try again.
        </div>
      )}

      {data && (
        <>
          <div className="mb-4 text-sm text-gray-600">
            Showing {data.errors.length} of {data.total} errors
          </div>
          <ErrorList errors={data.errors} />
        </>
      )}
    </div>
  );
}
