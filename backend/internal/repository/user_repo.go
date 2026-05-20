package repository

import (
	"context"
	"errors"

	"github.com/FallCatsinSeng/SWU_OSR/backend/internal/domain"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// UserRepo implements domain.UserRepository using pgxpool.
type UserRepo struct {
	pool *pgxpool.Pool
}

// NewUserRepo creates a new user repository.
func NewUserRepo(pool *pgxpool.Pool) domain.UserRepository {
	return &UserRepo{pool: pool}
}

// userSelectCols is the standard column list for user queries.
// banner_url uses COALESCE to handle cases where migration hasn't run yet.
const userSelectCols = `id, nim, full_name, major, semester, alias, bio, avatar_url, COALESCE(banner_url, '') as banner_url,
	github_username, github_id, github_token, role, is_active, created_at, updated_at`

// Create inserts a new user.
func (r *UserRepo) Create(ctx context.Context, user *domain.User) error {
	query := `
		INSERT INTO users (id, nim, full_name, major, semester, alias, bio, avatar_url, banner_url,
			github_username, github_id, github_token, role, is_active, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`

	_, err := r.pool.Exec(ctx, query,
		user.ID, user.NIM, user.FullName, user.Major, user.Semester,
		user.Alias, user.Bio, user.AvatarURL, user.BannerURL,
		user.GitHubUsername, user.GitHubID, user.GitHubToken,
		string(user.Role), user.IsActive, user.CreatedAt, user.UpdatedAt,
	)
	return err
}

// GetByID retrieves a user by their UUID.
func (r *UserRepo) GetByID(ctx context.Context, id uuid.UUID) (*domain.User, error) {
	query := `SELECT ` + userSelectCols + ` FROM users WHERE id = $1 AND deleted_at IS NULL`
	return r.scanUser(ctx, query, id)
}

// GetByNIM retrieves a user by their NIM.
func (r *UserRepo) GetByNIM(ctx context.Context, nim string) (*domain.User, error) {
	query := `SELECT ` + userSelectCols + ` FROM users WHERE nim = $1 AND deleted_at IS NULL`
	return r.scanUser(ctx, query, nim)
}

// GetByAlias retrieves a user by their alias.
func (r *UserRepo) GetByAlias(ctx context.Context, alias string) (*domain.User, error) {
	query := `SELECT ` + userSelectCols + ` FROM users WHERE alias = $1 AND deleted_at IS NULL`
	return r.scanUser(ctx, query, alias)
}

// GetByGitHubUsername retrieves a user by their GitHub username.
func (r *UserRepo) GetByGitHubUsername(ctx context.Context, username string) (*domain.User, error) {
	query := `SELECT ` + userSelectCols + ` FROM users WHERE github_username = $1 AND deleted_at IS NULL`
	return r.scanUser(ctx, query, username)
}

// Update modifies an existing user.
func (r *UserRepo) Update(ctx context.Context, user *domain.User) error {
	query := `
		UPDATE users
		SET full_name = $2, major = $3, semester = $4, alias = $5, bio = $6, avatar_url = $7,
			banner_url = $8, github_username = $9, github_id = $10, github_token = $11, role = $12,
			is_active = $13, updated_at = $14
		WHERE id = $1 AND deleted_at IS NULL`

	_, err := r.pool.Exec(ctx, query,
		user.ID, user.FullName, user.Major, user.Semester, user.Alias, user.Bio, user.AvatarURL,
		user.BannerURL, user.GitHubUsername, user.GitHubID, user.GitHubToken, string(user.Role),
		user.IsActive, user.UpdatedAt,
	)
	return err
}

// MarkTokenInvalid invalidates the GitHub token for a user.
func (r *UserRepo) MarkTokenInvalid(ctx context.Context, id uuid.UUID) error {
	query := `
		UPDATE users SET github_token = '', updated_at = NOW()
		WHERE id = $1 AND deleted_at IS NULL`

	_, err := r.pool.Exec(ctx, query, id)
	return err
}

// ListAll returns all active users.
func (r *UserRepo) ListAll(ctx context.Context) ([]*domain.User, error) {
	query := `SELECT ` + userSelectCols + ` FROM users WHERE deleted_at IS NULL AND is_active = true ORDER BY created_at DESC`

	rows, err := r.pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []*domain.User
	for rows.Next() {
		user, err := scanUserRow(rows)
		if err != nil {
			return nil, err
		}
		users = append(users, user)
	}

	return users, rows.Err()
}

// scanUser scans a single user row from a query result.
func (r *UserRepo) scanUser(ctx context.Context, query string, args ...interface{}) (*domain.User, error) {
	var user domain.User
	var role string

	err := r.pool.QueryRow(ctx, query, args...).Scan(
		&user.ID, &user.NIM, &user.FullName, &user.Major, &user.Semester,
		&user.Alias, &user.Bio, &user.AvatarURL, &user.BannerURL,
		&user.GitHubUsername, &user.GitHubID, &user.GitHubToken,
		&role, &user.IsActive, &user.CreatedAt, &user.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, err
	}

	user.Role = domain.Role(role)
	return &user, nil
}

// scanUserRow scans a user from pgx.Rows (for ListAll).
func scanUserRow(rows pgx.Rows) (*domain.User, error) {
	var user domain.User
	var role string
	if err := rows.Scan(
		&user.ID, &user.NIM, &user.FullName, &user.Major, &user.Semester,
		&user.Alias, &user.Bio, &user.AvatarURL, &user.BannerURL,
		&user.GitHubUsername, &user.GitHubID, &user.GitHubToken,
		&role, &user.IsActive, &user.CreatedAt, &user.UpdatedAt,
	); err != nil {
		return nil, err
	}
	user.Role = domain.Role(role)
	return &user, nil
}
