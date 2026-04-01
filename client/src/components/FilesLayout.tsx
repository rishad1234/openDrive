import { createContext, useContext, useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Stack, Text } from '@mantine/core'
import { Dropzone } from '@mantine/dropzone'
import { IconCloudUpload } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useQueryClient } from '@tanstack/react-query'
import { fsApi } from '../api/fs'
import { useAuthStore } from '../store/auth'

export interface UploadState {
  fileName: string
  fileIndex: number
  total: number
  pct: number
}

interface FilesUploadContextValue {
  currentPrefix: string
  userRoot: string
  handleUpload: (files: File[]) => void
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

  return (
    <FilesUploadContext.Provider value={{ currentPrefix, userRoot, handleUpload, uploadState, isUploading }}>
      {/* Full-screen dropzone — listens at document level via portal, covers entire viewport on drag */}
      <Dropzone.FullScreen
        active
        onDrop={handleUpload}
        onReject={(rejections) =>
          notifications.show({
            color: 'red',
            title: 'Upload rejected',
            message: rejections.map((r) => `${r.file.name}: ${r.errors[0]?.message}`).join(', '),
          })
        }
        maxSize={1 * 1024 * 1024 * 1024}
      >
        <Dropzone.Accept>
          <Stack align="center" gap="xs">
            <IconCloudUpload size={52} style={{ color: 'var(--mantine-color-blue-5)' }} />
            <Text fw={600} size="xl" c="blue">Drop files to upload</Text>
          </Stack>
        </Dropzone.Accept>
        <Dropzone.Reject>
          <Text fw={600} size="xl" c="red">File too large — max 1 GB</Text>
        </Dropzone.Reject>
      </Dropzone.FullScreen>

      {children}
    </FilesUploadContext.Provider>
  )
}
