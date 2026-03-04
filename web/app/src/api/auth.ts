import { api } from './client'

export interface HealthResponse {
  status: string
  version?: string
}

export const authApi = {
  verifyApiKey: (apiKey: string) =>
    api.get<HealthResponse>('/api/health', {
      headers: { 'X-API-Key': apiKey },
    }),
}
