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

interface UpdateFields {
  password?: string | null
  role?: Role | null
  email?: string | null
}

interface UpdateSelfFields {
  username?: string | null
  password?: string | null
  email?: string | null
}

export async function update(
  db: D1Database,
  id: string,
  hashedPassword: string | null,
  role: Role | null,
  email: string | null | undefined,
): Promise<void> {
  await applyUpdates(db, id, { password: hashedPassword, role, email })
}

export async function updateSelf(
  db: D1Database,
  id: string,
  username: string | null,
  hashedPassword: string | null,
  email: string | null | undefined,
): Promise<void> {
  await applyUpdates(db, id, { username, password: hashedPassword, email })
}

async function applyUpdates(
  db: D1Database,
  id: string,
  fields: UpdateFields | UpdateSelfFields,
): Promise<void> {
  const batch: D1PreparedStatement[] = []

  for (const [column, value] of Object.entries(fields)) {
    if (value === undefined) continue
    if (value === null && column !== 'email') continue
    batch.push(db.prepare(`UPDATE users SET ${column} = ? WHERE id = ?`).bind(value, id))
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
