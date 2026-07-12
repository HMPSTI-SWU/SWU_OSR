package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"
	"unicode"

	"github.com/FallCatsinSeng/SWU_OSR/backend/internal/domain"
	"github.com/google/uuid"
)

// SkillService defines the skill management service interface.
type SkillService interface {
	ListSkills(ctx context.Context) ([]domain.Skill, error)
	GetUserSkills(ctx context.Context, userID uuid.UUID, currentUserID *uuid.UUID) ([]domain.UserSkill, error)
	AddSkillToProfile(ctx context.Context, userID, skillID uuid.UUID) (*domain.UserSkill, error)
	RemoveSkillFromProfile(ctx context.Context, userID, skillID uuid.UUID) error
	EndorseSkill(ctx context.Context, userSkillID, endorserID uuid.UUID) (*domain.UserSkill, error)
	UnendorseSkill(ctx context.Context, userSkillID, endorserID uuid.UUID) error
	// Admin only
	CreateSkill(ctx context.Context, name, category string) (*domain.Skill, error)
	DeleteSkill(ctx context.Context, skillID uuid.UUID) error
}

type skillService struct {
	skillRepo domain.SkillRepository
}

// NewSkillService creates a new skill service.
func NewSkillService(skillRepo domain.SkillRepository) SkillService {
	return &skillService{skillRepo: skillRepo}
}

// ListSkills returns all skills in the master list.
func (s *skillService) ListSkills(ctx context.Context) ([]domain.Skill, error) {
	return s.skillRepo.ListSkills(ctx)
}

// GetUserSkills returns the skills for a given user.
func (s *skillService) GetUserSkills(ctx context.Context, userID uuid.UUID, currentUserID *uuid.UUID) ([]domain.UserSkill, error) {
	return s.skillRepo.GetUserSkills(ctx, userID, currentUserID)
}

// AddSkillToProfile adds a skill to the authenticated user's profile.
// Returns ErrForbidden if the skill limit is reached.
func (s *skillService) AddSkillToProfile(ctx context.Context, userID, skillID uuid.UUID) (*domain.UserSkill, error) {
	// Check skill exists
	if _, err := s.skillRepo.GetSkillByID(ctx, skillID); err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			return nil, domain.ErrNotFound
		}
		return nil, fmt.Errorf("checking skill: %w", err)
	}

	// Enforce max skill limit
	count, err := s.skillRepo.CountUserSkills(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("counting skills: %w", err)
	}
	if count >= domain.MaxSkillsPerUser {
		return nil, fmt.Errorf("skill limit reached (max %d): %w", domain.MaxSkillsPerUser, domain.ErrForbidden)
	}

	return s.skillRepo.AddUserSkill(ctx, userID, skillID)
}

// RemoveSkillFromProfile removes a skill from the user's profile.
func (s *skillService) RemoveSkillFromProfile(ctx context.Context, userID, skillID uuid.UUID) error {
	return s.skillRepo.RemoveUserSkill(ctx, userID, skillID)
}

// EndorseSkill adds an endorsement from endorserID to the given user_skill.
// Business rules:
//   - Cannot endorse your own skill.
//   - Cannot endorse the same skill twice (DB constraint handles this too).
func (s *skillService) EndorseSkill(ctx context.Context, userSkillID, endorserID uuid.UUID) (*domain.UserSkill, error) {
	// Fetch the user_skill to get its owner
	us, err := s.skillRepo.GetUserSkillByID(ctx, userSkillID)
	if err != nil {
		return nil, err
	}

	// Prevent self-endorsement
	if us.UserID == endorserID {
		return nil, fmt.Errorf("cannot endorse your own skill: %w", domain.ErrForbidden)
	}

	if err := s.skillRepo.AddEndorsement(ctx, userSkillID, endorserID); err != nil {
		return nil, fmt.Errorf("adding endorsement: %w", err)
	}

	// Return updated counts
	return s.skillRepo.GetUserSkillByID(ctx, userSkillID)
}

// UnendorseSkill removes an endorsement.
func (s *skillService) UnendorseSkill(ctx context.Context, userSkillID, endorserID uuid.UUID) error {
	return s.skillRepo.RemoveEndorsement(ctx, userSkillID, endorserID)
}

// CreateSkill adds a new skill to the master list (admin only, enforced at handler level).
func (s *skillService) CreateSkill(ctx context.Context, name, category string) (*domain.Skill, error) {
	name = strings.TrimSpace(name)
	category = strings.TrimSpace(category)
	if name == "" || category == "" {
		return nil, fmt.Errorf("name and category are required")
	}

	slug := toSlug(name)
	skill := &domain.Skill{
		ID:        uuid.New(),
		Name:      name,
		Slug:      slug,
		Category:  category,
		CreatedAt: time.Now(),
	}
	if err := s.skillRepo.CreateSkill(ctx, skill); err != nil {
		return nil, fmt.Errorf("creating skill: %w", err)
	}
	return skill, nil
}

// DeleteSkill removes a skill from the master list (admin only).
func (s *skillService) DeleteSkill(ctx context.Context, skillID uuid.UUID) error {
	return s.skillRepo.DeleteSkill(ctx, skillID)
}

// toSlug converts a skill name to a URL-safe slug.
// "Next.js" → "nextjs", "Machine Learning" → "machine-learning"
func toSlug(name string) string {
	var b strings.Builder
	prevDash := false
	for _, r := range strings.ToLower(name) {
		if unicode.IsLetter(r) || unicode.IsDigit(r) {
			_, _ = b.WriteRune(r) // WriteRune on Builder never errors
			prevDash = false
		} else if !prevDash && b.Len() > 0 {
			_, _ = b.WriteRune('-') // WriteRune on Builder never errors
			prevDash = true
		}
	}
	return strings.TrimRight(b.String(), "-")
}
