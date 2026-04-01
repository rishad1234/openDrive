import { apiFetch } from './client'
import { useAuthStore } from '../store/auth'

export interface FsEntry {
  name: string
  path: string
  isDir: boolean
  size: number
  lastModified: string
}

export const fsApi = {
  list: (path: string) =>
    apiFetch<FsEntry[]>(`/api/fs/list?path=${encodeURIComponent(path)}`),

  mkdir: (path: string) =>
    apiFetch<void>('/api/fs/mkdir', {
      method: 'POST',
      body: JSON.stringify({ path }),
    }),

  delete: (path: string) =>
    apiFetch<void>(`/api/fs/delete?path=${encodeURIComponent(path)}`, {
      method: 'DELETE',
    }),

  move: (from: string, to: string) =>
    apiFetch<void>('/api/fs/move', {
      method: 'POST',
      body: JSON.stringify({ from, to }),
    }),

  download: (path: string) => `/api/fs/download?path=${encodeURIComponent(path)}`,

  upload: (path: string, file: File) => {
    const form = new FormData()
    form.append('path', path)
    form.append('file', file)
    const token = useAuthStore.getState().token
    return fetch('/api/fs/upload', {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    })
  },
}
