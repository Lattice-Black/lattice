import { Link } from 'react-router-dom'
import { useMonitors } from '../hooks/useMonitors'
import { useIncidents } from '../hooks/useIncidents'
import { Layout } from '../components/Layout'
import { StatusBadge } from '../components/StatusBadge'

function StatCard({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="border border-border rounded bg-surface p-4">
      <div className="text-text-secondary text-sm mb-1">{label}</div>
      <div className={`text-2xl font-semibold font-mono ${color || 'text-text-primary'}`}>
        {value}
      </div>
    </div>
  )
}

export function Dashboard() {
  const { data: monitors, isLoading: monitorsLoading } = useMonitors()
  const { data: incidents, isLoading: incidentsLoading } = useIncidents('active')

  const isLoading = monitorsLoading || incidentsLoading

  const stats = {
    total: monitors?.length || 0,
    up: monitors?.filter(m => m.status === 'up').length || 0,
    down: monitors?.filter(m => m.status === 'down').length || 0,
    openIncidents: incidents?.length || 0,
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        <h1 className="text-text-primary text-2xl font-semibold mb-6">Dashboard</h1>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard label="Total Monitors" value={stats.total} />
          <StatCard label="Monitors Up" value={stats.up} color="text-status-up" />
          <StatCard label="Monitors Down" value={stats.down} color={stats.down > 0 ? 'text-status-down' : undefined} />
          <StatCard label="Open Incidents" value={stats.openIncidents} color={stats.openIncidents > 0 ? 'text-status-down' : undefined} />
        </div>

        {/* Monitor Grid */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-text-primary text-lg font-semibold">Monitors</h2>
            <Link
              to="/dashboard/monitors"
              className="text-accent text-sm hover:underline"
            >
              View all
            </Link>
          </div>

          {isLoading ? (
            <div className="text-text-secondary">Loading...</div>
          ) : monitors?.length === 0 ? (
            <div className="border border-border rounded bg-surface p-6 text-center">
              <p className="text-text-secondary mb-4">No monitors configured yet.</p>
              <Link
                to="/dashboard/monitors"
                className="text-accent hover:underline"
              >
                Add your first monitor
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {monitors?.map(monitor => (
                <div
                  key={monitor.id}
                  className="border border-border rounded bg-surface p-4"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="text-text-primary font-medium">{monitor.name}</h3>
                      <p className="text-text-secondary text-xs font-mono truncate max-w-[200px]">
                        {monitor.url}
                      </p>
                    </div>
                    <StatusBadge status={monitor.status} size="sm" />
                  </div>
                  <div className="flex items-center gap-4 text-xs text-text-secondary">
                    {monitor.latency !== undefined && (
                      <span className="font-mono">{monitor.latency}ms</span>
                    )}
                    {monitor.last_checked && (
                      <span>
                        Last checked:{' '}
                        {new Date(monitor.last_checked).toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Recent Incidents */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-text-primary text-lg font-semibold">Recent Incidents</h2>
            <Link
              to="/dashboard/incidents"
              className="text-accent text-sm hover:underline"
            >
              View all
            </Link>
          </div>

          {incidents?.length === 0 ? (
            <div className="text-text-secondary text-sm">No open incidents</div>
          ) : (
            <div className="space-y-3">
              {incidents?.slice(0, 5).map(incident => (
                <div
                  key={incident.id}
                  className="border border-border rounded bg-surface p-4"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-text-primary font-medium">{incident.title}</h3>
                      {incident.monitor_name && (
                        <p className="text-text-secondary text-sm">
                          {incident.monitor_name}
                        </p>
                      )}
                    </div>
                    <span className={`text-xs font-medium ${
                      incident.severity === 'critical' ? 'text-status-down' :
                      incident.severity === 'major' ? 'text-status-down' :
                      'text-status-degraded'
                    }`}>
                      {incident.severity.charAt(0).toUpperCase() + incident.severity.slice(1)}
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-text-secondary">
                    {new Date(incident.created_at).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </Layout>
  )
}
