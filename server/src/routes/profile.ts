import { Hono } from 'hono'
import bcrypt from 'bcryptjs'
import type { Env, AppVars } from '../index'
import { auth, getClaims } from '../middleware/auth'
import { validatePassword } from '@common/validation/password'
import { validateUsername } from '@common/validation/username'
import { validateEmail } from '@common/validation/email'
import * as users from '../db/users'

const profileRoutes = new Hono<{ Bindings: Env; Variables: AppVars }>()

// PATCH /api/user/profile — requires auth
profileRoutes.patch('/profile', auth, async (c) => {
  const claims = getClaims(c)
  const body = await c.req.json<{
    username?: string
    current_password?: string
    password?: string
    email?: string | null
  }>()

  if (body.username) {
    const unError = validateUsername(body.username)
    if (unError) {
      return c.text(unError, 400)
    }
  }

  let hashed: string | null = null

  // If changing password, enforce policy + verify current password
  if (body.password) {
    const pwError = validatePassword(body.password)
    if (pwError) {
      return c.text(pwError, 400)
    }
    if (!body.current_password) {
      return c.text('current password required to set a new password', 400)
    }

    const current = await users.getByIDWithPassword(c.env.DB, claims.user_id)
    if (!current) {
      return c.text('internal server error', 500)
    }

    const valid = await bcrypt.compare(body.current_password, current.password)
    if (!valid) {
      return c.text('current password is incorrect', 401)
    }

    hashed = await bcrypt.hash(body.password, 10)
  }

  const email = body.email !== undefined ? (body.email || null) : undefined
  const emailError = validateEmail(email)
  if (emailError) {
    return c.text(emailError, 400)
  }

  await users.updateSelf(c.env.DB, claims.user_id, body.username ?? null, hashed, email)

  const user = await users.getByID(c.env.DB, claims.user_id)
  if (!user) {
    return c.text('internal server error', 500)
  }

  return c.json(user)
})

export { profileRoutes }
