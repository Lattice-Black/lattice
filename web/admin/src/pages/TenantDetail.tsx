import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { tenantsApi, Tenant, TenantKeyResponse } from '../api/tenants'

function formatDate(s: string): string {
  return new Date(s).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export function TenantDetail() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()

  const { data: tenant, isLoading } = useQuery({
    queryKey: ['tenant', id],
    queryFn: () => tenantsApi.get(id!),
    enabled: !!id,
  })

  const [editEmail, setEditEmail] = useState('')
  const [editSlug, setEditSlug] = useState('')
  const [editing, setEditing] = useState(false)
  const [trialDays, setTrialDays] = useState(7)
  const [actionResult, setActionResult] = useState('')
  const [showResult, setShowResult] = useState(false)

  const updateMutation = useMutation({
    mutationFn: (data: { email?: string; slug?: string; status?: Tenant['status'] }) =>
      tenantsApi.update(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant', id] })
      queryClient.invalidateQueries({ queryKey: ['tenants'] })
      setEditing(false)
      setActionResult('Tenant updated')
      setShowResult(true)
    },
  })

  const suspendMutation = useMutation({
    mutationFn: () => tenantsApi.suspend(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant', id] })
      queryClient.invalidateQueries({ queryKey: ['tenants'] })
    },
  })

  const activateMutation = useMutation({
    mutationFn: () => tenantsApi.activate(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant', id] })
      queryClient.invalidateQueries({ queryKey: ['tenants'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => tenantsApi.delete(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] })
      window.history.back()
    },
  })

  const resetKeyMutation = useMutation({
    mutationFn: () => tenantsApi.resetKey(id!),
    onSuccess: (data) => {
      setActionResult(`New API key: ${data.api_key}`)
      setShowResult(true)
    },
  })

  const resetPasswordMutation = useMutation({
    mutationFn: () => tenantsApi.resetPassword(id!),
    onSuccess: (data) => {
      setActionResult(`Temporary password: ${data.temp_password}`)
      setShowResult(true)
    },
  })

  const extendTrialMutation = useMutation({
    mutationFn: () => tenantsApi.extendTrial(id!, { days: trialDays }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['tenant', id] })
      setActionResult(`Trial extended to ${formatDate(data.trial_ends_at)}`)
      setShowResult(true)
    },
  })

  const [showApiKey, setShowApiKey] = useState(false)
  const [tenantKey, setTenantKey] = useState<TenantKeyResponse | null>(null)

  const getApiKeyMutation = useMutation({
    mutationFn: () => tenantsApi.getApiKey(id!),
    onSuccess: (data) => {
      setTenantKey(data)
      setShowApiKey(true)
      setActionResult('')
      setShowResult(false)
    },
  })

  if (isLoading) return <div className="text-text-secondary text-sm">Loading...</div>
  if (!tenant) return <div className="text-text-muted">Tenant not found</div>

  const t: Tenant = tenant

  const startEdit = () => {
    setEditEmail(t.email)
    setEditSlug(t.slug)
    setEditing(true)
    setShowResult(false)
  }

  const saveEdit = () => {
    const data: { email?: string; slug?: string } = {}
    if (editEmail !== t.email) data.email = editEmail
    if (editSlug !== t.slug) data.slug = editSlug
    if (Object.keys(data).length === 0) {
      setEditing(false)
      return
    }
    updateMutation.mutate(data)
  }

  return (
    <div>
      <div className="mb-4">
        <Link to="/" className="text-text-muted text-sm hover:text-text-secondary">← Back to tenants</Link>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-text-primary font-mono">{t.slug}</h1>
          <div className="text-text-muted text-sm mt-1">{t.id}</div>
        </div>
        <div className="flex gap-2">
          {t.status === 'suspended' || t.status === 'trial' ? (
            <button
              onClick={() => activateMutation.mutate()}
              className="px-3 py-1.5 text-sm bg-accent/10 text-accent border border-accent/30 rounded hover:bg-accent/20"
            >
              Activate
            </button>
          ) : null}
          {t.status !== 'suspended' && t.status !== 'deleted' && (
            <button
              onClick={() => suspendMutation.mutate()}
              className="px-3 py-1.5 text-sm bg-warning/10 text-warning border border-warning/30 rounded hover:bg-warning/20"
            >
              Suspend
            </button>
          )}
          <button
            onClick={() => {
              if (confirm(`Delete ${t.slug}? This cannot be undone.`)) {
                deleteMutation.mutate()
              }
            }}
            className="px-3 py-1.5 text-sm bg-danger/10 text-danger border border-danger/30 rounded hover:bg-danger/20"
          >
            Delete
          </button>
        </div>
      </div>

      {showResult && actionResult && (
        <div className="mb-4 p-3 bg-accent/10 border border-accent/30 rounded text-sm text-accent break-all">
          {actionResult}
          <button onClick={() => setShowResult(false)} className="float-right text-text-muted hover:text-text-primary">✕</button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Details card */}
        <div className="border border-border rounded p-5 bg-surface">
          <h2 className="text-sm font-medium text-text-secondary mb-4">Details</h2>
          <div className="space-y-3">
            <div>
              <div className="text-xs text-text-muted">Email</div>
              {editing ? (
                <input
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full mt-1 px-2 py-1 bg-background border border-border rounded text-sm text-text-primary"
                />
              ) : (
                <div className="text-sm text-text-primary">{t.email}</div>
              )}
            </div>
            <div>
              <div className="text-xs text-text-muted">Slug / Subdomain</div>
              {editing ? (
                <input
                  value={editSlug}
                  onChange={(e) => setEditSlug(e.target.value)}
                  className="w-full mt-1 px-2 py-1 bg-background border border-border rounded text-sm text-text-primary font-mono"
                />
              ) : (
                <div className="text-sm text-text-primary font-mono">{t.slug}</div>
              )}
            </div>
            <div>
              <div className="text-xs text-text-muted">Status</div>
              <div className="text-sm text-text-primary">{t.status}</div>
            </div>
            <div>
              <div className="text-xs text-text-muted">Created</div>
              <div className="text-sm text-text-primary">{formatDate(t.created_at)}</div>
            </div>
            <div>
              <div className="text-xs text-text-muted">Updated</div>
              <div className="text-sm text-text-primary">{formatDate(t.updated_at)}</div>
            </div>
            {t.trial_ends_at && (
              <div>
                <div className="text-xs text-text-muted">Trial Ends</div>
                <div className="text-sm text-text-primary">{formatDate(t.trial_ends_at)}</div>
              </div>
            )}
            {t.suspended_at && (
              <div>
                <div className="text-xs text-text-muted">Suspended At</div>
                <div className="text-sm text-text-primary">{formatDate(t.suspended_at)}</div>
              </div>
            )}
          </div>

          {editing ? (
            <div className="flex gap-2 mt-4">
              <button
                onClick={saveEdit}
                className="px-3 py-1.5 text-sm bg-accent text-background rounded hover:bg-accent-hover"
              >
                Save
              </button>
              <button
                onClick={() => setEditing(false)}
                className="px-3 py-1.5 text-sm border border-border text-text-secondary rounded hover:bg-background"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={startEdit}
              className="mt-4 px-3 py-1.5 text-sm border border-border text-text-secondary rounded hover:bg-background"
            >
              Edit
            </button>
          )}
        </div>

        {/* Actions card */}
        <div className="border border-border rounded p-5 bg-surface">
          <h2 className="text-sm font-medium text-text-secondary mb-4">Actions</h2>
          <div className="space-y-4">
            {/* Open Tenant Dashboard */}
            <div>
              <div className="text-xs text-text-muted mb-1">Access the tenant's dashboard directly to manage their monitors, incidents, notifications, and settings.</div>
              {showApiKey && tenantKey ? (
                <div className="space-y-2">
                  <div className="p-3 bg-background border border-border rounded">
                    <div className="text-xs text-text-muted mb-1">API Key</div>
                    <div className="font-mono text-sm text-text-primary break-all">{tenantKey.api_key}</div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <a
                      href={tenantKey.login_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 text-sm bg-accent text-background rounded hover:bg-accent-hover inline-flex items-center gap-1"
                    >
                      Open Dashboard <span className="text-xs">↗</span>
                    </a>
                    <a
                      href={tenantKey.login_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 text-sm border border-border text-text-secondary rounded hover:bg-background"
                    >
                      Auto-Login Link
                    </a>
                    <button
                      onClick={() => { navigator.clipboard.writeText(tenantKey.api_key); }}
                      className="px-3 py-1.5 text-sm border border-border text-text-secondary rounded hover:bg-background"
                    >
                      Copy Key
                    </button>
                    <button
                      onClick={() => setShowApiKey(false)}
                      className="px-3 py-1.5 text-sm border border-border text-text-secondary rounded hover:bg-background"
                    >
                      Hide
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => getApiKeyMutation.mutate()}
                  disabled={getApiKeyMutation.isPending}
                  className="px-3 py-1.5 text-sm bg-accent/10 text-accent border border-accent/30 rounded hover:bg-accent/20"
                >
                  {getApiKeyMutation.isPending ? 'Loading...' : 'Reveal API Key & Open Dashboard'}
                </button>
              )}
            </div>

            <div className="border-t border-border pt-4" />

            {/* Reset API key */}
            <div>
              <div className="text-xs text-text-muted mb-1">Regenerate API key for this tenant. They will need the new key to access their dashboard.</div>
              <button
                onClick={() => {
                  if (confirm('Regenerate API key? The old key will stop working immediately.')) {
                    resetKeyMutation.mutate()
                  }
                }}
                className="px-3 py-1.5 text-sm border border-border text-text-secondary rounded hover:bg-background"
              >
                Reset API Key
              </button>
            </div>

            {/* Reset password */}
            <div>
              <div className="text-xs text-text-muted mb-1">Generate a temporary password. The tenant can use it to log in at the control plane.</div>
              <button
                onClick={() => {
                  if (confirm('Reset tenant password? A temporary password will be generated.')) {
                    resetPasswordMutation.mutate()
                  }
                }}
                className="px-3 py-1.5 text-sm border border-border text-text-secondary rounded hover:bg-background"
              >
                Reset Password
              </button>
            </div>

            {/* Extend trial */}
            {t.status === 'trial' && (
              <div>
                <div className="text-xs text-text-muted mb-1">Extend the trial period.</div>
                <div className="flex gap-2 items-center">
                  <input
                    type="number"
                    value={trialDays}
                    onChange={(e) => setTrialDays(parseInt(e.target.value) || 0)}
                    min={1}
                    max={365}
                    className="w-20 px-2 py-1.5 bg-background border border-border rounded text-sm text-text-primary"
                  />
                  <span className="text-text-muted text-sm">days</span>
                  <button
                    onClick={() => extendTrialMutation.mutate()}
                    className="px-3 py-1.5 text-sm border border-border text-text-secondary rounded hover:bg-background"
                  >
                    Extend Trial
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}