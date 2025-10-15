'use client';

interface StackFrame {
  filename: string;
  line_number: number;
  column_number?: number;
  function_name?: string;
}

interface StackTraceProps {
  frames: StackFrame[];
}

export function StackTrace({ frames }: StackTraceProps) {
  return (
    <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
      <div className="font-mono text-sm space-y-2">
        {frames.map((frame, index) => (
          <div key={index} className="flex items-start space-x-2">
            <span className="text-gray-500 min-w-[2rem]">{index + 1}</span>
            <div>
              <span className="text-blue-400">{frame.function_name || '<anonymous>'}</span>
              <span className="text-gray-500"> at </span>
              <span className="text-green-400">{frame.filename}</span>
              <span className="text-gray-500">:</span>
              <span className="text-yellow-400">{frame.line_number}</span>
              {frame.column_number && (
                <>
                  <span className="text-gray-500">:</span>
                  <span className="text-yellow-400">{frame.column_number}</span>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
