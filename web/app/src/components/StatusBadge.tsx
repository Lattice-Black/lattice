interface StatusBadgeProps {
  status: 'up' | 'down' | 'degraded' | 'unknown'
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
}

const statusConfig = {
  up: {
    label: 'Operational',
    bgColor: 'bg-status-up/10',
    borderColor: 'border-status-up',
    textColor: 'text-status-up',
    dotColor: 'bg-status-up',
  },
  down: {
    label: 'Down',
    bgColor: 'bg-status-down/10',
    borderColor: 'border-status-down',
    textColor: 'text-status-down',
    dotColor: 'bg-status-down',
  },
  degraded: {
    label: 'Degraded',
    bgColor: 'bg-status-degraded/10',
    borderColor: 'border-status-degraded',
    textColor: 'text-status-degraded',
    dotColor: 'bg-status-degraded',
  },
  unknown: {
    label: 'Unknown',
    bgColor: 'bg-no-data/50',
    borderColor: 'border-text-secondary',
    textColor: 'text-text-secondary',
    dotColor: 'bg-text-secondary',
  },
}

const sizeConfig = {
  sm: {
    padding: 'px-2 py-0.5',
    text: 'text-xs',
    dot: 'w-1.5 h-1.5',
  },
  md: {
    padding: 'px-2.5 py-1',
    text: 'text-sm',
    dot: 'w-2 h-2',
  },
  lg: {
    padding: 'px-3 py-1.5',
    text: 'text-base',
    dot: 'w-2.5 h-2.5',
  },
}

export function StatusBadge({ status, size = 'md', showLabel = true }: StatusBadgeProps) {
  const config = statusConfig[status]
  const sizes = sizeConfig[size]

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded border ${config.bgColor} ${config.borderColor} ${config.textColor} ${sizes.padding} ${sizes.text} font-medium`}
    >
      <span className={`${sizes.dot} rounded-full ${config.dotColor}`} />
      {showLabel && config.label}
    </span>
  )
}

interface OverallStatusBadgeProps {
  status: 'operational' | 'degraded' | 'partial_outage' | 'major_outage'
}

const overallStatusConfig = {
  operational: {
    label: 'All Systems Operational',
    bgColor: 'bg-status-up/10',
    borderColor: 'border-status-up',
    textColor: 'text-status-up',
  },
  degraded: {
    label: 'Degraded Performance',
    bgColor: 'bg-status-degraded/10',
    borderColor: 'border-status-degraded',
    textColor: 'text-status-degraded',
  },
  partial_outage: {
    label: 'Partial Outage',
    bgColor: 'bg-status-degraded/10',
    borderColor: 'border-status-degraded',
    textColor: 'text-status-degraded',
  },
  major_outage: {
    label: 'Major Outage',
    bgColor: 'bg-status-down/10',
    borderColor: 'border-status-down',
    textColor: 'text-status-down',
  },
}

export function OverallStatusBadge({ status }: OverallStatusBadgeProps) {
  const config = overallStatusConfig[status]

  return (
    <span
      className={`inline-flex items-center gap-2 rounded border px-4 py-2 text-lg font-semibold ${config.bgColor} ${config.borderColor} ${config.textColor}`}
    >
      {config.label}
    </span>
  )
}
