'use client';

import Link from 'next/link';

interface ErrorSummary {
  id: string;
  service_id: string;
  environment: string;
  error_type: string;
  message: string;
  occurrence_count: number;
  first_seen: string;
  last_seen: string;
  resolved: boolean;
  ignored: boolean;
}

interface ErrorListProps {
  errors: ErrorSummary[];
}

export function ErrorList({ errors }: ErrorListProps) {
  if (errors.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        No errors found
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Error Type
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Message
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Service
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Count
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Last Seen
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Status
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {errors.map((error) => (
            <tr key={error.id} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap">
                <Link
                  href={`/dashboard/errors/${error.id}`}
                  className="text-blue-600 hover:text-blue-800 font-medium"
                >
                  {error.error_type}
                </Link>
              </td>
              <td className="px-6 py-4">
                <div className="text-sm text-gray-900 truncate max-w-md">
                  {error.message}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {error.service_id}
                <span className="ml-2 text-xs text-gray-400">{error.environment}</span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {error.occurrence_count}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {new Date(error.last_seen).toLocaleString()}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                {error.resolved ? (
                  <span className="px-2 py-1 text-xs rounded bg-green-100 text-green-800">
                    Resolved
                  </span>
                ) : error.ignored ? (
                  <span className="px-2 py-1 text-xs rounded bg-gray-100 text-gray-800">
                    Ignored
                  </span>
                ) : (
                  <span className="px-2 py-1 text-xs rounded bg-red-100 text-red-800">
                    Active
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
