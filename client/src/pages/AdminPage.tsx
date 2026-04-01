import { useState, useEffect } from 'react'
import {
  Title,
  Table,
  Button,
  Group,
  Badge,
  ActionIcon,
  Tooltip,
  Text,
  Modal,
  TextInput,
  PasswordInput,
  Select,
  Stack,
  Box,
} from '@mantine/core'
import { IconTrash, IconEdit, IconPlus } from '@tabler/icons-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notifications } from '@mantine/notifications'
import { adminApi, type CreateUserRequest, type UpdateUserRequest } from '../api/admin'
import type { AuthUser } from '../store/auth'
import { useAuthStore } from '../store/auth'

interface UserFormValues {
  username: string
  password: string
  role: 'user' | 'admin'
  email: string
}

const emptyForm = (): UserFormValues => ({
  username: '',
  password: '',
  role: 'user',
  email: '',
})

function UserModal({
  opened,
  onClose,
  editing,
}: {
  opened: boolean
  onClose: () => void
  editing: AuthUser | null
}) {
  const qc = useQueryClient()
  const [form, setForm] = useState<UserFormValues>(emptyForm)

  const isEdit = editing !== null

  useEffect(() => {
    if (!opened) return
    if (editing) {
      setForm({ username: editing.username, password: '', role: editing.role, email: '' })
    } else {
      setForm(emptyForm())
    }
  }, [opened, editing])

  const set = (field: keyof UserFormValues) => (val: string) =>
    setForm((f) => ({ ...f, [field]: val }))

  const createMutation = useMutation({
    mutationFn: (data: CreateUserRequest) => adminApi.createUser(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      notifications.show({ color: 'green', message: 'User created.' })
      onClose()
    },
    onError: (e: Error) =>
      notifications.show({ color: 'red', title: 'Error', message: e.message }),
  })

  const updateMutation = useMutation({
    mutationFn: (data: UpdateUserRequest) => adminApi.updateUser(editing!.id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      notifications.show({ color: 'green', message: 'User updated.' })
      onClose()
    },
    onError: (e: Error) =>
      notifications.show({ color: 'red', title: 'Error', message: e.message }),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (isEdit) {
      const payload: UpdateUserRequest = { role: form.role }
      if (form.password) payload.password = form.password
      if (form.email) payload.email = form.email
      updateMutation.mutate(payload)
    } else {
      const payload: CreateUserRequest = {
        username: form.username,
        password: form.password,
        role: form.role,
      }
      if (form.email) payload.email = form.email
      createMutation.mutate(payload)
    }
  }

  const loading = createMutation.isPending || updateMutation.isPending

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={isEdit ? `Edit "${editing?.username}"` : 'Create user'}
      size="sm"
    >
      <form onSubmit={handleSubmit}>
        <Stack>
          {!isEdit && (
            <TextInput
              label="Username"
              placeholder="username"
              value={form.username}
              onChange={(e) => set('username')(e.currentTarget.value)}
              required
              autoFocus
            />
          )}
          <PasswordInput
            label={isEdit ? 'New password' : 'Password'}
            placeholder={isEdit ? 'Leave blank to keep current' : '••••••••'}
            value={form.password}
            onChange={(e) => set('password')(e.currentTarget.value)}
            required={!isEdit}
          />
          <Select
            label="Role"
            data={[
              { value: 'user', label: 'User' },
              { value: 'admin', label: 'Admin' },
            ]}
            value={form.role}
            onChange={(val) => val && set('role')(val)}
            allowDeselect={false}
          />
          <TextInput
            label="Email"
            placeholder="optional"
            value={form.email}
            onChange={(e) => set('email')(e.currentTarget.value)}
          />
          <Button type="submit" loading={loading} mt="xs">
            {isEdit ? 'Save changes' : 'Create user'}
          </Button>
        </Stack>
      </form>
    </Modal>
  )
}

function DeleteConfirm({
  user,
  onClose,
}: {
  user: AuthUser | null
  onClose: () => void
}) {
  const qc = useQueryClient()
  const mutation = useMutation({
    mutationFn: () => adminApi.deleteUser(user!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      notifications.show({ color: 'green', message: `${user!.username} deleted.` })
      onClose()
    },
    onError: (e: Error) =>
      notifications.show({ color: 'red', title: 'Error', message: e.message }),
  })

  return (
    <Modal opened={!!user} onClose={onClose} title="Delete user" size="sm">
      <Text size="sm" mb="lg">
        Are you sure you want to delete <strong>{user?.username}</strong>? This cannot be undone.
      </Text>
      <Group justify="flex-end">
        <Button variant="default" onClick={onClose}>
          Cancel
        </Button>
        <Button color="red" loading={mutation.isPending} onClick={() => mutation.mutate()}>
          Delete
        </Button>
      </Group>
    </Modal>
  )
}

export function AdminPage() {
  const currentUser = useAuthStore((s) => s.user)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<AuthUser | null>(null)
  const [deleting, setDeleting] = useState<AuthUser | null>(null)

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: adminApi.listUsers,
  })

  const rows = users.map((u) => (
    <Table.Tr key={u.id}>
      <Table.Td>{u.username}</Table.Td>
      <Table.Td>
        <Badge variant="light" color={u.role === 'admin' ? 'blue' : 'gray'} size="sm">
          {u.role}
        </Badge>
      </Table.Td>
      <Table.Td>
        <Group gap={4} justify="flex-end">
          <Tooltip label="Edit" position="left">
            <ActionIcon
              variant="subtle"
              color="gray"
              onClick={() => {
                setEditing(u)
                setFormOpen(true)
              }}
            >
              <IconEdit size={15} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Delete" position="left">
            <ActionIcon
              variant="subtle"
              color="red"
              disabled={u.id === currentUser?.id}
              onClick={() => setDeleting(u)}
            >
              <IconTrash size={15} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Table.Td>
    </Table.Tr>
  ))

  return (
    <Box maw={700}>
      <Group justify="space-between" mb="md">
        <Title order={4}>Users</Title>
        <Button
          size="xs"
          leftSection={<IconPlus size={14} />}
          onClick={() => {
            setEditing(null)
            setFormOpen(true)
          }}
        >
          New user
        </Button>
      </Group>

      <Table striped highlightOnHover withTableBorder>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Username</Table.Th>
            <Table.Th>Role</Table.Th>
            <Table.Th />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {isLoading ? (
            <Table.Tr>
              <Table.Td colSpan={3}>
                <Text size="sm" c="dimmed">
                  Loading…
                </Text>
              </Table.Td>
            </Table.Tr>
          ) : (
            rows
          )}
        </Table.Tbody>
      </Table>

      <UserModal
        opened={formOpen}
        onClose={() => setFormOpen(false)}
        editing={editing}
      />
      <DeleteConfirm user={deleting} onClose={() => setDeleting(null)} />
    </Box>
  )
}

