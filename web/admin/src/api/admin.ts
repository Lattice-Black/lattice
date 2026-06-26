import { api } from './client'

export interface AdminUser {
  id: string
  email: string
  role: 'super_admin' | 'admin'
  created_at: string
  updated_at: string
  last_login_at?: string
}

export interface AdminLoginRequest {
  email: string
  password: string
}

export interface AdminLoginResponse {
  admin: AdminUser
}

export interface CreateAdminUserRequest {
  email: string
  password: string
  role: 'super_admin' | 'admin'
}

export interface ChangePasswordRequest {
  current_password: string
  new_password: string
}

export const adminApi = {
  login: (data: AdminLoginRequest) =>
    api.post<AdminLoginResponse>('/api/hosted/admin/login', data),

  logout: () =>
    api.post<void>('/api/hosted/admin/logout'),

  me: () =>
    api.get<AdminUser>('/api/hosted/admin/me'),

  changePassword: (data: ChangePasswordRequest) =>
    api.post<void>('/api/hosted/admin/change-password', data),

  listUsers: () =>
    api.get<AdminUser[]>('/api/hosted/admin/users'),

  createUser: (data: CreateAdminUserRequest) =>
    api.post<AdminUser>('/api/hosted/admin/users', data),

  deleteUser: (id: string) =>
    api.delete<void>(`/api/hosted/admin/users/${id}`),
}