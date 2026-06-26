interface Service {
  name: string
  status: 'operational' | 'degraded' | 'down'
  uptime: number
}

const services: Service[] = [
  { name: 'API', status: 'operational', uptime: 99.98 },
  { name: 'Web App', status: 'operational', uptime: 99.95 },
  { name: 'Database', status: 'operational', uptime: 99.99 },
  { name: 'CDN', status: 'operational', uptime: 100.0 },
  { name: 'Auth Service', status: 'operational', uptime: 99.97 },
]

interface Incident {
  title: string
  status: 'resolved'
  date: string
  duration: string
}

const pastIncidents: Incident[] = [
  {
    title: 'Elevated API latency',
    status: 'resolved',
    date: 'Feb 28, 2026',
    duration: '23 minutes',
  },
]

function UptimeBars() {
  const days = 90
  const bars = Array.from({ length: days }, (_, i) => {
    if (i === 67) return 'degraded'
    if (i === 68) return 'degraded'
    return 'up'
  })

  return (
    <div className="flex items-end gap-px h-8">
      {bars.map((status, i) => (
        <div
          key={i}
          className={`w-[2px] h-full ${
            status === 'up' ? 'bg-status-green' : 'bg-status-yellow'
          } opacity-70`}
        />
      ))}
    </div>
  )
}

function ServiceRow({ service }: { service: Service }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border last:border-b-0">
      <div className="flex items-center gap-2.5">
        <span className="w-1.5 h-1.5 rounded-full bg-status-green" />
        <span className="text-sm text-text-primary">{service.name}</span>
      </div>
      <span className="text-xs text-text-secondary font-mono">
        {service.uptime.toFixed(2)}%
      </span>
    </div>
  )
}

function StatusPageMockup() {
  return (
    <div className="card rounded-none border-accent/30">
      <div className="border-b border-border px-5 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 bg-accent/20 border border-accent/40 flex items-center justify-center">
              <span className="text-accent text-xs font-bold">A</span>
            </div>
            <span className="text-sm font-medium text-text-primary">Acme Inc</span>
          </div>
          <span className="text-xs text-text-secondary font-mono">
            status.acme.io
          </span>
        </div>
      </div>

      <div className="p-5">
        <div className="flex items-center gap-2 mb-6">
          <span className="w-2 h-2 rounded-full bg-status-green animate-pulse-dot" />
          <span className="text-status-green text-sm font-medium">
            All systems operational
          </span>
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-text-secondary uppercase tracking-wider">
              Services
            </span>
            <span className="text-xs text-text-secondary">
              Uptime
            </span>
          </div>
          <div className="border border-border bg-background">
            {services.map((service) => (
              <ServiceRow key={service.name} service={service} />
            ))}
          </div>
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-text-secondary uppercase tracking-wider">
              90-day uptime
            </span>
            <span className="text-xs text-text-secondary">
              99.97%
            </span>
          </div>
          <UptimeBars />
        </div>

        <div>
          <span className="text-xs text-text-secondary uppercase tracking-wider block mb-2">
            Past Incidents
          </span>
          <div className="border border-border bg-background p-3">
            {pastIncidents.map((incident) => (
              <div key={incident.title}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm text-text-primary">{incident.title}</p>
                    <p className="text-xs text-status-green mt-1">
                      Resolved in {incident.duration}
                    </p>
                  </div>
                  <span className="text-xs text-text-secondary whitespace-nowrap">
                    {incident.date}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-border px-5 py-3 text-center">
        <span className="text-xs text-text-secondary">
          Powered by <span className="text-accent">Lattice</span>
        </span>
      </div>
    </div>
  )
}

export default function StatusPreview() {
  return (
    <section className="py-24 lg:py-32 border-b border-border" id="demo">
      <div className="section-container">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-start">
          <div className="lg:sticky lg:top-24">
            <span className="text-accent font-mono text-xs uppercase tracking-widest mb-4 block">
              Public Status Page
            </span>
            <h2 className="text-section-mobile md:text-section-desktop text-text-primary mb-6">
              What your users see
            </h2>
            <p className="text-text-body mb-8">
              A clean, dark-themed status page that builds trust. Real-time status,
              uptime history, and incident timeline. No branding clutter.
            </p>
            <ul className="space-y-3 text-sm text-text-body">
              <li className="flex items-center gap-3">
                <span className="w-1 h-1 bg-accent" />
                Real-time status updates
              </li>
              <li className="flex items-center gap-3">
                <span className="w-1 h-1 bg-accent" />
                90-day uptime visualization
              </li>
              <li className="flex items-center gap-3">
                <span className="w-1 h-1 bg-accent" />
                Full incident history with timeline
              </li>
              <li className="flex items-center gap-3">
                <span className="w-1 h-1 bg-accent" />
                Custom branding (name, colors, CSS)
              </li>
            </ul>
          </div>

          <div>
            <StatusPageMockup />
          </div>
        </div>
      </div>
    </section>
  )
}
