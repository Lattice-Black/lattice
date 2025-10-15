'use client';

interface SlowOperation {
  operation_name: string;
  avg_duration_ms: number;
  count: number;
}

interface SlowestOperationsProps {
  operations: SlowOperation[];
}

export function SlowestOperations({ operations }: SlowestOperationsProps) {
  if (!operations || operations.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Slowest Operations</h2>
        <p className="text-gray-500">No operations data available</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <h2 className="text-xl font-semibold mb-4">Slowest Operations</h2>
      <div className="space-y-3">
        {operations.map((op, index) => {
          // Determine color based on severity
          let severityColor = 'bg-green-100 text-green-800';
          if (op.avg_duration_ms > 3000) {
            severityColor = 'bg-red-100 text-red-800';
          } else if (op.avg_duration_ms > 1000) {
            severityColor = 'bg-yellow-100 text-yellow-800';
          }

          return (
            <div
              key={index}
              className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-mono text-sm font-semibold text-gray-900 flex-1">
                  {op.operation_name}
                </h3>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${severityColor}`}>
                  {op.avg_duration_ms.toLocaleString()}ms
                </span>
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <span>{op.count.toLocaleString()} requests</span>
                <span>•</span>
                <span>Avg: {op.avg_duration_ms.toLocaleString()}ms</span>
              </div>
              {/* Progress bar showing relative slowness */}
              <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${
                    op.avg_duration_ms > 3000
                      ? 'bg-red-500'
                      : op.avg_duration_ms > 1000
                      ? 'bg-yellow-500'
                      : 'bg-green-500'
                  }`}
                  style={{
                    width: `${Math.min((op.avg_duration_ms / operations[0].avg_duration_ms) * 100, 100)}%`,
                  }}
                ></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
