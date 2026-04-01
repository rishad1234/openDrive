import { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Center, Loader } from '@mantine/core'
import { LoginPage } from './pages/LoginPage'
import { FilesPage } from './pages/FilesPage'
import { AdminPage } from './pages/AdminPage'
import { ProfilePage } from './pages/ProfilePage'
import { AppLayout } from './components/AppLayout'
import { useAuthStore } from './store/auth'
import { authApi } from './api/auth'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { token, user, setAuth, clearAuth } = useAuthStore()
  const [checking, setChecking] = useState(!user && !!token)

  useEffect(() => {
    if (!token || user) {
      setChecking(false)
      return
    }
    authApi
      .me()
      .then((u) => {
        setAuth(token, u)
        setChecking(false)
      })
      .catch(() => {
        clearAuth()
        setChecking(false)
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!token) return <Navigate to="/login" replace />
  if (checking) {
    return (
      <Center mih="100vh">
        <Loader size="sm" />
      </Center>
    )
  }
  return <AppLayout>{children}</AppLayout>
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user)
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'admin') return <Navigate to="/files" replace />
  return <>{children}</>
}

export function Router() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/files/*"
        element={
          <RequireAuth>
            <FilesPage />
          </RequireAuth>
        }
      />
      <Route
        path="/admin"
        element={
          <RequireAuth>
            <RequireAdmin>
              <AdminPage />
            </RequireAdmin>
          </RequireAuth>
        }
      />
      <Route
        path="/profile"
        element={
          <RequireAuth>
            <ProfilePage />
          </RequireAuth>
        }
      />
      <Route path="/" element={<Navigate to="/files" replace />} />
      <Route path="*" element={<Navigate to="/files" replace />} />
    </Routes>
  )
}

