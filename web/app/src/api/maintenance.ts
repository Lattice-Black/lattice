import { api } from './client'

export interface MaintenanceWindow {
  id: string
  monitor_id: string
  monitor_name?: string
  title: string
  description?: string
  start_time: string
  end_time: string
  created_at: string
}

export interface CreateMaintenanceInput {
  monitor_id: string
  title: string
  description?: string
  start_time: string
  end_time: string
}

export interface UpdateMaintenanceInput extends Partial<CreateMaintenanceInput> {}

export const maintenanceApi = {
  list: (status?: 'upcoming' | 'active' | 'past') => {
    const params = status ? `?status=${status}` : ''
    return api.get<MaintenanceWindow[]>(`/api/maintenance${params}`)
  },

  get: (id: string) => api.get<MaintenanceWindow>(`/api/maintenance/${id}`),

  create: (data: CreateMaintenanceInput) =>
    api.post<MaintenanceWindow>('/api/maintenance', data),

  update: (id: string, data: UpdateMaintenanceInput) =>
    api.put<MaintenanceWindow>(`/api/maintenance/${id}`, data),

  delete: (id: string) => api.delete<void>(`/api/maintenance/${id}`),
}
