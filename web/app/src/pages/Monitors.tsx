import { useState } from 'react'
import {
  useMonitors,
  useCreateMonitor,
  useUpdateMonitor,
  useDeleteMonitor,
  useToggleMonitor,
} from '../hooks/useMonitors'
import { Layout } from '../components/Layout'
import { Button } from '../components/Button'
import { Input, Select } from '../components/Input'
import { SlidePanel } from '../components/SlidePanel'
import { StatusBadge } from '../components/StatusBadge'
import type { Monitor, CreateMonitorInput } from '../api/monitors'

const monitorTypeOptions = [
  { value: 'http', label: 'HTTP' },
  { value: 'https', label: 'HTTPS' },
  { value: 'tcp', label: 'TCP' },
  { value: 'dns', label: 'DNS' },
  { value: 'icmp', label: 'ICMP Ping' },
]

const intervalOptions = [
  { value: '30', label: '30 seconds' },
  { value: '60', label: '1 minute' },
  { value: '300', label: '5 minutes' },
  { value: '600', label: '10 minutes' },
]

interface MonitorFormProps {
  monitor?: Monitor
  onSubmit: (data: CreateMonitorInput) => void
  onCancel: () => void
  isLoading?: boolean
}

function MonitorForm({ monitor, onSubmit, onCancel, isLoading }: MonitorFormProps) {
  const [formData, setFormData] = useState({
    name: monitor?.name || '',
    url: monitor?.url || '',
    type: monitor?.type || 'http',
    interval: String(monitor?.interval || 60),
    timeout: String(monitor?.timeout || 30),
    expected_status: String(monitor?.expected_status || 200),
    group: monitor?.group || '',
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({
      name: formData.name,
      url: formData.url,
      type: formData.type as 'http' | 'https' | 'tcp' | 'dns' | 'icmp',
      interval: parseInt(formData.interval),
      timeout: parseInt(formData.timeout),
      expected_status: formData.type === 'http' ? parseInt(formData.expected_status) : undefined,
      group: formData.group || undefined,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Name"
        value={formData.name}
        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        placeholder="My Website"
        required
      />

      <Input
        label="URL"
        value={formData.url}
        onChange={(e) => setFormData({ ...formData, url: e.target.value })}
        placeholder="https://example.com"
        required
      />

      <Select
        label="Type"
        value={formData.type}
        onChange={(e) => setFormData({ ...formData, type: e.target.value as 'http' | 'tcp' | 'ping' | 'dns' })}
        options={monitorTypeOptions}
      />

      <Select
        label="Check Interval"
        value={formData.interval}
        onChange={(e) => setFormData({ ...formData, interval: e.target.value })}
        options={intervalOptions}
      />

      <Input
        label="Timeout (seconds)"
        type="number"
        value={formData.timeout}
        onChange={(e) => setFormData({ ...formData, timeout: e.target.value })}
        min={1}
        max={120}
      />

      {formData.type === 'http' && (
        <Input
          label="Expected Status Code"
          type="number"
          value={formData.expected_status}
          onChange={(e) => setFormData({ ...formData, expected_status: e.target.value })}
          min={100}
          max={599}
        />
      )}

      <Input
        label="Group (optional)"
        value={formData.group}
        onChange={(e) => setFormData({ ...formData, group: e.target.value })}
        placeholder="Infrastructure"
      />

      <div className="flex gap-3 pt-4">
        <Button type="submit" isLoading={isLoading}>
          {monitor ? 'Update Monitor' : 'Create Monitor'}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

export function Monitors() {
  const { data: monitors, isLoading } = useMonitors()
  const createMonitor = useCreateMonitor()
  const updateMonitor = useUpdateMonitor()
  const deleteMonitor = useDeleteMonitor()
  const toggleMonitor = useToggleMonitor()

  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [editingMonitor, setEditingMonitor] = useState<Monitor | undefined>()

  const handleCreate = (data: CreateMonitorInput) => {
    createMonitor.mutate(data, {
      onSuccess: () => {
        setIsPanelOpen(false)
      },
    })
  }

  const handleUpdate = (data: CreateMonitorInput) => {
    if (!editingMonitor) return
    updateMonitor.mutate(
      { id: editingMonitor.id, data },
      {
        onSuccess: () => {
          setIsPanelOpen(false)
          setEditingMonitor(undefined)
        },
      }
    )
  }

  const handleEdit = (monitor: Monitor) => {
    setEditingMonitor(monitor)
    setIsPanelOpen(true)
  }

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this monitor?')) {
      deleteMonitor.mutate(id)
    }
  }

  const handleToggle = (monitor: Monitor) => {
    toggleMonitor.mutate({ id: monitor.id, enabled: !monitor.enabled })
  }

  const closePanel = () => {
    setIsPanelOpen(false)
    setEditingMonitor(undefined)
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-text-primary text-2xl font-semibold">Monitors</h1>
          <Button onClick={() => setIsPanelOpen(true)}>Add Monitor</Button>
        </div>

        {isLoading ? (
          <div className="text-text-secondary">Loading...</div>
        ) : monitors?.length === 0 ? (
          <div className="border border-border rounded bg-surface p-8 text-center">
            <p className="text-text-secondary mb-4">No monitors configured yet.</p>
            <Button onClick={() => setIsPanelOpen(true)}>Add your first monitor</Button>
          </div>
        ) : (
          <div className="border border-border rounded bg-surface overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-background">
                    <th className="text-left text-text-secondary text-xs font-medium px-4 py-3">Name</th>
                    <th className="text-left text-text-secondary text-xs font-medium px-4 py-3 hidden md:table-cell">Type</th>
                    <th className="text-left text-text-secondary text-xs font-medium px-4 py-3 hidden lg:table-cell">URL</th>
                    <th className="text-left text-text-secondary text-xs font-medium px-4 py-3 hidden md:table-cell">Interval</th>
                    <th className="text-left text-text-secondary text-xs font-medium px-4 py-3">Status</th>
                    <th className="text-left text-text-secondary text-xs font-medium px-4 py-3 hidden sm:table-cell">Last Checked</th>
                    <th className="text-right text-text-secondary text-xs font-medium px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {monitors?.map(monitor => (
                    <tr key={monitor.id} className="border-b border-border last:border-b-0">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`text-text-primary font-medium ${!monitor.enabled ? 'opacity-50' : ''}`}>
                            {monitor.name}
                          </span>
                          {!monitor.enabled && (
                            <span className="text-text-secondary text-xs">(disabled)</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-text-secondary text-sm uppercase hidden md:table-cell">
                        {monitor.type}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className="text-text-secondary text-sm font-mono truncate block max-w-[200px]">
                          {monitor.url}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-text-secondary text-sm hidden md:table-cell">
                        {monitor.interval >= 60 ? `${monitor.interval / 60}m` : `${monitor.interval}s`}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={monitor.status} size="sm" />
                      </td>
                      <td className="px-4 py-3 text-text-secondary text-sm hidden sm:table-cell">
                        {monitor.last_checked
                          ? new Date(monitor.last_checked).toLocaleString()
                          : 'Never'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleToggle(monitor)}
                            className="p-1 text-text-secondary hover:text-text-primary transition-colors"
                            title={monitor.enabled ? 'Disable' : 'Enable'}
                          >
                            {monitor.enabled ? (
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            ) : (
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                              </svg>
                            )}
                          </button>
                          <button
                            onClick={() => handleEdit(monitor)}
                            className="p-1 text-text-secondary hover:text-text-primary transition-colors"
                            title="Edit"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDelete(monitor.id)}
                            className="p-1 text-text-secondary hover:text-status-down transition-colors"
                            title="Delete"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <SlidePanel
          isOpen={isPanelOpen}
          onClose={closePanel}
          title={editingMonitor ? 'Edit Monitor' : 'Add Monitor'}
        >
          <MonitorForm
            monitor={editingMonitor}
            onSubmit={editingMonitor ? handleUpdate : handleCreate}
            onCancel={closePanel}
            isLoading={createMonitor.isPending || updateMonitor.isPending}
          />
        </SlidePanel>
      </div>
    </Layout>
  )
}
