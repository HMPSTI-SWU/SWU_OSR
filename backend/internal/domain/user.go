package domain

import (
	"context"
	"time"

	"github.com/google/uuid"
)

// Role represents a user's role in the system.
type Role string

const (
	RoleStudent    Role = "student"
	RoleFaculty    Role = "faculty"
	RoleLPTOfficer Role = "lpt_officer"
	RoleSuperAdmin Role = "super_admin"
)

// User is the central identity binding entity.
// Fields marked json:"-" are never serialized in API responses to prevent
// leaking sensitive data (tokens, PII). Use dedicated DTOs for responses.
type User struct {
	ID             uuid.UUID  `json:"id"`
	NIM            string     `json:"-"`
	FullName       string     `json:"-"`
	Major          string     `json:"-"`
	Semester       int        `json:"-"`
	Alias          string     `json:"alias"`
	Bio            string     `json:"bio"`
	AvatarURL      string     `json:"avatar_url"`
	BannerURL      string     `json:"banner_url"`
	GitHubUsername string     `json:"github_username"`
	GitHubID       int64      `json:"-"`
	GitHubToken    string     `json:"-"`
	Role           Role       `json:"role"`
	IsActive       bool       `json:"-"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
	DeletedAt      *time.Time `json:"-"`
}

// UserClaims represents JWT claims stored in request context.
type UserClaims struct {
	UserID uuid.UUID `json:"user_id"`
	Alias  string    `json:"alias"`
	Role   Role      `json:"role"`
}

// ContextKey is a typed key used for storing values in context.
type ContextKey string

// UserClaimsKey is the context key for storing UserClaims.
const UserClaimsKey ContextKey = "user_claims"

// GetUserClaims extracts UserClaims from request context.
func GetUserClaims(ctx context.Context) (*UserClaims, bool) {
	claims, ok := ctx.Value(UserClaimsKey).(*UserClaims)
	return claims, ok
}
