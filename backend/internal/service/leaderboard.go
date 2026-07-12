package service

import (
	"context"
	"sync"
	"time"

	"github.com/FallCatsinSeng/SWU_OSR/backend/internal/domain"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

// leaderboardService implements domain.LeaderboardService.
type leaderboardService struct {
	repo   domain.LeaderboardRepository
	logger *zap.Logger
}

// NewLeaderboardService creates a new leaderboard service.
// The returned value also satisfies scheduler.LeaderboardRefresher via RefreshLeaderboard.
func NewLeaderboardService(repo domain.LeaderboardRepository, logger *zap.Logger) *leaderboardService {
	return &leaderboardService{
		repo:   repo,
		logger: logger,
	}
}

// GetLeaderboard returns the leaderboard for a given period.
func (s *leaderboardService) GetLeaderboard(ctx context.Context, period domain.LeaderboardPeriod, limit, offset int) (*domain.LeaderboardResult, error) {
	from, to := s.periodWindow(period)

	entries, err := s.repo.GetLeaderboard(ctx, from, to, limit, offset)
	if err != nil {
		s.logger.Error("failed to get leaderboard", zap.Error(err))
		return nil, err
	}

	result := &domain.LeaderboardResult{
		Period:  period,
		From:    from,
		To:      to,
		Entries: entries,
	}

	// Attach quarter number for quarterly period
	if period == domain.PeriodQuarterly {
		result.Quarter = quarterOf(from)
	}

	return result, nil
}

// GetUserSummary returns a user's personal points summary for a given period.
func (s *leaderboardService) GetUserSummary(ctx context.Context, userID uuid.UUID, period domain.LeaderboardPeriod) (*domain.UserPointsSummary, error) {
	from, to := s.periodWindow(period)

	summary, err := s.repo.GetUserPoints(ctx, userID, from, to)
	if err != nil {
		s.logger.Error("failed to get user points", zap.Error(err), zap.String("user_id", userID.String()))
		return nil, err
	}

	// Get live streak
	streak, err := s.repo.GetUserStreak(ctx, userID)
	if err != nil {
		s.logger.Warn("failed to get user streak", zap.Error(err))
		// Non-fatal: continue with cached streak
	} else {
		summary.StreakDays = streak
	}

	return summary, nil
}

// RefreshLeaderboard recomputes points for all active users in the given period.
// Performance: Uses a bounded worker pool (10 goroutines) to parallelize per-user
// computation, reducing refresh time from O(N×queries) sequential to O(N×queries/10) parallel.
func (s *leaderboardService) RefreshLeaderboard(ctx context.Context, period domain.LeaderboardPeriod) error {
	from, to := s.periodWindow(period)

	// Get all users with activity in this period
	userIDs, err := s.repo.GetAllActiveUserIDs(ctx, from, to)
	if err != nil {
		s.logger.Error("failed to get active user IDs", zap.Error(err))
		return err
	}

	s.logger.Info("refreshing leaderboard",
		zap.String("period", string(period)),
		zap.Int("active_users", len(userIDs)),
	)

	// Bounded worker pool to avoid overwhelming the DB connection pool
	const maxWorkers = 10
	sem := make(chan struct{}, maxWorkers)
	var wg sync.WaitGroup

	for _, userID := range userIDs {
		wg.Add(1)
		sem <- struct{}{} // Acquire semaphore slot
		go func(uid uuid.UUID) {
			defer wg.Done()
			defer func() { <-sem }() // Release semaphore slot

			if err := s.computeAndStoreUserPoints(ctx, uid, period, from, to); err != nil {
				s.logger.Error("failed to compute points for user",
					zap.Error(err),
					zap.String("user_id", uid.String()),
				)
			}
		}(userID)
	}

	wg.Wait()
	return nil
}

// computeAndStoreUserPoints calculates and persists a user's points.
// Anti-gaming measures:
//  1. Push: per-repo quarterly cap + daily cap + anomaly Z-Score penalty
//  2. PR: only MERGED PRs get full PointsPRMerged
//  3. Both push and merged PR points are weighted by repo star multiplier (Repo Reputation)
//  4. Per-repo quarterly cap on PR merged events (MaxPRPerRepoPerQuarter)
func (s *leaderboardService) computeAndStoreUserPoints(ctx context.Context, userID uuid.UUID, period domain.LeaderboardPeriod, from, to time.Time) error {
	// --- Anomaly coefficient (Z-Score burst detection, runs in PostgreSQL) ---
	anomalyCoeff, err := s.repo.GetUserAnomalyCoefficient(ctx, userID)
	if err != nil {
		anomalyCoeff = 1.0 // fail-open: jika gagal, tidak terapkan penalti
	}

	// --- Per-repo weighted push count (dengan star multiplier) ---
	weightedPushPerRepo, err := s.repo.CountUserWeightedPushPerRepo(ctx, userID, from, to)
	if err != nil {
		return err
	}

	// Apply per-repo quarterly cap + star multiplier + anomaly coefficient
	pushPtsFloat := 0.0
	for _, wrc := range weightedPushPerRepo {
		capped := wrc.Count
		if capped > domain.MaxPushPerRepoPerQuarter {
			capped = domain.MaxPushPerRepoPerQuarter
		}
		multiplier := domain.StarMultiplier(wrc.Stars)
		pushPtsFloat += float64(capped) * float64(domain.PointsPush) * multiplier
	}
	// Terapkan daily cap (cegah point explosion dari multi-repo)
	days := int(to.Sub(from).Hours()/24) + 1
	if days < 1 {
		days = 1
	}
	maxPushPts := float64((domain.MaxPointsPerDay / domain.PointsPush) * days * domain.PointsPush)
	if pushPtsFloat > maxPushPts {
		pushPtsFloat = maxPushPts
	}
	// Terapkan anomaly penalty ke push points
	pushPtsFloat *= anomalyCoeff
	pushPts := int(pushPtsFloat)

	// --- PR opened (poin kecil, flat, tidak ada star multiplier untuk mencegah spam) ---
	prOpenedPerRepo, err := s.repo.CountUserPREventsPerRepo(ctx, userID, from, to)
	if err != nil {
		return err
	}
	prOpenedCount := 0
	for _, rc := range prOpenedPerRepo {
		prOpenedCount += rc.Count
	}
	const maxOpenedPRsPerQuarter = 50
	if prOpenedCount > maxOpenedPRsPerQuarter {
		prOpenedCount = maxOpenedPRsPerQuarter
	}

	// --- PR merged (poin penuh + star multiplier — kontribusi nyata ke repo penting) ---
	weightedMergedPerRepo, err := s.repo.CountUserWeightedMergedPRPerRepo(ctx, userID, from, to)
	if err != nil {
		return err
	}
	mergedPtsFloat := 0.0
	for _, wrc := range weightedMergedPerRepo {
		capped := wrc.Count
		if capped > domain.MaxPRPerRepoPerQuarter {
			capped = domain.MaxPRPerRepoPerQuarter
		}
		multiplier := domain.StarMultiplier(wrc.Stars)
		mergedPtsFloat += float64(capped) * float64(domain.PointsPRMerged) * multiplier
	}
	prPts := int(mergedPtsFloat) + (prOpenedCount * domain.PointsPROpened)

	threadCount, err := s.repo.CountUserThreads(ctx, userID, from, to)
	if err != nil {
		return err
	}

	commentCount, err := s.repo.CountUserComments(ctx, userID, from, to)
	if err != nil {
		return err
	}

	showcaseCount, err := s.repo.CountUserShowcaseRepos(ctx, userID, from, to)
	if err != nil {
		return err
	}

	streak, err := s.repo.GetUserStreak(ctx, userID)
	if err != nil {
		streak = 0
	}

	forumPts := (threadCount * domain.PointsThreadCreated) + (commentCount * domain.PointsCommentPosted)
	otherPts := showcaseCount * domain.PointsShowcaseAdded

	// Streak bonus
	if streak >= domain.StreakThresholdDays {
		streakBonuses := streak / domain.StreakThresholdDays
		otherPts += streakBonuses * domain.PointsStreakBonus
	}

	totalPts := pushPts + prPts + forumPts + otherPts

	return s.repo.UpsertPoints(ctx, userID, period, from, to, pushPts, prPts, forumPts, otherPts, totalPts, streak)
}


// applyCappedCount applies a flat cap to event counts per repo.
// For each repo, only up to maxPerRepo events count.
func (s *leaderboardService) applyCappedCount(perRepo []domain.RepoEventCount, maxPerRepo int) int {
	total := 0
	for _, rc := range perRepo {
		capped := rc.Count
		if capped > maxPerRepo {
			capped = maxPerRepo
		}
		total += capped
	}
	return total
}

// capDailyPoints applies the daily point cap for push events.
// It limits the raw count so that points don't exceed MaxPointsPerDay worth of push points per day.
func (s *leaderboardService) capDailyPoints(count, pointsPerEvent int, from, to time.Time) int {
	days := int(to.Sub(from).Hours()/24) + 1
	if days < 1 {
		days = 1
	}

	// Max push events that count per day
	maxEventsPerDay := domain.MaxPointsPerDay / pointsPerEvent
	maxTotalEvents := maxEventsPerDay * days

	if count > maxTotalEvents {
		count = maxTotalEvents
	}

	return count * pointsPerEvent
}

// periodWindow returns the start and end time for a given leaderboard period.
func (s *leaderboardService) periodWindow(period domain.LeaderboardPeriod) (time.Time, time.Time) {
	now := time.Now()

	switch period {
	case domain.PeriodQuarterly:
		return currentQuarterWindow(now)

	case domain.PeriodAllTime:
		// Use fixed sentinel dates so writes and reads always match.
		from := time.Date(2020, 1, 1, 0, 0, 0, 0, time.UTC)
		to := time.Date(2099, 12, 31, 23, 59, 59, 0, time.UTC)
		return from, to

	default:
		// Default to quarterly
		return currentQuarterWindow(now)
	}
}

// currentQuarterWindow returns the start and end of the current academic/calendar quarter.
// Q1: Jan–Mar, Q2: Apr–Jun, Q3: Jul–Sep, Q4: Oct–Dec
func currentQuarterWindow(now time.Time) (time.Time, time.Time) {
	year := now.Year()
	month := now.Month()
	loc := now.Location()

	var qStart time.Month
	switch {
	case month <= 3:
		qStart = 1 // Q1
	case month <= 6:
		qStart = 4 // Q2
	case month <= 9:
		qStart = 7 // Q3
	default:
		qStart = 10 // Q4
	}

	from := time.Date(year, qStart, 1, 0, 0, 0, 0, loc)
	to := from.AddDate(0, 3, 0) // Add 3 months
	return from, to
}

// quarterOf returns the quarter number (1–4) for a given time.
func quarterOf(t time.Time) int {
	switch {
	case t.Month() <= 3:
		return 1
	case t.Month() <= 6:
		return 2
	case t.Month() <= 9:
		return 3
	default:
		return 4
	}
}
