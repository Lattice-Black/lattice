import { useState } from 'react'
import {
  useMaintenance,
  useCreateMaintenance,
  useDeleteMaintenance,
} from '../hooks/useMaintenance'
import { useMonitors } from '../hooks/useMonitors'
import { Layout } from '../components/Layout'
import { Button } from '../components/Button'
import { Input, Select, Textarea } from '../components/Input'
import { SlidePanel } from '../components/SlidePanel'
import type { MaintenanceWindow, CreateMaintenanceInput } from '../api/maintenance'

interface MaintenanceFormProps {
  onSubmit: (data: CreateMaintenanceInput) => void
  onCancel: () => void
  isLoading?: boolean
}

function MaintenanceForm({ onSubmit, onCancel, isLoading }: MaintenanceFormProps) {
  const { data: monitors } = useMonitors()

  const [formData, setFormData] = useState({
    monitor_id: '',
    title: '',
    description: '',
    start_time: '',
    end_time: '',
  })

  const monitorOptions = [
    { value: '', label: 'Select a monitor' },
    ...(monitors?.map(m => ({ value: m.id, label: m.name })) || []),
  ]

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({
      monitor_id: formData.monitor_id,
      title: formData.title,
      description: formData.description || undefined,
      start_time: new Date(formData.start_time).toISOString(),
      end_time: new Date(formData.end_time).toISOString(),
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Select
        label="Monitor"
        value={formData.monitor_id}
        onChange={(e) => setFormData({ ...formData, monitor_id: e.target.value })}
        options={monitorOptions}
        required
      />

      <Input
        label="Title"
        value={formData.title}
        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
        placeholder="Scheduled database maintenance"
        required
      />

      <Textarea
        label="Description (optional)"
        value={formData.description}
        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
        placeholder="Brief description of the maintenance work"
      />

      <Input
        label="Start Time"
        type="datetime-local"
        value={formData.start_time}
        onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
        required
      />

      <Input
        label="End Time"
        type="datetime-local"
        value={formData.end_time}
        onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
        required
      />

      <div className="flex gap-3 pt-4">
        <Button type="submit" isLoading={isLoading}>
          Schedule Maintenance
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function getMaintenanceStatus(maintenance: MaintenanceWindow): 'upcoming' | 'active' | 'past' {
  const now = new Date()
  const start = new Date(maintenance.start_time)
  const end = new Date(maintenance.end_time)

  if (now < start) return 'upcoming'
  if (now >= start && now <= end) return 'active'
  return 'past'
}

export function Maintenance() {
  const { data: maintenanceWindows, isLoading } = useMaintenance()
  const createMaintenance = useCreateMaintenance()
  const deleteMaintenance = useDeleteMaintenance()

  const [isPanelOpen, setIsPanelOpen] = useState(false)

  const handleCreate = (data: CreateMaintenanceInput) => {
    createMaintenance.mutate(data, {
      onSuccess: () => setIsPanelOpen(false),
    })
  }

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this maintenance window?')) {
      deleteMaintenance.mutate(id)
    }
  }

  const upcoming = maintenanceWindows?.filter(m => getMaintenanceStatus(m) === 'upcoming') || []
  const active = maintenanceWindows?.filter(m => getMaintenanceStatus(m) === 'active') || []
  const past = maintenanceWindows?.filter(m => getMaintenanceStatus(m) === 'past') || []

  const renderMaintenanceCard = (maintenance: MaintenanceWindow) => {
    const status = getMaintenanceStatus(maintenance)

    return (
      <div
        key={maintenance.id}
        className="border border-border rounded bg-surface p-4"
      >
        <div className="flex items-start justify-between mb-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-text-primary font-medium">{maintenance.title}</span>
              {status === 'active' && (
                <span className="text-xs px-2 py-0.5 rounded bg-status-degraded/10 border border-status-degraded text-status-degraded">
                  In Progress
                </span>
              )}
            </div>
            {maintenance.monitor_name && (
              <span className="text-text-secondary text-sm">{maintenance.monitor_name}</span>
            )}
          </div>
          <button
            onClick={() => handleDelete(maintenance.id)}
            className="p-1 text-text-secondary hover:text-status-down transition-colors"
            title="Delete"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>

        {maintenance.description && (
          <p className="text-text-secondary text-sm mb-2">{maintenance.description}</p>
        )}

        <div className="flex items-center gap-4 text-xs text-text-secondary">
          <span>{formatDateTime(maintenance.start_time)}</span>
          <span>→</span>
          <span>{formatDateTime(maintenance.end_time)}</span>
        </div>
      </div>
    )
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-text-primary text-2xl font-semibold">Maintenance</h1>
          <Button onClick={() => setIsPanelOpen(true)}>Schedule Maintenance</Button>
        </div>

        {isLoading ? (
          <div className="text-text-secondary">Loading...</div>
        ) : maintenanceWindows?.length === 0 ? (
          <div className="border border-border rounded bg-surface p-8 text-center">
            <p className="text-text-secondary mb-4">No maintenance windows scheduled.</p>
            <Button onClick={() => setIsPanelOpen(true)}>Schedule your first maintenance</Button>
          </div>
        ) : (
          <>
            {/* Active */}
            {active.length > 0 && (
              <section className="mb-6">
                <h2 className="text-text-secondary text-sm font-medium mb-3">Active</h2>
                <div className="space-y-3">
                  {active.map(renderMaintenanceCard)}
                </div>
              </section>
            )}

            {/* Upcoming */}
            <section className="mb-6">
              <h2 className="text-text-secondary text-sm font-medium mb-3">Upcoming</h2>
              {upcoming.length === 0 ? (
                <div className="text-text-secondary text-sm">No upcoming maintenance</div>
              ) : (
                <div className="space-y-3">
                  {upcoming.map(renderMaintenanceCard)}
                </div>
              )}
            </section>

            {/* Past */}
            {past.length > 0 && (
              <section>
                <h2 className="text-text-secondary text-sm font-medium mb-3">Past</h2>
                <div className="space-y-3">
                  {past.slice(0, 5).map(renderMaintenanceCard)}
                </div>
              </section>
            )}
          </>
        )}

        <SlidePanel
          isOpen={isPanelOpen}
          onClose={() => setIsPanelOpen(false)}
          title="Schedule Maintenance"
        >
          <MaintenanceForm
            onSubmit={handleCreate}
            onCancel={() => setIsPanelOpen(false)}
            isLoading={createMaintenance.isPending}
          />
        </SlidePanel>
      </div>
    </Layout>
  )
}
