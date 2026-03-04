import { useState } from 'react'
import {
  useNotifications,
  useCreateNotification,
  useUpdateNotification,
  useDeleteNotification,
  useTestNotification,
} from '../hooks/useNotifications'
import { Layout } from '../components/Layout'
import { Button } from '../components/Button'
import { Input, Select } from '../components/Input'
import { SlidePanel } from '../components/SlidePanel'
import type { NotificationChannel, NotificationType, CreateNotificationInput } from '../api/notifications'

const typeOptions = [
  { value: 'email', label: 'Email' },
  { value: 'slack', label: 'Slack' },
  { value: 'webhook', label: 'Webhook' },
  { value: 'pagerduty', label: 'PagerDuty' },
  { value: 'discord', label: 'Discord' },
]

const typeIcons: Record<NotificationType, string> = {
  email: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  slack: 'M14.5 10c-.83 0-1.5-.67-1.5-1.5v-5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5z M9.5 10H6.5C5.67 10 5 10.67 5 11.5S5.67 13 6.5 13H9.5C10.33 13 11 12.33 11 11.5S10.33 10 9.5 10z',
  webhook: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1',
  pagerduty: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  discord: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
}

interface NotificationFormProps {
  notification?: NotificationChannel
  onSubmit: (data: CreateNotificationInput) => void
  onCancel: () => void
  isLoading?: boolean
}

function NotificationForm({ notification, onSubmit, onCancel, isLoading }: NotificationFormProps) {
  const [type, setType] = useState<NotificationType>(notification?.type || 'email')
  const [name, setName] = useState(notification?.name || '')
  const [config, setConfig] = useState<Record<string, string>>(notification?.config || {})

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({ name, type, config })
  }

  const renderConfigFields = () => {
    switch (type) {
      case 'email':
        return (
          <Input
            label="Email Address"
            type="email"
            value={config.email || ''}
            onChange={(e) => setConfig({ ...config, email: e.target.value })}
            placeholder="alerts@example.com"
            required
          />
        )
      case 'slack':
        return (
          <Input
            label="Webhook URL"
            value={config.webhook_url || ''}
            onChange={(e) => setConfig({ ...config, webhook_url: e.target.value })}
            placeholder="https://hooks.slack.com/services/..."
            required
          />
        )
      case 'discord':
        return (
          <Input
            label="Webhook URL"
            value={config.webhook_url || ''}
            onChange={(e) => setConfig({ ...config, webhook_url: e.target.value })}
            placeholder="https://discord.com/api/webhooks/..."
            required
          />
        )
      case 'webhook':
        return (
          <>
            <Input
              label="Webhook URL"
              value={config.url || ''}
              onChange={(e) => setConfig({ ...config, url: e.target.value })}
              placeholder="https://your-server.com/webhook"
              required
            />
            <Input
              label="Secret (optional)"
              value={config.secret || ''}
              onChange={(e) => setConfig({ ...config, secret: e.target.value })}
              placeholder="Used for signature verification"
            />
          </>
        )
      case 'pagerduty':
        return (
          <Input
            label="Integration Key"
            value={config.integration_key || ''}
            onChange={(e) => setConfig({ ...config, integration_key: e.target.value })}
            placeholder="Your PagerDuty integration key"
            required
          />
        )
      default:
        return null
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="My Slack Channel"
        required
      />

      <Select
        label="Type"
        value={type}
        onChange={(e) => {
          setType(e.target.value as NotificationType)
          setConfig({})
        }}
        options={typeOptions}
      />

      {renderConfigFields()}

      <div className="flex gap-3 pt-4">
        <Button type="submit" isLoading={isLoading}>
          {notification ? 'Update Channel' : 'Create Channel'}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

export function Notifications() {
  const { data: channels, isLoading } = useNotifications()
  const createNotification = useCreateNotification()
  const updateNotification = useUpdateNotification()
  const deleteNotification = useDeleteNotification()
  const testNotification = useTestNotification()

  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [editingChannel, setEditingChannel] = useState<NotificationChannel | undefined>()
  const [testingId, setTestingId] = useState<string | null>(null)

  const handleCreate = (data: CreateNotificationInput) => {
    createNotification.mutate(data, {
      onSuccess: () => setIsPanelOpen(false),
    })
  }

  const handleUpdate = (data: CreateNotificationInput) => {
    if (!editingChannel) return
    updateNotification.mutate(
      { id: editingChannel.id, data },
      {
        onSuccess: () => {
          setIsPanelOpen(false)
          setEditingChannel(undefined)
        },
      }
    )
  }

  const handleEdit = (channel: NotificationChannel) => {
    setEditingChannel(channel)
    setIsPanelOpen(true)
  }

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this notification channel?')) {
      deleteNotification.mutate(id)
    }
  }

  const handleTest = (id: string) => {
    setTestingId(id)
    testNotification.mutate(id, {
      onSettled: () => setTestingId(null),
    })
  }

  const closePanel = () => {
    setIsPanelOpen(false)
    setEditingChannel(undefined)
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-text-primary text-2xl font-semibold">Notifications</h1>
          <Button onClick={() => setIsPanelOpen(true)}>Add Channel</Button>
        </div>

        {isLoading ? (
          <div className="text-text-secondary">Loading...</div>
        ) : channels?.length === 0 ? (
          <div className="border border-border rounded bg-surface p-8 text-center">
            <p className="text-text-secondary mb-4">No notification channels configured yet.</p>
            <Button onClick={() => setIsPanelOpen(true)}>Add your first channel</Button>
          </div>
        ) : (
          <div className="space-y-3">
            {channels?.map(channel => (
              <div
                key={channel.id}
                className="border border-border rounded bg-surface p-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded bg-background flex items-center justify-center">
                    <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={typeIcons[channel.type]} />
                    </svg>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-text-primary font-medium">{channel.name}</span>
                      {!channel.enabled && (
                        <span className="text-text-secondary text-xs">(disabled)</span>
                      )}
                    </div>
                    <span className="text-text-secondary text-sm capitalize">{channel.type}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleTest(channel.id)}
                    isLoading={testingId === channel.id}
                  >
                    Test
                  </Button>
                  <button
                    onClick={() => handleEdit(channel)}
                    className="p-2 text-text-secondary hover:text-text-primary transition-colors"
                    title="Edit"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(channel.id)}
                    className="p-2 text-text-secondary hover:text-status-down transition-colors"
                    title="Delete"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <SlidePanel
          isOpen={isPanelOpen}
          onClose={closePanel}
          title={editingChannel ? 'Edit Channel' : 'Add Channel'}
        >
          <NotificationForm
            notification={editingChannel}
            onSubmit={editingChannel ? handleUpdate : handleCreate}
            onCancel={closePanel}
            isLoading={createNotification.isPending || updateNotification.isPending}
          />
        </SlidePanel>
      </div>
    </Layout>
  )
}
