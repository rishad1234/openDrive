import { useState, useEffect } from 'react'
import {
  Title,
  TextInput,
  PasswordInput,
  Button,
  Stack,
  Box,
  Divider,
  Text,
  Group,
  Badge,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useMutation } from '@tanstack/react-query'
import { authApi } from '../api/auth'
import { useAuthStore } from '../store/auth'

export function ProfilePage() {
  const { user, setAuth } = useAuthStore()
  const token = useAuthStore((s) => s.token)!

  const [username, setUsername] = useState(user?.username ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  useEffect(() => {
    setUsername(user?.username ?? '')
    setEmail(user?.email ?? '')
  }, [user])

  const mutation = useMutation({
    mutationFn: (data: { username?: string; current_password?: string; password?: string; email?: string | null }) =>
      authApi.updateProfile(data),
    onSuccess: (updated) => {
      setAuth(token, updated)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      notifications.show({ color: 'green', message: 'Profile updated.' })
    },
    onError: (e: Error) =>
      notifications.show({ color: 'red', title: 'Error', message: e.message }),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (newPassword && newPassword !== confirmPassword) {
      notifications.show({ color: 'red', message: 'New passwords do not match.' })
      return
    }

    if (newPassword && !currentPassword) {
      notifications.show({ color: 'red', message: 'Enter your current password to set a new one.' })
      return
    }

    const payload: { username?: string; current_password?: string; password?: string; email?: string | null } = {}

    if (username && username !== user?.username) payload.username = username
    if (email !== (user?.email ?? '')) payload.email = email || null
    if (newPassword) {
      payload.password = newPassword
      payload.current_password = currentPassword
    }

    if (Object.keys(payload).length === 0) {
      notifications.show({ color: 'yellow', message: 'No changes to save.' })
      return
    }

    mutation.mutate(payload)
  }

  return (
    <Box maw={480}>
      <Group mb="md" align="center" gap="sm">
        <Title order={4}>Profile</Title>
        <Badge variant="light" color={user?.role === 'admin' ? 'blue' : 'gray'} size="sm">
          {user?.role}
        </Badge>
      </Group>

      <form onSubmit={handleSubmit}>
        <Stack>
          <TextInput
            label="Username"
            value={username}
            onChange={(e) => setUsername(e.currentTarget.value)}
            required
          />
          <TextInput
            label="Email"
            placeholder="optional"
            value={email}
            onChange={(e) => setEmail(e.currentTarget.value)}
          />

          <Divider label="Change password" labelPosition="left" mt="xs" />

          <Text size="xs" c="dimmed">
            Leave blank to keep your current password.
          </Text>

          <PasswordInput
            label="Current password"
            placeholder="••••••••"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.currentTarget.value)}
            autoComplete="current-password"
          />
          <PasswordInput
            label="New password"
            placeholder="••••••••"
            value={newPassword}
            onChange={(e) => setNewPassword(e.currentTarget.value)}
            autoComplete="new-password"
          />
          <PasswordInput
            label="Confirm new password"
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.currentTarget.value)}
            autoComplete="new-password"
          />

          <Button type="submit" loading={mutation.isPending} mt="xs">
            Save changes
          </Button>
        </Stack>
      </form>
    </Box>
  )
}
