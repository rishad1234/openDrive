package mapper

import (
	"database/sql"
	"fmt"
	"time"
)

type TokenMapper struct {
	db *sql.DB
}

func NewTokenMapper(db *sql.DB) *TokenMapper {
	return &TokenMapper{db: db}
}

// Revoke adds a token JTI to the blocklist until its expiry time.
func (m *TokenMapper) Revoke(jti string, expiresAt time.Time) error {
	_, err := m.db.Exec(
		"INSERT OR IGNORE INTO revoked_tokens (jti, expires_at) VALUES (?, ?)",
		jti, expiresAt.UTC().Format(time.RFC3339),
	)
	if err != nil {
		return fmt.Errorf("revoke token: %w", err)
	}
	return nil
}

// IsRevoked returns true if the token JTI has been revoked.
func (m *TokenMapper) IsRevoked(jti string) (bool, error) {
	var count int
	err := m.db.QueryRow(
		"SELECT COUNT(*) FROM revoked_tokens WHERE jti = ? AND expires_at > datetime('now')",
		jti,
	).Scan(&count)
	if err != nil {
		return false, fmt.Errorf("check revoked token: %w", err)
	}
	return count > 0, nil
}

// Cleanup removes expired entries from the blocklist.
func (m *TokenMapper) Cleanup() error {
	_, err := m.db.Exec("DELETE FROM revoked_tokens WHERE expires_at <= datetime('now')")
	return err
}
