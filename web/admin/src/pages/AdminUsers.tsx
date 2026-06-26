import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminApi, AdminUser, CreateAdminUserRequest } from '../api/admin'

function formatDate(s: string): string {
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function AdminUsers() {
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRole, setNewRole] = useState<'admin' | 'super_admin'>('admin')
  const [error, setError] = useState('')

  const { data: users, isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => adminApi.listUsers(),
  })

  const createMutation = useMutation({
    mutationFn: (data: CreateAdminUserRequest) => adminApi.createUser(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      setShowCreate(false)
      setNewEmail('')
      setNewPassword('')
      setNewRole('admin')
      setError('')
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Failed to create admin')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminApi.deleteUser(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-text-primary">Admin Users</h1>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="px-3 py-1.5 text-sm bg-accent text-background rounded hover:bg-accent-hover"
        >
          {showCreate ? 'Cancel' : 'Add Admin'}
        </button>
      </div>

      {showCreate && (
        <div className="mb-6 border border-border rounded p-5 bg-surface">
          <h2 className="text-sm font-medium text-text-secondary mb-4">Create New Admin</h2>
          {error && (
            <div className="mb-3 text-sm text-danger bg-danger/10 border border-danger/30 rounded px-3 py-2">{error}</div>
          )}
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-text-muted mb-1">Email</label>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded text-sm text-text-primary focus:border-accent"
                placeholder="admin@example.com"
              />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Password (min 8 chars)</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded text-sm text-text-primary focus:border-accent"
                placeholder="••••••••"
              />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Role</label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as 'admin' | 'super_admin')}
                className="w-full px-3 py-2 bg-background border border-border rounded text-sm text-text-primary focus:border-accent"
              >
                <option value="admin">Admin — manage tenants</option>
                <option value="super_admin">Super Admin — full control</option>
              </select>
            </div>
            <button
              onClick={() => createMutation.mutate({ email: newEmail, password: newPassword, role: newRole })}
              disabled={!newEmail || newPassword.length < 8 || createMutation.isPending}
              className="px-4 py-2 text-sm bg-accent text-background rounded hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createMutation.isPending ? 'Creating...' : 'Create Admin'}
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-text-secondary text-sm">Loading...</div>
      ) : (users || []).length === 0 ? (
        <div className="text-text-muted text-sm">No admin users</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-text-muted border-b border-border">
                <th className="pb-2 pr-4 font-medium">Email</th>
                <th className="pb-2 pr-4 font-medium">Role</th>
                <th className="pb-2 pr-4 font-medium">Created</th>
                <th className="pb-2 pr-4 font-medium">Last Login</th>
                <th className="pb-2 pr-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(users || []).map((u: AdminUser) => (
                <tr key={u.id} className="border-b border-border hover:bg-surface/50">
                  <td className="py-3 pr-4 text-text-primary">{u.email}</td>
                  <td className="py-3 pr-4">
                    <span className={`inline-block px-2 py-0.5 text-xs rounded border ${
                      u.role === 'super_admin'
                        ? 'text-accent border-accent/30 bg-accent/10'
                        : 'text-info border-info/30 bg-info/10'
                    }`}>
                      {u.role === 'super_admin' ? 'Super Admin' : 'Admin'}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-text-muted">{formatDate(u.created_at)}</td>
                  <td className="py-3 pr-4 text-text-muted">
                    {u.last_login_at ? formatDate(u.last_login_at) : '—'}
                  </td>
                  <td className="py-3 pr-4">
                    <button
                      onClick={() => {
                        if (confirm(`Remove admin ${u.email}?`)) {
                          deleteMutation.mutate(u.id)
                        }
                      }}
                      className="px-2 py-1 text-xs bg-danger/10 text-danger border border-danger/30 rounded hover:bg-danger/20"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}