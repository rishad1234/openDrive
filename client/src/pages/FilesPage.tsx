import { useState, useRef, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Table,
  Group,
  Button,
  ActionIcon,
  Tooltip,
  Text,
  Breadcrumbs,
  Anchor,
  Modal,
  TextInput,
  Stack,
  Center,
  Loader,
  ThemeIcon,
  ScrollArea,
  Paper,
  Progress,
} from '@mantine/core'
import {
  IconFolder,
  IconFile,
  IconDownload,
  IconPencil,
  IconTrash,
  IconPlus,
  IconUpload,
  IconFolderOpen,
} from '@tabler/icons-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notifications } from '@mantine/notifications'
import { fsApi, type FsEntry } from '../api/fs'
import { adminApi } from '../api/admin'
import { useAuthStore } from '../store/auth'
import { useFilesUpload } from '../components/FilesLayout'

// ── helpers ─────────────────────────────────────────────────────────────────

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function folderName(prefix: string): string {
  const parts = prefix.split('/').filter(Boolean)
  return parts[parts.length - 1] ?? prefix
}

// ── modals ───────────────────────────────────────────────────────────────────

function NewFolderModal({
  opened, onClose, currentPrefix,
}: { opened: boolean; onClose: () => void; currentPrefix: string }) {
  const qc = useQueryClient()
  const [name, setName] = useState('')

  const mutation = useMutation({
    mutationFn: () => fsApi.mkdir(currentPrefix + name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['files'] })
      notifications.show({ color: 'green', message: 'Folder created.' })
      setName('')
      onClose()
    },
    onError: () => notifications.show({ color: 'red', message: 'Failed to create folder.' }),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || name.includes('/')) return
    mutation.mutate()
  }

  return (
    <Modal opened={opened} onClose={() => { setName(''); onClose() }} title="New folder" size="sm">
      <form onSubmit={handleSubmit}>
        <Stack>
          <TextInput
            label="Folder name"
            placeholder="my-folder"
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
            required
            autoFocus
            error={name.includes('/') ? 'Folder name cannot contain /' : undefined}
          />
          <Button type="submit" loading={mutation.isPending}>Create</Button>
        </Stack>
      </form>
    </Modal>
  )
}

function RenameModal({
  file, onClose,
}: { file: FsEntry | null; onClose: () => void }) {
  const qc = useQueryClient()
  const [name, setName] = useState('')

  useEffect(() => {
    if (file) setName(file.name)
  }, [file])

  const mutation = useMutation({
    mutationFn: () => {
      const parent = file!.key.substring(0, file!.key.lastIndexOf('/') + 1)
      return fsApi.move(file!.key, parent + name)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['files'] })
      notifications.show({ color: 'green', message: 'File renamed.' })
      onClose()
    },
    onError: () => notifications.show({ color: 'red', message: 'Failed to rename file.' }),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || name.includes('/')) return
    mutation.mutate()
  }

  return (
    <Modal
      opened={!!file}
      onClose={onClose}
      title={`Rename "${file?.name}"`}
      size="sm"
    >
      <form onSubmit={handleSubmit}>
        <Stack>
          <TextInput
            label="New name"
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
            required
            autoFocus
            error={name.includes('/') ? 'Name cannot contain /' : undefined}
          />
          <Button type="submit" loading={mutation.isPending}>Rename</Button>
        </Stack>
      </form>
    </Modal>
  )
}

function DeleteConfirm({
  item, onClose, isAdmin,
}: { item: { key: string; name: string; isFolder: boolean } | null; onClose: () => void; isAdmin?: boolean }) {
  const qc = useQueryClient()
  const [step, setStep] = useState<1 | 2>(1)

  useEffect(() => {
    if (item) setStep(1)
  }, [item])

  const mutation = useMutation({
    mutationFn: () => fsApi.delete(item!.key),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['files'] })
      notifications.show({ color: 'green', message: `${item!.isFolder ? 'Folder' : 'File'} deleted.` })
      onClose()
    },
    onError: () => notifications.show({ color: 'red', message: 'Failed to delete.' }),
  })

  // Regular users: simple one-step confirm
  if (!isAdmin) {
    return (
      <Modal opened={!!item} onClose={onClose} title="Confirm delete" size="sm">
        <Text size="sm" mb="lg">
          {item?.isFolder
            ? <>Delete folder <strong>{item.name}</strong> and all its contents? This cannot be undone.</>
            : <>Delete <strong>{item?.name}</strong>? This cannot be undone.</>
          }
        </Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>Cancel</Button>
          <Button color="red" loading={mutation.isPending} onClick={() => mutation.mutate()}>Delete</Button>
        </Group>
      </Modal>
    )
  }

  // Admins: two-step confirm
  return (
    <Modal
      opened={!!item}
      onClose={onClose}
      title={step === 1 ? 'Delete confirmation — step 1 of 2' : 'Delete confirmation — step 2 of 2'}
      size="sm"
    >
      {step === 1 ? (
        <Stack>
          <Text size="sm">
            You are about to permanently delete{' '}
            {item?.isFolder
              ? <><strong>{item.name}</strong> and <em>all of its contents</em></>
              : <strong>{item?.name}</strong>
            }.
          </Text>
          <Text size="sm" c="dimmed">
            As an admin you are deleting on behalf of a user. This action cannot be undone.
          </Text>
          <Group justify="flex-end" mt="xs">
            <Button variant="default" onClick={onClose}>Cancel</Button>
            <Button color="orange" onClick={() => setStep(2)}>I understand, continue</Button>
          </Group>
        </Stack>
      ) : (
        <Stack>
          <Text size="sm" fw={600} c="red">Final confirmation</Text>
          <Text size="sm">
            Permanently delete{' '}
            {item?.isFolder
              ? <><strong>{item.name}</strong> and all its contents</>
              : <strong>{item?.name}</strong>
            }?
            {' '}There is no recovery.
          </Text>
          <Group justify="flex-end" mt="xs">
            <Button variant="default" onClick={() => setStep(1)}>Go back</Button>
            <Button color="red" loading={mutation.isPending} onClick={() => mutation.mutate()}>
              Delete permanently
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  )
}

// ── main page ────────────────────────────────────────────────────────────────

export function FilesPage() {
  const user = useAuthStore((s) => s.user)
  const isAdmin = user?.role === 'admin'
  const { currentPrefix, userRoot, handleUpload, uploadState } = useFilesUpload()
  const { '*': pathParam = '' } = useParams()

  // Admin: fetch all users to map id → username for folder labels
  const { data: allUsers } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => adminApi.listUsers(),
    enabled: isAdmin,
    staleTime: 60_000,
  })
  const userNameMap = Object.fromEntries((allUsers ?? []).map((u) => [u.id, u.username]))
  const navigate = useNavigate()

  // Breadcrumb segments
  const segments = pathParam ? pathParam.split('/').filter(Boolean) : []

  const { data, isLoading } = useQuery({
    queryKey: ['files', currentPrefix],
    queryFn: () => fsApi.list(currentPrefix),
  })

  const [newFolderOpen, setNewFolderOpen] = useState(false)
  const [renaming, setRenaming] = useState<FsEntry | null>(null)
  const [deleting, setDeleting] = useState<{ key: string; name: string; isFolder: boolean } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const navigateTo = (folderPrefix: string) => {
    const rel = folderPrefix.slice(userRoot.length).replace(/\/$/, '')
    navigate(`/files/${rel}`)
  }

  const handleDownload = async (file: FsEntry) => {
    try {
      await fsApi.download(file.key)
    } catch {
      notifications.show({ color: 'red', message: 'Download failed.' })
    }
  }

  const isEmpty = !isLoading && (data?.folders.length ?? 0) === 0 && (data?.files.length ?? 0) === 0

  return (
    <>
      {/* Toolbar */}
      <Group justify="space-between" mb="md" wrap="nowrap">
        <Breadcrumbs>
          <Anchor size="sm" onClick={() => navigate('/files')} style={{ cursor: 'pointer' }}>
            {isAdmin ? 'All Files' : 'My Files'}
          </Anchor>
          {segments.map((seg, i) => {
            const path = segments.slice(0, i + 1).join('/')
            const isLast = i === segments.length - 1
            return isLast ? (
              <Text key={seg} size="sm">{seg}</Text>
            ) : (
              <Anchor key={seg} size="sm" onClick={() => navigate(`/files/${path}`)} style={{ cursor: 'pointer' }}>
                {seg}
              </Anchor>
            )
          })}
        </Breadcrumbs>

        <Group gap="xs">
          <Button
            size="xs"
            variant="default"
            leftSection={<IconPlus size={14} />}
            onClick={() => setNewFolderOpen(true)}
          >
            New folder
          </Button>
          <Button
            size="xs"
            leftSection={<IconUpload size={14} />}
            loading={!!uploadState}
            onClick={() => fileInputRef.current?.click()}
          >
            Upload
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            style={{ display: 'none' }}
            onChange={(e) => handleUpload(Array.from(e.target.files ?? []))}
            onClick={(e) => { (e.target as HTMLInputElement).value = '' }}
          />
        </Group>
      </Group>

      {/* Upload progress */}
      {uploadState && (
        <Paper withBorder p="sm" mb="md" radius="md">
          <Group justify="space-between" mb={6}>
            <Text size="xs" c="dimmed">
              Uploading {uploadState.fileIndex} of {uploadState.total}: <strong>{uploadState.fileName}</strong>
            </Text>
            <Text size="xs" c="dimmed">{uploadState.pct}%</Text>
          </Group>
          <Progress value={uploadState.pct} animated size="sm" />
        </Paper>
      )}

      {/* Table */}
      {isLoading ? (
        <Center mt="xl"><Loader size="sm" /></Center>
      ) : isEmpty ? (
        <Center mt={60}>
          <Stack align="center" gap="xs">
            <ThemeIcon size={48} variant="light" color="gray" radius="xl">
              <IconFolderOpen size={24} />
            </ThemeIcon>
            <Text size="sm" c="dimmed">This folder is empty</Text>
            <Text size="xs" c="dimmed">Drag files here or use the buttons above</Text>
            <Group gap="xs">
              <Button size="xs" variant="light" onClick={() => setNewFolderOpen(true)}>
                New folder
              </Button>
              <Button size="xs" variant="light" onClick={() => fileInputRef.current?.click()}>
                Upload files
              </Button>
            </Group>
          </Stack>
        </Center>
      ) : (
        <ScrollArea>
          <Table striped highlightOnHover withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th>Size</Table.Th>
                <Table.Th>Modified</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {/* Folders */}
              {data?.folders.map((prefix) => (
                <Table.Tr key={prefix} style={{ cursor: 'pointer' }}>
                  <Table.Td>
                    <Group gap="xs" wrap="nowrap">
                      <IconFolder size={16} style={{ flexShrink: 0 }} />
                      <Anchor
                        size="sm"
                        onDoubleClick={() => navigateTo(prefix)}
                        style={{ cursor: 'pointer' }}
                        underline="never"
                        c="inherit"
                        fw={500}
                      >
                        {(() => {
                          const id = folderName(prefix)
                          const name = isAdmin && currentPrefix === 'users/' ? userNameMap[id] : undefined
                          return name ? <>{id} <Text span size="sm" c="dimmed">({name})</Text></> : id
                        })()}
                      </Anchor>
                    </Group>
                  </Table.Td>
                  <Table.Td><Text size="sm" c="dimmed">—</Text></Table.Td>
                  <Table.Td><Text size="sm" c="dimmed">—</Text></Table.Td>
                  <Table.Td>
                    <Group gap={4} justify="flex-end">
                      <Tooltip label="Delete folder" position="left">
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          onClick={() => setDeleting({ key: prefix, name: folderName(prefix), isFolder: true })}
                        >
                          <IconTrash size={15} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}

              {/* Files */}
              {data?.files.map((file) => (
                <Table.Tr key={file.key} style={{ cursor: 'pointer' }}>
                  <Table.Td>
                    <Group gap="xs" wrap="nowrap">
                      <IconFile size={16} style={{ flexShrink: 0 }} />
                      <Text size="sm">{file.name}</Text>
                    </Group>
                  </Table.Td>
                  <Table.Td><Text size="sm">{formatSize(file.size)}</Text></Table.Td>
                  <Table.Td><Text size="sm">{formatDate(file.last_modified)}</Text></Table.Td>
                  <Table.Td>
                    <Group gap={4} justify="flex-end" wrap="nowrap">
                      <Tooltip label="Download" position="left">
                        <ActionIcon variant="subtle" color="gray" onClick={() => handleDownload(file)}>
                          <IconDownload size={15} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Rename" position="left">
                        <ActionIcon variant="subtle" color="gray" onClick={() => setRenaming(file)}>
                          <IconPencil size={15} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Delete" position="left">
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          onClick={() => setDeleting({ key: file.key, name: file.name, isFolder: false })}
                        >
                          <IconTrash size={15} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      )}

      <NewFolderModal
        opened={newFolderOpen}
        onClose={() => setNewFolderOpen(false)}
        currentPrefix={currentPrefix}
      />
      <RenameModal file={renaming} onClose={() => setRenaming(null)} />
      <DeleteConfirm item={deleting} onClose={() => setDeleting(null)} isAdmin={isAdmin} />
    </>
  )
}

