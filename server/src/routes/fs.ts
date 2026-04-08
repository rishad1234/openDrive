import { Hono } from 'hono'
import type { Env, AppVars } from '../index'
import { auth, getClaims } from '../middleware/auth'
import {
  createR2Client,
  getUploadUrl,
  getDownloadUrl,
  listObjects,
  putEmpty,
  deleteObject,
  deletePrefix,
  copyObject,
} from '../lib/s3'

const fsRoutes = new Hono<{ Bindings: Env; Variables: AppVars }>()
fsRoutes.use('*', auth)

// ---------- helpers ----------

function userPrefix(role: string, userId: string, requested: string): string | null {
  const base = `users/${userId}/`

  if (role === 'admin') {
    return requested || 'users/'
  }

  if (!requested) return base
  if (!requested.startsWith(base)) return null // forbidden
  return requested
}

// ---------- LIST ----------

fsRoutes.get('/list', async (c) => {
  const claims = getClaims(c)
  const requested = c.req.query('prefix') ?? ''
  const prefix = userPrefix(claims.role, claims.user_id, requested)
  if (prefix === null) return c.text('forbidden', 403)

  const r2 = createR2Client(c.env)
  const result = await listObjects(r2, c.env, prefix)
  return c.json(result)
})

// ---------- MKDIR ----------

fsRoutes.post('/mkdir', async (c) => {
  const claims = getClaims(c)
  const body = await c.req.json<{ prefix: string }>()
  let requested = body.prefix
  if (!requested) return c.text('prefix required', 400)
  if (!requested.endsWith('/')) requested += '/'

  const prefix = userPrefix(claims.role, claims.user_id, requested)
  if (prefix === null) return c.text('forbidden', 403)

  const r2 = createR2Client(c.env)
  await putEmpty(r2, c.env, `${prefix}.keep`)
  return c.body(null, 201)
})

// ---------- UPLOAD (presigned URL) ----------

fsRoutes.post('/upload-url', async (c) => {
  const claims = getClaims(c)
  const body = await c.req.json<{ key: string; content_type: string }>()
  if (!body.key) return c.text('key required', 400)

  const prefix = userPrefix(claims.role, claims.user_id, body.key)
  if (prefix === null) return c.text('forbidden', 403)

  const r2 = createR2Client(c.env)
  const url = await getUploadUrl(r2, c.env, prefix, body.content_type || 'application/octet-stream')
  return c.json({ url })
})

// ---------- DOWNLOAD (presigned URL) ----------

fsRoutes.get('/download-url', async (c) => {
  const claims = getClaims(c)
  const key = c.req.query('key') ?? ''
  if (!key) return c.text('key required', 400)

  const resolved = userPrefix(claims.role, claims.user_id, key)
  if (resolved === null) return c.text('forbidden', 403)

  const r2 = createR2Client(c.env)
  const url = await getDownloadUrl(r2, c.env, resolved)
  return c.json({ url })
})

// ---------- DELETE ----------

fsRoutes.delete('/delete', async (c) => {
  const claims = getClaims(c)
  const key = c.req.query('key') ?? ''
  if (!key) return c.text('key required', 400)

  const resolved = userPrefix(claims.role, claims.user_id, key)
  if (resolved === null) return c.text('forbidden', 403)

  const r2 = createR2Client(c.env)
  if (resolved.endsWith('/')) {
    await deletePrefix(r2, c.env, resolved)
  } else {
    await deleteObject(r2, c.env, resolved)
  }

  return c.body(null, 204)
})

// ---------- MOVE ----------

fsRoutes.post('/move', async (c) => {
  const claims = getClaims(c)
  const body = await c.req.json<{ src: string; dst: string }>()
  if (!body.src || !body.dst) return c.text('src and dst required', 400)

  const srcKey = userPrefix(claims.role, claims.user_id, body.src)
  if (srcKey === null) return c.text('forbidden', 403)
  const dstKey = userPrefix(claims.role, claims.user_id, body.dst)
  if (dstKey === null) return c.text('forbidden', 403)

  const r2 = createR2Client(c.env)
  await copyObject(r2, c.env, srcKey, dstKey)
  await deleteObject(r2, c.env, srcKey)
  return c.body(null, 204)
})

export { fsRoutes }
