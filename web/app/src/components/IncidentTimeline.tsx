import type { Incident, IncidentStatus } from '../api/incidents'

interface IncidentTimelineProps {
  incident: Incident
  showTitle?: boolean
}

const statusConfig: Record<IncidentStatus, { label: string; color: string }> = {
  investigating: { label: 'Investigating', color: 'text-status-down' },
  identified: { label: 'Identified', color: 'text-status-degraded' },
  monitoring: { label: 'Monitoring', color: 'text-status-degraded' },
  resolved: { label: 'Resolved', color: 'text-status-up' },
}

const severityConfig = {
  minor: { label: 'Minor', color: 'text-status-degraded' },
  major: { label: 'Major', color: 'text-status-down' },
  critical: { label: 'Critical', color: 'text-status-down' },
}

function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

export function IncidentTimeline({ incident, showTitle = true }: IncidentTimelineProps) {
  const severity = severityConfig[incident.severity]

  return (
    <div className="border border-border rounded bg-surface p-4">
      {showTitle && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-text-primary font-semibold">{incident.title}</h3>
            <span className={`text-xs font-medium ${severity.color}`}>
              {severity.label}
            </span>
          </div>
          {incident.monitor_name && (
            <span className="text-text-secondary text-sm">
              Affecting: {incident.monitor_name}
            </span>
          )}
        </div>
      )}

      <div className="space-y-4">
        {incident.updates.map((update, index) => {
          const status = statusConfig[update.status]
          const isLast = index === incident.updates.length - 1

          return (
            <div key={update.id} className="relative pl-6">
              <div
                className={`absolute left-0 top-1.5 w-3 h-3 rounded-full border-2 ${
                  update.status === 'resolved'
                    ? 'border-status-up bg-status-up/20'
                    : 'border-text-secondary bg-surface'
                }`}
              />
              {!isLast && (
                <div className="absolute left-[5px] top-5 w-0.5 h-full bg-border" />
              )}

              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-sm font-medium ${status.color}`}>
                    {status.label}
                  </span>
                  <span className="text-text-secondary text-xs">
                    {formatDateTime(update.created_at)}
                  </span>
                </div>
                <p className="text-text-primary text-sm">{update.message}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

interface IncidentListProps {
  incidents: Incident[]
  title?: string
  emptyMessage?: string
  collapsible?: boolean
}

export function IncidentList({
  incidents,
  title,
  emptyMessage = 'No incidents',
  collapsible: _collapsible = false,
}: IncidentListProps) {
  if (incidents.length === 0) {
    return (
      <div className="text-text-secondary text-sm py-4 text-center">
        {emptyMessage}
      </div>
    )
  }

  return (
    <div>
      {title && (
        <h2 className="text-text-primary text-lg font-semibold mb-4">{title}</h2>
      )}
      <div className="space-y-4">
        {incidents.map(incident => (
          <IncidentTimeline
            key={incident.id}
            incident={incident}
            showTitle={true}
          />
        ))}
      </div>
    </div>
  )
}
