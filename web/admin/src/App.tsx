import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { adminApi, AdminUser } from './api/admin'

import { Login } from './pages/Login'
import { Tenants } from './pages/Tenants'
import { TenantDetail } from './pages/TenantDetail'
import { AdminUsers } from './pages/AdminUsers'
import { AuditLog } from './pages/AuditLog'
import { Layout } from './components/Layout'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

function useAuth() {
  const [admin, setAdmin] = useState<AdminUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    adminApi.me()
      .then(setAdmin)
      .catch(() => setAdmin(null))
      .finally(() => setLoading(false))
  }, [])

  return { admin, loading, setAdmin }
}

function RequireAuth({ children, admin }: { children: React.ReactNode, admin: AdminUser | null }) {
  const location = useLocation()
  if (!admin) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }
  return <>{children}</>
}

export function App() {
  const { admin, loading, setAdmin } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-text-secondary text-sm">Loading...</div>
      </div>
    )
  }

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename="/admin">
        <Routes>
          <Route path="/login" element={<Login onLogin={setAdmin} />} />

          <Route path="/" element={
            <RequireAuth admin={admin}>
              <Layout admin={admin}><Tenants /></Layout>
            </RequireAuth>
          } />

          <Route path="/tenants/:id" element={
            <RequireAuth admin={admin}>
              <Layout admin={admin}><TenantDetail /></Layout>
            </RequireAuth>
          } />

          <Route path="/users" element={
            <RequireAuth admin={admin}>
              <Layout admin={admin}>
                {admin?.role === 'super_admin' ? <AdminUsers /> : <div className="text-text-secondary">Access denied</div>}
              </Layout>
            </RequireAuth>
          } />

          <Route path="/audit" element={
            <RequireAuth admin={admin}>
              <Layout admin={admin}><AuditLog /></Layout>
            </RequireAuth>
          } />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}