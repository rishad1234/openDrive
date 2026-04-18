import { Hono } from 'hono'
import bcrypt from 'bcryptjs'
import type { Env, AppVars } from '../index'
import { auth, getClaims } from '../middleware/auth'
import { adminOnly } from '../middleware/admin'
import { validatePassword } from '@common/validation/password'
import { validateUsername } from '@common/validation/username'
import { validateEmail } from '@common/validation/email'
import * as users from '../db/users'

const userRoutes = new Hono<{ Bindings: Env; Variables: AppVars }>()

// All admin routes require auth + admin
userRoutes.use('*', auth, adminOnly)

// GET /api/admin/users
userRoutes.get('/', async (c) => {
  const all = await users.getAll(c.env.DB)
  return c.json(all)
})

// POST /api/admin/users
userRoutes.post('/', async (c) => {
  const body = await c.req.json<{
    username?: string
    password?: string
    role?: string
    email?: string
  }>()

  if (!body.username || !body.password) {
    return c.text('username and password required', 400)
  }

  const unError = validateUsername(body.username)
  if (unError) {
    return c.text(unError, 400)
  }

  const pwError = validatePassword(body.password)
  if (pwError) {
    return c.text(pwError, 400)
  }

  const emailError = validateEmail(body.email)
  if (emailError) {
    return c.text(emailError, 400)
  }

  const role = body.role === 'admin' ? 'admin' : 'user'
  const hashed = await bcrypt.hash(body.password, 10)
  const id = crypto.randomUUID()

  try {
    const user = await users.create(c.env.DB, id, body.username, hashed, role, body.email || undefined)
    return c.json(user, 201)
  } catch {
    return c.text('username already exists', 409)
  }
})

// PATCH /api/admin/users/:id
userRoutes.patch('/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json<{
    password?: string
    role?: string
    email?: string
  }>()

  if (body.password) {
    const pwError = validatePassword(body.password)
    if (pwError) {
      return c.text(pwError, 400)
    }
  }

  const hashed = body.password ? await bcrypt.hash(body.password, 10) : null
  const role = body.role === 'admin' || body.role === 'user' ? body.role : null
  const email = body.email !== undefined ? (body.email || null) : undefined

  const emailError = validateEmail(email)
  if (emailError) {
    return c.text(emailError, 400)
  }

  await users.update(c.env.DB, id, hashed, role, email)
  return c.body(null, 204)
})

// DELETE /api/admin/users/:id
userRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id')
  const claims = getClaims(c)
  if (id === claims.user_id) {
    return c.text('cannot delete your own account', 400)
  }
  const found = await users.deleteUser(c.env.DB, id)
  if (!found) {
    return c.text('user not found', 404)
  }
  return c.body(null, 204)
})

export { userRoutes }
