import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  useIncidents,
  useAddIncidentUpdate,
  useResolveIncident,
  useDeleteIncident,
} from '../hooks/useIncidents'
import { Layout } from '../components/Layout'
import { Button } from '../components/Button'
import { Select, Textarea } from '../components/Input'
import { SlidePanel } from '../components/SlidePanel'
import { IncidentTimeline } from '../components/IncidentTimeline'
import type { Incident, IncidentStatus } from '../api/incidents'

const statusOptions = [
  { value: 'investigating', label: 'Investigating' },
  { value: 'identified', label: 'Identified' },
  { value: 'monitoring', label: 'Monitoring' },
  { value: 'resolved', label: 'Resolved' },
]

interface UpdateFormProps {
  incident: Incident
  onClose: () => void
}

function UpdateForm({ incident, onClose }: UpdateFormProps) {
  const addUpdate = useAddIncidentUpdate()
  const resolveIncident = useResolveIncident()

  const [status, setStatus] = useState<IncidentStatus>(incident.status)
  const [message, setMessage] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (status === 'resolved') {
      resolveIncident.mutate(
        { id: incident.id, message: message || undefined },
        { onSuccess: onClose }
      )
    } else {
      addUpdate.mutate(
        { id: incident.id, data: { status, message } },
        { onSuccess: onClose }
      )
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Select
        label="Status"
        value={status}
        onChange={(e) => setStatus(e.target.value as IncidentStatus)}
        options={statusOptions}
      />

      <Textarea
        label="Update Message"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="What's the latest?"
        required
      />

      <div className="flex gap-3 pt-4">
        <Button
          type="submit"
          isLoading={addUpdate.isPending || resolveIncident.isPending}
        >
          {status === 'resolved' ? 'Resolve Incident' : 'Add Update'}
        </Button>
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

export function Incidents() {
  const { data: activeIncidents, isLoading: activeLoading } = useIncidents('active')
  const { data: resolvedIncidents, isLoading: resolvedLoading } = useIncidents('resolved')
  const deleteIncident = useDeleteIncident()

  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const isLoading = activeLoading || resolvedLoading

  const toggleExpanded = (id: string) => {
    const newSet = new Set(expandedIds)
    if (newSet.has(id)) {
      newSet.delete(id)
    } else {
      newSet.add(id)
    }
    setExpandedIds(newSet)
  }

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this incident?')) {
      deleteIncident.mutate(id)
    }
  }

  const severityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'text-status-down'
      case 'major':
        return 'text-status-down'
      default:
        return 'text-status-degraded'
    }
  }

  const renderIncidentRow = (incident: Incident) => {
    const isExpanded = expandedIds.has(incident.id)

    return (
      <div key={incident.id} className="border-b border-border last:border-b-0">
        <div className="px-4 py-3">
          <div className="flex items-start justify-between">
            <button
              onClick={() => toggleExpanded(incident.id)}
              className="flex-1 text-left"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-text-primary font-medium">{incident.title}</span>
                <span className={`text-xs font-medium ${severityColor(incident.severity)}`}>
                  {incident.severity.charAt(0).toUpperCase() + incident.severity.slice(1)}
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs text-text-secondary">
                {incident.monitor_name && <span>{incident.monitor_name}</span>}
                <span>{new Date(incident.created_at).toLocaleString()}</span>
                <span className={incident.status === 'resolved' ? 'text-status-up' : ''}>
                  {incident.status.charAt(0).toUpperCase() + incident.status.slice(1)}
                </span>
              </div>
            </button>
            <div className="flex items-center gap-2">
              {incident.status !== 'resolved' && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setSelectedIncident(incident)}
                >
                  Update
                </Button>
              )}
              <button
                onClick={() => handleDelete(incident.id)}
                className="p-1 text-text-secondary hover:text-status-down transition-colors"
                title="Delete"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {isExpanded && (
          <div className="px-4 pb-4">
            <IncidentTimeline incident={incident} showTitle={false} />
          </div>
        )}
      </div>
    )
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-text-primary text-2xl font-semibold">Incidents</h1>
          <Link to="/dashboard/incidents/new">
            <Button>New Incident</Button>
          </Link>
        </div>

        {isLoading ? (
          <div className="text-text-secondary">Loading...</div>
        ) : (
          <>
            {/* Active Incidents */}
            <section className="mb-8">
              <h2 className="text-text-secondary text-sm font-medium mb-3">Active Incidents</h2>
              {activeIncidents?.length === 0 ? (
                <div className="border border-border rounded bg-surface p-4 text-center text-text-secondary">
                  No active incidents
                </div>
              ) : (
                <div className="border border-border rounded bg-surface">
                  {activeIncidents?.map(renderIncidentRow)}
                </div>
              )}
            </section>

            {/* Resolved Incidents */}
            <section>
              <h2 className="text-text-secondary text-sm font-medium mb-3">Resolved Incidents</h2>
              {resolvedIncidents?.length === 0 ? (
                <div className="border border-border rounded bg-surface p-4 text-center text-text-secondary">
                  No resolved incidents
                </div>
              ) : (
                <div className="border border-border rounded bg-surface">
                  {resolvedIncidents?.slice(0, 10).map(renderIncidentRow)}
                </div>
              )}
            </section>
          </>
        )}

        <SlidePanel
          isOpen={!!selectedIncident}
          onClose={() => setSelectedIncident(null)}
          title="Update Incident"
        >
          {selectedIncident && (
            <UpdateForm
              incident={selectedIncident}
              onClose={() => setSelectedIncident(null)}
            />
          )}
        </SlidePanel>
      </div>
    </Layout>
  )
}
