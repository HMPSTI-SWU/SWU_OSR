package handler

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/FallCatsinSeng/SWU_OSR/backend/internal/domain"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// AdminHandler handles admin-only HTTP requests.
type AdminHandler struct {
	pool *pgxpool.Pool
}

// NewAdminHandler creates a new admin handler.
func NewAdminHandler(pool *pgxpool.Pool) *AdminHandler {
	return &AdminHandler{pool: pool}
}

// AdminUserResponse is the DTO for user data returned by admin endpoints.
type AdminUserResponse struct {
	ID             uuid.UUID   `json:"id"`
	NIM            string      `json:"nim"`
	FullName       string      `json:"full_name"`
	Alias          string      `json:"alias"`
	GitHubUsername string      `json:"github_username"`
	AvatarURL      string      `json:"avatar_url"`
	Role           domain.Role `json:"role"`
	IsActive       bool        `json:"is_active"`
	CreatedAt      time.Time   `json:"created_at"`
}

// updateRoleRequest is the request body for updating a user's role.
type updateRoleRequest struct {
	Role string `json:"role"`
}

// validAssignableRoles are roles that can be assigned via the admin API.
// super_admin is intentionally excluded — it can only be set via SUPER_ADMIN_NIMS in .env.
var validAssignableRoles = map[string]domain.Role{
	"student":     domain.RoleStudent,
	"faculty":     domain.RoleFaculty,
	"lpt_officer": domain.RoleLPTOfficer,
}

// HandleListUsers handles GET /api/admin/users.
// Returns all users in the system with their roles.
func (h *AdminHandler) HandleListUsers(w http.ResponseWriter, r *http.Request) {
	query := `
		SELECT id, nim, full_name, alias, github_username, avatar_url, role, is_active, created_at
		FROM users
		WHERE deleted_at IS NULL
		ORDER BY created_at DESC`

	rows, err := h.pool.Query(r.Context(), query)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to list users")
		return
	}
	defer rows.Close()

	var users []AdminUserResponse
	for rows.Next() {
		var u AdminUserResponse
		var role string
		if err := rows.Scan(
			&u.ID, &u.NIM, &u.FullName, &u.Alias, &u.GitHubUsername,
			&u.AvatarURL, &role, &u.IsActive, &u.CreatedAt,
		); err != nil {
			RespondError(w, http.StatusInternalServerError, "failed to scan user")
			return
		}
		u.Role = domain.Role(role)
		users = append(users, u)
	}
	if err := rows.Err(); err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to read users")
		return
	}

	if users == nil {
		users = []AdminUserResponse{}
	}

	RespondJSON(w, http.StatusOK, users)
}

// HandleUpdateUserRole handles PUT /api/admin/users/{id}/role.
// Updates the role of a specific user. Cannot assign super_admin via this endpoint.
func (h *AdminHandler) HandleUpdateUserRole(w http.ResponseWriter, r *http.Request) {
	// Parse target user ID from URL
	idStr := chi.URLParam(r, "id")
	targetID, err := uuid.Parse(idStr)
	if err != nil {
		RespondError(w, http.StatusBadRequest, "invalid user id")
		return
	}

	// Parse request body
	var req updateRoleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	// Validate role — super_admin cannot be assigned via API
	newRole, ok := validAssignableRoles[req.Role]
	if !ok {
		RespondError(w, http.StatusBadRequest, "invalid role: must be one of student, faculty, lpt_officer")
		return
	}

	// Prevent admin from changing their own role (safety measure)
	callerClaims, _ := domain.GetUserClaims(r.Context())
	if callerClaims != nil && callerClaims.UserID == targetID {
		RespondError(w, http.StatusForbidden, "cannot change your own role")
		return
	}

	// Prevent downgrading another super_admin via API
	var currentRole string
	err = h.pool.QueryRow(r.Context(),
		`SELECT role FROM users WHERE id = $1 AND deleted_at IS NULL`, targetID,
	).Scan(&currentRole)
	if err != nil {
		RespondError(w, http.StatusNotFound, "user not found")
		return
	}
	if currentRole == string(domain.RoleSuperAdmin) {
		RespondError(w, http.StatusForbidden, "cannot change the role of a super admin")
		return
	}

	// Apply the role update
	_, err = h.pool.Exec(r.Context(),
		`UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2 AND deleted_at IS NULL`,
		string(newRole), targetID,
	)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to update role")
		return
	}

	RespondJSON(w, http.StatusOK, map[string]interface{}{
		"message": "role updated successfully",
		"user_id": targetID,
		"role":    string(newRole),
	})
}
