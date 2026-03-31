package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
	"github.com/rishad/opendrive/server/internal/entities"
	"github.com/rishad/opendrive/server/internal/mapper"
)

type contextKey string

const ClaimsKey contextKey = "claims"

type Claims struct {
	UserID   string        `json:"user_id"`
	Username string        `json:"username"`
	Role     entities.Role `json:"role"`
	jwt.RegisteredClaims
}

// Auth validates the JWT, checks the blocklist, and re-validates the user's
// current role from the database on every request.
func Auth(jwtSecret string, userMapper *mapper.UserMapper, tokenMapper *mapper.TokenMapper) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			header := r.Header.Get("Authorization")
			if !strings.HasPrefix(header, "Bearer ") {
				http.Error(w, "unauthorized", http.StatusUnauthorized)
				return
			}

			tokenStr := strings.TrimPrefix(header, "Bearer ")
			claims := &Claims{}

			token, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (interface{}, error) {
				if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
					return nil, jwt.ErrSignatureInvalid
				}
				return []byte(jwtSecret), nil
			})
			if err != nil || !token.Valid {
				http.Error(w, "unauthorized", http.StatusUnauthorized)
				return
			}

			// Check if this token has been revoked (logout)
			jti := claims.ID // jwt standard claim "jti"
			if jti != "" {
				revoked, err := tokenMapper.IsRevoked(jti)
				if err != nil || revoked {
					http.Error(w, "unauthorized", http.StatusUnauthorized)
					return
				}
			}

			// Re-validate user and role from DB — catches deleted users and role changes
			user, err := userMapper.GetByID(claims.UserID)
			if err != nil || user == nil {
				http.Error(w, "unauthorized", http.StatusUnauthorized)
				return
			}
			// Update claims with current role from DB
			claims.Role = user.Role

			ctx := context.WithValue(r.Context(), ClaimsKey, claims)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func AdminOnly(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		claims, ok := r.Context().Value(ClaimsKey).(*Claims)
		if !ok || claims.Role != entities.RoleAdmin {
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func GetClaims(r *http.Request) *Claims {
	claims, _ := r.Context().Value(ClaimsKey).(*Claims)
	return claims
}
