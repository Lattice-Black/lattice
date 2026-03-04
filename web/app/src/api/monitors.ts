import { api } from './client'

export interface Monitor {
  id: string
  name: string
  url: string
  type: 'http' | 'tcp' | 'ping' | 'dns'
  interval: number
  timeout: number
  expected_status?: number
  group?: string
  enabled: boolean
  status: 'up' | 'down' | 'degraded' | 'unknown'
  latency?: number
  last_checked?: string
  created_at: string
  updated_at: string
}

export interface CreateMonitorInput {
  name: string
  url: string
  type: 'http' | 'tcp' | 'ping' | 'dns'
  interval: number
  timeout: number
  expected_status?: number
  group?: string
}

export interface UpdateMonitorInput extends Partial<CreateMonitorInput> {
  enabled?: boolean
}

export interface MonitorHistory {
  date: string
  status: 'up' | 'down' | 'degraded' | 'unknown'
  uptime_percent: number
}

export const monitorsApi = {
  list: () => api.get<Monitor[]>('/api/monitors'),

  get: (id: string) => api.get<Monitor>(`/api/monitors/${id}`),

  create: (data: CreateMonitorInput) =>
    api.post<Monitor>('/api/monitors', data),

  update: (id: string, data: UpdateMonitorInput) =>
    api.put<Monitor>(`/api/monitors/${id}`, data),

  delete: (id: string) => api.delete<void>(`/api/monitors/${id}`),

  toggle: (id: string, enabled: boolean) =>
    api.patch<Monitor>(`/api/monitors/${id}`, { enabled }),

  history: (id: string, days: number = 90) =>
    api.get<MonitorHistory[]>(`/api/monitors/${id}/history?days=${days}`),
}
