package mapper

import (
	"crypto/rand"
	"database/sql"
	"fmt"

	"github.com/oklog/ulid/v2"
	"github.com/rishad/opendrive/server/internal/entities"
	"golang.org/x/crypto/bcrypt"
)

type UserMapper struct {
	db *sql.DB
}

func NewUserMapper(db *sql.DB) *UserMapper {
	return &UserMapper{db: db}
}

func (m *UserMapper) GetAll() ([]entities.User, error) {
	rows, err := m.db.Query("SELECT id, username, role, created_at, email FROM users ORDER BY created_at ASC")
	if err != nil {
		return nil, fmt.Errorf("query users: %w", err)
	}
	defer rows.Close()

	var users []entities.User
	for rows.Next() {
		var u entities.User
		var email sql.NullString
		if err := rows.Scan(&u.ID, &u.Username, &u.Role, &u.CreatedAt, &email); err != nil {
			return nil, fmt.Errorf("scan user: %w", err)
		}
		if email.Valid {
			u.Email = &email.String
		}
		users = append(users, u)
	}
	return users, nil
}

func (m *UserMapper) GetByUsername(username string) (*entities.User, error) {
	var u entities.User
	var email sql.NullString
	err := m.db.QueryRow(
		"SELECT id, username, password, role, created_at, email FROM users WHERE username = ?", username,
	).Scan(&u.ID, &u.Username, &u.Password, &u.Role, &u.CreatedAt, &email)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("query user by username: %w", err)
	}
	if email.Valid {
		u.Email = &email.String
	}
	return &u, nil
}

func (m *UserMapper) GetByID(id string) (*entities.User, error) {
	var u entities.User
	var email sql.NullString
	err := m.db.QueryRow(
		"SELECT id, username, role, created_at, email FROM users WHERE id = ?", id,
	).Scan(&u.ID, &u.Username, &u.Role, &u.CreatedAt, &email)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("query user by id: %w", err)
	}
	if email.Valid {
		u.Email = &email.String
	}
	return &u, nil
}

func (m *UserMapper) Create(username, password string, role entities.Role, email *string) (*entities.User, error) {
	hashed, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("hash password: %w", err)
	}

	id := ulid.MustNew(ulid.Now(), rand.Reader).String()
	_, err = m.db.Exec(
		"INSERT INTO users (id, username, password, role, email) VALUES (?, ?, ?, ?, ?)",
		id, username, string(hashed), role, email,
	)
	if err != nil {
		return nil, fmt.Errorf("insert user: %w", err)
	}

	return &entities.User{ID: id, Username: username, Role: entities.Role(role), Email: email}, nil
}

func (m *UserMapper) Update(id, password string, role entities.Role, email *string) error {
	if password != "" {
		hashed, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
		if err != nil {
			return fmt.Errorf("hash password: %w", err)
		}
		if _, err := m.db.Exec("UPDATE users SET password = ? WHERE id = ?", string(hashed), id); err != nil {
			return fmt.Errorf("update password: %w", err)
		}
	}

	if role == entities.RoleAdmin || role == entities.RoleUser {
		if _, err := m.db.Exec("UPDATE users SET role = ? WHERE id = ?", role, id); err != nil {
			return fmt.Errorf("update role: %w", err)
		}
	}

	if email != nil {
		if _, err := m.db.Exec("UPDATE users SET email = ? WHERE id = ?", email, id); err != nil {
			return fmt.Errorf("update email: %w", err)
		}
	}

	return nil
}

func (m *UserMapper) Delete(id string) (bool, error) {
	res, err := m.db.Exec("DELETE FROM users WHERE id = ?", id)
	if err != nil {
		return false, fmt.Errorf("delete user: %w", err)
	}
	n, _ := res.RowsAffected()
	return n > 0, nil
}
