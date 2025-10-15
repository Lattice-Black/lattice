'use client';

interface HealthStatusBadgeProps {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
}

export function HealthStatusBadge({ status }: HealthStatusBadgeProps) {
  const getStatusColor = () => {
    switch (status) {
      case 'healthy':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'degraded':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'unhealthy':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'unknown':
        return 'bg-gray-100 text-gray-800 border-gray-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'healthy':
        return '✓';
      case 'degraded':
        return '⚠';
      case 'unhealthy':
        return '✗';
      case 'unknown':
        return '?';
      default:
        return '?';
    }
  };

  return (
    <span
      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor()}`}
    >
      <span>{getStatusIcon()}</span>
      <span className="capitalize">{status}</span>
    </span>
  );
}
