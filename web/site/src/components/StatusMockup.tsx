import { useState, useEffect } from 'react'

interface Monitor {
  name: string
  status: 'operational' | 'degraded' | 'down'
  uptime: number
  uptimeBars: ('up' | 'degraded' | 'down')[]
}

const monitors: Monitor[] = [
  {
    name: 'API Server',
    status: 'operational',
    uptime: 99.98,
    uptimeBars: Array(30).fill('up'),
  },
  {
    name: 'Web Application',
    status: 'operational',
    uptime: 99.95,
    uptimeBars: [...Array(28).fill('up'), 'degraded', 'up'],
  },
  {
    name: 'Database Cluster',
    status: 'degraded',
    uptime: 98.72,
    uptimeBars: [...Array(25).fill('up'), 'degraded', 'degraded', 'up', 'degraded', 'up'],
  },
  {
    name: 'CDN Edge',
    status: 'operational',
    uptime: 100.0,
    uptimeBars: Array(30).fill('up'),
  },
]

function StatusDot({ status }: { status: Monitor['status'] }) {
  const colors = {
    operational: 'bg-status-green',
    degraded: 'bg-status-yellow',
    down: 'bg-status-red',
  }

  return (
    <span
      className={`w-2 h-2 rounded-full ${colors[status]} animate-pulse-dot`}
    />
  )
}

function UptimeBar({ status }: { status: 'up' | 'degraded' | 'down' }) {
  const colors = {
    up: 'bg-status-green',
    degraded: 'bg-status-yellow',
    down: 'bg-status-red',
  }

  return (
    <div
      className={`w-1 h-4 ${colors[status]} opacity-80`}
    />
  )
}

function MonitorRow({ monitor, index }: { monitor: Monitor; index: number }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), index * 100)
    return () => clearTimeout(timer)
  }, [index])

  return (
    <div
      className={`flex items-center justify-between py-3 border-b border-border last:border-b-0 transition-opacity duration-300 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div className="flex items-center gap-3">
        <StatusDot status={monitor.status} />
        <span className="text-sm text-text-primary font-medium">
          {monitor.name}
        </span>
      </div>
      <div className="flex items-center gap-4">
        <div className="hidden sm:flex items-center gap-px">
          {monitor.uptimeBars.slice(-15).map((bar, i) => (
            <UptimeBar key={i} status={bar} />
          ))}
        </div>
        <span className="text-xs text-text-secondary font-mono w-16 text-right">
          {monitor.uptime.toFixed(2)}%
        </span>
      </div>
    </div>
  )
}

export default function StatusMockup() {
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  const operationalCount = monitors.filter(m => m.status === 'operational').length
  const allOperational = operationalCount === monitors.length

  return (
    <div className="card rounded border-accent/50">
      <div className="border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-status-red opacity-60" />
          <div className="w-3 h-3 rounded-full bg-status-yellow opacity-60" />
          <div className="w-3 h-3 rounded-full bg-status-green opacity-60" />
        </div>
        <span className="text-xs text-text-secondary font-mono">
          status.acme.io
        </span>
      </div>

      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-text-primary">
              System Status
            </h3>
            <p className={`text-sm ${allOperational ? 'text-status-green' : 'text-status-yellow'}`}>
              {allOperational ? 'All systems operational' : 'Partial system degradation'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-text-secondary font-mono">
              {time.toLocaleTimeString('en-US', { hour12: false })}
            </p>
            <p className="text-xs text-text-secondary">
              UTC
            </p>
          </div>
        </div>

        <div className="space-y-0">
          {monitors.map((monitor, i) => (
            <MonitorRow key={monitor.name} monitor={monitor} index={i} />
          ))}
        </div>

        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex items-center justify-between text-xs text-text-secondary">
            <span>Last 30 days</span>
            <span className="font-mono">
              {operationalCount}/{monitors.length} operational
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
