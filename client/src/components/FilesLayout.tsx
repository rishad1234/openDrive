import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { Stack, Text } from '@mantine/core'
import { IconCloudUpload } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useQueryClient } from '@tanstack/react-query'
import { fsApi } from '../api/fs'
import { useAuthStore } from '../store/auth'

const MAX_DEPTH = 5

export interface UploadState {
  fileName: string
  fileIndex: number
  total: number
  pct: number
}

export interface FileWithPath {
  file: File
  relativePath: string  // e.g. "photos/sub/cat.jpg"
}

interface FilesUploadContextValue {
  currentPrefix: string
  userRoot: string
  handleUpload: (files: File[]) => void
  handleFolderUpload: (entries: FileWithPath[]) => void
  uploadState: UploadState | null
  isUploading: boolean
}

const FilesUploadContext = createContext<FilesUploadContextValue | null>(null)

export function useFilesUpload(): FilesUploadContextValue {
  const ctx = useContext(FilesUploadContext)
  if (!ctx) throw new Error('useFilesUpload must be used within FilesLayout')
  return ctx
}

export function FilesLayout({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user)
  const isAdmin = user?.role === 'admin'
  const userRoot = isAdmin ? 'users/' : `users/${user!.id}/`
  const { '*': pathParam = '' } = useParams()
  const qc = useQueryClient()

  const currentPrefix = pathParam
    ? `${userRoot}${pathParam.endsWith('/') ? pathParam : pathParam + '/'}`
    : userRoot

  const [uploadState, setUploadState] = useState<UploadState | null>(null)
  const isUploading = !!uploadState

  useEffect(() => {
    if (!isUploading) return
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isUploading])

  const handleUpload = async (files: File[]) => {
    if (files.length === 0) return
    const MAX_SIZE = 1 * 1024 * 1024 * 1024
    const oversized = files.filter((f) => f.size > MAX_SIZE)
    if (oversized.length > 0) {
      notifications.show({
        color: 'red',
        title: 'File too large',
        message: `${oversized.map((f) => f.name).join(', ')} exceed${oversized.length === 1 ? 's' : ''} the 1 GB limit.`,
      })
      return
    }
    let failed = 0
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      setUploadState({ fileName: file.name, fileIndex: i + 1, total: files.length, pct: 0 })
      try {
        const res = await fsApi.upload(currentPrefix, file, (pct) => {
          setUploadState((s) => s ? { ...s, pct } : s)
        })
        if (!res.ok) failed++
      } catch {
        failed++
      }
    }
    setUploadState(null)
    qc.invalidateQueries({ queryKey: ['files'] })
    if (failed > 0) {
      notifications.show({ color: 'red', message: `${failed} file(s) failed to upload.` })
    } else {
      notifications.show({ color: 'green', message: `${files.length} file(s) uploaded.` })
    }
  }

  const handleFolderUpload = useCallback(async (entries: FileWithPath[]) => {
    if (entries.length === 0) return

    // Depth validation — count slashes in each relative path
    const tooDeep = entries.filter((e) => e.relativePath.split('/').length - 1 > MAX_DEPTH)
    if (tooDeep.length > 0) {
      notifications.show({
        color: 'red',
        title: 'Folder too deep',
        message: `Maximum folder depth is ${MAX_DEPTH}. Upload cancelled.`,
      })
      return
    }

    const MAX_SIZE = 1 * 1024 * 1024 * 1024
    const oversized = entries.filter((e) => e.file.size > MAX_SIZE)
    if (oversized.length > 0) {
      notifications.show({
        color: 'red',
        title: 'File too large',
        message: `${oversized.map((e) => e.file.name).join(', ')} exceed${oversized.length === 1 ? 's' : ''} the 1 GB limit.`,
      })
      return
    }

    let failed = 0
    for (let i = 0; i < entries.length; i++) {
      const { file, relativePath } = entries[i]
      setUploadState({ fileName: relativePath, fileIndex: i + 1, total: entries.length, pct: 0 })
      try {
        const res = await fsApi.upload(currentPrefix, file, (pct) => {
          setUploadState((s) => s ? { ...s, pct } : s)
        }, relativePath)
        if (!res.ok) failed++
      } catch {
        failed++
      }
    }
    setUploadState(null)
    qc.invalidateQueries({ queryKey: ['files'] })
    if (failed > 0) {
      notifications.show({ color: 'red', message: `${failed} file(s) failed to upload.` })
    } else {
      notifications.show({ color: 'green', message: `${entries.length} file(s) uploaded.` })
    }
  }, [currentPrefix, qc])

  return (
    <FilesUploadContext.Provider value={{ currentPrefix, userRoot, handleUpload, handleFolderUpload, uploadState, isUploading }}>
      {/* Full-screen dropzone overlay */}
      <DropzoneOverlay onFiles={handleUpload} onFolderEntries={handleFolderUpload} />
      {children}
    </FilesUploadContext.Provider>
  )
}

// ── Dropzone with folder support ─────────────────────────────────────────────

function readEntryRecursive(entry: FileSystemEntry, path: string): Promise<FileWithPath[]> {
  return new Promise((resolve) => {
    if (entry.isFile) {
      (entry as FileSystemFileEntry).file((file) => {
        resolve([{ file, relativePath: path + file.name }])
      }, () => resolve([]))
    } else if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader()
      const allEntries: FileSystemEntry[] = []
      const readBatch = () => {
        reader.readEntries((batch) => {
          if (batch.length === 0) {
            Promise.all(
              allEntries.map((e) => readEntryRecursive(e, path + entry.name + '/'))
            ).then((results) => resolve(results.flat()))
          } else {
            allEntries.push(...batch)
            readBatch()
          }
        }, () => resolve([]))
      }
      readBatch()
    } else {
      resolve([])
    }
  })
}

function DropzoneOverlay({ onFiles, onFolderEntries }: {
  onFiles: (files: File[]) => void
  onFolderEntries: (entries: FileWithPath[]) => void
}) {
  const [active, setActive] = useState(false)
  const dragCounter = useRef(0)

  useEffect(() => {
    const onDragEnter = (e: DragEvent) => {
      e.preventDefault()
      dragCounter.current++
      if (dragCounter.current === 1) setActive(true)
    }
    const onDragLeave = (e: DragEvent) => {
      e.preventDefault()
      dragCounter.current--
      if (dragCounter.current === 0) setActive(false)
    }
    const onDragOver = (e: DragEvent) => e.preventDefault()

    const onDrop = async (e: DragEvent) => {
      e.preventDefault()
      dragCounter.current = 0
      setActive(false)

      const items = e.dataTransfer?.items
      if (!items) return

      let hasDirectories = false
      const entries: FileSystemEntry[] = []
      for (let i = 0; i < items.length; i++) {
        const entry = items[i].webkitGetAsEntry?.()
        if (entry) {
          entries.push(entry)
          if (entry.isDirectory) hasDirectories = true
        }
      }

      if (hasDirectories) {
        const allFiles = await Promise.all(entries.map((e) => readEntryRecursive(e, '')))
        onFolderEntries(allFiles.flat())
      } else {
        const files = Array.from(e.dataTransfer?.files ?? [])
        onFiles(files)
      }
    }

    document.addEventListener('dragenter', onDragEnter)
    document.addEventListener('dragleave', onDragLeave)
    document.addEventListener('dragover', onDragOver)
    document.addEventListener('drop', onDrop)
    return () => {
      document.removeEventListener('dragenter', onDragEnter)
      document.removeEventListener('dragleave', onDragLeave)
      document.removeEventListener('dragover', onDragOver)
      document.removeEventListener('drop', onDrop)
    }
  }, [onFiles, onFolderEntries])

  if (!active) return null

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      pointerEvents: 'none',
    }}>
      <Stack align="center" gap="xs">
        <IconCloudUpload size={52} style={{ color: 'var(--mantine-color-blue-5)' }} />
        <Text fw={600} size="xl" c="blue">Drop files or folders to upload</Text>
      </Stack>
    </div>
  )
}
