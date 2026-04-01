import { apiFetch } from './client'
import type { AuthUser } from '../store/auth'

export interface LoginResponse {
  token: string
}

export const authApi = {
  login: (username: string, password: string) =>
    apiFetch<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  me: () => apiFetch<AuthUser>('/api/auth/me'),

  logout: () => apiFetch<void>('/api/auth/logout', { method: 'POST' }),

  updateProfile: (data: { username?: string; current_password?: string; password?: string; email?: string | null }) =>
    apiFetch<AuthUser>('/api/user/profile', {
      method: 'PATCH',
      body: JSON.stringify(data),
      skipRedirectOn401: true,
    }),
}
