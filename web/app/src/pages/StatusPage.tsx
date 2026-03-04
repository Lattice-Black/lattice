import { useMemo, useState } from 'react'
import { useStatus } from '../hooks/useStatus'
import { PublicLayout } from '../components/PublicLayout'
import { MonitorCard } from '../components/MonitorCard'
import { IncidentTimeline } from '../components/IncidentTimeline'
import type { StatusMonitor } from '../api/status'

function groupMonitors(monitors: StatusMonitor[]): Map<string, StatusMonitor[]> {
  const groups = new Map<string, StatusMonitor[]>()

  monitors.forEach(monitor => {
    const group = monitor.group || 'Other'
    const existing = groups.get(group) || []
    groups.set(group, [...existing, monitor])
  })

  return groups
}

export function StatusPage() {
  const { data, isLoading, error } = useStatus()
  const [showPastIncidents, setShowPastIncidents] = useState(false)

  const monitorGroups = useMemo((): Map<string, StatusMonitor[]> => {
    if (!data?.monitors) return new Map<string, StatusMonitor[]>()
    return groupMonitors(data.monitors)
  }, [data?.monitors])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-text-secondary">Loading...</div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-status-down">Failed to load status</div>
      </div>
    )
  }

  return (
    <PublicLayout
      siteName={data.site_name}
      logoUrl={data.logo_url}
      overallStatus={data.overall_status}
    >
      {/* Active Maintenance */}
      {data.active_maintenance.length > 0 && (
        <section className="mb-8">
          <h2 className="text-text-primary text-lg font-semibold mb-4">
            Scheduled Maintenance
          </h2>
          <div className="space-y-3">
            {data.active_maintenance.map(maintenance => (
              <div
                key={maintenance.id}
                className="border border-border rounded bg-surface p-4"
              >
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-5 h-5 text-status-degraded" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-text-primary font-medium">
                    {maintenance.title}
                  </span>
                </div>
                {maintenance.description && (
                  <p className="text-text-secondary text-sm">
                    {maintenance.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Monitor Groups */}
      <section className="mb-8">
        {Array.from(monitorGroups.entries()).map(([groupName, monitors], index) => (
          <div key={groupName} className={index > 0 ? 'mt-6' : ''}>
            {monitorGroups.size > 1 && (
              <>
                {index > 0 && <hr className="border-border mb-4" />}
                <h3 className="text-text-secondary text-sm font-medium mb-3">
                  {groupName}
                </h3>
              </>
            )}
            <div className="space-y-2">
              {monitors.map(monitor => (
                <MonitorCard key={monitor.id} monitor={monitor} />
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* Active Incidents */}
      {data.active_incidents.length > 0 && (
        <section className="mb-8">
          <h2 className="text-text-primary text-lg font-semibold mb-4">
            Active Incidents
          </h2>
          <div className="space-y-4">
            {data.active_incidents.map(incident => (
              <IncidentTimeline key={incident.id} incident={incident} />
            ))}
          </div>
        </section>
      )}

      {/* Past Incidents */}
      {data.past_incidents.length > 0 && (
        <section>
          <button
            onClick={() => setShowPastIncidents(!showPastIncidents)}
            className="flex items-center gap-2 text-text-primary text-lg font-semibold mb-4 hover:text-accent transition-colors"
          >
            <span>Past Incidents</span>
            <svg
              className={`w-4 h-4 transition-transform ${showPastIncidents ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showPastIncidents && (
            <div className="space-y-4">
              {data.past_incidents.map(incident => (
                <IncidentTimeline key={incident.id} incident={incident} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Empty State */}
      {data.monitors.length === 0 && data.active_incidents.length === 0 && (
        <div className="text-center py-12">
          <div className="text-text-secondary">
            No monitors configured yet.
          </div>
        </div>
      )}
    </PublicLayout>
  )
}
