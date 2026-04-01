import { apiFetch } from './client'
import { useAuthStore } from '../store/auth'

export interface FsEntry {
  key: string
  name: string
  size: number
  last_modified: string
}

export interface ListResponse {
  folders: string[]
  files: FsEntry[]
}

export const fsApi = {
  list: (prefix: string) =>
    apiFetch<ListResponse>(`/api/fs/list?prefix=${encodeURIComponent(prefix)}`),

  mkdir: (prefix: string) =>
    apiFetch<void>('/api/fs/mkdir', {
      method: 'POST',
      body: JSON.stringify({ prefix }),
    }),

  delete: (key: string) =>
    apiFetch<void>(`/api/fs/delete?key=${encodeURIComponent(key)}`, {
      method: 'DELETE',
    }),

  move: (src: string, dst: string) =>
    apiFetch<void>('/api/fs/move', {
      method: 'POST',
      body: JSON.stringify({ src, dst }),
    }),

  download: async (key: string): Promise<void> => {
    const token = useAuthStore.getState().token
    const res = await fetch(`/api/fs/download?key=${encodeURIComponent(key)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!res.ok) throw new Error('Download failed')
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const match = res.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)
    a.download = match?.[1] ?? key.split('/').pop() ?? 'download'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  },

  upload: (prefix: string, file: File, onProgress?: (pct: number) => void): Promise<{ ok: boolean }> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      const token = useAuthStore.getState().token

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress(Math.round((e.loaded / e.total) * 100))
        }
      }

      xhr.onload = () => resolve({ ok: xhr.status >= 200 && xhr.status < 300 })
      xhr.onerror = () => reject(new Error('Upload failed'))
      xhr.onabort = () => reject(new Error('Upload aborted'))

      const form = new FormData()
      form.append('file', file)

      xhr.open('POST', `/api/fs/upload?prefix=${encodeURIComponent(prefix)}`)
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)
      xhr.send(form)
    })
  },
}

