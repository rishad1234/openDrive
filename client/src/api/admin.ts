import { apiFetch } from './client'
import type { AuthUser } from '../store/auth'

export interface CreateUserRequest {
  username: string
  password: string
  role: 'user' | 'admin'
  email?: string
}

export interface UpdateUserRequest {
  username?: string
  password?: string
  role?: 'user' | 'admin'
  email?: string
}

export const adminApi = {
  listUsers: () => apiFetch<AuthUser[]>('/api/admin/users'),

  createUser: (data: CreateUserRequest) =>
    apiFetch<AuthUser>('/api/admin/users', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateUser: (id: string, data: UpdateUserRequest) =>
    apiFetch<AuthUser>(`/api/admin/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteUser: (id: string) =>
    apiFetch<void>(`/api/admin/users/${id}`, { method: 'DELETE' }),
}
