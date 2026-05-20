package handler

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/FallCatsinSeng/SWU_OSR/backend/internal/domain"
	"github.com/google/uuid"
)

const (
	// MaxBannerSize is the maximum allowed banner file size (10 MB).
	MaxBannerSize = 10 << 20
	// BannerURLPrefix is the URL path prefix where banners are served.
	BannerURLPrefix = "/uploads/banners/"
)

// allowedBannerMIME maps allowed MIME types to file extensions.
var allowedBannerMIME = map[string]string{
	"image/jpeg": ".jpg",
	"image/png":  ".png",
	"image/webp": ".webp",
	"image/gif":  ".gif",
	"video/mp4":  ".mp4",
	"video/webm": ".webm",
}

// BannerHandler handles profile banner upload/delete.
type BannerHandler struct {
	userRepo  domain.UserRepository
	uploadDir string
}

// NewBannerHandler creates a new banner handler. uploadDir must be writable.
func NewBannerHandler(userRepo domain.UserRepository, uploadDir string) *BannerHandler {
	return &BannerHandler{userRepo: userRepo, uploadDir: uploadDir}
}

// HandleUploadBanner handles POST /api/profile/banner (multipart/form-data, field "banner").
// Security: MIME validated from file bytes, random filename, old file deleted immediately.
func (h *BannerHandler) HandleUploadBanner(w http.ResponseWriter, r *http.Request) {
	claims, ok := domain.GetUserClaims(r.Context())
	if !ok {
		RespondError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	// Limit body to 10MB + multipart overhead (NOT using the global MaxBodySize)
	r.Body = http.MaxBytesReader(w, r.Body, MaxBannerSize+4096)

	if err := r.ParseMultipartForm(2 << 20); err != nil {
		RespondError(w, http.StatusBadRequest, "file too large or invalid form data (max 10MB)")
		return
	}
	defer r.MultipartForm.RemoveAll()

	file, header, err := r.FormFile("banner")
	if err != nil {
		RespondError(w, http.StatusBadRequest, "banner file is required (field: 'banner')")
		return
	}
	defer file.Close()

	if header.Size == 0 {
		RespondError(w, http.StatusBadRequest, "file is empty")
		return
	}
	if header.Size > MaxBannerSize {
		RespondError(w, http.StatusRequestEntityTooLarge, "file exceeds 10MB limit")
		return
	}

	// Read first 512 bytes to detect actual MIME type (don't trust Content-Type header)
	buf := make([]byte, 512)
	n, err := io.ReadFull(file, buf)
	if err != nil && err != io.ErrUnexpectedEOF {
		RespondError(w, http.StatusBadRequest, "cannot read file")
		return
	}
	buf = buf[:n]

	detected := strings.Split(http.DetectContentType(buf), ";")[0]
	detected = strings.TrimSpace(detected)

	ext, ok := allowedBannerMIME[detected]
	if !ok {
		// For videos, Go's DetectContentType often returns "application/octet-stream"
		// Fall back to declared Content-Type for video/* types only
		declared := strings.Split(header.Header.Get("Content-Type"), ";")[0]
		declared = strings.TrimSpace(declared)
		ext, ok = allowedBannerMIME[declared]
		if !ok || !strings.HasPrefix(declared, "video/") {
			RespondError(w, http.StatusBadRequest, fmt.Sprintf("unsupported file type: %s", detected))
			return
		}
	}

	// Generate cryptographically random filename
	randBytes := make([]byte, 16)
	if _, err := rand.Read(randBytes); err != nil {
		RespondError(w, http.StatusInternalServerError, "internal error")
		return
	}
	filename := hex.EncodeToString(randBytes) + ext
	destPath := filepath.Join(h.uploadDir, filename)

	// Write file to disk
	dest, err := os.OpenFile(destPath, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0644)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to save file")
		return
	}
	defer dest.Close()

	// Write the header bytes we already read
	if _, err := dest.Write(buf); err != nil {
		os.Remove(destPath)
		RespondError(w, http.StatusInternalServerError, "failed to write file")
		return
	}
	// Copy the rest
	if _, err := io.Copy(dest, file); err != nil {
		os.Remove(destPath)
		RespondError(w, http.StatusInternalServerError, "failed to write file")
		return
	}

	// Update user in DB: delete old banner file, set new URL
	newURL := BannerURLPrefix + filename
	if err := h.replaceBanner(r.Context(), claims.UserID, newURL); err != nil {
		os.Remove(destPath)
		RespondError(w, http.StatusInternalServerError, "failed to update profile")
		return
	}

	RespondJSON(w, http.StatusOK, map[string]string{
		"banner_url": newURL,
		"message":    "Banner uploaded successfully",
	})
}

// HandleDeleteBanner handles DELETE /api/profile/banner.
func (h *BannerHandler) HandleDeleteBanner(w http.ResponseWriter, r *http.Request) {
	claims, ok := domain.GetUserClaims(r.Context())
	if !ok {
		RespondError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	user, err := h.userRepo.GetByID(r.Context(), claims.UserID)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to fetch user")
		return
	}

	// Delete old file from disk
	h.deleteFile(user.BannerURL)

	// Clear in DB
	user.BannerURL = ""
	user.UpdatedAt = time.Now()
	if err := h.userRepo.Update(r.Context(), user); err != nil {
		RespondError(w, http.StatusInternalServerError, "failed to update profile")
		return
	}

	RespondJSON(w, http.StatusOK, map[string]string{"message": "Banner removed"})
}

// replaceBanner deletes old banner file and updates user with new URL.
func (h *BannerHandler) replaceBanner(ctx interface {
	Value(any) any
	Done() <-chan struct{}
	Err() error
	Deadline() (time.Time, bool)
}, userID uuid.UUID, newURL string) error {
	user, err := h.userRepo.GetByID(ctx, userID)
	if err != nil {
		return err
	}

	// Delete old file
	h.deleteFile(user.BannerURL)

	// Update DB
	user.BannerURL = newURL
	user.UpdatedAt = time.Now()
	return h.userRepo.Update(ctx, user)
}

// deleteFile removes a banner file from disk given its URL path.
func (h *BannerHandler) deleteFile(urlPath string) {
	if urlPath == "" || !strings.HasPrefix(urlPath, BannerURLPrefix) {
		return
	}
	filename := filepath.Base(urlPath)
	if filename == "." || filename == ".." {
		return
	}
	fullPath := filepath.Join(h.uploadDir, filename)
	os.Remove(fullPath)
}
