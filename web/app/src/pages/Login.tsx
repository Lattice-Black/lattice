import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { setApiKey } from '../api/client'
import { authApi } from '../api/auth'
import { Button } from '../components/Button'
import { Input } from '../components/Input'

export function Login() {
  const navigate = useNavigate()
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

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
            autoFocus
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
