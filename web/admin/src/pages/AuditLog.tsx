import { useQuery } from '@tanstack/react-query'
import { tenantsApi, type AuditLog as AuditLogType } from '../api/tenants'

function formatDate(s: string): string {
  return new Date(s).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

const actionColors: Record<string, string> = {
  'tenant.delete': 'text-danger',
  'tenant.suspend': 'text-warning',
  'tenant.activate': 'text-accent',
  'tenant.reset_key': 'text-info',
  'tenant.reset_password': 'text-info',
  'admin.create': 'text-accent',
  'admin.delete': 'text-danger',
  'admin.login': 'text-text-muted',
  'admin.logout': 'text-text-muted',
}

export function AuditLog() {
  const { data: logs, isLoading } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: () => tenantsApi.listAuditLogs(100),
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-text-primary">Audit Log</h1>
        <div className="text-sm text-text-muted">{(logs || []).length} entries</div>
      </div>

      {isLoading ? (
        <div className="text-text-secondary text-sm">Loading...</div>
      ) : (logs || []).length === 0 ? (
        <div className="text-text-muted text-sm">No audit entries</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-text-muted border-b border-border">
                <th className="pb-2 pr-4 font-medium">Time</th>
                <th className="pb-2 pr-4 font-medium">Admin</th>
                <th className="pb-2 pr-4 font-medium">Action</th>
                <th className="pb-2 pr-4 font-medium">Target</th>
                <th className="pb-2 pr-4 font-medium">Details</th>
              </tr>
            </thead>
            <tbody>
              {(logs || []).map((log: AuditLogType) => (
                <tr key={log.id} className="border-b border-border hover:bg-surface/50">
                  <td className="py-2.5 pr-4 text-text-muted whitespace-nowrap">{formatDate(log.created_at)}</td>
                  <td className="py-2.5 pr-4 text-text-secondary">{log.admin_email}</td>
                  <td className={`py-2.5 pr-4 font-mono ${actionColors[log.action] || 'text-text-primary'}`}>
                    {log.action}
                  </td>
                  <td className="py-2.5 pr-4 text-text-muted">
                    <span className="font-mono text-xs">{log.target_type}</span>
                    {log.target_id && <span className="text-xs"> / {log.target_id}</span>}
                  </td>
                  <td className="py-2.5 pr-4 text-text-muted text-xs">{log.details || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}