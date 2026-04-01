import { AppShell, Group, Text, ActionIcon, Tooltip, Anchor, Avatar, Divider, UnstyledButton, Burger, Drawer, Stack, Box } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { IconLogout, IconCloud, IconFiles, IconUsers, IconUser } from '@tabler/icons-react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { authApi } from '../api/auth'
import { useAuthStore } from '../store/auth'

interface AppLayoutProps {
  children: React.ReactNode
}

function NavLink({ to, label, icon, active, onClick, fullWidth }: {
  to: string; label: string; icon: React.ReactNode; active: boolean; onClick?: () => void; fullWidth?: boolean
}) {
  return (
    <Anchor
      component={Link}
      to={to}
      underline="never"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: fullWidth ? '10px 12px' : '5px 10px',
        borderRadius: 6,
        width: fullWidth ? '100%' : undefined,
        fontSize: 'var(--mantine-font-size-sm)',
        fontWeight: active ? 600 : 400,
        color: active ? 'var(--mantine-color-indigo-6)' : 'var(--mantine-color-dimmed)',
        backgroundColor: active ? 'var(--mantine-color-indigo-0)' : 'transparent',
        transition: 'background 120ms ease, color 120ms ease',
      }}
    >
      {icon}
      {label}
    </Anchor>
  )
}

export function AppLayout({ children }: AppLayoutProps) {
  const { user, clearAuth } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [drawerOpen, { open: openDrawer, close: closeDrawer }] = useDisclosure(false)

  const handleLogout = async () => {
    closeDrawer()
    try {
      await authApi.logout()
    } finally {
      clearAuth()
      navigate('/login', { replace: true })
    }
  }

  const initials = (user?.username ?? '?').slice(0, 2).toUpperCase()

  return (
    <AppShell header={{ height: 56 }} padding="md">
      <AppShell.Header style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}>
        <Group h="100%" px="lg" justify="space-between">
          {/* Left: brand + desktop nav */}
          <Group gap="xs">
            <Anchor component={Link} to="/files" underline="never" style={{ display: 'flex', alignItems: 'center', gap: 5, marginRight: 8 }}>
              <IconCloud size={20} style={{ color: 'var(--mantine-color-indigo-5)' }} />
              <Text fw={800} size="sm" style={{ color: 'var(--mantine-color-indigo-6)', letterSpacing: -0.3 }}>
                openDrive
              </Text>
            </Anchor>

            {/* Desktop nav — hidden on mobile */}
            <Box visibleFrom="sm">
              <Group gap="xs">
                <NavLink to="/files" label="Files" icon={<IconFiles size={15} />} active={location.pathname.startsWith('/files')} />
                {user?.role === 'admin' && (
                  <NavLink to="/admin" label="Admin" icon={<IconUsers size={15} />} active={location.pathname === '/admin'} />
                )}
              </Group>
            </Box>
          </Group>

          {/* Right: desktop profile + logout, mobile burger */}
          <Group gap={4}>
            {/* Desktop right side */}
            <Box visibleFrom="sm">
              <Group gap={4}>
                <Tooltip label="Profile" position="bottom">
                  <UnstyledButton component={Link} to="/profile" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px', borderRadius: 6 }}>
                    <Avatar size={28} radius="xl" color="indigo" variant={location.pathname === '/profile' ? 'filled' : 'light'}>
                      {initials}
                    </Avatar>
                    <Text size="sm" fw={location.pathname === '/profile' ? 600 : 400} c={location.pathname === '/profile' ? undefined : 'dimmed'}>
                      {user?.username}
                    </Text>
                  </UnstyledButton>
                </Tooltip>
                <Divider orientation="vertical" my={8} />
                <Tooltip label="Sign out" position="bottom">
                  <ActionIcon variant="subtle" color="gray" onClick={handleLogout} aria-label="Sign out">
                    <IconLogout size={16} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            </Box>

            {/* Mobile burger — hidden on desktop */}
            <Box hiddenFrom="sm">
              <Burger opened={drawerOpen} onClick={openDrawer} size="sm" aria-label="Open menu" />
            </Box>
          </Group>
        </Group>
      </AppShell.Header>

      {/* Mobile drawer */}
      <Drawer
        opened={drawerOpen}
        onClose={closeDrawer}
        size="xs"
        padding="md"
        title={
          <Group gap={6}>
            <IconCloud size={18} style={{ color: 'var(--mantine-color-indigo-5)' }} />
            <Text fw={800} size="sm" style={{ color: 'var(--mantine-color-indigo-6)', letterSpacing: -0.3 }}>
              openDrive
            </Text>
          </Group>
        }
      >
        <Stack gap={4}>
          <NavLink to="/files" label="Files" icon={<IconFiles size={16} />} active={location.pathname.startsWith('/files')} onClick={closeDrawer} fullWidth />
          {user?.role === 'admin' && (
            <NavLink to="/admin" label="Admin" icon={<IconUsers size={16} />} active={location.pathname === '/admin'} onClick={closeDrawer} fullWidth />
          )}

          <Divider my="xs" />

          <NavLink to="/profile" label={user?.username ?? 'Profile'} icon={<IconUser size={16} />} active={location.pathname === '/profile'} onClick={closeDrawer} fullWidth />

          <Anchor
            underline="never"
            onClick={handleLogout}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 12px', borderRadius: 6, width: '100%',
              fontSize: 'var(--mantine-font-size-sm)',
              color: 'var(--mantine-color-red-6)',
            }}
          >
            <IconLogout size={16} />
            Sign out
          </Anchor>
        </Stack>
      </Drawer>

      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  )
}
