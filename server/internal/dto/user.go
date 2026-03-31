package dto

import "github.com/rishad/opendrive/server/internal/entities"

// UserResponse is the safe public representation of a user sent to the client.
type UserResponse struct {
	ID        string        `json:"id"`
	Username  string        `json:"username"`
	Role      entities.Role `json:"role"`
	Email     *string       `json:"email,omitempty"`
	CreatedAt string        `json:"created_at"`
}

func UserFromEntity(u entities.User) UserResponse {
	return UserResponse{
		ID:        u.ID,
		Username:  u.Username,
		Role:      u.Role,
		Email:     u.Email,
		CreatedAt: u.CreatedAt,
	}
}

type CreateUserRequest struct {
	Username string        `json:"username"`
	Password string        `json:"password"`
	Role     entities.Role `json:"role"`
	Email    *string       `json:"email"`
}

type UpdateUserRequest struct {
	Password string        `json:"password"`
	Role     entities.Role `json:"role"`
	Email    *string       `json:"email"`
}
