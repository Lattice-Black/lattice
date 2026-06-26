import { api } from './client'

export interface Tenant {
  id: string
  email: string
  slug: string
  status: 'trial' | 'active' | 'suspended' | 'deleted'
  trial_ends_at?: string
  created_at: string
  updated_at: string
  suspended_at?: string
}

export interface UpdateTenantRequest {
  email?: string
  slug?: string
  status?: Tenant['status']
}

export interface ResetKeyResponse {
  api_key: string
}

export interface ResetPasswordResponse {
  temp_password: string
}

export interface ExtendTrialRequest {
  days: number
}

export interface ExtendTrialResponse {
  trial_ends_at: string
}

export interface AuditLog {
  id: string
  admin_id: string
  admin_email: string
  action: string
  target_type: string
  target_id: string
  details?: string
  created_at: string
}

export const tenantsApi = {
  list: (status?: string) =>
    api.get<Tenant[]>('/api/hosted/tenants' + (status ? `?status=${status}` : '')),

  get: (id: string) =>
    api.get<Tenant>(`/api/hosted/tenants/${id}`),

  update: (id: string, data: UpdateTenantRequest) =>
    api.put<Tenant>(`/api/hosted/tenants/${id}`, data),

  delete: (id: string) =>
    api.delete<void>(`/api/hosted/tenants/${id}`),

  suspend: (id: string) =>
    api.post<{ status: string }>(`/api/hosted/tenants/${id}/suspend`),

  activate: (id: string) =>
    api.post<{ status: string }>(`/api/hosted/tenants/${id}/activate`),

  resetKey: (id: string) =>
    api.post<ResetKeyResponse>(`/api/hosted/tenants/${id}/reset-key`),

  resetPassword: (id: string) =>
    api.post<ResetPasswordResponse>(`/api/hosted/tenants/${id}/reset-password`),

  extendTrial: (id: string, data: ExtendTrialRequest) =>
    api.post<ExtendTrialResponse>(`/api/hosted/tenants/${id}/extend-trial`, data),

  listAuditLogs: (limit?: number, offset?: number) =>
    api.get<AuditLog[]>(`/api/hosted/admin/audit` + 
      `?limit=${limit ?? 50}&offset=${offset ?? 0}`),
}