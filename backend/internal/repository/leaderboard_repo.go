package repository

import (
	"context"
	"errors"
	"time"

	"github.com/FallCatsinSeng/SWU_OSR/backend/internal/domain"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// LeaderboardRepo implements domain.LeaderboardRepository using pgxpool.
type LeaderboardRepo struct {
	pool *pgxpool.Pool
}

// NewLeaderboardRepo creates a new leaderboard repository.
func NewLeaderboardRepo(pool *pgxpool.Pool) domain.LeaderboardRepository {
	return &LeaderboardRepo{pool: pool}
}

// GetLeaderboard retrieves ranked users for a given time window.
func (r *LeaderboardRepo) GetLeaderboard(ctx context.Context, from, to time.Time, limit, offset int) ([]domain.LeaderboardEntry, error) {
	query := `
		SELECT 
			lp.user_id,
			u.alias,
			u.avatar_url,
			lp.push_points,
			lp.pr_points,
			lp.forum_points,
			lp.other_points,
			lp.total_points,
			lp.streak_days
		FROM leaderboard_points lp
		JOIN users u ON lp.user_id = u.id
		WHERE lp.period_start = $1 AND lp.period_end = $2
		ORDER BY lp.total_points DESC, u.alias ASC
		LIMIT $3 OFFSET $4`

	rows, err := r.pool.Query(ctx, query, from, to, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var entries []domain.LeaderboardEntry
	rank := offset + 1
	for rows.Next() {
		var entry domain.LeaderboardEntry
		if err := rows.Scan(
			&entry.UserID,
			&entry.Alias,
			&entry.AvatarURL,
			&entry.PushPoints,
			&entry.PRPoints,
			&entry.ForumPoints,
			&entry.OtherPoints,
			&entry.TotalPoints,
			&entry.StreakDays,
		); err != nil {
			return nil, err
		}
		entry.Rank = rank
		rank++
		entries = append(entries, entry)
	}

	if entries == nil {
		entries = []domain.LeaderboardEntry{}
	}
	return entries, rows.Err()
}

// GetUserPoints retrieves a single user's points summary for a given time window.
func (r *LeaderboardRepo) GetUserPoints(ctx context.Context, userID uuid.UUID, from, to time.Time) (*domain.UserPointsSummary, error) {
	query := `
		SELECT 
			lp.user_id,
			lp.push_points,
			lp.pr_points,
			lp.forum_points,
			lp.other_points,
			lp.total_points,
			lp.streak_days
		FROM leaderboard_points lp
		WHERE lp.user_id = $1 AND lp.period_start = $2 AND lp.period_end = $3`

	var summary domain.UserPointsSummary
	var pushPts, prPts, forumPts, otherPts int
	err := r.pool.QueryRow(ctx, query, userID, from, to).Scan(
		&summary.UserID,
		&pushPts,
		&prPts,
		&forumPts,
		&otherPts,
		&summary.TotalPoints,
		&summary.StreakDays,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			// User has no points for this period — return zeroes
			return &domain.UserPointsSummary{UserID: userID}, nil
		}
		return nil, err
	}

	// Derive counts from points using the point constants
	if domain.PointsPush > 0 {
		summary.PushCount = pushPts / domain.PointsPush
	}
	if domain.PointsPRMerged > 0 {
		summary.PRCount = prPts / domain.PointsPRMerged
	}
	// Forum points are mixed (threads=2, comments=1), store raw for now
	summary.ThreadCount = 0
	summary.CommentCnt = 0

	// Get rank
	rankQuery := `
		SELECT COUNT(*) + 1 
		FROM leaderboard_points 
		WHERE period_start = $1 AND period_end = $2 AND total_points > $3`
	err = r.pool.QueryRow(ctx, rankQuery, from, to, summary.TotalPoints).Scan(&summary.Rank)
	if err != nil {
		summary.Rank = 0
	}

	return &summary, nil
}

// GetUserStreak returns the current consecutive active days for a user.
func (r *LeaderboardRepo) GetUserStreak(ctx context.Context, userID uuid.UUID) (int, error) {
	// Look back up to 90 days for streak calculation
	since := time.Now().AddDate(0, 0, -90)

	query := `
		SELECT DISTINCT DATE(created_at) AS active_date
		FROM activity_logs
		WHERE user_id = $1 AND created_at >= $2
		ORDER BY active_date DESC`

	rows, err := r.pool.Query(ctx, query, userID, since)
	if err != nil {
		return 0, err
	}
	defer rows.Close()

	var dates []time.Time
	for rows.Next() {
		var d time.Time
		if err := rows.Scan(&d); err != nil {
			return 0, err
		}
		dates = append(dates, d)
	}
	if err := rows.Err(); err != nil {
		return 0, err
	}

	if len(dates) == 0 {
		return 0, nil
	}

	// Count consecutive days starting from today/yesterday
	today := time.Now().Truncate(24 * time.Hour)
	streak := 0

	for i, d := range dates {
		expected := today.AddDate(0, 0, -i)
		if d.Equal(expected) {
			streak++
		} else if i == 0 && d.Equal(today.AddDate(0, 0, -1)) {
			// First entry is yesterday (user hasn't been active today yet)
			streak++
			today = today.AddDate(0, 0, -1)
		} else {
			break
		}
	}

	return streak, nil
}

// CountUserPushEvents counts push events for a user within a time range.
func (r *LeaderboardRepo) CountUserPushEvents(ctx context.Context, userID uuid.UUID, from, to time.Time) (int, error) {
	var count int
	err := r.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM activity_logs WHERE user_id = $1 AND event_type = 'push' AND created_at >= $2 AND created_at < $3`,
		userID, from, to,
	).Scan(&count)
	return count, err
}

// CountUserPREvents counts pull_request events for a user within a time range.
func (r *LeaderboardRepo) CountUserPREvents(ctx context.Context, userID uuid.UUID, from, to time.Time) (int, error) {
	var count int
	err := r.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM activity_logs WHERE user_id = $1 AND event_type = 'pull_request' AND created_at >= $2 AND created_at < $3`,
		userID, from, to,
	).Scan(&count)
	return count, err
}

// CountUserPushEventsPerRepo returns push event counts grouped by showcase_repo_id for a user within a time range.
// This is used to apply per-repo quarterly caps to prevent gaming.
func (r *LeaderboardRepo) CountUserPushEventsPerRepo(ctx context.Context, userID uuid.UUID, from, to time.Time) ([]domain.RepoEventCount, error) {
	query := `
		SELECT showcase_repo_id, COUNT(*) AS cnt
		FROM activity_logs
		WHERE user_id = $1 AND event_type = 'push' AND created_at >= $2 AND created_at < $3
		  AND showcase_repo_id IS NOT NULL
		GROUP BY showcase_repo_id`

	rows, err := r.pool.Query(ctx, query, userID, from, to)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []domain.RepoEventCount
	for rows.Next() {
		var rc domain.RepoEventCount
		if err := rows.Scan(&rc.RepoID, &rc.Count); err != nil {
			return nil, err
		}
		results = append(results, rc)
	}
	if results == nil {
		results = []domain.RepoEventCount{}
	}
	return results, rows.Err()
}

// CountUserPREventsPerRepo returns PR event counts grouped by showcase_repo_id for a user within a time range.
// This is used to apply per-repo quarterly caps to prevent gaming.
func (r *LeaderboardRepo) CountUserPREventsPerRepo(ctx context.Context, userID uuid.UUID, from, to time.Time) ([]domain.RepoEventCount, error) {
	query := `
		SELECT showcase_repo_id, COUNT(*) AS cnt
		FROM activity_logs
		WHERE user_id = $1 AND event_type = 'pull_request' AND created_at >= $2 AND created_at < $3
		  AND showcase_repo_id IS NOT NULL
		GROUP BY showcase_repo_id`

	rows, err := r.pool.Query(ctx, query, userID, from, to)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []domain.RepoEventCount
	for rows.Next() {
		var rc domain.RepoEventCount
		if err := rows.Scan(&rc.RepoID, &rc.Count); err != nil {
			return nil, err
		}
		results = append(results, rc)
	}
	if results == nil {
		results = []domain.RepoEventCount{}
	}
	return results, rows.Err()
}

// CountUserMergedPREventsPerRepo returns per-repo counts of PRs that were merged.
// A PR is considered merged when: event_type='pull_request' AND metadata->>'action'='closed'
// AND (metadata->>'merged'='true' OR metadata->>'merged' IS inferred from GitHub payload).
// We check for action='closed' as the main filter since webhooks send 'closed' for merges.
func (r *LeaderboardRepo) CountUserMergedPREventsPerRepo(ctx context.Context, userID uuid.UUID, from, to time.Time) ([]domain.RepoEventCount, error) {
	query := `
		SELECT showcase_repo_id, COUNT(*) AS cnt
		FROM activity_logs
		WHERE user_id = $1
		  AND event_type = 'pull_request'
		  AND created_at >= $2 AND created_at < $3
		  AND showcase_repo_id IS NOT NULL
		  AND (
		    metadata->>'action' = 'closed'
		    OR metadata->>'merged' = 'true'
		  )
		GROUP BY showcase_repo_id`

	rows, err := r.pool.Query(ctx, query, userID, from, to)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []domain.RepoEventCount
	for rows.Next() {
		var rc domain.RepoEventCount
		if err := rows.Scan(&rc.RepoID, &rc.Count); err != nil {
			return nil, err
		}
		results = append(results, rc)
	}
	if results == nil {
		results = []domain.RepoEventCount{}
	}
	return results, rows.Err()
}

// CountUserWeightedPushPerRepo returns push counts per repo WITH star count from metadata.
// The star count is read from metadata->>'repo_stars' (stored by aggregator on each webhook).
// Legacy rows without repo_stars default to 0 stars → multiplier = 1.0 (backward compatible).
func (r *LeaderboardRepo) CountUserWeightedPushPerRepo(ctx context.Context, userID uuid.UUID, from, to time.Time) ([]domain.WeightedRepoEventCount, error) {
	query := `
		SELECT
			showcase_repo_id,
			COUNT(*) AS cnt,
			-- Ambil nilai stars tertinggi dari grup repo ini (lebih akurat dari rata-rata)
			MAX(COALESCE(NULLIF(metadata->>'repo_stars', '')::int, 0)) AS repo_stars
		FROM activity_logs
		WHERE user_id = $1
		  AND event_type = 'push'
		  AND created_at >= $2 AND created_at < $3
		  AND showcase_repo_id IS NOT NULL
		GROUP BY showcase_repo_id`

	rows, err := r.pool.Query(ctx, query, userID, from, to)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []domain.WeightedRepoEventCount
	for rows.Next() {
		var wrc domain.WeightedRepoEventCount
		if err := rows.Scan(&wrc.RepoID, &wrc.Count, &wrc.Stars); err != nil {
			return nil, err
		}
		results = append(results, wrc)
	}
	if results == nil {
		results = []domain.WeightedRepoEventCount{}
	}
	return results, rows.Err()
}

// CountUserWeightedMergedPRPerRepo returns merged PR counts per repo WITH star count from metadata.
func (r *LeaderboardRepo) CountUserWeightedMergedPRPerRepo(ctx context.Context, userID uuid.UUID, from, to time.Time) ([]domain.WeightedRepoEventCount, error) {
	query := `
		SELECT
			showcase_repo_id,
			COUNT(*) AS cnt,
			MAX(COALESCE(NULLIF(metadata->>'repo_stars', '')::int, 0)) AS repo_stars
		FROM activity_logs
		WHERE user_id = $1
		  AND event_type = 'pull_request'
		  AND created_at >= $2 AND created_at < $3
		  AND showcase_repo_id IS NOT NULL
		  AND (
		    metadata->>'action' = 'closed'
		    OR metadata->>'merged' = 'true'
		  )
		GROUP BY showcase_repo_id`

	rows, err := r.pool.Query(ctx, query, userID, from, to)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []domain.WeightedRepoEventCount
	for rows.Next() {
		var wrc domain.WeightedRepoEventCount
		if err := rows.Scan(&wrc.RepoID, &wrc.Count, &wrc.Stars); err != nil {
			return nil, err
		}
		results = append(results, wrc)
	}
	if results == nil {
		results = []domain.WeightedRepoEventCount{}
	}
	return results, rows.Err()
}

// GetUserAnomalyCoefficient menggunakan Z-Score berbasis PostgreSQL untuk mendeteksi burst activity.
//
// Algoritma:
//  1. Hitung rata-rata (avg) dan standar deviasi (stddev) push harian dari 30 hari terakhir (exclude hari ini)
//  2. Hitung jumlah push hari ini
//  3. Jika push_hari_ini > avg + 2*stddev → aktivitas anomali → terapkan penalti
//
// Rumus penalti: coeff = max(0.1, 1 - (excess/today) * 0.5)
// Contoh: avg=5, stddev=2, threshold=9, hari_ini=50
//   excess = 50-9 = 41, ratio = 41/50 = 0.82
//   coeff = max(0.1, 1 - 0.82*0.5) = 0.59 → poin dikali 0.59
//
// Returns 1.0 (tidak ada penalti) jika:
// - Data historis < 7 hari (user baru, belum cukup data)
// - stddev = 0 (aktivitas sangat konsisten, bukan anomali)
// - Aktivitas hari ini normal
func (r *LeaderboardRepo) GetUserAnomalyCoefficient(ctx context.Context, userID uuid.UUID) (float64, error) {
	query := `
		WITH daily_counts AS (
			SELECT
				DATE(created_at) AS day,
				COUNT(*)         AS cnt
			FROM activity_logs
			WHERE user_id = $1
			  AND event_type = 'push'
			  AND created_at >= NOW() - INTERVAL '31 days'
			GROUP BY DATE(created_at)
		),
		historical AS (
			-- Gunakan data 30 hari KECUALI hari ini untuk menghitung baseline
			SELECT
				COUNT(*)            AS day_count,
				COALESCE(AVG(cnt), 0)    AS avg_daily,
				COALESCE(STDDEV(cnt), 0) AS stddev_daily
			FROM daily_counts
			WHERE day < CURRENT_DATE
		),
		today AS (
			SELECT COALESCE(SUM(cnt), 0) AS today_count
			FROM daily_counts
			WHERE day = CURRENT_DATE
		)
		SELECT
			historical.day_count,
			historical.avg_daily,
			historical.stddev_daily,
			today.today_count
		FROM historical, today`

	var dayCount int
	var avgDaily, stddevDaily float64
	var todayCount int

	err := r.pool.QueryRow(ctx, query, userID).Scan(
		&dayCount, &avgDaily, &stddevDaily, &todayCount,
	)
	if err != nil {
		// Jika query gagal, kembalikan 1.0 (tidak ada penalti) — fail-open
		return 1.0, nil
	}

	// Tidak cukup data historis → tidak terapkan penalti
	if dayCount < 7 {
		return 1.0, nil
	}

	// stddev = 0 berarti aktivitas sangat konsisten → tidak anomali
	if stddevDaily == 0 {
		return 1.0, nil
	}

	threshold := avgDaily + 2*stddevDaily
	if float64(todayCount) <= threshold {
		return 1.0, nil // Normal, tidak ada penalti
	}

	// Hitung excess dan koefisien penalti
	excess := float64(todayCount) - threshold
	excessRatio := excess / float64(todayCount)
	coeff := 1.0 - excessRatio*0.5

	// Floor: tidak boleh kurang dari 0.1 (minimal 10% poin tetap dihitung)
	if coeff < 0.1 {
		coeff = 0.1
	}

	return coeff, nil
}

// GetUserBehavioralStats returns timing-based activity statistics for badge calculation.
// Uses the EXTRACT function to determine the local server hour and day-of-week.
func (r *LeaderboardRepo) GetUserBehavioralStats(ctx context.Context, userID uuid.UUID, from, to time.Time) (*domain.BehavioralStats, error) {
	query := `
		SELECT
			COUNT(*) FILTER (WHERE EXTRACT(HOUR FROM created_at) >= 0 AND EXTRACT(HOUR FROM created_at) < 4)  AS night_owl_count,
			COUNT(*) FILTER (WHERE EXTRACT(HOUR FROM created_at) >= 4 AND EXTRACT(HOUR FROM created_at) < 7)  AS early_bird_count,
			COUNT(*) FILTER (WHERE EXTRACT(DOW FROM created_at) IN (0, 6))                                     AS weekend_count,
			COUNT(*)                                                                                            AS total_count
		FROM activity_logs
		WHERE user_id = $1
		  AND event_type = 'push'
		  AND created_at >= $2 AND created_at < $3`

	var stats domain.BehavioralStats
	err := r.pool.QueryRow(ctx, query, userID, from, to).Scan(
		&stats.NightOwlCount,
		&stats.EarlyBirdCount,
		&stats.WeekendCount,
		&stats.TotalActivityCount,
	)
	if err != nil {
		return &domain.BehavioralStats{}, nil
	}

	// Get total forum activity
	forumQuery := `
		SELECT 
			(SELECT COUNT(*) FROM threads WHERE author_id = $1 AND created_at >= $2 AND created_at < $3 AND deleted_at IS NULL)
			+ (SELECT COUNT(*) FROM comments WHERE author_id = $1 AND created_at >= $2 AND created_at < $3 AND deleted_at IS NULL)
			AS forum_total`
	err = r.pool.QueryRow(ctx, forumQuery, userID, from, to).Scan(&stats.ForumTotal)
	if err != nil {
		stats.ForumTotal = 0
	}

	return &stats, nil
}

// CountUserThreads counts threads created by a user within a time range.
func (r *LeaderboardRepo) CountUserThreads(ctx context.Context, userID uuid.UUID, from, to time.Time) (int, error) {
	var count int
	err := r.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM threads WHERE author_id = $1 AND created_at >= $2 AND created_at < $3 AND deleted_at IS NULL`,
		userID, from, to,
	).Scan(&count)
	return count, err
}

// CountUserComments counts comments posted by a user within a time range.
func (r *LeaderboardRepo) CountUserComments(ctx context.Context, userID uuid.UUID, from, to time.Time) (int, error) {
	var count int
	err := r.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM comments WHERE author_id = $1 AND created_at >= $2 AND created_at < $3 AND deleted_at IS NULL`,
		userID, from, to,
	).Scan(&count)
	return count, err
}

// CountUserShowcaseRepos counts showcase repos added by a user within a time range.
func (r *LeaderboardRepo) CountUserShowcaseRepos(ctx context.Context, userID uuid.UUID, from, to time.Time) (int, error) {
	var count int
	err := r.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM showcase_repos WHERE user_id = $1 AND created_at >= $2 AND created_at < $3 AND deleted_at IS NULL`,
		userID, from, to,
	).Scan(&count)
	return count, err
}

// GetAllActiveUserIDs returns all user IDs that have any activity in the given time range.
func (r *LeaderboardRepo) GetAllActiveUserIDs(ctx context.Context, from, to time.Time) ([]uuid.UUID, error) {
	query := `
		SELECT DISTINCT user_id FROM activity_logs
		WHERE created_at >= $1 AND created_at < $2
		UNION
		SELECT DISTINCT author_id FROM threads
		WHERE created_at >= $1 AND created_at < $2 AND deleted_at IS NULL
		UNION
		SELECT DISTINCT author_id FROM comments
		WHERE created_at >= $1 AND created_at < $2 AND deleted_at IS NULL
		UNION
		SELECT DISTINCT user_id FROM showcase_repos
		WHERE created_at >= $1 AND created_at < $2 AND deleted_at IS NULL`

	rows, err := r.pool.Query(ctx, query, from, to)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var ids []uuid.UUID
	for rows.Next() {
		var id uuid.UUID
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	if ids == nil {
		ids = []uuid.UUID{}
	}
	return ids, rows.Err()
}

// UpsertPoints inserts or updates leaderboard points for a user in a given period.
func (r *LeaderboardRepo) UpsertPoints(ctx context.Context, userID uuid.UUID, period domain.LeaderboardPeriod, from, to time.Time, pushPts, prPts, forumPts, otherPts, totalPts, streakDays int) error {
	query := `
		INSERT INTO leaderboard_points (
			user_id, period, period_start, period_end,
			push_points, pr_points, forum_points, other_points,
			total_points, streak_days, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
		ON CONFLICT (user_id, period, period_start)
		DO UPDATE SET
			period_end = EXCLUDED.period_end,
			push_points = EXCLUDED.push_points,
			pr_points = EXCLUDED.pr_points,
			forum_points = EXCLUDED.forum_points,
			other_points = EXCLUDED.other_points,
			total_points = EXCLUDED.total_points,
			streak_days = EXCLUDED.streak_days,
			updated_at = NOW()`

	_, err := r.pool.Exec(ctx, query,
		userID, string(period), from, to,
		pushPts, prPts, forumPts, otherPts, totalPts, streakDays,
	)
	return err
}
