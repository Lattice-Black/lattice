import { api } from './client'
import type { Incident } from './incidents'
import type { MaintenanceWindow } from './maintenance'

export type OverallStatus = 'operational' | 'degraded' | 'partial_outage' | 'major_outage'

export interface StatusMonitor {
  id: string
  name: string
  group?: string
  status: 'up' | 'down' | 'degraded' | 'unknown'
  latency?: number
  uptime_90d: number
  history: Array<{
    date: string
    status: 'up' | 'down' | 'degraded' | 'unknown'
    uptime_percent: number
  }>
}

export interface StatusResponse {
  site_name: string
  logo_url?: string
  overall_status: OverallStatus
  monitors: StatusMonitor[]
  active_incidents: Incident[]
  past_incidents: Incident[]
  active_maintenance: MaintenanceWindow[]
}

export const statusApi = {
  get: () => api.get<StatusResponse>('/status', { skipAuth: true }),
}
