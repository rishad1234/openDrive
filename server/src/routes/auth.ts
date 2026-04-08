import { Hono } from 'hono'
import { SignJWT } from 'jose'
import bcrypt from 'bcryptjs'
import type { Env, AppVars } from '../index'
import { auth, getClaims } from '../middleware/auth'
import * as users from '../db/users'
import * as tokens from '../db/tokens'

const authRoutes = new Hono<{ Bindings: Env; Variables: AppVars }>()

// POST /api/auth/login — public, no middleware
authRoutes.post('/login', async (c) => {
  const body = await c.req.json<{ username?: string; password?: string }>()
  if (!body.username || !body.password) {
    return c.text('username and password required', 400)
  }

  const user = await users.getByUsername(c.env.DB, body.username)
  if (!user) {
    return c.text('invalid credentials', 401)
  }

  const valid = await bcrypt.compare(body.password, user.password)
  if (!valid) {
    return c.text('invalid credentials', 401)
  }

  const jti = crypto.randomUUID()
  const secret = new TextEncoder().encode(c.env.JWT_SECRET)
  const now = Math.floor(Date.now() / 1000)

  const token = await new SignJWT({
    user_id: user.id,
    username: user.username,
    role: user.role,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setJti(jti)
    .setIssuedAt(now)
    .setExpirationTime(now + 24 * 60 * 60) // 24 hours
    .sign(secret)

  return c.json({ token })
})

// GET /api/auth/me — requires auth
authRoutes.get('/me', auth, async (c) => {
  const claims = getClaims(c)
  const user = await users.getByID(c.env.DB, claims.user_id)
  if (!user) {
    return c.text('internal server error', 500)
  }
  return c.json(user)
})

// POST /api/auth/logout — requires auth
authRoutes.post('/logout', auth, async (c) => {
  const claims = getClaims(c)
  if (!claims.jti) {
    return c.body(null, 204)
  }

  const expiresAt = new Date(claims.exp * 1000).toISOString()
  await tokens.revoke(c.env.DB, claims.jti, expiresAt)
  return c.body(null, 204)
})

export { authRoutes }
