import type { Context, Next } from 'hono'
import { jwtVerify } from 'jose'
import type { Role } from '@common/types/user'
import * as tokens from '../db/tokens'
import * as users from '../db/users'
import type { Env, AppVars } from '../index'

export interface Claims {
  user_id: string
  username: string
  role: Role
  jti: string
  exp: number
}

export async function auth(c: Context<{ Bindings: Env; Variables: AppVars }>, next: Next) {
  const header = c.req.header('Authorization')
  if (!header?.startsWith('Bearer ')) {
    return c.text('unauthorized', 401)
  }

  const token = header.slice(7)

  let payload: Claims
  try {
    const secret = new TextEncoder().encode(c.env.JWT_SECRET)
    const { payload: p } = await jwtVerify(token, secret)
    payload = p as unknown as Claims
  } catch {
    return c.text('unauthorized', 401)
  }

  // Check if token has been revoked (logout)
  if (payload.jti) {
    const revoked = await tokens.isRevoked(c.env.DB, payload.jti)
    if (revoked) {
      return c.text('unauthorized', 401)
    }
  }

  // Re-validate user and role from DB
  const user = await users.getByID(c.env.DB, payload.user_id)
  if (!user) {
    return c.text('unauthorized', 401)
  }

  // Update role from DB (catches role changes)
  payload.role = user.role

  c.set('claims', payload)
  await next()
}

export function getClaims(c: Context): Claims {
  return c.get('claims') as Claims
}
