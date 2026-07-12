package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/FallCatsinSeng/SWU_OSR/backend/internal/domain"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// SkillRepo implements domain.SkillRepository.
type SkillRepo struct {
	pool *pgxpool.Pool
}

// NewSkillRepo creates a new skill repository.
func NewSkillRepo(pool *pgxpool.Pool) domain.SkillRepository {
	return &SkillRepo{pool: pool}
}

// ListSkills returns all skills ordered by category then name.
func (r *SkillRepo) ListSkills(ctx context.Context) ([]domain.Skill, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT id, name, slug, category, created_at FROM skills ORDER BY category, name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var skills []domain.Skill
	for rows.Next() {
		var s domain.Skill
		if err := rows.Scan(&s.ID, &s.Name, &s.Slug, &s.Category, &s.CreatedAt); err != nil {
			return nil, err
		}
		skills = append(skills, s)
	}
	return skills, rows.Err()
}

// GetSkillByID retrieves a skill by its UUID.
func (r *SkillRepo) GetSkillByID(ctx context.Context, id uuid.UUID) (*domain.Skill, error) {
	var s domain.Skill
	err := r.pool.QueryRow(ctx,
		`SELECT id, name, slug, category, created_at FROM skills WHERE id = $1`, id,
	).Scan(&s.ID, &s.Name, &s.Slug, &s.Category, &s.CreatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, err
	}
	return &s, nil
}

// GetSkillBySlug retrieves a skill by its slug.
func (r *SkillRepo) GetSkillBySlug(ctx context.Context, slug string) (*domain.Skill, error) {
	var s domain.Skill
	err := r.pool.QueryRow(ctx,
		`SELECT id, name, slug, category, created_at FROM skills WHERE slug = $1`, slug,
	).Scan(&s.ID, &s.Name, &s.Slug, &s.Category, &s.CreatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, err
	}
	return &s, nil
}

// CreateSkill inserts a new skill into the master list.
func (r *SkillRepo) CreateSkill(ctx context.Context, skill *domain.Skill) error {
	_, err := r.pool.Exec(ctx,
		`INSERT INTO skills (id, name, slug, category, created_at) VALUES ($1, $2, $3, $4, $5)`,
		skill.ID, skill.Name, skill.Slug, skill.Category, skill.CreatedAt,
	)
	return err
}

// DeleteSkill removes a skill from the master list (cascades to user_skills and endorsements).
func (r *SkillRepo) DeleteSkill(ctx context.Context, id uuid.UUID) error {
	tag, err := r.pool.Exec(ctx, `DELETE FROM skills WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}

// CountUserSkills returns how many skills a user currently has.
func (r *SkillRepo) CountUserSkills(ctx context.Context, userID uuid.UUID) (int, error) {
	var count int
	err := r.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM user_skills WHERE user_id = $1`, userID,
	).Scan(&count)
	return count, err
}

// AddUserSkill adds a skill to a user's profile.
func (r *SkillRepo) AddUserSkill(ctx context.Context, userID, skillID uuid.UUID) (*domain.UserSkill, error) {
	id := uuid.New()
	_, err := r.pool.Exec(ctx,
		`INSERT INTO user_skills (id, user_id, skill_id, created_at) VALUES ($1, $2, $3, $4)`,
		id, userID, skillID, time.Now(),
	)
	if err != nil {
		return nil, err
	}

	// Fetch full UserSkill with skill details
	return r.getUserSkillByIDInternal(ctx, id, nil)
}

// RemoveUserSkill deletes a user's skill (also cascades endorsements).
func (r *SkillRepo) RemoveUserSkill(ctx context.Context, userID, skillID uuid.UUID) error {
	tag, err := r.pool.Exec(ctx,
		`DELETE FROM user_skills WHERE user_id = $1 AND skill_id = $2`, userID, skillID,
	)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}

// GetUserSkills returns all skills for a user, with endorsement counts and "is endorsed by me" flag.
func (r *SkillRepo) GetUserSkills(ctx context.Context, userID uuid.UUID, currentUserID *uuid.UUID) ([]domain.UserSkill, error) {
	// Use uuid.Nil as fallback so se.endorser_id = $2 is always a valid UUID comparison
	viewerID := uuid.Nil
	if currentUserID != nil {
		viewerID = *currentUserID
	}

	rows, err := r.pool.Query(ctx, `
		SELECT
			us.id, us.user_id, us.created_at,
			s.id, s.name, s.slug, s.category, s.created_at,
			COUNT(se.id) AS endorse_count,
			COUNT(CASE WHEN u.role = 'student'     THEN 1 END) AS peer_count,
			COUNT(CASE WHEN u.role = 'faculty'     THEN 1 END) AS faculty_count,
			COUNT(CASE WHEN u.role = 'lpt_officer' THEN 1 END) AS lpt_count,
			COALESCE(BOOL_OR(se.endorser_id = $2), false) AS is_endorsed_by_me
		FROM user_skills us
		JOIN skills s ON s.id = us.skill_id
		LEFT JOIN skill_endorsements se ON se.user_skill_id = us.id
		LEFT JOIN users u ON u.id = se.endorser_id
		WHERE us.user_id = $1
		GROUP BY us.id, us.user_id, us.created_at, s.id, s.name, s.slug, s.category, s.created_at
		ORDER BY endorse_count DESC, us.created_at ASC`,
		userID, viewerID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var userSkills []domain.UserSkill
	for rows.Next() {
		var us domain.UserSkill
		if err := rows.Scan(
			&us.ID, &us.UserID, &us.CreatedAt,
			&us.Skill.ID, &us.Skill.Name, &us.Skill.Slug, &us.Skill.Category, &us.Skill.CreatedAt,
			&us.EndorseCount, &us.PeerCount, &us.FacultyCount, &us.LPTCount,
			&us.IsEndorsedByMe,
		); err != nil {
			return nil, err
		}
		userSkills = append(userSkills, us)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	// Fetch endorser previews for each skill (max 5 most recent)
	for i := range userSkills {
		endorsers, err := r.getEndorserPreviews(ctx, userSkills[i].ID)
		if err != nil {
			return nil, err
		}
		userSkills[i].Endorsers = endorsers
	}

	return userSkills, nil
}

// getEndorserPreviews fetches up to 5 recent endorsers for a user_skill.
func (r *SkillRepo) getEndorserPreviews(ctx context.Context, userSkillID uuid.UUID) ([]domain.EndorserPreview, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT u.id, u.alias, u.avatar_url, u.role
		FROM skill_endorsements se
		JOIN users u ON u.id = se.endorser_id
		WHERE se.user_skill_id = $1
		ORDER BY se.created_at DESC
		LIMIT 5`,
		userSkillID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var previews []domain.EndorserPreview
	for rows.Next() {
		var p domain.EndorserPreview
		var role string
		if err := rows.Scan(&p.UserID, &p.Alias, &p.AvatarURL, &role); err != nil {
			return nil, err
		}
		p.Role = domain.Role(role)
		previews = append(previews, p)
	}
	return previews, rows.Err()
}

// GetUserSkillByID fetches a specific user_skill by its ID.
func (r *SkillRepo) GetUserSkillByID(ctx context.Context, userSkillID uuid.UUID) (*domain.UserSkill, error) {
	return r.getUserSkillByIDInternal(ctx, userSkillID, nil)
}

func (r *SkillRepo) getUserSkillByIDInternal(ctx context.Context, userSkillID uuid.UUID, currentUserID *uuid.UUID) (*domain.UserSkill, error) {
	// Use uuid.Nil as fallback so the comparison is always valid (never NULL)
	viewerID := uuid.Nil
	if currentUserID != nil {
		viewerID = *currentUserID
	}

	var us domain.UserSkill
	err := r.pool.QueryRow(ctx, `
		SELECT
			us.id, us.user_id, us.created_at,
			s.id, s.name, s.slug, s.category, s.created_at,
			COUNT(se.id),
			COUNT(CASE WHEN u.role = 'student'     THEN 1 END),
			COUNT(CASE WHEN u.role = 'faculty'     THEN 1 END),
			COUNT(CASE WHEN u.role = 'lpt_officer' THEN 1 END),
			COALESCE(BOOL_OR(se.endorser_id = $2), false)
		FROM user_skills us
		JOIN skills s ON s.id = us.skill_id
		LEFT JOIN skill_endorsements se ON se.user_skill_id = us.id
		LEFT JOIN users u ON u.id = se.endorser_id
		WHERE us.id = $1
		GROUP BY us.id, us.user_id, us.created_at, s.id, s.name, s.slug, s.category, s.created_at`,
		userSkillID, viewerID,
	).Scan(
		&us.ID, &us.UserID, &us.CreatedAt,
		&us.Skill.ID, &us.Skill.Name, &us.Skill.Slug, &us.Skill.Category, &us.Skill.CreatedAt,
		&us.EndorseCount, &us.PeerCount, &us.FacultyCount, &us.LPTCount,
		&us.IsEndorsedByMe,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, fmt.Errorf("getUserSkillByID: %w", err)
	}
	return &us, nil
}

// AddEndorsement records an endorsement of a user_skill.
func (r *SkillRepo) AddEndorsement(ctx context.Context, userSkillID, endorserID uuid.UUID) error {
	_, err := r.pool.Exec(ctx,
		`INSERT INTO skill_endorsements (id, user_skill_id, endorser_id, created_at) VALUES ($1, $2, $3, $4)`,
		uuid.New(), userSkillID, endorserID, time.Now(),
	)
	return err
}

// RemoveEndorsement deletes an endorsement.
func (r *SkillRepo) RemoveEndorsement(ctx context.Context, userSkillID, endorserID uuid.UUID) error {
	tag, err := r.pool.Exec(ctx,
		`DELETE FROM skill_endorsements WHERE user_skill_id = $1 AND endorser_id = $2`,
		userSkillID, endorserID,
	)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}
