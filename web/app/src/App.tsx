import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { getApiKey } from './api/client'

import { StatusPage } from './pages/StatusPage'
import { Login } from './pages/Login'
import { Dashboard } from './pages/Dashboard'
import { Monitors } from './pages/Monitors'
import { Incidents } from './pages/Incidents'
import { NewIncident } from './pages/NewIncident'
import { Notifications } from './pages/Notifications'
import { Maintenance } from './pages/Maintenance'
import { Settings } from './pages/Settings'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

function RequireAuth({ children }: { children: React.ReactNode }) {
  const apiKey = getApiKey()

  if (!apiKey) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/status" element={<StatusPage />} />
          <Route path="/login" element={<Login />} />

          {/* Protected dashboard routes */}
          <Route
            path="/dashboard"
            element={
              <RequireAuth>
                <Dashboard />
              </RequireAuth>
            }
          />
          <Route
            path="/dashboard/monitors"
            element={
              <RequireAuth>
                <Monitors />
              </RequireAuth>
            }
          />
          <Route
            path="/dashboard/incidents"
            element={
              <RequireAuth>
                <Incidents />
              </RequireAuth>
            }
          />
          <Route
            path="/dashboard/incidents/new"
            element={
              <RequireAuth>
                <NewIncident />
              </RequireAuth>
            }
          />
          <Route
            path="/dashboard/notifications"
            element={
              <RequireAuth>
                <Notifications />
              </RequireAuth>
            }
          />
          <Route
            path="/dashboard/maintenance"
            element={
              <RequireAuth>
                <Maintenance />
              </RequireAuth>
            }
          />
          <Route
            path="/dashboard/settings"
            element={
              <RequireAuth>
                <Settings />
              </RequireAuth>
            }
          />

          {/* Redirect root to status page */}
          <Route path="/" element={<Navigate to="/status" replace />} />

          {/* Catch all - redirect to status */}
          <Route path="*" element={<Navigate to="/status" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
