import { useAuthStore } from '../store/auth'

interface ApiFetchOptions extends RequestInit {
  skipRedirectOn401?: boolean
}

export async function apiFetch<T>(
  path: string,
  init: ApiFetchOptions = {},
): Promise<T> {
  const { skipRedirectOn401, ...fetchInit } = init
  const token = useAuthStore.getState().token

  const res = await fetch(path, {
    ...fetchInit,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...fetchInit.headers,
    },
  })

  if (res.status === 401) {
    if (!skipRedirectOn401) {
      useAuthStore.getState().clearAuth()
      window.location.href = '/login'
    }
    const text = await res.text()
    throw new Error(text || 'unauthorized')
  }

  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || res.statusText)
  }

  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}
