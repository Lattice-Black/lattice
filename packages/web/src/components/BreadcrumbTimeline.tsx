'use client';

interface Breadcrumb {
  id?: string;
  session_id: string;
  category: string;
  message: string;
  level: string;
  data?: Record<string, any>;
  timestamp: string | Date;
}

interface BreadcrumbTimelineProps {
  breadcrumbs: Breadcrumb[];
}

export function BreadcrumbTimeline({ breadcrumbs }: BreadcrumbTimelineProps) {
  if (!breadcrumbs || breadcrumbs.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No breadcrumbs available for this session
      </div>
    );
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'navigation':
        return '🧭';
      case 'user':
        return '👤';
      case 'console':
        return '💬';
      case 'error':
        return '❌';
      case 'http':
        return '🌐';
      default:
        return '📌';
    }
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'info':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'debug':
        return 'bg-gray-100 text-gray-800 border-gray-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  return (
    <div className="space-y-2">
      {breadcrumbs.map((breadcrumb, index) => {
        const timestamp = new Date(breadcrumb.timestamp);
        const timeString = timestamp.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          fractionalSecondDigits: 3,
        });

        return (
          <div
            key={breadcrumb.id || index}
            className={`border rounded-lg p-3 ${getLevelColor(breadcrumb.level)}`}
          >
            <div className="flex items-start gap-3">
              {/* Icon */}
              <div className="text-xl flex-shrink-0">
                {getCategoryIcon(breadcrumb.category)}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-xs uppercase font-semibold">
                    {breadcrumb.category}
                  </span>
                  <span className="text-xs text-gray-500">{timeString}</span>
                </div>
                <div className="text-sm break-words">{breadcrumb.message}</div>

                {/* Additional data */}
                {breadcrumb.data && Object.keys(breadcrumb.data).length > 0 && (
                  <details className="mt-2">
                    <summary className="text-xs cursor-pointer text-gray-600 hover:text-gray-800">
                      Show data
                    </summary>
                    <pre className="mt-1 text-xs bg-white/50 p-2 rounded overflow-x-auto">
                      {JSON.stringify(breadcrumb.data, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
