import { api } from './client'

export type NotificationType = 'email' | 'slack' | 'webhook' | 'ntfy' | 'discord'

export interface NotificationChannel {
  id: string
  name: string
  type: NotificationType
  enabled: boolean
  config: Record<string, string>
  created_at: string
  updated_at: string
}

export interface CreateNotificationInput {
  name: string
  type: NotificationType
  config: Record<string, string>
}

export interface UpdateNotificationInput extends Partial<CreateNotificationInput> {
  enabled?: boolean
}

export const notificationsApi = {
  list: () => api.get<NotificationChannel[]>('/api/notifications'),

  get: (id: string) => api.get<NotificationChannel>(`/api/notifications/${id}`),

  create: (data: CreateNotificationInput) =>
    api.post<NotificationChannel>('/api/notifications', data),

  update: (id: string, data: UpdateNotificationInput) =>
    api.put<NotificationChannel>(`/api/notifications/${id}`, data),

  delete: (id: string) => api.delete<void>(`/api/notifications/${id}`),

  test: (id: string) => api.post<{ success: boolean }>(`/api/notifications/${id}/test`),
}