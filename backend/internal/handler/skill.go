package handler

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/FallCatsinSeng/SWU_OSR/backend/internal/domain"
	"github.com/FallCatsinSeng/SWU_OSR/backend/internal/service"
)

// SkillHandler handles skill-related HTTP requests.
type SkillHandler struct {
	skillSvc service.SkillService
}

// NewSkillHandler creates a new skill handler.
func NewSkillHandler(skillSvc service.SkillService) *SkillHandler {
	return &SkillHandler{skillSvc: skillSvc}
}

// ── Public Endpoints ───────────────────────────────────────────────────────────

// HandleListSkills handles GET /api/skills
// Returns all skills in the master list.
func (h *SkillHandler) HandleListSkills(w http.ResponseWriter, r *http.Request) {
	skills, err := h.skillSvc.ListSkills(r.Context())
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to list skills")
		return
	}
	if skills == nil {
		skills = []domain.Skill{}
	}
	RespondJSON(w, http.StatusOK, skills)
}

// HandleGetUserSkills handles GET /api/profiles/{alias}/skills
// Returns skills for a given user. If the caller is authenticated, "is_endorsed_by_me" is set.
// Note: alias → userID resolution is done via the profile service at the main.go level.
// We receive the userID directly from the route param.
func (h *SkillHandler) HandleGetUserSkills(w http.ResponseWriter, r *http.Request) {
	userIDStr := chi.URLParam(r, "id")
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		RespondError(w, http.StatusBadRequest, "invalid user id")
		return
	}

	var currentUserID *uuid.UUID
	if claims, ok := domain.GetUserClaims(r.Context()); ok {
		id := claims.UserID
		currentUserID = &id
	}

	skills, err := h.skillSvc.GetUserSkills(r.Context(), userID, currentUserID)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to fetch skills")
		return
	}
	if skills == nil {
		skills = []domain.UserSkill{}
	}
	RespondJSON(w, http.StatusOK, skills)
}

// ── Authenticated Endpoints ───────────────────────────────────────────────────

type addSkillRequest struct {
	SkillID string `json:"skill_id"`
}

// HandleAddSkill handles POST /api/profile/skills
func (h *SkillHandler) HandleAddSkill(w http.ResponseWriter, r *http.Request) {
	claims, ok := domain.GetUserClaims(r.Context())
	if !ok {
		RespondError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	var req addSkillRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	skillID, err := uuid.Parse(req.SkillID)
	if err != nil {
		RespondError(w, http.StatusBadRequest, "invalid skill_id")
		return
	}

	userSkill, err := h.skillSvc.AddSkillToProfile(r.Context(), claims.UserID, skillID)
	if err != nil {
		switch {
		case errors.Is(err, domain.ErrNotFound):
			RespondError(w, http.StatusNotFound, "skill not found")
		case errors.Is(err, domain.ErrForbidden):
			RespondError(w, http.StatusForbidden, err.Error())
		default:
			RespondError(w, http.StatusInternalServerError, "failed to add skill")
		}
		return
	}

	RespondJSON(w, http.StatusCreated, userSkill)
}

// HandleRemoveSkill handles DELETE /api/profile/skills/{skill_id}
func (h *SkillHandler) HandleRemoveSkill(w http.ResponseWriter, r *http.Request) {
	claims, ok := domain.GetUserClaims(r.Context())
	if !ok {
		RespondError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	skillIDStr := chi.URLParam(r, "skill_id")
	skillID, err := uuid.Parse(skillIDStr)
	if err != nil {
		RespondError(w, http.StatusBadRequest, "invalid skill_id")
		return
	}

	if err := h.skillSvc.RemoveSkillFromProfile(r.Context(), claims.UserID, skillID); err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			RespondError(w, http.StatusNotFound, "skill not found on your profile")
			return
		}
		RespondError(w, http.StatusInternalServerError, "failed to remove skill")
		return
	}

	RespondJSON(w, http.StatusOK, map[string]string{"message": "skill removed"})
}

// HandleEndorseSkill handles POST /api/skills/{user_skill_id}/endorse
func (h *SkillHandler) HandleEndorseSkill(w http.ResponseWriter, r *http.Request) {
	claims, ok := domain.GetUserClaims(r.Context())
	if !ok {
		RespondError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	userSkillIDStr := chi.URLParam(r, "user_skill_id")
	userSkillID, err := uuid.Parse(userSkillIDStr)
	if err != nil {
		RespondError(w, http.StatusBadRequest, "invalid user_skill_id")
		return
	}

	us, err := h.skillSvc.EndorseSkill(r.Context(), userSkillID, claims.UserID)
	if err != nil {
		switch {
		case errors.Is(err, domain.ErrNotFound):
			RespondError(w, http.StatusNotFound, "skill not found")
		case errors.Is(err, domain.ErrForbidden):
			RespondError(w, http.StatusForbidden, "cannot endorse your own skill")
		default:
			RespondError(w, http.StatusConflict, "already endorsed or error occurred")
		}
		return
	}

	RespondJSON(w, http.StatusOK, us)
}

// HandleUnendorseSkill handles DELETE /api/skills/{user_skill_id}/endorse
func (h *SkillHandler) HandleUnendorseSkill(w http.ResponseWriter, r *http.Request) {
	claims, ok := domain.GetUserClaims(r.Context())
	if !ok {
		RespondError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	userSkillIDStr := chi.URLParam(r, "user_skill_id")
	userSkillID, err := uuid.Parse(userSkillIDStr)
	if err != nil {
		RespondError(w, http.StatusBadRequest, "invalid user_skill_id")
		return
	}

	if err := h.skillSvc.UnendorseSkill(r.Context(), userSkillID, claims.UserID); err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			RespondError(w, http.StatusNotFound, "endorsement not found")
			return
		}
		RespondError(w, http.StatusInternalServerError, "failed to remove endorsement")
		return
	}

	RespondJSON(w, http.StatusOK, map[string]string{"message": "endorsement removed"})
}

// ── Admin Endpoints ───────────────────────────────────────────────────────────

type createSkillRequest struct {
	Name     string `json:"name"`
	Category string `json:"category"`
}

// HandleAdminCreateSkill handles POST /api/admin/skills
func (h *SkillHandler) HandleAdminCreateSkill(w http.ResponseWriter, r *http.Request) {
	var req createSkillRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	skill, err := h.skillSvc.CreateSkill(r.Context(), req.Name, req.Category)
	if err != nil {
		RespondError(w, http.StatusBadRequest, err.Error())
		return
	}

	RespondJSON(w, http.StatusCreated, skill)
}

// HandleAdminDeleteSkill handles DELETE /api/admin/skills/{id}
func (h *SkillHandler) HandleAdminDeleteSkill(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	skillID, err := uuid.Parse(idStr)
	if err != nil {
		RespondError(w, http.StatusBadRequest, "invalid skill id")
		return
	}

	if err := h.skillSvc.DeleteSkill(r.Context(), skillID); err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			RespondError(w, http.StatusNotFound, "skill not found")
			return
		}
		RespondError(w, http.StatusInternalServerError, "failed to delete skill")
		return
	}

	RespondJSON(w, http.StatusOK, map[string]string{"message": "skill deleted"})
}
