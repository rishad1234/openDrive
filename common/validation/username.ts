export function validateUsername(username: string): string | null {
  if (username.length < 3) return 'Username must be at least 3 characters'
  if (username.length > 32) return 'Username must be at most 32 characters'
  if (!/^[a-zA-Z0-9_-]+$/.test(username)) return 'Username may only contain letters, numbers, underscores, and hyphens'
  return null
}
