package service

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/FallCatsinSeng/SWU_OSR/backend/internal/config"
	"github.com/FallCatsinSeng/SWU_OSR/backend/internal/domain"
	"github.com/FallCatsinSeng/SWU_OSR/backend/internal/github"
	"github.com/FallCatsinSeng/SWU_OSR/backend/internal/siakad"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"
)

// mockSIAKADService is a mock for siakad.Service.
type mockSIAKADService struct {
	authenticateFn func(ctx context.Context, nim, password string) (*siakad.StudentData, error)
}

func (m *mockSIAKADService) Authenticate(ctx context.Context, nim, password string) (*siakad.StudentData, error) {
	return m.authenticateFn(ctx, nim, password)
}

// mockGitHubService is a mock for github.Service.
type mockGitHubService struct {
	getAuthorizationURLFn func(state string) string
	exchangeCodeFn        func(ctx context.Context, code string) (*github.OAuthToken, error)
	getUserFn             func(ctx context.Context, token string) (*github.GitHubUser, error)
	listReposFn           func(ctx context.Context, token string) ([]github.Repository, error)
	registerWebhookFn     func(ctx context.Context, token, owner, repo, webhookURL, secret string) (int64, error)
	removeWebhookFn       func(ctx context.Context, token, owner, repo string, hookID int64) error
}

func (m *mockGitHubService) GetAuthorizationURL(state string) string {
	return m.getAuthorizationURLFn(state)
}
func (m *mockGitHubService) ExchangeCode(ctx context.Context, code string) (*github.OAuthToken, error) {
	return m.exchangeCodeFn(ctx, code)
}
func (m *mockGitHubService) GetUser(ctx context.Context, token string) (*github.GitHubUser, error) {
	return m.getUserFn(ctx, token)
}
func (m *mockGitHubService) ListRepos(ctx context.Context, token string) ([]github.Repository, error) {
	if m.listReposFn != nil {
		return m.listReposFn(ctx, token)
	}
	return nil, nil
}
func (m *mockGitHubService) RegisterWebhook(ctx context.Context, token, owner, repo, webhookURL, secret string) (int64, error) {
	if m.registerWebhookFn != nil {
		return m.registerWebhookFn(ctx, token, owner, repo, webhookURL, secret)
	}
	return 0, nil
}
func (m *mockGitHubService) RemoveWebhook(ctx context.Context, token, owner, repo string, hookID int64) error {
	if m.removeWebhookFn != nil {
		return m.removeWebhookFn(ctx, token, owner, repo, hookID)
	}
	return nil
}
func (m *mockGitHubService) GetRepoEvents(_ context.Context, _, _, _ string) ([]github.RepoEvent, error) {
	return nil, nil
}
func (m *mockGitHubService) GetUserPublicEvents(_ context.Context, _, _ string) ([]github.RepoEvent, error) {
	return nil, nil
}
func (m *mockGitHubService) GetRepoCommits(_ context.Context, _, _, _ string, _ int) ([]github.Commit, error) {
	return nil, nil
}
func (m *mockGitHubService) GetUserProfile(_ context.Context, _, _ string) (*github.GitHubUser, error) {
	return &github.GitHubUser{}, nil
}

// mockUserRepo is a mock for domain.UserRepository.
type mockUserRepo struct {
	users map[string]*domain.User // keyed by NIM
}

func newMockUserRepo() *mockUserRepo {
	return &mockUserRepo{users: make(map[string]*domain.User)}
}

func (m *mockUserRepo) GetByID(_ context.Context, id uuid.UUID) (*domain.User, error) {
	for _, u := range m.users {
		if u.ID == id {
			return u, nil
		}
	}
	return nil, domain.ErrNotFound
}

func (m *mockUserRepo) GetByNIM(_ context.Context, nim string) (*domain.User, error) {
	if u, ok := m.users[nim]; ok {
		return u, nil
	}
	return nil, domain.ErrNotFound
}

func (m *mockUserRepo) GetByAlias(_ context.Context, alias string) (*domain.User, error) {
	for _, u := range m.users {
		if u.Alias == alias {
			return u, nil
		}
	}
	return nil, domain.ErrNotFound
}

func (m *mockUserRepo) GetByGitHubUsername(_ context.Context, username string) (*domain.User, error) {
	for _, u := range m.users {
		if u.GitHubUsername == username {
			return u, nil
		}
	}
	return nil, domain.ErrNotFound
}

func (m *mockUserRepo) Create(_ context.Context, user *domain.User) error {
	m.users[user.NIM] = user
	return nil
}

func (m *mockUserRepo) Update(_ context.Context, user *domain.User) error {
	m.users[user.NIM] = user
	return nil
}

func (m *mockUserRepo) MarkTokenInvalid(_ context.Context, id uuid.UUID) error {
	for _, u := range m.users {
		if u.ID == id {
			u.GitHubToken = ""
			return nil
		}
	}
	return nil
}

func (m *mockUserRepo) ListAll(_ context.Context) ([]*domain.User, error) {
	var users []*domain.User
	for _, u := range m.users {
		users = append(users, u)
	}
	return users, nil
}

// mockRefreshTokenRepo is a mock for domain.RefreshTokenRepository.
type mockRefreshTokenRepo struct {
	tokens map[string]*domain.RefreshToken // keyed by token hash
}

func newMockRefreshTokenRepo() *mockRefreshTokenRepo {
	return &mockRefreshTokenRepo{tokens: make(map[string]*domain.RefreshToken)}
}

func (m *mockRefreshTokenRepo) Create(_ context.Context, userID uuid.UUID, tokenHash string, expiresAt time.Time) error {
	m.tokens[tokenHash] = &domain.RefreshToken{
		ID:        uuid.New(),
		UserID:    userID,
		TokenHash: tokenHash,
		ExpiresAt: expiresAt,
		CreatedAt: time.Now(),
	}
	return nil
}

func (m *mockRefreshTokenRepo) GetByHash(_ context.Context, tokenHash string) (*domain.RefreshToken, error) {
	if t, ok := m.tokens[tokenHash]; ok {
		return t, nil
	}
	return nil, domain.ErrTokenInvalid
}

func (m *mockRefreshTokenRepo) Revoke(_ context.Context, id uuid.UUID) error {
	for _, t := range m.tokens {
		if t.ID == id {
			now := time.Now()
			t.RevokedAt = &now
			return nil
		}
	}
	return nil
}

func (m *mockRefreshTokenRepo) RevokeAllForUser(_ context.Context, userID uuid.UUID) error {
	for _, t := range m.tokens {
		if t.UserID == userID {
			now := time.Now()
			t.RevokedAt = &now
		}
	}
	return nil
}

func setupTestAuthService(t *testing.T) (*authService, *miniredis.Miniredis, *mockSIAKADService, *mockGitHubService, *mockUserRepo, *mockRefreshTokenRepo) {
	mr, err := miniredis.Run()
	require.NoError(t, err)

	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})

	siakadMock := &mockSIAKADService{}
	githubMock := &mockGitHubService{}
	userRepo := newMockUserRepo()
	tokenRepo := newMockRefreshTokenRepo()

	cfg := &config.Config{
		JWTSecret:     "test-secret-key-for-testing-only",
		JWTExpiry:     15 * time.Minute,
		RefreshExpiry: 7 * 24 * time.Hour,
		EncryptionKey: []byte("01234567890123456789012345678901"), // 32 bytes
	}

	svc := &authService{
		siakadSvc:   siakadMock,
		githubSvc:   githubMock,
		userRepo:    userRepo,
		tokenRepo:   tokenRepo,
		redisClient: rdb,
		cfg:         cfg,
	}

	return svc, mr, siakadMock, githubMock, userRepo, tokenRepo
}

func TestInitiateSIAKADLogin_Success(t *testing.T) {
	svc, mr, siakadMock, githubMock, _, _ := setupTestAuthService(t)
	defer mr.Close()

	siakadMock.authenticateFn = func(_ context.Context, nim, password string) (*siakad.StudentData, error) {
		return &siakad.StudentData{
			NIM:       nim,
			FullName:  "Test Student",
			Major:     "Computer Science",
			Semester:  4,
			IsActive:  true,
			SessionID: "php-session-123",
		}, nil
	}

	githubMock.getAuthorizationURLFn = func(state string) string {
		return "https://github.com/login/oauth/authorize?state=" + state
	}

	ctx := context.Background()
	result, err := svc.InitiateSIAKADLogin(ctx, "12345", "password")

	require.NoError(t, err)
	assert.NotEmpty(t, result.SessionID)
	assert.Contains(t, result.RedirectURL, "github.com/login/oauth/authorize")
	assert.Contains(t, result.RedirectURL, result.SessionID)

	// Verify data is stored in Redis
	key := "pending_session:" + result.SessionID
	val := mr.Keys()
	assert.Contains(t, val, key)
}

func TestInitiateSIAKADLogin_InvalidCredentials(t *testing.T) {
	svc, mr, siakadMock, _, _, _ := setupTestAuthService(t)
	defer mr.Close()

	siakadMock.authenticateFn = func(_ context.Context, _, _ string) (*siakad.StudentData, error) {
		return nil, domain.ErrInvalidCredentials
	}

	ctx := context.Background()
	_, err := svc.InitiateSIAKADLogin(ctx, "12345", "wrong")

	assert.ErrorIs(t, err, domain.ErrInvalidCredentials)
}

func TestCompleteGitHubOAuth_Success(t *testing.T) {
	svc, mr, _, githubMock, _, _ := setupTestAuthService(t)
	defer mr.Close()

	// Manually store a pending session
	sessionID := uuid.New().String()
	data := pendingSessionData{
		NIM:      "12345",
		FullName: "Test Student",
		Major:    "CS",
		Semester: 4,
		IsActive: true,
	}
	jsonData, _ := json.Marshal(data)
	mr.Set("pending_session:"+sessionID, string(jsonData))
	mr.SetTTL("pending_session:"+sessionID, 10*time.Minute)

	githubMock.exchangeCodeFn = func(_ context.Context, _ string) (*github.OAuthToken, error) {
		return &github.OAuthToken{
			AccessToken: "gho_test_token_123",
			TokenType:   "bearer",
			Scope:       "read:user,repo",
		}, nil
	}

	githubMock.getUserFn = func(_ context.Context, _ string) (*github.GitHubUser, error) {
		return &github.GitHubUser{
			ID:        12345,
			Login:     "testuser",
			AvatarURL: "https://avatars.githubusercontent.com/u/12345",
			Name:      "Test User",
		}, nil
	}

	ctx := context.Background()
	result, err := svc.CompleteGitHubOAuth(ctx, sessionID, "auth-code-123")

	require.NoError(t, err)
	assert.NotNil(t, result.User)
	assert.Equal(t, "testuser", result.User.GitHubUsername)
	assert.Equal(t, "12345", result.User.NIM)
	assert.NotEmpty(t, result.AccessToken)
	assert.NotEmpty(t, result.RefreshToken)
}

func TestCompleteGitHubOAuth_InvalidSession(t *testing.T) {
	svc, mr, _, _, _, _ := setupTestAuthService(t)
	defer mr.Close()

	ctx := context.Background()
	_, err := svc.CompleteGitHubOAuth(ctx, "non-existent-session", "code")

	assert.ErrorIs(t, err, domain.ErrTokenInvalid)
}

func TestLogout_Success(t *testing.T) {
	svc, mr, _, _, userRepo, tokenRepo := setupTestAuthService(t)
	defer mr.Close()

	userID := uuid.New()
	userRepo.users["12345"] = &domain.User{
		ID:  userID,
		NIM: "12345",
	}

	// Create some tokens for the user
	_ = tokenRepo.Create(context.Background(), userID, "hash1", time.Now().Add(time.Hour))
	_ = tokenRepo.Create(context.Background(), userID, "hash2", time.Now().Add(time.Hour))

	err := svc.Logout(context.Background(), userID)
	require.NoError(t, err)

	// Verify tokens are revoked
	for _, token := range tokenRepo.tokens {
		if token.UserID == userID {
			assert.NotNil(t, token.RevokedAt)
		}
	}
}
