package service

import (
	"context"
	"testing"
	"time"

	"github.com/FallCatsinSeng/SWU_OSR/backend/internal/domain"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap"
)

// mockLeaderboardRepo implements domain.LeaderboardRepository for testing.
type mockLeaderboardRepo struct {
	entries                 []domain.LeaderboardEntry
	userPoints             map[uuid.UUID]*domain.UserPointsSummary
	userStreaks             map[uuid.UUID]int
	upsertedPoints         map[uuid.UUID]int
	activeUserIDs          []uuid.UUID
	pushPerRepo            map[uuid.UUID][]domain.RepoEventCount
	prPerRepo              map[uuid.UUID][]domain.RepoEventCount
	mergedPRPerRepo        map[uuid.UUID][]domain.RepoEventCount
	weightedPushPerRepo    map[uuid.UUID][]domain.WeightedRepoEventCount
	weightedMergedPerRepo  map[uuid.UUID][]domain.WeightedRepoEventCount
	anomalyCoeff           map[uuid.UUID]float64
	threadCounts           map[uuid.UUID]int
	commentCounts          map[uuid.UUID]int
	showcaseCounts         map[uuid.UUID]int
	behavioralStats        map[uuid.UUID]*domain.BehavioralStats
}

func newMockLeaderboardRepo() *mockLeaderboardRepo {
	return &mockLeaderboardRepo{
		entries:                []domain.LeaderboardEntry{},
		userPoints:             make(map[uuid.UUID]*domain.UserPointsSummary),
		userStreaks:            make(map[uuid.UUID]int),
		upsertedPoints:        make(map[uuid.UUID]int),
		pushPerRepo:           make(map[uuid.UUID][]domain.RepoEventCount),
		prPerRepo:             make(map[uuid.UUID][]domain.RepoEventCount),
		mergedPRPerRepo:       make(map[uuid.UUID][]domain.RepoEventCount),
		weightedPushPerRepo:   make(map[uuid.UUID][]domain.WeightedRepoEventCount),
		weightedMergedPerRepo: make(map[uuid.UUID][]domain.WeightedRepoEventCount),
		anomalyCoeff:          make(map[uuid.UUID]float64),
		threadCounts:          make(map[uuid.UUID]int),
		commentCounts:         make(map[uuid.UUID]int),
		showcaseCounts:        make(map[uuid.UUID]int),
		behavioralStats:       make(map[uuid.UUID]*domain.BehavioralStats),
	}
}

func (m *mockLeaderboardRepo) GetLeaderboard(_ context.Context, _, _ time.Time, limit, offset int) ([]domain.LeaderboardEntry, error) {
	end := offset + limit
	if end > len(m.entries) {
		end = len(m.entries)
	}
	if offset > len(m.entries) {
		return []domain.LeaderboardEntry{}, nil
	}
	return m.entries[offset:end], nil
}

func (m *mockLeaderboardRepo) GetUserPoints(_ context.Context, userID uuid.UUID, _, _ time.Time) (*domain.UserPointsSummary, error) {
	if summary, ok := m.userPoints[userID]; ok {
		return summary, nil
	}
	return &domain.UserPointsSummary{UserID: userID}, nil
}

func (m *mockLeaderboardRepo) GetUserStreak(_ context.Context, userID uuid.UUID) (int, error) {
	return m.userStreaks[userID], nil
}

func (m *mockLeaderboardRepo) CountUserPushEvents(_ context.Context, userID uuid.UUID, _, _ time.Time) (int, error) {
	return 0, nil
}

func (m *mockLeaderboardRepo) CountUserPREvents(_ context.Context, userID uuid.UUID, _, _ time.Time) (int, error) {
	return 0, nil
}

func (m *mockLeaderboardRepo) CountUserThreads(_ context.Context, userID uuid.UUID, _, _ time.Time) (int, error) {
	return m.threadCounts[userID], nil
}

func (m *mockLeaderboardRepo) CountUserComments(_ context.Context, userID uuid.UUID, _, _ time.Time) (int, error) {
	return m.commentCounts[userID], nil
}

func (m *mockLeaderboardRepo) CountUserShowcaseRepos(_ context.Context, userID uuid.UUID, _, _ time.Time) (int, error) {
	return m.showcaseCounts[userID], nil
}

func (m *mockLeaderboardRepo) CountUserPushEventsPerRepo(_ context.Context, userID uuid.UUID, _, _ time.Time) ([]domain.RepoEventCount, error) {
	return m.pushPerRepo[userID], nil
}

func (m *mockLeaderboardRepo) CountUserPREventsPerRepo(_ context.Context, userID uuid.UUID, _, _ time.Time) ([]domain.RepoEventCount, error) {
	return m.prPerRepo[userID], nil
}

func (m *mockLeaderboardRepo) CountUserMergedPREventsPerRepo(_ context.Context, userID uuid.UUID, _, _ time.Time) ([]domain.RepoEventCount, error) {
	return m.mergedPRPerRepo[userID], nil
}

func (m *mockLeaderboardRepo) CountUserWeightedPushPerRepo(_ context.Context, userID uuid.UUID, _, _ time.Time) ([]domain.WeightedRepoEventCount, error) {
	return m.weightedPushPerRepo[userID], nil
}

func (m *mockLeaderboardRepo) CountUserWeightedMergedPRPerRepo(_ context.Context, userID uuid.UUID, _, _ time.Time) ([]domain.WeightedRepoEventCount, error) {
	return m.weightedMergedPerRepo[userID], nil
}

func (m *mockLeaderboardRepo) GetUserAnomalyCoefficient(_ context.Context, userID uuid.UUID) (float64, error) {
	if coeff, ok := m.anomalyCoeff[userID]; ok {
		return coeff, nil
	}
	return 1.0, nil // default: no penalty
}

func (m *mockLeaderboardRepo) GetUserBehavioralStats(_ context.Context, userID uuid.UUID, _, _ time.Time) (*domain.BehavioralStats, error) {
	if stats, ok := m.behavioralStats[userID]; ok {
		return stats, nil
	}
	return &domain.BehavioralStats{}, nil
}

func (m *mockLeaderboardRepo) GetAllActiveUserIDs(_ context.Context, _, _ time.Time) ([]uuid.UUID, error) {
	return m.activeUserIDs, nil
}

func (m *mockLeaderboardRepo) UpsertPoints(_ context.Context, userID uuid.UUID, _ domain.LeaderboardPeriod, _, _ time.Time, _, _, _, _, totalPts, _ int) error {
	m.upsertedPoints[userID] = totalPts
	return nil
}

func setupLeaderboardService() (*leaderboardService, *mockLeaderboardRepo) {
	repo := newMockLeaderboardRepo()
	svc := NewLeaderboardService(repo, zap.NewNop())
	return svc, repo
}

// --- GetLeaderboard ---

func TestGetLeaderboard_ReturnsPaginatedEntries(t *testing.T) {
	svc, repo := setupLeaderboardService()

	userID1 := uuid.New()
	userID2 := uuid.New()
	repo.entries = []domain.LeaderboardEntry{
		{Rank: 1, UserID: userID1, Alias: "alice", TotalPoints: 100},
		{Rank: 2, UserID: userID2, Alias: "bob", TotalPoints: 80},
	}

	result, err := svc.GetLeaderboard(context.Background(), domain.PeriodQuarterly, 10, 0)

	require.NoError(t, err)
	require.NotNil(t, result)
	assert.Equal(t, domain.PeriodQuarterly, result.Period)
	assert.Len(t, result.Entries, 2)
	assert.Equal(t, "alice", result.Entries[0].Alias)
}

func TestGetLeaderboard_RespectsLimitAndOffset(t *testing.T) {
	svc, repo := setupLeaderboardService()

	for i := 0; i < 5; i++ {
		repo.entries = append(repo.entries, domain.LeaderboardEntry{
			Rank:        i + 1,
			UserID:      uuid.New(),
			TotalPoints: (5 - i) * 10,
		})
	}

	result, err := svc.GetLeaderboard(context.Background(), domain.PeriodAllTime, 2, 1)

	require.NoError(t, err)
	assert.Len(t, result.Entries, 2)
}

func TestGetLeaderboard_EmptyWhenNoEntries(t *testing.T) {
	svc, _ := setupLeaderboardService()

	result, err := svc.GetLeaderboard(context.Background(), domain.PeriodAllTime, 20, 0)

	require.NoError(t, err)
	assert.Empty(t, result.Entries)
}

func TestGetLeaderboard_QuarterlyHasQuarterNumber(t *testing.T) {
	svc, _ := setupLeaderboardService()

	result, err := svc.GetLeaderboard(context.Background(), domain.PeriodQuarterly, 10, 0)

	require.NoError(t, err)
	assert.Greater(t, result.Quarter, 0)
	assert.LessOrEqual(t, result.Quarter, 4)
}

// --- GetUserSummary ---

func TestGetUserSummary_ReturnsPointsWithStreak(t *testing.T) {
	svc, repo := setupLeaderboardService()

	userID := uuid.New()
	repo.userPoints[userID] = &domain.UserPointsSummary{
		UserID:      userID,
		TotalPoints: 45,
	}
	repo.userStreaks[userID] = 10

	summary, err := svc.GetUserSummary(context.Background(), userID, domain.PeriodQuarterly)

	require.NoError(t, err)
	require.NotNil(t, summary)
	assert.Equal(t, 45, summary.TotalPoints)
	assert.Equal(t, 10, summary.StreakDays)
}

func TestGetUserSummary_AllActivePeriods(t *testing.T) {
	svc, _ := setupLeaderboardService()
	userID := uuid.New()

	periods := []domain.LeaderboardPeriod{
		domain.PeriodQuarterly,
		domain.PeriodAllTime,
	}

	for _, period := range periods {
		result, err := svc.GetUserSummary(context.Background(), userID, period)
		require.NoError(t, err, "period: %s", period)
		require.NotNil(t, result, "period: %s", period)
	}
}

// --- periodWindow ---

func TestPeriodWindow_Quarterly_StartsOnFirstOfMonth(t *testing.T) {
	svc, _ := setupLeaderboardService()

	from, to := svc.periodWindow(domain.PeriodQuarterly)

	// Quarter starts on 1st of month
	assert.Equal(t, 1, from.Day())
	// Quarter spans exactly 3 months
	expectedTo := from.AddDate(0, 3, 0)
	assert.Equal(t, expectedTo, to)
}

func TestPeriodWindow_Quarterly_CorrectQuarter(t *testing.T) {
	// Test that the quarter window logic is correct for a known date
	// We test via currentQuarterWindow directly
	q1Start := time.Date(2024, 1, 15, 0, 0, 0, 0, time.UTC)
	from, to := currentQuarterWindow(q1Start)
	assert.Equal(t, time.January, from.Month())
	assert.Equal(t, time.April, to.Month())

	q3Start := time.Date(2024, 8, 20, 0, 0, 0, 0, time.UTC)
	from, to = currentQuarterWindow(q3Start)
	assert.Equal(t, time.July, from.Month())
	assert.Equal(t, time.October, to.Month())
}

func TestPeriodWindow_AllTime_UsesFixedSentinelDates(t *testing.T) {
	svc, _ := setupLeaderboardService()

	from, to := svc.periodWindow(domain.PeriodAllTime)

	// Should use fixed sentinel dates so reads/writes always match
	assert.Equal(t, 2020, from.Year())
	assert.Equal(t, 2099, to.Year())
}

func TestPeriodWindow_DefaultsToQuarterly(t *testing.T) {
	svc, _ := setupLeaderboardService()

	fromDefault, toDefault := svc.periodWindow("")
	fromQuarterly, toQuarterly := svc.periodWindow(domain.PeriodQuarterly)

	assert.Equal(t, fromQuarterly, fromDefault)
	assert.Equal(t, toQuarterly, toDefault)
}

// --- applyCappedCount (anti-gaming logic) ---

func TestApplyCappedCount_CapsPerRepoPushCount(t *testing.T) {
	svc, _ := setupLeaderboardService()

	// User pushed 200 times to one repo (cap is 90/quarter)
	perRepo := []domain.RepoEventCount{
		{RepoID: uuid.New(), Count: 200},
	}

	total := svc.applyCappedCount(perRepo, domain.MaxPushPerRepoPerQuarter)

	// Should be capped at MaxPushPerRepoPerQuarter (90)
	assert.Equal(t, domain.MaxPushPerRepoPerQuarter, total)
}

func TestApplyCappedCount_SumsMultipleRepos(t *testing.T) {
	svc, _ := setupLeaderboardService()

	perRepo := []domain.RepoEventCount{
		{RepoID: uuid.New(), Count: 30},  // under cap
		{RepoID: uuid.New(), Count: 10},  // under cap
		{RepoID: uuid.New(), Count: 200}, // over cap (90)
	}

	total := svc.applyCappedCount(perRepo, domain.MaxPushPerRepoPerQuarter)

	// 30 + 10 + 90 (capped) = 130
	assert.Equal(t, 130, total)
}

// --- capDailyPoints ---

func TestCapDailyPoints_CapsAtMaxDailyLimit(t *testing.T) {
	svc, _ := setupLeaderboardService()

	now := time.Now()
	from := now.AddDate(0, -3, 0) // quarterly window (~90 days)
	to := now

	// 10000 push events, each worth 3 points, but daily cap is 30 pts
	// Max events/day = 30/3 = 10 events/day
	// Total max = 10 * ~90 days
	days := int(to.Sub(from).Hours()/24) + 1
	points := svc.capDailyPoints(10000, domain.PointsPush, from, to)

	maxExpected := (domain.MaxPointsPerDay / domain.PointsPush) * days * domain.PointsPush
	assert.Equal(t, maxExpected, points)
}

func TestCapDailyPoints_AllowsUnderLimit(t *testing.T) {
	svc, _ := setupLeaderboardService()

	now := time.Now()
	from := now.AddDate(0, 0, -6)
	to := now

	// Only 3 pushes at 3 pts each = 9 pts total, well under daily cap
	points := svc.capDailyPoints(3, domain.PointsPush, from, to)

	assert.Equal(t, 9, points)
}

// --- PR points anti-gaming ---

func TestComputePoints_MergedPRScoresHigher(t *testing.T) {
	svc, repo := setupLeaderboardService()

	userID := uuid.New()
	repoID := uuid.New()

	// 5 pushes ke repo 0 stars (multiplier 1.0)
	repo.weightedPushPerRepo[userID] = []domain.WeightedRepoEventCount{
		{RepoID: repoID, Count: 5, Stars: 0},
	}
	// 3 PR merged ke repo 0 stars (multiplier 1.0)
	repo.weightedMergedPerRepo[userID] = []domain.WeightedRepoEventCount{
		{RepoID: repoID, Count: 3, Stars: 0},
	}
	// 5 PR opened
	repo.prPerRepo[userID] = []domain.RepoEventCount{{RepoID: repoID, Count: 5}}
	repo.activeUserIDs = []uuid.UUID{userID}

	err := svc.RefreshLeaderboard(context.Background(), domain.PeriodQuarterly)
	require.NoError(t, err)

	// Expected PR pts: 3*12*1.0 + 5*2 = 36 + 10 = 46
	// Expected push pts: 5*3*1.0 = 15
	// Total = 61
	totalPts := repo.upsertedPoints[userID]
	expectedPR := 3*domain.PointsPRMerged + 5*domain.PointsPROpened
	expectedPush := 5 * domain.PointsPush
	assert.Equal(t, expectedPR+expectedPush, totalPts)
}

func TestComputePoints_HighStarRepoScoresMore(t *testing.T) {
	svc, repo := setupLeaderboardService()

	userID := uuid.New()
	repoID := uuid.New()

	// 5 pushes ke repo dengan 500 stars (multiplier 3.0)
	repo.weightedPushPerRepo[userID] = []domain.WeightedRepoEventCount{
		{RepoID: repoID, Count: 5, Stars: 500},
	}
	repo.activeUserIDs = []uuid.UUID{userID}

	err := svc.RefreshLeaderboard(context.Background(), domain.PeriodQuarterly)
	require.NoError(t, err)

	// 5 pushes × 3 pts × 3.0 multiplier = 45 pts
	totalPts := repo.upsertedPoints[userID]
	assert.Equal(t, int(float64(5*domain.PointsPush)*domain.StarMultiplier(500)), totalPts)
}

func TestComputePoints_AnomalyPenaltyApplied(t *testing.T) {
	svc, repo := setupLeaderboardService()

	userID := uuid.New()
	repoID := uuid.New()

	repo.weightedPushPerRepo[userID] = []domain.WeightedRepoEventCount{
		{RepoID: repoID, Count: 10, Stars: 0},
	}
	repo.activeUserIDs = []uuid.UUID{userID}
	// Simulasi anomaly: hanya 50% poin yang dihitung
	repo.anomalyCoeff[userID] = 0.5

	err := svc.RefreshLeaderboard(context.Background(), domain.PeriodQuarterly)
	require.NoError(t, err)

	// 10 pushes × 3 pts × 1.0 multiplier × 0.5 anomaly = 15 pts
	totalPts := repo.upsertedPoints[userID]
	assert.Equal(t, 15, totalPts)
}
