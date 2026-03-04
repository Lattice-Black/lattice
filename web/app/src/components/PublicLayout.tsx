import { ReactNode } from 'react'
import { OverallStatusBadge } from './StatusBadge'
import type { OverallStatus } from '../api/status'

interface PublicLayoutProps {
  children: ReactNode
  siteName: string
  logoUrl?: string
  overallStatus: OverallStatus
}

export function PublicLayout({
  children,
  siteName,
  logoUrl,
  overallStatus,
}: PublicLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              {logoUrl ? (
                <img src={logoUrl} alt={siteName} className="h-8 w-auto" />
              ) : (
                <div className="flex items-center gap-2">
                  <svg className="w-6 h-6 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                  </svg>
                  <span className="text-text-primary text-xl font-semibold">
                    {siteName}
                  </span>
                </div>
              )}
            </div>
            <OverallStatusBadge status={overallStatus} />
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">{children}</main>

      <footer className="border-t border-border mt-auto">
        <div className="max-w-4xl mx-auto px-4 py-6 text-center text-text-secondary text-sm">
          Powered by{' '}
          <span className="text-accent font-medium">Lattice</span>
        </div>
      </footer>
    </div>
  )
}
