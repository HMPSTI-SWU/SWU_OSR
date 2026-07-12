package handler

import (
	"net/http"
	"strconv"

	"github.com/FallCatsinSeng/SWU_OSR/backend/internal/domain"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

// LeaderboardHandler handles leaderboard HTTP requests.
type LeaderboardHandler struct {
	svc domain.LeaderboardService
}

// NewLeaderboardHandler creates a new leaderboard handler.
func NewLeaderboardHandler(svc domain.LeaderboardService) *LeaderboardHandler {
	return &LeaderboardHandler{svc: svc}
}

// HandleGetLeaderboard handles GET /api/leaderboard?period=quarterly&limit=20&offset=0
func (h *LeaderboardHandler) HandleGetLeaderboard(w http.ResponseWriter, r *http.Request) {
	period := parsePeriod(r.URL.Query().Get("period"))
	limit := parseIntParam(r.URL.Query().Get("limit"), 20)
	offset := parseIntParam(r.URL.Query().Get("offset"), 0)

	// Clamp limit
	if limit < 1 {
		limit = 1
	}
	if limit > 100 {
		limit = 100
	}
	if offset < 0 {
		offset = 0
	}

	result, err := h.svc.GetLeaderboard(r.Context(), period, limit, offset)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to fetch leaderboard")
		return
	}

	RespondJSON(w, http.StatusOK, result)
}

// HandleGetUserSummary handles GET /api/leaderboard/users/{id}?period=weekly
func (h *LeaderboardHandler) HandleGetUserSummary(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	userID, err := uuid.Parse(idStr)
	if err != nil {
		RespondError(w, http.StatusBadRequest, "invalid user ID")
		return
	}

	period := parsePeriod(r.URL.Query().Get("period"))

	summary, err := h.svc.GetUserSummary(r.Context(), userID, period)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to fetch user summary")
		return
	}

	RespondJSON(w, http.StatusOK, summary)
}

// HandleGetMyPoints handles GET /api/leaderboard/me?period=weekly (authenticated)
func (h *LeaderboardHandler) HandleGetMyPoints(w http.ResponseWriter, r *http.Request) {
	claims, ok := domain.GetUserClaims(r.Context())
	if !ok {
		RespondError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	period := parsePeriod(r.URL.Query().Get("period"))

	summary, err := h.svc.GetUserSummary(r.Context(), claims.UserID, period)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to fetch your points")
		return
	}

	RespondJSON(w, http.StatusOK, summary)
}

// parsePeriod converts a string to a LeaderboardPeriod, defaulting to quarterly.
func parsePeriod(s string) domain.LeaderboardPeriod {
	switch s {
	case "quarterly":
		return domain.PeriodQuarterly
	case "all_time":
		return domain.PeriodAllTime
	default:
		return domain.PeriodQuarterly
	}
}

// parseIntParam parses an integer query parameter with a default value.
func parseIntParam(s string, defaultVal int) int {
	if s == "" {
		return defaultVal
	}
	v, err := strconv.Atoi(s)
	if err != nil {
		return defaultVal
	}
	return v
}
