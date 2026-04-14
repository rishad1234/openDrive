import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AuthUser } from '@common/types/user'

interface AuthState {
  token: string | null
  user: AuthUser | null
  setAuth: (token: string, user: AuthUser) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setAuth: (token, user) => set({ token, user }),
      clearAuth: () => set({ token: null, user: null }),
    }),
    {
      name: 'auth',
      partialize: (state) => ({ token: state.token, user: state.user }),
    },
  ),
)
