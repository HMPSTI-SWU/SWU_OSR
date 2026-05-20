package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/FallCatsinSeng/SWU_OSR/backend/internal/domain"
	"github.com/FallCatsinSeng/SWU_OSR/backend/internal/service"
	"github.com/go-playground/validator/v10"
	"github.com/google/uuid"
)

// AuthHandler handles authentication HTTP requests.
type AuthHandler struct {
	authService  service.AuthService
	secureCookie bool
	validate     *validator.Validate
}

// NewAuthHandler creates a new auth handler.
func NewAuthHandler(authService service.AuthService, secureCookie bool) *AuthHandler {
	return &AuthHandler{
		authService:  authService,
		secureCookie: secureCookie,
		validate:     validator.New(),
	}
}

// siakadLoginRequest is the request body for SIAKAD login.
type siakadLoginRequest struct {
	NIM      string `json:"nim" validate:"required"`
	Password string `json:"password" validate:"required"`
}

// githubCallbackRequest is the request body for GitHub OAuth callback.
type githubCallbackRequest struct {
	SessionID string `json:"session_id" validate:"required"`
	Code      string `json:"code" validate:"required"`
}

// HandleSIAKADLogin handles POST /api/auth/siakad-login.
func (h *AuthHandler) HandleSIAKADLogin(w http.ResponseWriter, r *http.Request) {
	var req siakadLoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if err := h.validate.Struct(req); err != nil {
		RespondError(w, http.StatusBadRequest, "nim and password are required")
		return
	}

	result, err := h.authService.InitiateSIAKADLogin(r.Context(), req.NIM, req.Password)
	if err != nil {
		h.handleAuthError(w, err)
		return
	}

	RespondJSON(w, http.StatusOK, map[string]string{
		"session_id":   result.SessionID,
		"redirect_url": result.RedirectURL,
	})
}

// HandleGitHubCallback handles POST /api/auth/github-callback.
func (h *AuthHandler) HandleGitHubCallback(w http.ResponseWriter, r *http.Request) {
	var req githubCallbackRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if err := h.validate.Struct(req); err != nil {
		RespondError(w, http.StatusBadRequest, "session_id and code are required")
		return
	}

	result, err := h.authService.CompleteGitHubOAuth(r.Context(), req.SessionID, req.Code)
	if err != nil {
		h.handleAuthError(w, err)
		return
	}

	// Set refresh token as httpOnly cookie
	sameSite := http.SameSiteLaxMode
	if h.secureCookie {
		sameSite = http.SameSiteStrictMode
	}
	http.SetCookie(w, &http.Cookie{
		Name:     "refresh_token",
		Value:    result.RefreshToken,
		Path:     "/api/auth",
		HttpOnly: true,
		Secure:   h.secureCookie,
		SameSite: sameSite,
		MaxAge:   int(7 * 24 * time.Hour / time.Second),
	})

	RespondJSON(w, http.StatusOK, map[string]interface{}{
		"user": MeResponse{
			ID:             result.User.ID,
			NIM:            result.User.NIM,
			Alias:          result.User.Alias,
			Bio:            result.User.Bio,
			AvatarURL:      result.User.AvatarURL,
			GitHubUsername: result.User.GitHubUsername,
			Role:           result.User.Role,
			CreatedAt:      result.User.CreatedAt,
			UpdatedAt:      result.User.UpdatedAt,
		},
		"access_token": result.AccessToken,
	})
}

// HandleRefreshToken handles POST /api/auth/refresh.
func (h *AuthHandler) HandleRefreshToken(w http.ResponseWriter, r *http.Request) {
	cookie, err := r.Cookie("refresh_token")
	if err != nil {
		RespondError(w, http.StatusUnauthorized, "missing refresh token")
		return
	}

	result, err := h.authService.RefreshToken(r.Context(), cookie.Value)
	if err != nil {
		h.handleAuthError(w, err)
		return
	}

	// Set new refresh token cookie
	sameSite := http.SameSiteLaxMode
	if h.secureCookie {
		sameSite = http.SameSiteStrictMode
	}
	http.SetCookie(w, &http.Cookie{
		Name:     "refresh_token",
		Value:    result.RefreshToken,
		Path:     "/api/auth",
		HttpOnly: true,
		Secure:   h.secureCookie,
		SameSite: sameSite,
		MaxAge:   int(7 * 24 * time.Hour / time.Second),
	})

	RespondJSON(w, http.StatusOK, map[string]string{
		"access_token": result.AccessToken,
	})
}

// HandleLogout handles POST /api/auth/logout.
func (h *AuthHandler) HandleLogout(w http.ResponseWriter, r *http.Request) {
	claims, ok := domain.GetUserClaims(r.Context())
	if !ok {
		RespondError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	if err := h.authService.Logout(r.Context(), claims.UserID); err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to logout")
		return
	}

	// Clear refresh token cookie
	sameSite := http.SameSiteLaxMode
	if h.secureCookie {
		sameSite = http.SameSiteStrictMode
	}
	http.SetCookie(w, &http.Cookie{
		Name:     "refresh_token",
		Value:    "",
		Path:     "/api/auth",
		HttpOnly: true,
		Secure:   h.secureCookie,
		SameSite: sameSite,
		MaxAge:   -1,
	})

	RespondJSON(w, http.StatusOK, map[string]string{
		"message": "logged out successfully",
	})
}

// MeResponse is the DTO returned by GET /api/auth/me.
// It exposes only safe fields — never tokens, NIM, or full name.
type MeResponse struct {
	ID             uuid.UUID   `json:"id"`
	NIM            string      `json:"nim"`
	Alias          string      `json:"alias"`
	Bio            string      `json:"bio"`
	AvatarURL      string      `json:"avatar_url"`
	BannerURL      string      `json:"banner_url"`
	GitHubUsername string      `json:"github_username"`
	Role           domain.Role `json:"role"`
	CreatedAt      time.Time   `json:"created_at"`
	UpdatedAt      time.Time   `json:"updated_at"`
}

// HandleGetMe handles GET /api/auth/me.
func (h *AuthHandler) HandleGetMe(w http.ResponseWriter, r *http.Request) {
	claims, ok := domain.GetUserClaims(r.Context())
	if !ok {
		RespondError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	user, err := h.authService.GetCurrentUser(r.Context(), claims.UserID)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to fetch user")
		return
	}

	resp := MeResponse{
		ID:             user.ID,
		NIM:            user.NIM,
		Alias:          user.Alias,
		Bio:            user.Bio,
		AvatarURL:      user.AvatarURL,
		BannerURL:      user.BannerURL,
		GitHubUsername: user.GitHubUsername,
		Role:           user.Role,
		CreatedAt:      user.CreatedAt,
		UpdatedAt:      user.UpdatedAt,
	}

	RespondJSON(w, http.StatusOK, resp)
}

// handleAuthError maps domain errors to HTTP responses.
func (h *AuthHandler) handleAuthError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, domain.ErrInvalidCredentials):
		RespondError(w, http.StatusUnauthorized, "invalid credentials")
	case errors.Is(err, domain.ErrDeviceRejected):
		RespondError(w, http.StatusForbidden, "device rejected by SIAKAD")
	case errors.Is(err, domain.ErrSIAKADUnavailable):
		RespondError(w, http.StatusServiceUnavailable, "SIAKAD service unavailable")
	case errors.Is(err, domain.ErrSessionInitFailed):
		RespondError(w, http.StatusBadGateway, "session initialization failed")
	case errors.Is(err, domain.ErrTokenInvalid):
		RespondError(w, http.StatusUnauthorized, "invalid or expired session")
	case errors.Is(err, domain.ErrTokenExpired):
		RespondError(w, http.StatusUnauthorized, "token expired")
	case errors.Is(err, domain.ErrForbidden):
		RespondError(w, http.StatusForbidden, "forbidden")
	default:
		RespondError(w, http.StatusInternalServerError, "internal server error")
	}
}
