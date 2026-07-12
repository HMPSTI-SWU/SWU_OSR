package domain

import (
	"context"
	"time"

	"github.com/google/uuid"
)

// Point values for different activities.
const (
	PointsPush          = 3
	PointsPROpened      = 2  // Small bonus just for opening a PR
	PointsPRMerged      = 12 // Full points only for merged PRs — anti-gaming
	PointsShowcaseAdded = 10
	PointsThreadCreated = 2
	PointsCommentPosted = 1
	PointsStreakBonus   = 20 // Streak bonus per threshold

	// Anti-gaming: maximum push-points a user can earn per day.
	MaxPointsPerDay = 30

	// Anti-gaming: maximum scoreable push events per repo per quarter.
	MaxPushPerRepoPerQuarter = 90

	// Anti-gaming: maximum scoreable PR events per repo per quarter.
	MaxPRPerRepoPerQuarter = 20

	// Streak threshold: consecutive days needed for bonus.
	StreakThresholdDays = 7
)

// LeaderboardPeriod represents the time window for a leaderboard.
type LeaderboardPeriod string

const (
	PeriodQuarterly LeaderboardPeriod = "quarterly"
	PeriodAllTime   LeaderboardPeriod = "all_time"
)

// LeaderboardEntry represents a single user's position on the leaderboard.
type LeaderboardEntry struct {
	Rank        int       `json:"rank"`
	UserID      uuid.UUID `json:"user_id"`
	Alias       string    `json:"alias"`
	AvatarURL   string    `json:"avatar_url"`
	TotalPoints int       `json:"total_points"`
	PushPoints  int       `json:"push_points"`
	PRPoints    int       `json:"pr_points"`
	ForumPoints int       `json:"forum_points"`
	OtherPoints int       `json:"other_points"`
	StreakDays  int       `json:"streak_days"`
}

// LeaderboardResult is the response for a leaderboard query.
type LeaderboardResult struct {
	Period  LeaderboardPeriod  `json:"period"`
	From    time.Time          `json:"from"`
	To      time.Time          `json:"to"`
	Quarter int                `json:"quarter,omitempty"` // 1-4 for quarterly period
	Entries []LeaderboardEntry `json:"entries"`
}

// UserPointsSummary is a user's personal points breakdown.
type UserPointsSummary struct {
	UserID      uuid.UUID `json:"user_id"`
	TotalPoints int       `json:"total_points"`
	PushCount   int       `json:"push_count"`
	PRCount     int       `json:"pr_count"`
	ThreadCount int       `json:"thread_count"`
	CommentCnt  int       `json:"comment_count"`
	ShowcaseCnt int       `json:"showcase_count"`
	StreakDays  int       `json:"streak_days"`
	Rank        int       `json:"rank"`
}

// RepoEventCount holds event counts for a single repository.
type RepoEventCount struct {
	RepoID uuid.UUID
	Count  int
}

// WeightedRepoEventCount holds event counts with repository reputation (stars).
// Used by the scoring engine to apply the Repo Reputation multiplier.
type WeightedRepoEventCount struct {
	RepoID uuid.UUID
	Count  int
	Stars  int // GitHub stargazers_count from webhook metadata
}

// StarMultiplier returns the scoring multiplier based on repository star count.
// This is the core of the Repo Reputation algorithm (lightweight PageRank adaptation):
// repositories with more stars are more "important" in the contribution graph,
// so contributions to them receive a higher weight.
//
// Tier thresholds are intentionally coarse to avoid micro-optimization by users.
func StarMultiplier(stars int) float64 {
	switch {
	case stars >= 1000:
		return 5.0 // Proyek open source besar/populer
	case stars >= 100:
		return 3.0 // Open source dengan komunitas aktif
	case stars >= 10:
		return 2.0 // Proyek dengan beberapa pengikut
	case stars >= 1:
		return 1.5 // Ada sedikit peminat
	default:
		return 1.0 // Repo pribadi/belum ada star (base rate)
	}
}

// BehavioralStats holds activity timing stats used for behavioral badges.
type BehavioralStats struct {
	// NightOwlCount: commits/pushes done between 00:00–04:00 local server time
	NightOwlCount int `json:"night_owl_count"`
	// EarlyBirdCount: commits/pushes done between 04:00–07:00
	EarlyBirdCount int `json:"early_bird_count"`
	// WeekendCount: commits/pushes done on Saturday or Sunday
	WeekendCount int `json:"weekend_count"`
	// TotalActivityCount: all commits/pushes (for ratio calculation)
	TotalActivityCount int `json:"total_activity_count"`
	// ForumTotal: total threads + comments (for community badges)
	ForumTotal int `json:"forum_total"`
}

// LeaderboardRepository defines data access methods for leaderboard.
type LeaderboardRepository interface {
	// GetLeaderboard retrieves ranked users for a given time window.
	GetLeaderboard(ctx context.Context, from, to time.Time, limit, offset int) ([]LeaderboardEntry, error)

	// GetUserPoints retrieves a single user's points summary for a given time window.
	GetUserPoints(ctx context.Context, userID uuid.UUID, from, to time.Time) (*UserPointsSummary, error)

	// GetUserStreak returns the current consecutive active days for a user.
	GetUserStreak(ctx context.Context, userID uuid.UUID) (int, error)

	// Count methods for computing points from source tables.
	CountUserPushEvents(ctx context.Context, userID uuid.UUID, from, to time.Time) (int, error)
	CountUserPREvents(ctx context.Context, userID uuid.UUID, from, to time.Time) (int, error)
	CountUserThreads(ctx context.Context, userID uuid.UUID, from, to time.Time) (int, error)
	CountUserComments(ctx context.Context, userID uuid.UUID, from, to time.Time) (int, error)
	CountUserShowcaseRepos(ctx context.Context, userID uuid.UUID, from, to time.Time) (int, error)

	// Per-repo count methods for anti-gaming caps.
	CountUserPushEventsPerRepo(ctx context.Context, userID uuid.UUID, from, to time.Time) ([]RepoEventCount, error)
	CountUserPREventsPerRepo(ctx context.Context, userID uuid.UUID, from, to time.Time) ([]RepoEventCount, error)

	// CountUserMergedPREventsPerRepo returns per-repo counts of merged PRs only.
	// A PR is considered merged when metadata->>'action' = 'closed' AND metadata->>'merged' = 'true'.
	CountUserMergedPREventsPerRepo(ctx context.Context, userID uuid.UUID, from, to time.Time) ([]RepoEventCount, error)

	// CountUserWeightedPushPerRepo returns per-repo push counts WITH the star count from metadata.
	// Stars are read from metadata->>'repo_stars' stored by the aggregator on each webhook.
	// For legacy rows without repo_stars, stars defaults to 0 (multiplier = 1.0).
	CountUserWeightedPushPerRepo(ctx context.Context, userID uuid.UUID, from, to time.Time) ([]WeightedRepoEventCount, error)

	// CountUserWeightedMergedPRPerRepo returns per-repo merged PR counts WITH star count from metadata.
	CountUserWeightedMergedPRPerRepo(ctx context.Context, userID uuid.UUID, from, to time.Time) ([]WeightedRepoEventCount, error)

	// GetUserAnomalyCoefficient computes a penalty multiplier [0.1, 1.0] for push events.
	// Uses 30-day rolling AVG+STDDEV to detect burst activity (Z-Score > 2 = anomaly).
	// Returns 1.0 (no penalty) if data is insufficient or no anomaly detected.
	GetUserAnomalyCoefficient(ctx context.Context, userID uuid.UUID) (float64, error)

	// GetUserBehavioralStats returns timing-based activity stats for badge calculation.
	GetUserBehavioralStats(ctx context.Context, userID uuid.UUID, from, to time.Time) (*BehavioralStats, error)

	// GetAllActiveUserIDs returns user IDs with activity in the given time range.
	GetAllActiveUserIDs(ctx context.Context, from, to time.Time) ([]uuid.UUID, error)

	// UpsertPoints inserts or updates computed leaderboard points.
	UpsertPoints(ctx context.Context, userID uuid.UUID, period LeaderboardPeriod, from, to time.Time, pushPts, prPts, forumPts, otherPts, totalPts, streakDays int) error
}

// LeaderboardService defines the business logic for the leaderboard feature.
type LeaderboardService interface {
	// GetLeaderboard returns the leaderboard for a given period.
	GetLeaderboard(ctx context.Context, period LeaderboardPeriod, limit, offset int) (*LeaderboardResult, error)

	// GetUserSummary returns a user's personal points summary for a given period.
	GetUserSummary(ctx context.Context, userID uuid.UUID, period LeaderboardPeriod) (*UserPointsSummary, error)
}
