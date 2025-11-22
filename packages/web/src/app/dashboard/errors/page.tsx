'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { ErrorList } from '@/components/ErrorList';
import { ErrorItem } from '@/types';
import {
  Heading,
  Text,
  Input,
  Label,
  Alert,
  AlertTitle,
  AlertDescription,
} from '@duro/core';

interface ErrorsResponse {
  errors: ErrorItem[];
  total: number;
}

const fetcher = async (url: string): Promise<unknown> => {
  const res = await fetch(url);
  return res.json() as Promise<unknown>;
};

export default function ErrorsPage() {
  const [serviceFilter, setServiceFilter] = useState('');
  const [environmentFilter, setEnvironmentFilter] = useState('');

  const queryParams = new URLSearchParams();
  if (serviceFilter) queryParams.set('service_id', serviceFilter);
  if (environmentFilter) queryParams.set('environment', environmentFilter);

  const errorsResult = useSWR<ErrorsResponse>(
    `/api/v1/errors?${queryParams.toString()}`,
    fetcher as (url: string) => Promise<ErrorsResponse>,
    {
      refreshInterval: 5000,
      refreshWhenHidden: false,
      refreshWhenOffline: false,
    }
  );
  const { data, isLoading } = errorsResult;

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="border-b border-gray-800 pb-8">
        <Heading level={1} className="text-4xl mb-2 tracking-tight">
          Error Tracking
        </Heading>
        <Text size="sm" className="text-gray-500">
          Monitor and manage errors across your services
        </Text>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
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
          <Label htmlFor="env-filter">Environment</Label>
          <select
            id="env-filter"
            value={environmentFilter}
            onChange={(e) => setEnvironmentFilter(e.target.value)}
            className="w-full px-3 py-2 bg-black border-2 border-gray-800 text-white focus:border-white focus:outline-none"
          >
            <option value="">All Environments</option>
            <option value="development">Development</option>
            <option value="staging">Staging</option>
            <option value="production">Production</option>
          </select>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="w-16 h-16 border-2 border-gray-800 relative">
            <div className="absolute inset-2 border border-gray-700 animate-pulse" />
          </div>
        </div>
      )}

      {/* Error */}
      {errorsResult.error && (
        <Alert variant="error">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            Failed to load errors. Please try again.
          </AlertDescription>
        </Alert>
      )}

      {/* Results */}
      {data && (
        <div className="space-y-4">
          <Text size="sm" className="text-gray-500 font-mono">
            Showing {data.errors.length} of {data.total} errors
          </Text>
          <ErrorList errors={data.errors} />
        </div>
      )}
    </div>
  );
}
