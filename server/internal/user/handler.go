package user

import (
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"

	"github.com/go-chi/chi/v5"
	"github.com/rishad/opendrive/server/internal/dto"
	"github.com/rishad/opendrive/server/internal/entities"
	"github.com/rishad/opendrive/server/internal/mapper"
	"github.com/rishad/opendrive/server/internal/middleware"
	"golang.org/x/crypto/bcrypt"
)

var (
	reUppercase = regexp.MustCompile(`[A-Z]`)
	reLowercase = regexp.MustCompile(`[a-z]`)
	reDigit     = regexp.MustCompile(`[0-9]`)
)

func validatePasswordPolicy(pw string) error {
	if len(pw) < 8 {
		return fmt.Errorf("password must be at least 8 characters")
	}
	if !reUppercase.MatchString(pw) {
		return fmt.Errorf("password must contain at least one uppercase letter")
	}
	if !reLowercase.MatchString(pw) {
		return fmt.Errorf("password must contain at least one lowercase letter")
	}
	if !reDigit.MatchString(pw) {
		return fmt.Errorf("password must contain at least one number")
	}
	return nil
}

type Handler struct {
	mapper *mapper.UserMapper
}

func NewHandler(m *mapper.UserMapper) *Handler {
	return &Handler{mapper: m}
}

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	users, err := h.mapper.GetAll()
	if err != nil {
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}

	resp := []dto.UserResponse{}
	for _, u := range users {
		resp = append(resp, dto.UserFromEntity(u))
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	var req dto.CreateUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if req.Username == "" || req.Password == "" {
		http.Error(w, "username and password required", http.StatusBadRequest)
		return
	}
	if err := validatePasswordPolicy(req.Password); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if req.Role != entities.RoleAdmin && req.Role != entities.RoleUser {
		req.Role = entities.RoleUser
	}

	u, err := h.mapper.Create(req.Username, req.Password, req.Role, req.Email)
	if err != nil {
		http.Error(w, "username already exists", http.StatusConflict)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(dto.UserFromEntity(*u))
}

func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	found, err := h.mapper.Delete(id)
	if err != nil {
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}
	if !found {
		http.Error(w, "user not found", http.StatusNotFound)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	var req dto.UpdateUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	if req.Password != "" {
		if err := validatePasswordPolicy(req.Password); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
	}

	if err := h.mapper.Update(id, req.Password, req.Role, req.Email); err != nil {
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

type updateProfileRequest struct {
	Username        string  `json:"username"`
	CurrentPassword string  `json:"current_password"`
	Password        string  `json:"password"`
	Email           *string `json:"email"`
}

func (h *Handler) Profile(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r)

	var req updateProfileRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	// If changing password, enforce policy then verify current password
	if req.Password != "" {
		if err := validatePasswordPolicy(req.Password); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		if req.CurrentPassword == "" {
			http.Error(w, "current password required to set a new password", http.StatusBadRequest)
			return
		}
		current, err := h.mapper.GetByIDWithPassword(claims.UserID)
		if err != nil || current == nil {
			http.Error(w, "internal server error", http.StatusInternalServerError)
			return
		}
		if err := bcrypt.CompareHashAndPassword([]byte(current.Password), []byte(req.CurrentPassword)); err != nil {
			http.Error(w, "current password is incorrect", http.StatusUnauthorized)
			return
		}
	}

	if err := h.mapper.UpdateSelf(claims.UserID, req.Username, req.Password, req.Email); err != nil {
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}

	u, err := h.mapper.GetByID(claims.UserID)
	if err != nil || u == nil {
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(dto.UserFromEntity(*u))
}
