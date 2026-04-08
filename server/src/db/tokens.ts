export async function revoke(db: D1Database, jti: string, expiresAt: string): Promise<void> {
  await db
    .prepare('INSERT OR IGNORE INTO revoked_tokens (jti, expires_at) VALUES (?, ?)')
    .bind(jti, expiresAt)
    .run()
}

export async function isRevoked(db: D1Database, jti: string): Promise<boolean> {
  const row = await db
    .prepare("SELECT COUNT(*) as count FROM revoked_tokens WHERE jti = ? AND expires_at > datetime('now')")
    .bind(jti)
    .first<{ count: number }>()
  return (row?.count ?? 0) > 0
}

export async function cleanup(db: D1Database): Promise<void> {
  await db.prepare("DELETE FROM revoked_tokens WHERE expires_at <= datetime('now')").run()
}
