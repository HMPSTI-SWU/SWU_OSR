package service

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"crypto/sha256"

	"github.com/FallCatsinSeng/SWU_OSR/backend/internal/config"
	"github.com/FallCatsinSeng/SWU_OSR/backend/internal/domain"
	"github.com/FallCatsinSeng/SWU_OSR/backend/internal/github"
	"github.com/FallCatsinSeng/SWU_OSR/backend/internal/siakad"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
)

// PendingSession holds the data stored in Redis while waiting for GitHub OAuth callback.
type PendingSession struct {
	SessionID   string `json:"session_id"`
	RedirectURL string `json:"redirect_url"`
}

// AuthResult holds the result of a completed authentication flow.
type AuthResult struct {
	User         *domain.User `json:"user"`
	AccessToken  string       `json:"access_token"`
	RefreshToken string       `json:"refresh_token"`
}

// TokenPair holds a new JWT and refresh token pair.
type TokenPair struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
}

// AuthService defines the authentication service interface.
type AuthService interface {
	InitiateSIAKADLogin(ctx context.Context, nim, password string) (*PendingSession, error)
	CompleteGitHubOAuth(ctx context.Context, sessionID, code string) (*AuthResult, error)
	RefreshToken(ctx context.Context, refreshToken string) (*TokenPair, error)
	Logout(ctx context.Context, userID uuid.UUID) error
	ManualVerify(ctx context.Context, adminID, studentID uuid.UUID, nim string) error
	GetCurrentUser(ctx context.Context, userID uuid.UUID) (*domain.User, error)
}

// authService is the concrete implementation.
type authService struct {
	siakadSvc   siakad.Service
	githubSvc   github.Service
	userRepo    domain.UserRepository
	tokenRepo   domain.RefreshTokenRepository
	redisClient *redis.Client
	cfg         *config.Config
}

// NewAuthService creates a new auth service.
func NewAuthService(
	siakadSvc siakad.Service,
	githubSvc github.Service,
	userRepo domain.UserRepository,
	tokenRepo domain.RefreshTokenRepository,
	redisClient *redis.Client,
	cfg *config.Config,
) AuthService {
	return &authService{
		siakadSvc:   siakadSvc,
		githubSvc:   githubSvc,
		userRepo:    userRepo,
		tokenRepo:   tokenRepo,
		redisClient: redisClient,
		cfg:         cfg,
	}
}

// pendingSessionData is stored in Redis for the pending session.
type pendingSessionData struct {
	NIM      string `json:"nim"`
	FullName string `json:"full_name"`
	Major    string `json:"major"`
	Semester int    `json:"semester"`
	IsActive bool   `json:"is_active"`
}

// InitiateSIAKADLogin authenticates with SIAKAD and stores a pending session in Redis.
func (s *authService) InitiateSIAKADLogin(ctx context.Context, nim, password string) (*PendingSession, error) {
	studentData, err := s.siakadSvc.Authenticate(ctx, nim, password)
	if err != nil {
		return nil, err
	}

	sessionID := uuid.New().String()

	data := pendingSessionData{
		NIM:      studentData.NIM,
		FullName: studentData.FullName,
		Major:    studentData.Major,
		Semester: studentData.Semester,
		IsActive: studentData.IsActive,
	}

	jsonData, err := json.Marshal(data)
	if err != nil {
		return nil, fmt.Errorf("marshaling session data: %w", err)
	}

	key := fmt.Sprintf("pending_session:%s", sessionID)
	if err := s.redisClient.Set(ctx, key, jsonData, 10*time.Minute).Err(); err != nil {
		return nil, fmt.Errorf("storing pending session: %w", err)
	}

	redirectURL := s.githubSvc.GetAuthorizationURL(sessionID)

	return &PendingSession{
		SessionID:   sessionID,
		RedirectURL: redirectURL,
	}, nil
}

// CompleteGitHubOAuth completes the OAuth flow by exchanging the code and binding identities.
func (s *authService) CompleteGitHubOAuth(ctx context.Context, sessionID, code string) (*AuthResult, error) {
	// Retrieve pending session from Redis
	key := fmt.Sprintf("pending_session:%s", sessionID)
	jsonData, err := s.redisClient.Get(ctx, key).Bytes()
	if err != nil {
		if errors.Is(err, redis.Nil) {
			return nil, domain.ErrTokenInvalid
		}
		return nil, fmt.Errorf("retrieving pending session: %w", err)
	}

	var sessionData pendingSessionData
	if err := json.Unmarshal(jsonData, &sessionData); err != nil {
		return nil, fmt.Errorf("unmarshaling session data: %w", err)
	}

	// Clean up the pending session
	s.redisClient.Del(ctx, key)

	// Exchange code for GitHub token
	oauthToken, err := s.githubSvc.ExchangeCode(ctx, code)
	if err != nil {
		return nil, fmt.Errorf("exchanging GitHub code: %w", err)
	}

	// Get GitHub user info
	ghUser, err := s.githubSvc.GetUser(ctx, oauthToken.AccessToken)
	if err != nil {
		return nil, fmt.Errorf("fetching GitHub user: %w", err)
	}

	// Encrypt GitHub token for storage
	encryptedToken, err := Encrypt(oauthToken.AccessToken, s.cfg.EncryptionKey)
	if err != nil {
		return nil, fmt.Errorf("encrypting GitHub token: %w", err)
	}

	// Upsert user: check if user exists by NIM first
	user, err := s.userRepo.GetByNIM(ctx, sessionData.NIM)
	if err != nil && !errors.Is(err, domain.ErrNotFound) {
		return nil, fmt.Errorf("looking up user: %w", err)
	}

	if user == nil {
		// Determine initial role — NIMs in the super-admin list start as super_admin.
		initialRole := domain.RoleStudent
		if s.isSuperAdminNIM(sessionData.NIM) {
			initialRole = domain.RoleSuperAdmin
		}
		// Create new user
		user = &domain.User{
			ID:             uuid.New(),
			NIM:            sessionData.NIM,
			FullName:       sessionData.FullName,
			Major:          sessionData.Major,
			Semester:       sessionData.Semester,
			Alias:          ghUser.Login,
			AvatarURL:      ghUser.AvatarURL,
			GitHubUsername: ghUser.Login,
			GitHubID:       ghUser.ID,
			GitHubToken:    encryptedToken,
			Role:           initialRole,
			IsActive:       sessionData.IsActive,
			CreatedAt:      time.Now(),
			UpdatedAt:      time.Now(),
		}
		if err := s.userRepo.Create(ctx, user); err != nil {
			return nil, fmt.Errorf("creating user: %w", err)
		}
	} else {
		// Update existing user with new GitHub info
		user.GitHubUsername = ghUser.Login
		user.GitHubID = ghUser.ID
		user.GitHubToken = encryptedToken
		user.AvatarURL = ghUser.AvatarURL
		user.FullName = sessionData.FullName
		user.Major = sessionData.Major
		user.Semester = sessionData.Semester
		user.IsActive = sessionData.IsActive
		user.UpdatedAt = time.Now()
		// Preserve existing role unless the NIM is in the super-admin list.
		// This prevents overwriting a manually assigned lecturer/lpt_officer role on re-login.
		if s.isSuperAdminNIM(sessionData.NIM) {
			user.Role = domain.RoleSuperAdmin
		}
		if err := s.userRepo.Update(ctx, user); err != nil {
			return nil, fmt.Errorf("updating user: %w", err)
		}
	}

	// Generate JWT
	accessToken, err := s.generateJWT(user)
	if err != nil {
		return nil, fmt.Errorf("generating JWT: %w", err)
	}

	// Generate refresh token
	refreshToken, err := s.generateRefreshToken(ctx, user.ID)
	if err != nil {
		return nil, fmt.Errorf("generating refresh token: %w", err)
	}

	return &AuthResult{
		User:         user,
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
	}, nil
}

// RefreshToken validates the refresh token and issues a new token pair.
func (s *authService) RefreshToken(ctx context.Context, refreshToken string) (*TokenPair, error) {
	// Hash the token to look it up
	tokenHash, err := hashRefreshToken(refreshToken)
	if err != nil {
		return nil, domain.ErrTokenInvalid
	}

	// Find the token in DB
	storedToken, err := s.tokenRepo.GetByHash(ctx, tokenHash)
	if err != nil {
		return nil, domain.ErrTokenInvalid
	}

	// Check if revoked
	if storedToken.RevokedAt != nil {
		return nil, domain.ErrTokenInvalid
	}

	// Check if expired
	if time.Now().After(storedToken.ExpiresAt) {
		return nil, domain.ErrTokenExpired
	}

	// Revoke the used token
	if err := s.tokenRepo.Revoke(ctx, storedToken.ID); err != nil {
		return nil, fmt.Errorf("revoking old token: %w", err)
	}

	// Get user for JWT claims
	user, err := s.userRepo.GetByID(ctx, storedToken.UserID)
	if err != nil {
		return nil, fmt.Errorf("fetching user for refresh: %w", err)
	}

	// Issue new JWT
	accessToken, err := s.generateJWT(user)
	if err != nil {
		return nil, fmt.Errorf("generating new JWT: %w", err)
	}

	// Issue new refresh token
	newRefreshToken, err := s.generateRefreshToken(ctx, user.ID)
	if err != nil {
		return nil, fmt.Errorf("generating new refresh token: %w", err)
	}

	return &TokenPair{
		AccessToken:  accessToken,
		RefreshToken: newRefreshToken,
	}, nil
}

// Logout revokes all refresh tokens for the user.
func (s *authService) Logout(ctx context.Context, userID uuid.UUID) error {
	return s.tokenRepo.RevokeAllForUser(ctx, userID)
}

// ManualVerify allows an admin to manually verify a student when SIAKAD is unavailable.
func (s *authService) ManualVerify(ctx context.Context, adminID, studentID uuid.UUID, nim string) error {
	// Verify admin role would be checked at handler level
	user, err := s.userRepo.GetByID(ctx, studentID)
	if err != nil {
		return fmt.Errorf("fetching student: %w", err)
	}

	user.NIM = nim
	user.IsActive = true
	user.UpdatedAt = time.Now()

	return s.userRepo.Update(ctx, user)
}

// GetCurrentUser retrieves the current user by their ID.
func (s *authService) GetCurrentUser(ctx context.Context, userID uuid.UUID) (*domain.User, error) {
	return s.userRepo.GetByID(ctx, userID)
}

// generateJWT creates a signed JWT for the given user.
func (s *authService) generateJWT(user *domain.User) (string, error) {
	now := time.Now()
	claims := jwt.MapClaims{
		"user_id": user.ID.String(),
		"alias":   user.Alias,
		"role":    string(user.Role),
		"iat":     now.Unix(),
		"exp":     now.Add(s.cfg.JWTExpiry).Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(s.cfg.JWTSecret))
}

// generateRefreshToken creates a random refresh token, stores its hash, and returns the raw token.
func (s *authService) generateRefreshToken(ctx context.Context, userID uuid.UUID) (string, error) {
	// Generate a random token
	tokenBytes := make([]byte, 32)
	if _, err := rand.Read(tokenBytes); err != nil {
		return "", fmt.Errorf("generating random token: %w", err)
	}
	rawToken := hex.EncodeToString(tokenBytes)

	// Hash it for storage
	tokenHash, err := hashRefreshToken(rawToken)
	if err != nil {
		return "", fmt.Errorf("hashing refresh token: %w", err)
	}

	expiresAt := time.Now().Add(s.cfg.RefreshExpiry)

	if err := s.tokenRepo.Create(ctx, userID, tokenHash, expiresAt); err != nil {
		return "", fmt.Errorf("storing refresh token: %w", err)
	}

	return rawToken, nil
}

// hashRefreshToken creates a deterministic SHA-256 hash of the refresh token.
// SHA-256 is appropriate here because refresh tokens are high-entropy (32 random bytes),
// making brute-force infeasible without the computational cost of bcrypt.
func hashRefreshToken(token string) (string, error) {
	hash := sha256.Sum256([]byte(token))
	return hex.EncodeToString(hash[:]), nil
}

// isSuperAdminNIM checks whether the given NIM is in the configured super-admin list.
func (s *authService) isSuperAdminNIM(nim string) bool {
	for _, adminNIM := range s.cfg.SuperAdminNIMs {
		if adminNIM == nim {
			return true
		}
	}
	return false
}
