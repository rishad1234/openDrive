import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Table,
  Group,
  Button,
  Checkbox,
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
  IconRefresh,
} from '@tabler/icons-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notifications } from '@mantine/notifications'
import { fsApi, type FsEntry } from '../api/fs'
import { adminApi } from '../api/admin'
import { useAuthStore } from '../store/auth'
import { useFilesUpload, type FileWithPath } from '../components/FilesLayout'

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

function fileIconColor(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (['jpg','jpeg','png','gif','webp','svg','ico','bmp','heic'].includes(ext)) return 'green'
  if (['mp4','mov','avi','mkv','webm','m4v'].includes(ext)) return 'grape'
  if (['mp3','wav','flac','aac','ogg','m4a'].includes(ext)) return 'teal'
  if (['pdf'].includes(ext)) return 'red'
  if (['doc','docx','txt','md','rtf','odt'].includes(ext)) return 'blue'
  if (['xls','xlsx','csv','ods'].includes(ext)) return 'lime'
  if (['zip','tar','gz','rar','7z','bz2'].includes(ext)) return 'orange'
  if (['js','ts','jsx','tsx','go','py','rs','java','c','cpp','h','rb','php'].includes(ext)) return 'violet'
  return 'gray'
}

// ── hover row ────────────────────────────────────────────────────────────────

function HoverRow({ children, actions, checked, hasSelection, onCheck }: {
  children: React.ReactNode
  actions: React.ReactNode
  checked: boolean
  hasSelection: boolean
  onCheck: (e: React.MouseEvent) => void
}) {
  const [hovered, setHovered] = useState(false)
  const showCheckbox = hasSelection || hovered || checked

  return (
    <Table.Tr
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      bg={checked ? 'var(--mantine-color-blue-light)' : undefined}
    >
      <Table.Td style={{ width: 36 }} onClick={(e) => { e.stopPropagation(); onCheck(e) }}>
        <Checkbox
          checked={checked}
          onChange={() => {}}
          tabIndex={-1}
          size="xs"
          style={{ opacity: showCheckbox ? 1 : 0, transition: 'opacity 140ms ease', pointerEvents: 'none' }}
        />
      </Table.Td>
      {children}
      <Table.Td>
        <Group gap={4} justify="flex-end" wrap="nowrap">
          {actions}
        </Group>
      </Table.Td>
    </Table.Tr>
  )
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

function BulkDeleteConfirm({
  items, onClose, isAdmin,
}: { items: { key: string; name: string; isFolder: boolean }[]; onClose: () => void; isAdmin?: boolean }) {
  const qc = useQueryClient()
  const [step, setStep] = useState<1 | 2>(1)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (items.length) { setStep(1); setProgress(0) }
  }, [items])

  const mutation = useMutation({
    mutationFn: async () => {
      for (let i = 0; i < items.length; i++) {
        await fsApi.delete(items[i].key)
        setProgress(i + 1)
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['files'] })
      notifications.show({ color: 'green', message: `${items.length} item${items.length > 1 ? 's' : ''} deleted.` })
      onClose()
    },
    onError: () => {
      qc.invalidateQueries({ queryKey: ['files'] })
      notifications.show({ color: 'red', message: 'Some items failed to delete.' })
    },
  })

  if (!isAdmin) {
    return (
      <Modal opened={items.length > 0} onClose={onClose} title="Confirm delete" size="sm">
        <Text size="sm" mb="lg">
          Delete <strong>{items.length} item{items.length > 1 ? 's' : ''}</strong>? This cannot be undone.
        </Text>
        {mutation.isPending && (
          <Progress value={(progress / items.length) * 100} size="sm" mb="md" animated />
        )}
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose} disabled={mutation.isPending}>Cancel</Button>
          <Button color="red" loading={mutation.isPending} onClick={() => mutation.mutate()}>Delete</Button>
        </Group>
      </Modal>
    )
  }

  return (
    <Modal
      opened={items.length > 0}
      onClose={onClose}
      title={step === 1 ? 'Delete confirmation — step 1 of 2' : 'Delete confirmation — step 2 of 2'}
      size="sm"
    >
      {step === 1 ? (
        <Stack>
          <Text size="sm">
            You are about to permanently delete <strong>{items.length} item{items.length > 1 ? 's' : ''}</strong>.
          </Text>
          <Text size="sm" c="dimmed">
            As an admin you may be deleting user files. This action cannot be undone.
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
            Permanently delete <strong>{items.length} item{items.length > 1 ? 's' : ''}</strong>? There is no recovery.
          </Text>
          {mutation.isPending && (
            <Progress value={(progress / items.length) * 100} size="sm" animated />
          )}
          <Group justify="flex-end" mt="xs">
            <Button variant="default" onClick={() => setStep(1)} disabled={mutation.isPending}>Go back</Button>
            <Button color="red" loading={mutation.isPending} onClick={() => mutation.mutate()}>Delete permanently</Button>
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
  const { currentPrefix, userRoot, handleUpload, handleFolderUpload, uploadState } = useFilesUpload()
  const { '*': pathParam = '' } = useParams()
  const qc = useQueryClient()

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
  const folderInputRef = useRef<HTMLInputElement>(null)

  // ── selection ──────────────────────────────────────────────────────────────
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const lastClickedRef = useRef<string | null>(null)
  const [bulkDeleting, setBulkDeleting] = useState<{ key: string; name: string; isFolder: boolean }[]>([])

  const allItems = useMemo(() => {
    const items: { key: string; name: string; isFolder: boolean }[] = []
    for (const prefix of data?.folders ?? []) {
      items.push({ key: prefix, name: folderName(prefix), isFolder: true })
    }
    for (const file of data?.files ?? []) {
      items.push({ key: file.key, name: file.name, isFolder: false })
    }
    return items
  }, [data])

  const hasSelection = selected.size > 0

  const toggleSelect = useCallback((key: string, e: React.MouseEvent) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (e.shiftKey && lastClickedRef.current) {
        const allKeys = allItems.map((i) => i.key)
        const lastIdx = allKeys.indexOf(lastClickedRef.current)
        const curIdx = allKeys.indexOf(key)
        if (lastIdx !== -1 && curIdx !== -1) {
          const [start, end] = lastIdx < curIdx ? [lastIdx, curIdx] : [curIdx, lastIdx]
          for (let i = start; i <= end; i++) next.add(allKeys[i])
        }
      } else {
        if (next.has(key)) next.delete(key)
        else next.add(key)
      }
      lastClickedRef.current = key
      return next
    })
  }, [allItems])

  const toggleSelectAll = useCallback(() => {
    setSelected((prev) =>
      prev.size === allItems.length ? new Set() : new Set(allItems.map((i) => i.key))
    )
  }, [allItems])

  const handleBulkDelete = useCallback(() => {
    setBulkDeleting(allItems.filter((i) => selected.has(i.key)))
  }, [allItems, selected])

  // Clear selection on navigation
  useEffect(() => { setSelected(new Set()) }, [currentPrefix])

  // Escape clears selection
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelected(new Set()) }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

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
      {hasSelection ? (
        <Group justify="space-between" mb="md" wrap="nowrap">
          <Text size="sm">
            {selected.size} item{selected.size > 1 ? 's' : ''} selected
          </Text>
          <Group gap="xs">
            <Button size="xs" variant="default" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
            <Button size="xs" color="red" leftSection={<IconTrash size={14} />} onClick={handleBulkDelete}>
              Delete
            </Button>
          </Group>
        </Group>
      ) : (
      <Group justify="space-between" mb="md" wrap="wrap">
        <Group gap={4} align="center" wrap="nowrap" style={{ minWidth: 0 }}>
          <Breadcrumbs style={{ overflow: 'hidden' }}>
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
          <Tooltip label="Refresh" position="bottom">
            <ActionIcon
              variant="subtle"
              color="gray"
              size="md"
              loading={isLoading}
              onClick={() => qc.invalidateQueries({ queryKey: ['files', currentPrefix] })}
              aria-label="Refresh"
            >
              <IconRefresh size={15} />
            </ActionIcon>
          </Tooltip>
        </Group>

        <Group gap="xs" wrap="nowrap">
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
          <Button
            size="xs"
            variant="default"
            leftSection={<IconUpload size={14} />}
            loading={!!uploadState}
            onClick={() => folderInputRef.current?.click()}
          >
            Upload folder
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            style={{ display: 'none' }}
            onChange={(e) => handleUpload(Array.from(e.target.files ?? []))}
            onClick={(e) => { (e.target as HTMLInputElement).value = '' }}
          />
          <input
            ref={folderInputRef}
            type="file"
            // @ts-expect-error webkitdirectory is non-standard but widely supported
            webkitdirectory=""
            multiple
            style={{ display: 'none' }}
            onChange={(e) => {
              const files = Array.from(e.target.files ?? [])
              const entries: FileWithPath[] = files.map((f) => ({
                file: f,
                relativePath: (f as any).webkitRelativePath || f.name,
              }))
              handleFolderUpload(entries)
            }}
            onClick={(e) => { (e.target as HTMLInputElement).value = '' }}
          />
        </Group>
      </Group>
      )}

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
        <>

        <ScrollArea>
          <Table striped highlightOnHover withTableBorder style={{ minWidth: 500 }}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th style={{ width: 36, height: 36, verticalAlign: 'middle' }}>
                  <Checkbox
                    checked={allItems.length > 0 && selected.size === allItems.length}
                    indeterminate={selected.size > 0 && selected.size < allItems.length}
                    onChange={toggleSelectAll}
                    size="xs"
                  />
                </Table.Th>
                <Table.Th style={{ verticalAlign: 'middle' }}>Name</Table.Th>
                <Table.Th style={{ verticalAlign: 'middle' }}>Size</Table.Th>
                <Table.Th style={{ verticalAlign: 'middle' }}>Modified</Table.Th>
                <Table.Th style={{ height: 36 }} />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {/* Folders */}
              {data?.folders.map((prefix) => (
                <HoverRow
                  key={prefix}
                  checked={selected.has(prefix)}
                  hasSelection={hasSelection}
                  onCheck={(e) => toggleSelect(prefix, e)}
                  actions={
                    <Tooltip label="Delete folder" position="left">
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        onClick={() => setDeleting({ key: prefix, name: folderName(prefix), isFolder: true })}
                      >
                        <IconTrash size={15} />
                      </ActionIcon>
                    </Tooltip>
                  }
                >
                  <Table.Td>
                    <Group gap="xs" wrap="nowrap">
                      <IconFolder size={16} style={{ color: 'var(--mantine-color-yellow-5)', flexShrink: 0 }} />
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
                </HoverRow>
              ))}

              {/* Files */}
              {data?.files.map((file) => (
                <HoverRow
                  key={file.key}
                  checked={selected.has(file.key)}
                  hasSelection={hasSelection}
                  onCheck={(e) => toggleSelect(file.key, e)}
                  actions={
                    <>
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
                    </>
                  }
                >
                  <Table.Td>
                    <Group gap="xs" wrap="nowrap">
                      <IconFile size={16} style={{ color: `var(--mantine-color-${fileIconColor(file.name)}-5)`, flexShrink: 0 }} />
                      <Text size="sm">{file.name}</Text>
                    </Group>
                  </Table.Td>
                  <Table.Td><Text size="sm">{formatSize(file.size)}</Text></Table.Td>
                  <Table.Td><Text size="sm">{formatDate(file.last_modified)}</Text></Table.Td>
                </HoverRow>
              ))}
            </Table.Tbody>
          </Table>
        </ScrollArea>
        </>)}


      <NewFolderModal
        opened={newFolderOpen}
        onClose={() => setNewFolderOpen(false)}
        currentPrefix={currentPrefix}
      />
      <RenameModal file={renaming} onClose={() => setRenaming(null)} />
      <DeleteConfirm item={deleting} onClose={() => setDeleting(null)} isAdmin={isAdmin} />
      <BulkDeleteConfirm
        items={bulkDeleting}
        onClose={() => { setBulkDeleting([]); setSelected(new Set()) }}
        isAdmin={isAdmin}
      />
    </>
  )
}

