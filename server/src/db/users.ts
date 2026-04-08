import type { AuthUser, Role } from '@common/types/user'

interface UserRow {
  id: string
  username: string
  password: string
  role: Role
  email: string | null
  created_at: string
}

export async function getAll(db: D1Database): Promise<AuthUser[]> {
  const { results } = await db
    .prepare('SELECT id, username, role, created_at, email FROM users ORDER BY created_at ASC')
    .all<UserRow>()
  return results.map(toAuthUser)
}

export async function getByUsername(db: D1Database, username: string): Promise<UserRow | null> {
  return db
    .prepare('SELECT id, username, password, role, created_at, email FROM users WHERE username = ?')
    .bind(username)
    .first<UserRow>()
}

export async function getByID(db: D1Database, id: string): Promise<AuthUser | null> {
  const row = await db
    .prepare('SELECT id, username, role, created_at, email FROM users WHERE id = ?')
    .bind(id)
    .first<UserRow>()
  return row ? toAuthUser(row) : null
}

export async function getByIDWithPassword(db: D1Database, id: string): Promise<UserRow | null> {
  return db
    .prepare('SELECT id, username, password, role, created_at, email FROM users WHERE id = ?')
    .bind(id)
    .first<UserRow>()
}

export async function create(
  db: D1Database,
  id: string,
  username: string,
  hashedPassword: string,
  role: Role,
  email?: string,
): Promise<AuthUser> {
  await db
    .prepare('INSERT INTO users (id, username, password, role, email) VALUES (?, ?, ?, ?, ?)')
    .bind(id, username, hashedPassword, role, email ?? null)
    .run()
  return { id, username, role, email }
}

export async function update(
  db: D1Database,
  id: string,
  hashedPassword: string | null,
  role: Role | null,
  email: string | null | undefined,
): Promise<void> {
  const batch: D1PreparedStatement[] = []

  if (hashedPassword) {
    batch.push(db.prepare('UPDATE users SET password = ? WHERE id = ?').bind(hashedPassword, id))
  }
  if (role) {
    batch.push(db.prepare('UPDATE users SET role = ? WHERE id = ?').bind(role, id))
  }
  if (email !== undefined) {
    batch.push(db.prepare('UPDATE users SET email = ? WHERE id = ?').bind(email, id))
  }

  if (batch.length > 0) {
    await db.batch(batch)
  }
}

export async function updateSelf(
  db: D1Database,
  id: string,
  username: string | null,
  hashedPassword: string | null,
  email: string | null | undefined,
): Promise<void> {
  const batch: D1PreparedStatement[] = []

  if (username) {
    batch.push(db.prepare('UPDATE users SET username = ? WHERE id = ?').bind(username, id))
  }
  if (hashedPassword) {
    batch.push(db.prepare('UPDATE users SET password = ? WHERE id = ?').bind(hashedPassword, id))
  }
  if (email !== undefined) {
    batch.push(db.prepare('UPDATE users SET email = ? WHERE id = ?').bind(email, id))
  }

  if (batch.length > 0) {
    await db.batch(batch)
  }
}

export async function deleteUser(db: D1Database, id: string): Promise<boolean> {
  const result = await db
    .prepare('DELETE FROM users WHERE id = ?')
    .bind(id)
    .run()
  return result.meta.changes > 0
}

function toAuthUser(row: UserRow): AuthUser {
  return {
    id: row.id,
    username: row.username,
    role: row.role,
    email: row.email,
    created_at: row.created_at,
  }
}
