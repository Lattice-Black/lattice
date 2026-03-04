import { api } from './client'

export interface Settings {
  site_name: string
  logo_url?: string
  accent_color?: string
  custom_css?: string
}

export const settingsApi = {
  get: () => api.get<Settings>('/api/settings'),

  update: (data: Partial<Settings>) =>
    api.put<Settings>('/api/settings', data),
}
