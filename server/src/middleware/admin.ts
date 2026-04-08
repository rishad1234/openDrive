import type { Context, Next } from 'hono'
import { getClaims } from './auth'

export async function adminOnly(c: Context, next: Next) {
  const claims = getClaims(c)
  if (claims.role !== 'admin') {
    return c.text('forbidden', 403)
  }
  await next()
}
