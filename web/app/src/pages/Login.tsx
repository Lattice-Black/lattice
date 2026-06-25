import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { setApiKey, getApiKey } from '../api/client'
import { authApi } from '../api/auth'
import { Button } from '../components/Button'
import { Input } from '../components/Input'

export function Login() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // Auto-login if API key is passed via URL param (?key=...)
  // This is used by the hosted control plane to redirect users
  // to their tenant dashboard with credentials pre-filled.
  useEffect(() => {
    const keyFromUrl = searchParams.get('key')
    const existingKey = getApiKey()

    if (keyFromUrl) {
      // Verify the key from URL and auto-login
      setIsLoading(true)
      authApi.verifyApiKey(keyFromUrl)
        .then(() => {
          setApiKey(keyFromUrl)
          navigate('/dashboard')
        })
        .catch(() => {
          setError('The provided API key is invalid for this instance.')
          setIsLoading(false)
        })
    } else if (existingKey) {
      // Already have a key — verify and redirect
      setIsLoading(true)
      authApi.verifyApiKey(existingKey)
        .then(() => navigate('/dashboard'))
        .catch(() => {
          setApiKeyInput(existingKey)
          setIsLoading(false)
        })
    }
  }, [searchParams, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      await authApi.verifyApiKey(apiKeyInput.trim())
      setApiKey(apiKeyInput.trim())
      navigate('/dashboard')
    } catch {
      setError('Invalid API key')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <svg className="w-8 h-8 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
            <span className="text-text-primary text-2xl font-semibold">Lattice</span>
          </div>
          <p className="text-text-secondary">Enter your API key to access the dashboard</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="password"
            placeholder="API Key"
            value={apiKeyInput}
            onChange={(e) => setApiKeyInput(e.target.value)}
            error={error}
            autoFocus={!isLoading}
          />

          <Button
            type="submit"
            className="w-full"
            isLoading={isLoading}
            disabled={!apiKeyInput.trim()}
          >
            Sign In
          </Button>
        </form>
      </div>
    </div>
  )
}