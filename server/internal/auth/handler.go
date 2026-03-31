package auth

import (
	"crypto/rand"
	"encoding/json"
	"net/http"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/oklog/ulid/v2"
	"github.com/rishad/opendrive/server/internal/entities"
	"github.com/rishad/opendrive/server/internal/mapper"
	"github.com/rishad/opendrive/server/internal/middleware"
	"golang.org/x/crypto/bcrypt"
)

type Handler struct {
	userMapper  *mapper.UserMapper
	tokenMapper *mapper.TokenMapper
	jwtSecret   string
}

func NewHandler(userMapper *mapper.UserMapper, tokenMapper *mapper.TokenMapper, jwtSecret string) *Handler {
	return &Handler{userMapper: userMapper, tokenMapper: tokenMapper, jwtSecret: jwtSecret}
}

type loginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type loginResponse struct {
	Token string `json:"token"`
}

func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if req.Username == "" || req.Password == "" {
		http.Error(w, "username and password required", http.StatusBadRequest)
		return
	}

	u, err := h.userMapper.GetByUsername(req.Username)
	if err != nil {
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}
	if u == nil {
		http.Error(w, "invalid credentials", http.StatusUnauthorized)
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(u.Password), []byte(req.Password)); err != nil {
		http.Error(w, "invalid credentials", http.StatusUnauthorized)
		return
	}

	expiresAt := time.Now().Add(24 * time.Hour)
	jti := ulid.MustNew(ulid.Now(), rand.Reader).String()

	claims := &middleware.Claims{
		UserID:   u.ID,
		Username: u.Username,
		Role:     u.Role,
		RegisteredClaims: jwt.RegisteredClaims{
			ID:        jti,
			ExpiresAt: jwt.NewNumericDate(expiresAt),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString([]byte(h.jwtSecret))
	if err != nil {
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(loginResponse{Token: signed})
}

func (h *Handler) Logout(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r)
	jti := claims.ID
	if jti == "" {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	expiresAt := claims.ExpiresAt.Time
	if err := h.tokenMapper.Revoke(jti, expiresAt); err != nil {
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

type meResponse struct {
	ID       string        `json:"id"`
	Username string        `json:"username"`
	Role     entities.Role `json:"role"`
}

func (h *Handler) Me(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(meResponse{
		ID:       claims.UserID,
		Username: claims.Username,
		Role:     claims.Role,
	})
}
