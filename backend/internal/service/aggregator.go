package service

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/FallCatsinSeng/SWU_OSR/backend/internal/domain"
	"github.com/FallCatsinSeng/SWU_OSR/backend/internal/github"
	"github.com/google/uuid"
)

// AggregatorService defines the aggregator service interface.
type AggregatorService interface {
	ProcessWebhook(ctx context.Context, payload []byte, signature, eventType, deliveryID string) error
	GetActivityFeed(ctx context.Context, params domain.FeedParams) (*domain.FeedResult, error)
	GetUserActivity(ctx context.Context, userID uuid.UUID, params domain.FeedParams) (*domain.FeedResult, error)
	GetRepoActivity(ctx context.Context, showcaseRepoID uuid.UUID, params domain.FeedParams) (*domain.FeedResult, error)
	SyncUserActivity(ctx context.Context, userID uuid.UUID) (int, error)
	SyncRepoActivity(ctx context.Context, userID uuid.UUID, showcaseRepoID uuid.UUID) (int, error)
}

// aggregatorService is the concrete implementation.
type aggregatorService struct {
	activityRepo  domain.ActivityRepository
	userRepo      domain.UserRepository
	showcaseRepo  domain.ShowcaseRepository
	githubSvc     github.Service
	encryptionKey []byte
	webhookSecret []byte
}

// NewAggregatorService creates a new aggregator service.
func NewAggregatorService(
	activityRepo domain.ActivityRepository,
	userRepo domain.UserRepository,
	showcaseRepo domain.ShowcaseRepository,
	githubSvc github.Service,
	encryptionKey []byte,
	webhookSecret string,
) AggregatorService {
	return &aggregatorService{
		activityRepo:  activityRepo,
		userRepo:      userRepo,
		showcaseRepo:  showcaseRepo,
		githubSvc:     githubSvc,
		encryptionKey: encryptionKey,
		webhookSecret: []byte(webhookSecret),
	}
}

// ProcessWebhook verifies the HMAC signature, parses the event, and inserts an activity log.
func (s *aggregatorService) ProcessWebhook(ctx context.Context, payload []byte, signature, eventType, deliveryID string) error {
	// Verify HMAC-SHA256 signature
	if !s.verifySignature(payload, signature) {
		return domain.ErrInvalidSignature
	}

	// Parse the event
	var repoFullName, username, summary string
	var metadata json.RawMessage

	switch domain.EventType(eventType) {
	case domain.EventPush:
		repoFullName, username, summary, metadata = s.parsePushEvent(payload)
	case domain.EventPR:
		repoFullName, username, summary, metadata = s.parsePREvent(payload)
	case domain.EventRelease:
		repoFullName, username, summary, metadata = s.parseReleaseEvent(payload)
	default:
		// Unsupported event type, ignore
		return nil
	}

	if username == "" || repoFullName == "" {
		return nil
	}

	// Resolve user by GitHub username
	user, err := s.userRepo.GetByGitHubUsername(ctx, username)
	if err != nil {
		// User not found, ignore
		return nil
	}

	// Resolve showcase repo (may or may not exist)
	var showcaseRepoID *uuid.UUID
	showcaseRepo, err := s.showcaseRepo.GetByUserAndRepoFullName(ctx, user.ID, repoFullName)
	if err == nil && showcaseRepo != nil {
		showcaseRepoID = &showcaseRepo.ID
	} else if err != nil && !errors.Is(err, domain.ErrNotFound) {
		// Real DB error — log but don't block the insert
		// showcaseRepoID remains nil
		_ = err
	}

	// Check duplicate via github_event_id
	if deliveryID != "" {
		existing, err := s.activityRepo.GetByGitHubEventID(ctx, deliveryID)
		if err == nil && existing != nil {
			// Already processed, skip
			return nil
		}
	}

	// Insert activity log
	log := &domain.ActivityLog{
		ID:             uuid.New(),
		UserID:         user.ID,
		ShowcaseRepoID: showcaseRepoID,
		RepoFullName:   repoFullName,
		EventType:      domain.EventType(eventType),
		Summary:        summary,
		Metadata:       metadata,
		GitHubEventID:  deliveryID,
		CreatedAt:      time.Now(),
	}

	return s.activityRepo.Insert(ctx, log)
}

// GetActivityFeed returns a paginated activity feed.
func (s *aggregatorService) GetActivityFeed(ctx context.Context, params domain.FeedParams) (*domain.FeedResult, error) {
	limit := clampLimit(params.Limit)
	cursor := decodeCursor(params.Cursor)

	items, err := s.activityRepo.GetFeed(ctx, cursor, limit+1)
	if err != nil {
		return nil, err
	}

	hasMore := len(items) > limit
	if hasMore {
		items = items[:limit]
	}

	var nextCursor string
	if hasMore && len(items) > 0 {
		nextCursor = encodeCursor(items[len(items)-1].CreatedAt)
	}

	return &domain.FeedResult{
		Items:      items,
		NextCursor: nextCursor,
		HasMore:    hasMore,
	}, nil
}

// GetUserActivity returns a paginated activity feed filtered by user.
func (s *aggregatorService) GetUserActivity(ctx context.Context, userID uuid.UUID, params domain.FeedParams) (*domain.FeedResult, error) {
	limit := clampLimit(params.Limit)
	cursor := decodeCursor(params.Cursor)

	items, err := s.activityRepo.GetUserFeed(ctx, userID, cursor, limit+1)
	if err != nil {
		return nil, err
	}

	hasMore := len(items) > limit
	if hasMore {
		items = items[:limit]
	}

	var nextCursor string
	if hasMore && len(items) > 0 {
		nextCursor = encodeCursor(items[len(items)-1].CreatedAt)
	}

	return &domain.FeedResult{
		Items:      items,
		NextCursor: nextCursor,
		HasMore:    hasMore,
	}, nil
}

// GetRepoActivity returns a paginated activity feed for a specific showcase repo.
func (s *aggregatorService) GetRepoActivity(ctx context.Context, showcaseRepoID uuid.UUID, params domain.FeedParams) (*domain.FeedResult, error) {
	limit := clampLimit(params.Limit)
	cursor := decodeCursor(params.Cursor)

	items, err := s.activityRepo.GetRepoFeed(ctx, showcaseRepoID, cursor, limit+1)
	if err != nil {
		return nil, err
	}

	hasMore := len(items) > limit
	if hasMore {
		items = items[:limit]
	}

	var nextCursor string
	if hasMore && len(items) > 0 {
		nextCursor = encodeCursor(items[len(items)-1].CreatedAt)
	}

	return &domain.FeedResult{
		Items:      items,
		NextCursor: nextCursor,
		HasMore:    hasMore,
	}, nil
}

// SyncRepoActivity fetches recent commits for a specific showcase repo and inserts them into activity logs.
func (s *aggregatorService) SyncRepoActivity(ctx context.Context, userID uuid.UUID, showcaseRepoID uuid.UUID) (int, error) {
	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return 0, err
	}

	if user.GitHubUsername == "" {
		return 0, nil
	}

	// Decrypt the user's GitHub token
	var token string
	if user.GitHubToken != "" {
		decrypted, err := Decrypt(user.GitHubToken, s.encryptionKey)
		if err == nil {
			token = decrypted
		}
	}

	// Get the specific showcase repo
	repo, err := s.showcaseRepo.GetByID(ctx, showcaseRepoID)
	if err != nil {
		return 0, err
	}

	// Verify the repo belongs to this user
	if repo.UserID != userID {
		return 0, domain.ErrNotFound
	}

	parts := strings.SplitN(repo.RepoFullName, "/", 2)
	if len(parts) != 2 {
		return 0, fmt.Errorf("invalid repo full name: %s", repo.RepoFullName)
	}

	inserted := 0

	// Fetch commits from GitHub
	commits, err := s.githubSvc.GetRepoCommits(ctx, token, parts[0], parts[1], 30)
	if err != nil {
		return 0, fmt.Errorf("fetching repo commits: %w", err)
	}

	for _, commit := range commits {
		// Only include commits by this user
		if commit.Author.Login != "" && commit.Author.Login != user.GitHubUsername {
			continue
		}

		// Use commit SHA as event ID for dedup
		eventID := "commit:" + commit.SHA
		existing, _ := s.activityRepo.GetByGitHubEventID(ctx, eventID)
		if existing != nil {
			continue
		}

		// Parse commit date
		commitTime, parseErr := time.Parse(time.RFC3339, commit.Commit.Author.Date)
		if parseErr != nil {
			continue
		}

		// Truncate long commit messages
		msg := commit.Commit.Message
		if len(msg) > 100 {
			msg = msg[:100] + "..."
		}

		summary := fmt.Sprintf("Committed to %s: %s", repo.RepoName, msg)
		meta, _ := json.Marshal(map[string]string{
			"sha":     commit.SHA[:7],
			"message": commit.Commit.Message,
		})

		repoID := repo.ID
		log := &domain.ActivityLog{
			ID:             uuid.New(),
			UserID:         userID,
			ShowcaseRepoID: &repoID,
			RepoFullName:   repo.RepoFullName,
			EventType:      domain.EventPush,
			Summary:        summary,
			Metadata:       meta,
			GitHubEventID:  eventID,
			CreatedAt:      commitTime,
		}

		if insertErr := s.activityRepo.Insert(ctx, log); insertErr != nil {
			continue
		}
		inserted++
	}

	return inserted, nil
}

// verifySignature checks the HMAC-SHA256 signature.
func (s *aggregatorService) verifySignature(payload []byte, signature string) bool {
	mac := hmac.New(sha256.New, s.webhookSecret)
	mac.Write(payload)
	expected := "sha256=" + hex.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(expected), []byte(signature))
}

// parsePushEvent extracts data from a push event payload.
func (s *aggregatorService) parsePushEvent(payload []byte) (repoFullName, username, summary string, metadata json.RawMessage) {
	var event struct {
		Repository struct {
			FullName       string `json:"full_name"`
			StargazersCount int   `json:"stargazers_count"`
		} `json:"repository"`
		Pusher struct {
			Name string `json:"name"`
		} `json:"pusher"`
		Ref     string `json:"ref"`
		Commits []struct {
			ID      string `json:"id"`
			Message string `json:"message"`
			Author  struct {
				Name string `json:"name"`
			} `json:"author"`
		} `json:"commits"`
	}

	if err := json.Unmarshal(payload, &event); err != nil {
		return "", "", "", nil
	}

	commitCount := len(event.Commits)
	branch := event.Ref
	if strings.HasPrefix(branch, "refs/heads/") {
		branch = strings.TrimPrefix(branch, "refs/heads/")
	}

	summary = fmt.Sprintf("Pushed %d commit(s) to %s", commitCount, branch)

	// Build metadata with up to 5 commits
	commits := event.Commits
	if len(commits) > 5 {
		commits = commits[:5]
	}
	meta := map[string]interface{}{
		"ref":          event.Ref,
		"commit_count": commitCount,
		"commits":      commits,
		// repo_stars digunakan oleh scoring engine untuk menghitung multiplier reputasi
		"repo_stars":   sanitizeStars(event.Repository.StargazersCount),
	}
	metadata, _ = json.Marshal(meta)

	return event.Repository.FullName, event.Pusher.Name, summary, metadata
}

// sanitizeStars mencegah nilai negatif dari payload GitHub yang tidak valid.
func sanitizeStars(n int) int {
	if n < 0 {
		return 0
	}
	return n
}

// parsePREvent extracts data from a pull_request event payload.
func (s *aggregatorService) parsePREvent(payload []byte) (repoFullName, username, summary string, metadata json.RawMessage) {
	var event struct {
		Action string `json:"action"`
		Number int    `json:"number"`
		Repository struct {
			FullName        string `json:"full_name"`
			StargazersCount int    `json:"stargazers_count"`
		} `json:"repository"`
		PullRequest struct {
			Title  string `json:"title"`
			Merged bool   `json:"merged"`
			User   struct {
				Login string `json:"login"`
			} `json:"user"`
		} `json:"pull_request"`
	}

	if err := json.Unmarshal(payload, &event); err != nil {
		return "", "", "", nil
	}

	summary = fmt.Sprintf("PR #%d %s: %s", event.Number, event.Action, event.PullRequest.Title)

	stars := sanitizeStars(event.Repository.StargazersCount)

	meta := map[string]interface{}{
		"action":     event.Action,
		"number":     event.Number,
		"title":      event.PullRequest.Title,
		"merged":     event.PullRequest.Merged,
		// repo_stars digunakan oleh scoring engine untuk menghitung multiplier reputasi
		"repo_stars": stars,
	}
	metadata, _ = json.Marshal(meta)

	return event.Repository.FullName, event.PullRequest.User.Login, summary, metadata
}

// parseReleaseEvent extracts data from a release event payload.
func (s *aggregatorService) parseReleaseEvent(payload []byte) (repoFullName, username, summary string, metadata json.RawMessage) {
	var event struct {
		Repository struct {
			FullName string `json:"full_name"`
		} `json:"repository"`
		Release struct {
			TagName string `json:"tag_name"`
			Name    string `json:"name"`
			Author  struct {
				Login string `json:"login"`
			} `json:"author"`
		} `json:"release"`
	}

	if err := json.Unmarshal(payload, &event); err != nil {
		return "", "", "", nil
	}

	summary = fmt.Sprintf("Released %s (%s)", event.Release.Name, event.Release.TagName)

	meta := map[string]interface{}{
		"tag_name": event.Release.TagName,
		"name":     event.Release.Name,
	}
	metadata, _ = json.Marshal(meta)

	return event.Repository.FullName, event.Release.Author.Login, summary, metadata
}

// clampLimit ensures the limit is between 1 and 50, defaulting to 20.
func clampLimit(limit int) int {
	if limit <= 0 {
		return 20
	}
	if limit > 50 {
		return 50
	}
	return limit
}

// decodeCursor decodes a base64-encoded RFC3339 timestamp cursor.
func decodeCursor(cursor string) time.Time {
	if cursor == "" {
		return time.Now().Add(time.Second)
	}
	data, err := base64.StdEncoding.DecodeString(cursor)
	if err != nil {
		return time.Now().Add(time.Second)
	}
	t, err := time.Parse(time.RFC3339Nano, string(data))
	if err != nil {
		return time.Now().Add(time.Second)
	}
	return t
}

// encodeCursor encodes a time as a base64 RFC3339Nano string.
func encodeCursor(t time.Time) string {
	return base64.StdEncoding.EncodeToString([]byte(t.Format(time.RFC3339Nano)))
}

// SyncUserActivity fetches recent public events from GitHub for the user's
// showcase repos and inserts any new activity into the feed.
func (s *aggregatorService) SyncUserActivity(ctx context.Context, userID uuid.UUID) (int, error) {
	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return 0, err
	}

	if user.GitHubUsername == "" {
		return 0, nil
	}

	// Decrypt the user's GitHub token to get authenticated API access (higher rate limits)
	var token string
	if user.GitHubToken != "" {
		decrypted, err := Decrypt(user.GitHubToken, s.encryptionKey)
		if err == nil {
			token = decrypted
		}
	}

	// Fetch public events for the user
	events, err := s.githubSvc.GetUserPublicEvents(ctx, token, user.GitHubUsername)
	if err != nil {
		return 0, fmt.Errorf("fetching user events: %w", err)
	}

	// Get user's showcase repos for matching
	repos, err := s.showcaseRepo.GetByUserID(ctx, userID)
	if err != nil {
		return 0, err
	}

	// Build repo lookup map
	repoMap := make(map[string]*domain.ShowcaseRepo)
	for i := range repos {
		repoMap[repos[i].RepoFullName] = &repos[i]
	}

	inserted := 0
	for _, event := range events {
		// Map GitHub event types to our domain types
		var eventType domain.EventType
		var summary string

		switch event.Type {
		case "PushEvent":
			eventType = domain.EventPush
			summary = s.buildPushSummary(event.Payload, event.Repo.Name)
		case "PullRequestEvent":
			eventType = domain.EventPR
			summary = s.buildPRSummary(event.Payload, event.Repo.Name)
		case "ReleaseEvent":
			eventType = domain.EventRelease
			summary = s.buildReleaseSummary(event.Payload, event.Repo.Name)
		case "CreateEvent":
			eventType = domain.EventPush
			summary = s.buildCreateSummary(event.Payload, event.Repo.Name)
		case "IssuesEvent":
			eventType = domain.EventPR
			summary = s.buildIssueSummary(event.Payload, event.Repo.Name)
		case "ForkEvent":
			eventType = domain.EventPush
			summary = fmt.Sprintf("Forked %s", event.Repo.Name)
		case "WatchEvent":
			eventType = domain.EventPush
			summary = fmt.Sprintf("Starred %s", event.Repo.Name)
		default:
			continue
		}

		// Check if event already exists (dedup by GitHub event ID)
		existing, _ := s.activityRepo.GetByGitHubEventID(ctx, event.ID)
		if existing != nil {
			continue
		}

		// Find matching showcase repo (if any) — activity is recorded regardless
		var showcaseRepoID *uuid.UUID
		showcaseRepo, found := repoMap[event.Repo.Name]
		if found {
			showcaseRepoID = &showcaseRepo.ID
		}

		// Parse created_at
		createdAt, parseErr := time.Parse(time.RFC3339, event.CreatedAt)
		if parseErr != nil {
			createdAt = time.Now()
		}

		log := &domain.ActivityLog{
			ID:             uuid.New(),
			UserID:         userID,
			ShowcaseRepoID: showcaseRepoID,
			RepoFullName:   event.Repo.Name,
			EventType:      eventType,
			Summary:        summary,
			Metadata:       event.Payload,
			GitHubEventID:  event.ID,
			CreatedAt:      createdAt,
		}

		if insertErr := s.activityRepo.Insert(ctx, log); insertErr != nil {
			continue
		}
		inserted++
	}

	// Phase 2: Backfill commits from showcase repos
	// This catches commits that the Events API might not include (older than 90 days)
	for _, repo := range repos {
		parts := strings.SplitN(repo.RepoFullName, "/", 2)
		if len(parts) != 2 {
			continue
		}

		commits, err := s.githubSvc.GetRepoCommits(ctx, token, parts[0], parts[1], 30)
		if err != nil {
			continue // Skip repos we can't access
		}

		for _, commit := range commits {
			// Only include commits by this user
			if commit.Author.Login != "" && commit.Author.Login != user.GitHubUsername {
				continue
			}

			// Use commit SHA as event ID for dedup
			eventID := "commit:" + commit.SHA
			existing, _ := s.activityRepo.GetByGitHubEventID(ctx, eventID)
			if existing != nil {
				continue
			}

			// Parse commit date
			commitTime, parseErr := time.Parse(time.RFC3339, commit.Commit.Author.Date)
			if parseErr != nil {
				continue
			}

			// Truncate long commit messages
			msg := commit.Commit.Message
			if len(msg) > 100 {
				msg = msg[:100] + "..."
			}

			summary := fmt.Sprintf("Committed to %s: %s", repo.RepoName, msg)
			meta, _ := json.Marshal(map[string]string{
				"sha":     commit.SHA[:7],
				"message": commit.Commit.Message,
			})

			repoID := repo.ID
			log := &domain.ActivityLog{
				ID:             uuid.New(),
				UserID:         userID,
				ShowcaseRepoID: &repoID,
				RepoFullName:   repo.RepoFullName,
				EventType:      domain.EventPush,
				Summary:        summary,
				Metadata:       meta,
				GitHubEventID:  eventID,
				CreatedAt:      commitTime,
			}

			if insertErr := s.activityRepo.Insert(ctx, log); insertErr != nil {
				continue
			}
			inserted++
		}
	}

	return inserted, nil
}

// buildPushSummary extracts a summary from a PushEvent payload.
func (s *aggregatorService) buildPushSummary(payload json.RawMessage, repoName string) string {
	var p struct {
		Size int    `json:"size"`
		Ref  string `json:"ref"`
	}
	if err := json.Unmarshal(payload, &p); err != nil {
		return fmt.Sprintf("Pushed to %s", repoName)
	}
	branch := p.Ref
	if strings.HasPrefix(branch, "refs/heads/") {
		branch = strings.TrimPrefix(branch, "refs/heads/")
	}
	return fmt.Sprintf("Pushed %d commit(s) to %s:%s", p.Size, repoName, branch)
}

// buildPRSummary extracts a summary from a PullRequestEvent payload.
func (s *aggregatorService) buildPRSummary(payload json.RawMessage, repoName string) string {
	var p struct {
		Action      string `json:"action"`
		Number      int    `json:"number"`
		PullRequest struct {
			Title string `json:"title"`
		} `json:"pull_request"`
	}
	if err := json.Unmarshal(payload, &p); err != nil {
		return fmt.Sprintf("PR activity on %s", repoName)
	}
	return fmt.Sprintf("PR #%d %s: %s", p.Number, p.Action, p.PullRequest.Title)
}

// buildReleaseSummary extracts a summary from a ReleaseEvent payload.
func (s *aggregatorService) buildReleaseSummary(payload json.RawMessage, repoName string) string {
	var p struct {
		Release struct {
			TagName string `json:"tag_name"`
			Name    string `json:"name"`
		} `json:"release"`
	}
	if err := json.Unmarshal(payload, &p); err != nil {
		return fmt.Sprintf("Released on %s", repoName)
	}
	return fmt.Sprintf("Released %s (%s) on %s", p.Release.Name, p.Release.TagName, repoName)
}

// buildCreateSummary extracts a summary from a CreateEvent payload.
func (s *aggregatorService) buildCreateSummary(payload json.RawMessage, repoName string) string {
	var p struct {
		RefType string `json:"ref_type"`
		Ref     string `json:"ref"`
	}
	if err := json.Unmarshal(payload, &p); err != nil {
		return fmt.Sprintf("Created on %s", repoName)
	}
	if p.RefType == "repository" {
		return fmt.Sprintf("Created repository %s", repoName)
	}
	return fmt.Sprintf("Created %s '%s' on %s", p.RefType, p.Ref, repoName)
}

// buildIssueSummary extracts a summary from an IssuesEvent payload.
func (s *aggregatorService) buildIssueSummary(payload json.RawMessage, repoName string) string {
	var p struct {
		Action string `json:"action"`
		Issue  struct {
			Number int    `json:"number"`
			Title  string `json:"title"`
		} `json:"issue"`
	}
	if err := json.Unmarshal(payload, &p); err != nil {
		return fmt.Sprintf("Issue activity on %s", repoName)
	}
	return fmt.Sprintf("Issue #%d %s: %s", p.Issue.Number, p.Action, p.Issue.Title)
}
