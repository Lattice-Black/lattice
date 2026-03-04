import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCreateIncident } from '../hooks/useIncidents'
import { useMonitors } from '../hooks/useMonitors'
import { Layout } from '../components/Layout'
import { Button } from '../components/Button'
import { Input, Select, Textarea } from '../components/Input'
import type { IncidentSeverity } from '../api/incidents'

const severityOptions = [
  { value: 'minor', label: 'Minor' },
  { value: 'major', label: 'Major' },
  { value: 'critical', label: 'Critical' },
]

export function NewIncident() {
  const navigate = useNavigate()
  const createIncident = useCreateIncident()
  const { data: monitors } = useMonitors()

  const [formData, setFormData] = useState({
    title: '',
    monitor_id: '',
    severity: 'minor' as IncidentSeverity,
    message: '',
  })

  const monitorOptions = [
    { value: '', label: 'Select a monitor (optional)' },
    ...(monitors?.map(m => ({ value: m.id, label: m.name })) || []),
  ]

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    createIncident.mutate(
      {
        title: formData.title,
        monitor_id: formData.monitor_id || undefined,
        severity: formData.severity,
        message: formData.message,
      },
      {
        onSuccess: () => {
          navigate('/dashboard/incidents')
        },
      }
    )
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        <h1 className="text-text-primary text-2xl font-semibold mb-6">New Incident</h1>

        <div className="border border-border rounded bg-surface p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Brief description of the incident"
              required
            />

            <Select
              label="Affected Monitor"
              value={formData.monitor_id}
              onChange={(e) => setFormData({ ...formData, monitor_id: e.target.value })}
              options={monitorOptions}
            />

            <Select
              label="Severity"
              value={formData.severity}
              onChange={(e) => setFormData({ ...formData, severity: e.target.value as IncidentSeverity })}
              options={severityOptions}
            />

            <Textarea
              label="Initial Update"
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              placeholder="Describe the current situation and what you're investigating"
              required
            />

            <div className="flex gap-3 pt-4">
              <Button type="submit" isLoading={createIncident.isPending}>
                Create Incident
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => navigate('/dashboard/incidents')}
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  )
}
