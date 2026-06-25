import { useState, useEffect } from 'react'
import { useSettings, useUpdateSettings } from '../hooks/useSettings'
import { Layout } from '../components/Layout'
import { Button } from '../components/Button'
import { Input, Textarea } from '../components/Input'
import { getApiKey } from '../api/client'

export function Settings() {
  const { data: settings, isLoading } = useSettings()
  const updateSettings = useUpdateSettings()

  const [formData, setFormData] = useState({
    site_name: '',
    logo_url: '',
    accent_color: '#4d9f5d',
    custom_css: '',
  })
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (settings) {
      setFormData({
        site_name: settings.site_name || '',
        logo_url: settings.logo_url || '',
        accent_color: settings.accent_color || '#4d9f5d',
        custom_css: settings.custom_css || '',
      })
    }
  }, [settings])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    updateSettings.mutate(
      {
        site_name: formData.site_name,
        logo_url: formData.logo_url || undefined,
        accent_color: formData.accent_color || undefined,
        custom_css: formData.custom_css || undefined,
      },
      {
        onSuccess: () => {
          setSaved(true)
          setTimeout(() => setSaved(false), 3000)
        },
      }
    )
  }

  if (isLoading) {
    return (
      <Layout>
        <div className="text-text-secondary">Loading...</div>
      </Layout>
    )
  }

  const apiKey = getApiKey()
  const [keyCopied, setKeyCopied] = useState(false)

  const copyApiKey = () => {
    if (apiKey) {
      navigator.clipboard.writeText(apiKey)
      setKeyCopied(true)
      setTimeout(() => setKeyCopied(false), 2000)
    }
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        <h1 className="text-text-primary text-2xl font-semibold mb-6">Settings</h1>

        {/* API Key */}
        <div className="border border-border rounded bg-surface p-6 mb-6">
          <h2 className="text-text-primary text-lg font-semibold mb-2">API Key</h2>
          <p className="text-text-secondary text-sm mb-4">
            Use this key to authenticate API requests to your Lattice instance.
          </p>
          <div className="flex items-center gap-3">
            <code className="flex-1 px-3 py-2 bg-background border border-border rounded text-sm font-mono text-text-secondary break-all">
              {apiKey || 'Not available'}
            </code>
            <Button
              onClick={copyApiKey}
              disabled={!apiKey}
              className="whitespace-nowrap"
            >
              {keyCopied ? 'Copied!' : 'Copy'}
            </Button>
          </div>
        </div>

        <div className="border border-border rounded bg-surface p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <Input
              label="Site Name"
              value={formData.site_name}
              onChange={(e) => setFormData({ ...formData, site_name: e.target.value })}
              placeholder="My Company Status"
            />

            <Input
              label="Logo URL"
              value={formData.logo_url}
              onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
              placeholder="https://example.com/logo.svg"
            />

            <div className="space-y-1">
              <label className="block text-text-secondary text-sm font-medium">
                Accent Color
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={formData.accent_color}
                  onChange={(e) => setFormData({ ...formData, accent_color: e.target.value })}
                  className="w-12 h-10 rounded border border-border bg-background cursor-pointer"
                />
                <Input
                  value={formData.accent_color}
                  onChange={(e) => setFormData({ ...formData, accent_color: e.target.value })}
                  placeholder="#4d9f5d"
                  className="flex-1 font-mono"
                />
              </div>
            </div>

            <Textarea
              label="Custom CSS"
              value={formData.custom_css}
              onChange={(e) => setFormData({ ...formData, custom_css: e.target.value })}
              placeholder="/* Add custom styles here */"
              className="font-mono text-sm"
            />

            <div className="flex items-center gap-4 pt-4">
              <Button type="submit" isLoading={updateSettings.isPending}>
                Save Settings
              </Button>
              {saved && (
                <span className="text-status-up text-sm">Settings saved!</span>
              )}
            </div>
          </form>
        </div>
      </div>
    </Layout>
  )
}
