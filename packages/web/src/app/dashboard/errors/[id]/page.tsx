'use client';

import { useParams } from 'next/navigation';
import useSWR from 'swr';
import { StackTrace } from '@/components/StackTrace';
import { BreadcrumbTimeline } from '@/components/BreadcrumbTimeline';
import Link from 'next/link';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function ErrorDetailPage() {
  const params = useParams();
  const { data: error, isLoading } = useSWR(
    `/api/v1/errors/${params.id}`,
    fetcher
  );

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">Loading error details...</div>
      </div>
    );
  }

  if (!error) {
    return (
      <div className="p-6">
        <div className="text-red-600">Error not found</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl">
      <div className="mb-6">
        <Link href="/dashboard/errors" className="text-blue-600 hover:text-blue-800 mb-4 inline-block">
          ← Back to errors
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 mt-2">{error.error_type}</h1>
      </div>

      <div className="space-y-6">
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Error Details</h2>
          <dl className="grid grid-cols-2 gap-4">
            <div>
              <dt className="text-sm font-medium text-gray-500">Service</dt>
              <dd className="mt-1 text-sm text-gray-900">{error.service_id}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Environment</dt>
              <dd className="mt-1 text-sm text-gray-900">{error.environment}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Occurrences</dt>
              <dd className="mt-1 text-sm text-gray-900">{error.occurrence_count}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">First Seen</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {new Date(error.first_seen).toLocaleString()}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Last Seen</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {new Date(error.last_seen).toLocaleString()}
              </dd>
            </div>
          </dl>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Message</h2>
          <p className="text-gray-900 font-mono text-sm">{error.message}</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Stack Trace</h2>
          <StackTrace frames={error.stack_trace} />
        </div>

        {error.breadcrumbs && error.breadcrumbs.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">
              Breadcrumb Timeline
              <span className="text-sm font-normal text-gray-500 ml-2">
                ({error.breadcrumbs.length} events)
              </span>
            </h2>
            <BreadcrumbTimeline breadcrumbs={error.breadcrumbs} />
          </div>
        )}

        {error.context && (
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Context</h2>
            <pre className="bg-gray-50 p-4 rounded overflow-x-auto text-sm">
              {JSON.stringify(error.context, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
