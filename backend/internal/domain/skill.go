package domain

import (
	"time"

	"github.com/google/uuid"
)

// Skill is a technology or competency in the master list.
type Skill struct {
	ID        uuid.UUID `json:"id"`
	Name      string    `json:"name"`
	Slug      string    `json:"slug"`
	Category  string    `json:"category"`
	CreatedAt time.Time `json:"created_at"`
}

// UserSkill is a skill claimed by a specific user.
type UserSkill struct {
	ID           uuid.UUID       `json:"id"`
	UserID       uuid.UUID       `json:"user_id"`
	Skill        Skill           `json:"skill"`
	EndorseCount int             `json:"endorse_count"`
	PeerCount    int             `json:"peer_count"`    // endorsed by students
	FacultyCount int             `json:"faculty_count"` // endorsed by faculty
	LPTCount     int             `json:"lpt_count"`     // endorsed by lpt_officer
	IsEndorsedByMe bool          `json:"is_endorsed_by_me"`
	Endorsers    []EndorserPreview `json:"endorsers"`
	CreatedAt    time.Time       `json:"created_at"`
}

// EndorserPreview is a lightweight representation of someone who endorsed a skill.
type EndorserPreview struct {
	UserID    uuid.UUID `json:"user_id"`
	Alias     string    `json:"alias"`
	AvatarURL string    `json:"avatar_url"`
	Role      Role      `json:"role"`
}

// MaxSkillsPerUser is the maximum number of skills a user can claim.
const MaxSkillsPerUser = 15
