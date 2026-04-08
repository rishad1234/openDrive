export function validatePassword(pw: string): string | null {
  if (pw.length < 8) return 'At least 8 characters required'
  if (!/[A-Z]/.test(pw)) return 'At least one uppercase letter required'
  if (!/[a-z]/.test(pw)) return 'At least one lowercase letter required'
  if (!/[0-9]/.test(pw)) return 'At least one number required'
  return null
}
