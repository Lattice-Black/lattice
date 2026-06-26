import { ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { AdminUser } from '../api/admin'
import { adminApi } from '../api/admin'

interface LayoutProps {
  children: ReactNode
  admin: AdminUser | null
}

const navItems = [
  { path: '/', label: 'Tenants', icon: 'M4 6h16M4 10h16M4 14h16M4 18h16' },
  { path: '/users', label: 'Admin Users', icon: 'M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1a4 4 0 11-8 0 4 4 0 018 0zm6 0a4 4 0 11-8 0 4 4 0 018 0z', superAdminOnly: true },
  { path: '/audit', label: 'Audit Log', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
]

export function Layout({ children, admin }: LayoutProps) {
  const navigate = useNavigate()

  const handleLogout = async () => {
    try {
      await adminApi.logout()
    } catch {}
    navigate('/login')
  }

  const visibleNavItems = navItems.filter(
    item => !item.superAdminOnly || admin?.role === 'super_admin'
  )

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:flex-col md:w-64 border-r border-border bg-surface">
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <svg className="w-6 h-6 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
            <div className="flex flex-col">
              <span className="text-text-primary text-sm font-semibold">Lattice</span>
              <span className="text-text-muted text-xs">Control Plane</span>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {visibleNavItems.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded text-sm transition-colors ${
                  isActive
                    ? 'bg-accent/10 text-accent border border-accent/30'
                    : 'text-text-secondary hover:text-text-primary hover:bg-background'
                }`
              }
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
              </svg>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-border">
          <div className="mb-3 px-3">
            <div className="text-xs text-text-muted">{admin?.email}</div>
            <div className="text-xs text-accent">{admin?.role === 'super_admin' ? 'Super Admin' : 'Admin'}</div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2 w-full rounded text-sm text-text-secondary hover:text-text-primary hover:bg-background transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen">
        <main className="flex-1 p-4 md:p-8 pb-20 md:pb-8">{children}</main>
      </div>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-surface border-t border-border flex justify-around py-2">
        {visibleNavItems.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 px-3 py-1 ${
                isActive ? 'text-accent' : 'text-text-secondary'
              }`
            }
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
            </svg>
            <span className="text-xs">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}