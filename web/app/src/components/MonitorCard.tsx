import { useState } from 'react'
import type { StatusMonitor } from '../api/status'
import { StatusBadge } from './StatusBadge'
import { UptimeBars } from './UptimeBars'

interface MonitorCardProps {
  monitor: StatusMonitor
}

export function MonitorCard({ monitor }: MonitorCardProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="border border-border rounded bg-surface">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-background/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-text-primary font-medium">{monitor.name}</span>
          {monitor.status === 'up' && monitor.latency !== undefined && (
            <span className="text-text-secondary text-sm font-mono">
              {monitor.latency}ms
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={monitor.status} size="sm" />
          <svg
            className={`w-4 h-4 text-text-secondary transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-2 border-t border-border">
          <div className="flex justify-between items-center mb-2">
            <span className="text-text-secondary text-sm">90-day uptime</span>
            <span className="text-text-primary text-sm font-mono">
              {monitor.uptime_90d.toFixed(2)}%
            </span>
          </div>
          <UptimeBars history={monitor.history} />
          <div className="flex justify-between mt-2 text-xs text-text-secondary">
            <span>90 days ago</span>
            <span>Today</span>
          </div>
        </div>
      )}
    </div>
  )
}
