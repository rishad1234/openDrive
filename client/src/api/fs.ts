import { apiFetch } from './client'

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
    const { url } = await apiFetch<{ url: string }>(
      `/api/fs/download-url?key=${encodeURIComponent(key)}`,
    )
    const a = document.createElement('a')
    a.href = url
    a.download = key.split('/').pop() ?? 'download'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  },

  upload: (prefix: string, file: File, onProgress?: (pct: number) => void, relativePath?: string): Promise<{ ok: boolean }> => {
    return new Promise(async (resolve, reject) => {
      try {
        const key = relativePath ? prefix + relativePath : prefix + file.name
        const { url } = await apiFetch<{ url: string }>('/api/fs/upload-url', {
          method: 'POST',
          body: JSON.stringify({ key, content_type: file.type || 'application/octet-stream' }),
        })

        const xhr = new XMLHttpRequest()

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable && onProgress) {
            onProgress(Math.round((e.loaded / e.total) * 100))
          }
        }

        xhr.onload = () => resolve({ ok: xhr.status >= 200 && xhr.status < 300 })
        xhr.onerror = () => reject(new Error('Upload failed'))
        xhr.onabort = () => reject(new Error('Upload aborted'))

        xhr.open('PUT', url)
        xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream')
        xhr.send(file)
      } catch (err) {
        reject(err)
      }
    })
  },
}

