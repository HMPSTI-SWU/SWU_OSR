package domain

import (
	"context"
	"time"

	"github.com/google/uuid"
)

// UserRepository defines data access methods for users.
type UserRepository interface {
	GetByID(ctx context.Context, id uuid.UUID) (*User, error)
	GetByNIM(ctx context.Context, nim string) (*User, error)
	GetByAlias(ctx context.Context, alias string) (*User, error)
	GetByGitHubUsername(ctx context.Context, username string) (*User, error)
	ListAll(ctx context.Context) ([]*User, error)
	Create(ctx context.Context, user *User) error
	Update(ctx context.Context, user *User) error
	MarkTokenInvalid(ctx context.Context, id uuid.UUID) error
}

// ShowcaseRepository defines data access methods for showcase repos.
type ShowcaseRepository interface {
	Create(ctx context.Context, repo *ShowcaseRepo) error
	GetByID(ctx context.Context, id uuid.UUID) (*ShowcaseRepo, error)
	GetByUserID(ctx context.Context, userID uuid.UUID) ([]ShowcaseRepo, error)
	GetByUserAndRepoFullName(ctx context.Context, userID uuid.UUID, repoFullName string) (*ShowcaseRepo, error)
	GetByUserAndRepoFullNameIncludeDeleted(ctx context.Context, userID uuid.UUID, repoFullName string) (*ShowcaseRepo, error)
	GetByUserAndGitHubRepoIDIncludeDeleted(ctx context.Context, userID uuid.UUID, githubRepoID int64) (*ShowcaseRepo, error)
	SoftDelete(ctx context.Context, id uuid.UUID) error
	SoftDeleteByUser(ctx context.Context, userID uuid.UUID, repoID uuid.UUID) error
	Restore(ctx context.Context, repo *ShowcaseRepo) error
	UpdateDescription(ctx context.Context, repoID uuid.UUID, description string) error
}

// ActivityRepository defines data access methods for activity logs.
type ActivityRepository interface {
	Insert(ctx context.Context, log *ActivityLog) error
	GetFeed(ctx context.Context, cursor time.Time, limit int) ([]ActivityItem, error)
	GetUserFeed(ctx context.Context, userID uuid.UUID, cursor time.Time, limit int) ([]ActivityItem, error)
	GetRepoFeed(ctx context.Context, showcaseRepoID uuid.UUID, cursor time.Time, limit int) ([]ActivityItem, error)
	GetByGitHubEventID(ctx context.Context, eventID string) (*ActivityLog, error)
}

// ThreadRepository defines data access methods for forum threads.
type ThreadRepository interface {
	Create(ctx context.Context, thread *Thread) error
	GetByID(ctx context.Context, id uuid.UUID) (*Thread, error)
	ListByRepoID(ctx context.Context, repoID uuid.UUID, cursor time.Time, limit int) ([]Thread, error)
	IncrementCommentCount(ctx context.Context, id uuid.UUID) error
}

// CommentRepository defines data access methods for comments.
type CommentRepository interface {
	Create(ctx context.Context, comment *Comment) error
	GetByThreadID(ctx context.Context, threadID uuid.UUID, cursor time.Time, limit int) ([]Comment, error)
}

// NotificationRepository defines data access methods for notifications.
type NotificationRepository interface {
	Create(ctx context.Context, notif *Notification) error
	ListByUserID(ctx context.Context, userID uuid.UUID, limit int) ([]Notification, error)
	MarkRead(ctx context.Context, userID uuid.UUID, notifID uuid.UUID) error
}

// RefreshTokenRepository defines data access methods for refresh tokens.
type RefreshTokenRepository interface {
	Create(ctx context.Context, userID uuid.UUID, tokenHash string, expiresAt time.Time) error
	GetByHash(ctx context.Context, tokenHash string) (*RefreshToken, error)
	Revoke(ctx context.Context, id uuid.UUID) error
	RevokeAllForUser(ctx context.Context, userID uuid.UUID) error
}

// RefreshToken represents a stored refresh token.
type RefreshToken struct {
	ID        uuid.UUID  `json:"id"`
	UserID    uuid.UUID  `json:"user_id"`
	TokenHash string     `json:"-"`
	ExpiresAt time.Time  `json:"expires_at"`
	CreatedAt time.Time  `json:"created_at"`
	RevokedAt *time.Time `json:"-"`
}

// SkillRepository defines data access methods for the skill system.
type SkillRepository interface {
	// Master list
	ListSkills(ctx context.Context) ([]Skill, error)
	GetSkillByID(ctx context.Context, id uuid.UUID) (*Skill, error)
	GetSkillBySlug(ctx context.Context, slug string) (*Skill, error)
	CreateSkill(ctx context.Context, skill *Skill) error
	DeleteSkill(ctx context.Context, id uuid.UUID) error

	// User skills
	GetUserSkills(ctx context.Context, userID uuid.UUID, currentUserID *uuid.UUID) ([]UserSkill, error)
	AddUserSkill(ctx context.Context, userID, skillID uuid.UUID) (*UserSkill, error)
	RemoveUserSkill(ctx context.Context, userID, skillID uuid.UUID) error
	CountUserSkills(ctx context.Context, userID uuid.UUID) (int, error)

	// Endorsements
	AddEndorsement(ctx context.Context, userSkillID, endorserID uuid.UUID) error
	RemoveEndorsement(ctx context.Context, userSkillID, endorserID uuid.UUID) error
	GetUserSkillByID(ctx context.Context, userSkillID uuid.UUID) (*UserSkill, error)
}

