import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { authRoutes } from './routes/auth'
import { userRoutes } from './routes/users'
import { profileRoutes } from './routes/profile'
import { fsRoutes } from './routes/fs'

import type { Claims } from './middleware/auth'

export type Env = {
  DB: D1Database
  JWT_SECRET: string
  ALLOWED_ORIGIN: string
  R2_ENDPOINT: string
  R2_ACCESS_KEY_ID: string
  R2_SECRET_ACCESS_KEY: string
  R2_BUCKET: string
  R2_REGION: string
}

export type AppVars = {
  claims: Claims
}

const app = new Hono<{ Bindings: Env; Variables: AppVars }>()

app.use('*', logger())
app.use('*', (c, next) => {
  return cors({
    origin: c.env.ALLOWED_ORIGIN,
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Accept', 'Authorization', 'Content-Type'],
    credentials: true,
  })(c, next)
})

// Health check
app.get('/api/health', (c) => c.json({ status: 'ok' }))

// Auth routes (login is public, me/logout have auth inline)
app.route('/api/auth', authRoutes)

// Admin user management (auth + admin middleware applied in route)
app.route('/api/admin/users', userRoutes)

// User self-service profile (auth middleware applied in route)
app.route('/api/user', profileRoutes)

// File operations (auth middleware applied in route)
app.route('/api/fs', fsRoutes)

export default app
