import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { tenantsApi, Tenant } from '../api/tenants'

const statusColors: Record<string, string> = {
  trial: 'text-accent border-accent/30 bg-accent/10',
  active: 'text-accent border-accent/30 bg-accent/10',
  suspended: 'text-warning border-warning/30 bg-warning/10',
  deleted: 'text-danger border-danger/30 bg-danger/10',
}

function formatDate(s: string): string {
  const d = new Date(s)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function Tenants() {
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const { data: tenants, isLoading } = useQuery({
    queryKey: ['tenants', statusFilter],
    queryFn: () => tenantsApi.list(statusFilter || undefined),
  })

  const suspendMutation = useMutation({
    mutationFn: (id: string) => tenantsApi.suspend(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tenants'] }),
  })

  const activateMutation = useMutation({
    mutationFn: (id: string) => tenantsApi.activate(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tenants'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => tenantsApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tenants'] }),
  })

  const filtered = (tenants || []).filter((t: Tenant) => {
    const matchFilter = !filter ||
      t.email.toLowerCase().includes(filter.toLowerCase()) ||
      t.slug.toLowerCase().includes(filter.toLowerCase()) ||
      t.id.toLowerCase().includes(filter.toLowerCase())
    const matchStatus = !statusFilter || t.status === statusFilter
    return matchFilter && matchStatus
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-text-primary">Tenants</h1>
        <div className="text-sm text-text-muted">{filtered.length} total</div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <input
          type="text"
          placeholder="Search email, slug, or ID..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="flex-1 px-3 py-2 bg-surface border border-border rounded text-sm text-text-primary focus:border-accent"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-surface border border-border rounded text-sm text-text-primary focus:border-accent"
        >
          <option value="">All statuses</option>
          <option value="trial">Trial</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-text-secondary text-sm">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-text-muted text-sm py-8 text-center">No tenants found</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-text-muted border-b border-border">
                <th className="pb-2 pr-4 font-medium">Slug</th>
                <th className="pb-2 pr-4 font-medium">Email</th>
                <th className="pb-2 pr-4 font-medium">Status</th>
                <th className="pb-2 pr-4 font-medium">Created</th>
                <th className="pb-2 pr-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t: Tenant) => (
                <tr key={t.id} className="border-b border-border hover:bg-surface/50">
                  <td className="py-3 pr-4">
                    <Link to={`/tenants/${t.id}`} className="text-accent hover:underline font-mono">
                      {t.slug}
                    </Link>
                  </td>
                  <td className="py-3 pr-4 text-text-secondary">{t.email}</td>
                  <td className="py-3 pr-4">
                    <span className={`inline-block px-2 py-0.5 text-xs rounded border ${statusColors[t.status] || ''}`}>
                      {t.status}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-text-muted">{formatDate(t.created_at)}</td>
                  <td className="py-3 pr-4">
                    <div className="flex gap-2">
                      {t.status === 'suspended' ? (
                        <button
                          onClick={() => activateMutation.mutate(t.id)}
                          className="px-2 py-1 text-xs bg-accent/10 text-accent border border-accent/30 rounded hover:bg-accent/20"
                        >
                          Activate
                        </button>
                      ) : (
                        <button
                          onClick={() => suspendMutation.mutate(t.id)}
                          className="px-2 py-1 text-xs bg-warning/10 text-warning border border-warning/30 rounded hover:bg-warning/20"
                        >
                          Suspend
                        </button>
                      )}
                      <button
                        onClick={() => {
                          if (confirm(`Delete tenant ${t.slug}? This will deprovision k8s resources and cancel billing.`)) {
                            deleteMutation.mutate(t.id)
                          }
                        }}
                        className="px-2 py-1 text-xs bg-danger/10 text-danger border border-danger/30 rounded hover:bg-danger/20"
                      >
                        Delete
                      </button>
                    </div>
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