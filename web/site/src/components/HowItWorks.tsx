import CopyButton from './CopyButton'

const dockerCommand = 'docker run -p 8080:8080 ghcr.io/lattice-black/lattice'

const yamlConfig = `monitors:
  - name: API Server
    url: https://api.example.com/health
    interval: 30s

  - name: Database
    type: tcp
    host: db.internal:5432
    interval: 60s`

interface StepProps {
  number: string
  title: string
  children: React.ReactNode
}

function Step({ number, title, children }: StepProps) {
  return (
    <div className="relative p-6 lg:p-8 border-b lg:border-b-0 lg:border-r border-border last:border-b-0 last:border-r-0">
      <span className="absolute top-4 right-4 text-6xl lg:text-8xl font-bold text-border select-none">
        {number}
      </span>
      <div className="relative z-10">
        <h3 className="text-xl font-semibold text-text-primary mb-4">{title}</h3>
        {children}
      </div>
    </div>
  )
}

export default function HowItWorks() {
  return (
    <section className="py-24 lg:py-32 border-b border-border" id="get-started">
      <div className="section-container">
        <div className="mb-12 lg:mb-16">
          <h2 className="text-section-mobile md:text-section-desktop text-text-primary">
            Up and running in minutes
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 border border-border">
          <Step number="01" title="Deploy">
            <p className="text-text-body text-sm mb-4">
              One command. No database to install, no Redis, no external services.
            </p>
            <div className="bg-background border border-border p-3 flex items-center justify-between gap-2">
              <code className="text-xs text-accent font-mono overflow-x-auto whitespace-nowrap">
                {dockerCommand}
              </code>
              <CopyButton text={dockerCommand} />
            </div>
          </Step>

          <Step number="02" title="Configure">
            <p className="text-text-body text-sm mb-4">
              Simple YAML configuration. Define what to monitor.
            </p>
            <div className="bg-background border border-border p-3">
              <pre className="text-xs text-text-body font-mono overflow-x-auto">
                {yamlConfig}
              </pre>
            </div>
          </Step>

          <Step number="03" title="Watch">
            <p className="text-text-body text-sm mb-4">
              Your status page is live. Share it with your users.
            </p>
            <div className="bg-background border border-border p-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-status-green animate-pulse-dot" />
              <code className="text-xs text-text-body font-mono">
                localhost:8080/status
              </code>
            </div>
            <p className="text-xs text-text-secondary mt-3">
              Incidents, notifications, and 90-day history included.
            </p>
          </Step>
        </div>
      </div>
    </section>
  )
}
