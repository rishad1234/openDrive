import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  TextInput,
  PasswordInput,
  Button,
  Paper,
  Title,
  Text,
  Center,
  Stack,
  Box,
  Alert,
} from '@mantine/core'
import { IconAlertCircle } from '@tabler/icons-react'
import { authApi } from '../api/auth'
import { useAuthStore } from '../store/auth'

export function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { setAuth } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { token } = await authApi.login(username, password)
      useAuthStore.setState({ token })
      const user = await authApi.me()
      setAuth(token, user)
      navigate('/files', { replace: true })
    } catch {
      setError('Invalid username or password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Center mih="100vh" p="md">
      <Box w="100%" maw={380}>
        <Title order={2} ta="center" mb={4}>
          openDrive
        </Title>
        <Text c="dimmed" ta="center" size="sm" mb="xl">
          Sign in to continue
        </Text>

        <Paper withBorder p="xl" radius="md">
          <form onSubmit={handleSubmit}>
            <Stack>
              {error && (
                <Alert
                  icon={<IconAlertCircle size={16} />}
                  color="red"
                  variant="light"
                  p="xs"
                >
                  {error}
                </Alert>
              )}
              <TextInput
                label="Username"
                placeholder="username"
                value={username}
                onChange={(e) => setUsername(e.currentTarget.value)}
                required
                autoFocus
                autoComplete="username"
              />
              <PasswordInput
                label="Password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.currentTarget.value)}
                required
                autoComplete="current-password"
              />
              <Button type="submit" fullWidth loading={loading} mt="xs">
                Sign in
              </Button>
            </Stack>
          </form>
        </Paper>
      </Box>
    </Center>
  )
}

