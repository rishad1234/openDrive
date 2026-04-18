export function validateEmail(email: string | null | undefined): string | null {
  if (!email) return null // email is optional
  if (email.length > 254) return 'Email must be at most 254 characters'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Invalid email address'
  return null
}
