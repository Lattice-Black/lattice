import { api } from './client'

export type IncidentSeverity = 'minor' | 'major' | 'critical'
export type IncidentStatus = 'investigating' | 'identified' | 'monitoring' | 'resolved'

export interface IncidentUpdate {
  id: string
  status: IncidentStatus
  message: string
  created_at: string
}

export interface Incident {
  id: string
  title: string
  monitor_id?: string
  monitor_name?: string
  severity: IncidentSeverity
  status: IncidentStatus
  updates: IncidentUpdate[]
  created_at: string
  resolved_at?: string
}

export interface CreateIncidentInput {
  title: string
  monitor_id?: string
  severity: IncidentSeverity
  message: string
}

export interface AddIncidentUpdateInput {
  status: IncidentStatus
  message: string
}

export const incidentsApi = {
  list: (status?: 'active' | 'resolved') => {
    const params = status ? `?status=${status}` : ''
    return api.get<Incident[]>(`/api/incidents${params}`)
  },

  get: (id: string) => api.get<Incident>(`/api/incidents/${id}`),

  create: (data: CreateIncidentInput) =>
    api.post<Incident>('/api/incidents', data),

  addUpdate: (id: string, data: AddIncidentUpdateInput) =>
    api.post<Incident>(`/api/incidents/${id}/updates`, data),

  resolve: (id: string, message?: string) =>
    api.post<Incident>(`/api/incidents/${id}/resolve`, { message }),

  delete: (id: string) => api.delete<void>(`/api/incidents/${id}`),
}
