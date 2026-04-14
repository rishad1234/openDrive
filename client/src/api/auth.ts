import { apiFetch } from './client'
import type { AuthUser, LoginResponse, UpdateProfileRequest } from '@common/types/user'

export const authApi = {
  login: (username: string, password: string) =>
    apiFetch<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
      skipRedirectOn401: true,
    }),

  me: () => apiFetch<AuthUser>('/api/auth/me'),

  logout: () => apiFetch<void>('/api/auth/logout', { method: 'POST' }),

  updateProfile: (data: UpdateProfileRequest) =>
    apiFetch<AuthUser>('/api/user/profile', {
      method: 'PATCH',
      body: JSON.stringify(data),
      skipRedirectOn401: true,
    }),
}
