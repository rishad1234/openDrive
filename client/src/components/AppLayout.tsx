import { AppShell, Group, Text, ActionIcon, Tooltip, Anchor } from '@mantine/core'
import { IconLogout } from '@tabler/icons-react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { authApi } from '../api/auth'
import { useAuthStore } from '../store/auth'

interface AppLayoutProps {
  children: React.ReactNode
}

export function AppLayout({ children }: AppLayoutProps) {
  const { user, clearAuth } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()

  const handleLogout = async () => {
    try {
      await authApi.logout()
    } finally {
      clearAuth()
      navigate('/login', { replace: true })
    }
  }

  return (
    <AppShell header={{ height: 52 }} padding="md">
      <AppShell.Header>
        <Group h="100%" px="lg" justify="space-between">
          <Group gap="lg">
            <Text fw={600} size="sm">
              openDrive
            </Text>
            <Anchor
              component={Link}
              to="/files"
              size="sm"
              c={location.pathname.startsWith('/files') ? undefined : 'dimmed'}
              underline="never"
              fw={location.pathname.startsWith('/files') ? 500 : undefined}
            >
              Files
            </Anchor>
            {user?.role === 'admin' && (
              <Anchor
                component={Link}
                to="/admin"
                size="sm"
                c={location.pathname === '/admin' ? undefined : 'dimmed'}
                underline="never"
                fw={location.pathname === '/admin' ? 500 : undefined}
              >
                Admin
              </Anchor>
            )}
          </Group>
          <Group gap="xs">
            <Anchor
              component={Link}
              to="/profile"
              size="sm"
              c={location.pathname === '/profile' ? undefined : 'dimmed'}
              underline="never"
            >
              {user?.username}
            </Anchor>
            <Tooltip label="Sign out" position="bottom">
              <ActionIcon
                variant="subtle"
                color="gray"
                onClick={handleLogout}
                aria-label="Sign out"
              >
                <IconLogout size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  )
}
