import { api } from './client'

export interface HealthResponse {
  status: string
}

export const authApi = {
  // Verify the API key by making an authenticated request to /api/monitors
  verifyApiKey: (apiKey: string) =>
    api.get<unknown[]>('/api/monitors', {
      headers: { 'X-API-Key': apiKey },
    }),
}