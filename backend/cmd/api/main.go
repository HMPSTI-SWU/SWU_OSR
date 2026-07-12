package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/FallCatsinSeng/SWU_OSR/backend/internal/cache"
	"github.com/FallCatsinSeng/SWU_OSR/backend/internal/config"
	"github.com/FallCatsinSeng/SWU_OSR/backend/internal/github"
	"github.com/FallCatsinSeng/SWU_OSR/backend/internal/handler"
	"github.com/FallCatsinSeng/SWU_OSR/backend/internal/metrics"
	mw "github.com/FallCatsinSeng/SWU_OSR/backend/internal/middleware"
	"github.com/FallCatsinSeng/SWU_OSR/backend/internal/repository"
	"github.com/FallCatsinSeng/SWU_OSR/backend/internal/scheduler"
	"github.com/FallCatsinSeng/SWU_OSR/backend/internal/service"
	"github.com/FallCatsinSeng/SWU_OSR/backend/internal/siakad"
	"github.com/FallCatsinSeng/SWU_OSR/backend/internal/upload"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"
)

func main() {
	// Initialize logger
	logger, err := zap.NewProduction()
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to init logger: %v\n", err)
		os.Exit(1)
	}
	defer logger.Sync()

	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		logger.Fatal("failed to load config", zap.Error(err))
	}

	// Connect to PostgreSQL
	// Performance: Explicit pool tuning prevents connection exhaustion under load
	// and avoids stale connections from lingering too long.
	ctx := context.Background()
	poolConfig, err := pgxpool.ParseConfig(cfg.DatabaseURL)
	if err != nil {
		logger.Fatal("failed to parse database URL", zap.Error(err))
	}
	poolConfig.MaxConns = 25
	poolConfig.MinConns = 5
	poolConfig.MaxConnLifetime = 1 * time.Hour
	poolConfig.MaxConnIdleTime = 15 * time.Minute
	poolConfig.HealthCheckPeriod = 30 * time.Second

	pool, err := pgxpool.NewWithConfig(ctx, poolConfig)
	if err != nil {
		logger.Fatal("failed to connect to PostgreSQL", zap.Error(err))
	}
	defer pool.Close()

	if err := pool.Ping(ctx); err != nil {
		logger.Fatal("failed to ping PostgreSQL", zap.Error(err))
	}
	logger.Info("connected to PostgreSQL")

	// Run database migrations
	m, err := migrate.New("file:///migrations", cfg.DatabaseURL)
	if err != nil {
		logger.Fatal("failed to create migrator", zap.Error(err))
	}
	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
		logger.Fatal("failed to run migrations", zap.Error(err))
	}
	logger.Info("database migrations applied")

	// Connect to Redis
	redisOpts, err := redis.ParseURL(cfg.RedisURL)
	if err != nil {
		logger.Fatal("failed to parse Redis URL", zap.Error(err))
	}
	rdb := redis.NewClient(redisOpts)
	defer rdb.Close()

	if err := rdb.Ping(ctx).Err(); err != nil {
		logger.Fatal("failed to ping Redis", zap.Error(err))
	}
	logger.Info("connected to Redis")

	// Initialize repositories
	userRepo := repository.NewUserRepo(pool)
	refreshTokenRepo := repository.NewRefreshTokenRepo(pool)
	showcaseRepo := repository.NewShowcaseRepo(pool)
	activityRepo := repository.NewActivityRepo(pool)
	threadRepo := repository.NewThreadRepo(pool)
	commentRepo := repository.NewCommentRepo(pool)
	notifRepo := repository.NewNotificationRepo(pool)
	leaderboardRepo := repository.NewLeaderboardRepo(pool)
	skillRepo := repository.NewSkillRepo(pool)

	// Initialize external services
	githubSvc := github.NewService(cfg.GitHubClientID, cfg.GitHubClientSecret, cfg.GitHubRedirectURI)
	siakadSvc := siakad.NewService(cfg.SIAKADBaseURL, 30*time.Second)

	// Initialize application services
	encryptionKey := cfg.EncryptionKey
	webhookURL := cfg.WebhookURL
	if webhookURL == "" {
		logger.Fatal("WEBHOOK_URL must be set to the publicly reachable HTTPS URL of /api/webhooks/github")
	}

	authSvc := service.NewAuthService(siakadSvc, githubSvc, userRepo, refreshTokenRepo, rdb, cfg)
	profileSvc := service.NewProfileService(userRepo, showcaseRepo, activityRepo, githubSvc, encryptionKey)
	showcaseSvc := service.NewShowcaseService(showcaseRepo, userRepo, githubSvc, encryptionKey, webhookURL, cfg.WebhookSecret)
	aggregatorSvc := service.NewAggregatorService(activityRepo, userRepo, showcaseRepo, githubSvc, encryptionKey, cfg.WebhookSecret)
	forumSvc := service.NewForumService(threadRepo, commentRepo, notifRepo, showcaseRepo, userRepo, logger)
	leaderboardSvc := service.NewLeaderboardService(leaderboardRepo, logger)
	cachedLeaderboardSvc := cache.NewCachedLeaderboardService(leaderboardSvc, rdb, logger)
	skillSvc := service.NewSkillService(skillRepo)

	// Wire aggregator into showcase for auto-sync on repo add
	showcaseSvc.SetAggregatorService(aggregatorSvc)

	// Initialize banner file storage
	// Files are stored in /data/uploads/banners/ and served at /uploads/banners/
	bannerStorage, err := upload.NewStorage("/data/uploads/banners", "/uploads/banners/")
	if err != nil {
		logger.Fatal("failed to initialize banner storage", zap.Error(err))
	}

	// Initialize handlers
	authHandler := handler.NewAuthHandler(authSvc, cfg.CookieSecure)
	profileHandler := handler.NewProfileHandler(profileSvc, rdb)
	showcaseHandler := handler.NewShowcaseHandler(showcaseSvc)
	aggregatorHandler := handler.NewAggregatorHandler(aggregatorSvc)
	forumHandler := handler.NewForumHandler(forumSvc)
	communityHandler := handler.NewCommunityHandler(pool, rdb)
	leaderboardHandler := handler.NewLeaderboardHandler(cachedLeaderboardSvc)
	bannerHandler := handler.NewBannerHandler(userRepo, bannerStorage)
	adminHandler := handler.NewAdminHandler(pool)
	skillHandler := handler.NewSkillHandler(skillSvc)

	// Initialize Prometheus metrics
	appMetrics := metrics.New()

	// Set up router
	r := chi.NewRouter()

	// Global middleware
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(mw.MaxBodySize(1 << 20)) // 1MB global request body size limit
	r.Use(mw.CORS(cfg.CORSOrigin))
	r.Use(appMetrics.Middleware)

	// Rate limiter (IP-only applied globally)
	rateLimiter := mw.NewRateLimiter(rdb, cfg.RateLimitIP, cfg.RateLimitUser)
	r.Use(rateLimiter.IPMiddleware)

	// Health check
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		handler.RespondJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	// Prometheus metrics endpoint
	// Security: This endpoint should NOT be exposed to the public internet.
	// In production, restrict access via Nginx (allow only internal/monitoring IPs).
	r.Handle("/metrics", metrics.Handler())

	// Serve uploaded banner files (public, no auth required)
	// Security: Only serves from the specific uploads directory; chi.URLParam-based path
	// prevents directory traversal. Content-Type is set by http.FileServer from file content.
	fileServer := http.StripPrefix("/uploads/banners/", http.FileServer(http.Dir("/data/uploads/banners")))
	r.Get("/uploads/banners/*", func(w http.ResponseWriter, r *http.Request) {
		// Security: Prevent directory listing
		if r.URL.Path == "/uploads/banners/" {
			http.NotFound(w, r)
			return
		}
		// Security: Set headers to prevent sniffing and ensure caching
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		fileServer.ServeHTTP(w, r)
	})

	// API route groups
	r.Route("/api", func(r chi.Router) {
		// Public routes (no auth)
		r.Group(func(r chi.Router) {
			r.Get("/profiles/{alias}", profileHandler.HandleGetPublicProfile)
			r.Get("/feed", aggregatorHandler.HandleGetFeed)
			r.Get("/users/{id}/activity", aggregatorHandler.HandleGetUserActivity)
			r.Get("/users/{id}/skills", skillHandler.HandleGetUserSkills)
			r.Get("/repos/{id}", showcaseHandler.HandleGetPublicRepo)
			r.Get("/repos/{id}/activity", aggregatorHandler.HandleGetRepoActivity)
			r.Get("/repos/{id}/threads", forumHandler.HandleListThreads)
			r.Get("/threads/{id}", forumHandler.HandleGetThread)
			r.Get("/skills", skillHandler.HandleListSkills)

			// Performance: Cache-Control headers for stable/slow-changing endpoints
			r.With(mw.CacheControl(60)).Get("/members", profileHandler.HandleListMembers)
			r.With(mw.CacheControl(30)).Get("/stats", communityHandler.HandleGetStats)
			r.With(mw.CacheControl(60)).Get("/repos/popular", communityHandler.HandleGetPopularRepos)
			r.With(mw.CacheControl(60)).Get("/leaderboard", leaderboardHandler.HandleGetLeaderboard)
			r.With(mw.CacheControl(60)).Get("/leaderboard/users/{id}", leaderboardHandler.HandleGetUserSummary)
		})

		// Webhook endpoint (no auth, signature verified internally)
		r.Post("/webhooks/github", aggregatorHandler.HandleWebhook)

		// Auth routes
		r.Route("/auth", func(r chi.Router) {
			r.Post("/siakad-login", authHandler.HandleSIAKADLogin)
			r.Post("/github-callback", authHandler.HandleGitHubCallback)
			r.Post("/refresh", authHandler.HandleRefreshToken)
			r.Group(func(r chi.Router) {
				r.Use(mw.JWTAuth(cfg.JWTSecret))
				r.Post("/logout", authHandler.HandleLogout)
				r.Get("/me", authHandler.HandleGetMe)
			})
		})

		// Protected routes (auth required)
		r.Group(func(r chi.Router) {
			r.Use(mw.JWTAuth(cfg.JWTSecret))
			r.Use(rateLimiter.UserMiddleware)

			r.Put("/profile", profileHandler.HandleUpdateProfile)
			// Banner upload has its own 10MB limit set in the handler, so we
			// override the global 1MB MaxBodySize for this route only.
			r.With(mw.MaxBodySize(upload.MaxBannerSize + 4096)).Post("/profile/banner", bannerHandler.HandleUploadBanner)
			r.Delete("/profile/banner", bannerHandler.HandleDeleteBanner)
			r.Get("/profiles/{alias}/identity", profileHandler.HandleGetRealIdentity)
			r.Get("/repos/available", showcaseHandler.HandleGetAvailableRepos)
			r.Post("/showcase", showcaseHandler.HandleSetShowcase)
			r.Get("/showcase", showcaseHandler.HandleGetShowcase)
			r.Delete("/showcase/{id}", showcaseHandler.HandleRemoveFromShowcase)
			r.Patch("/showcase/{id}", showcaseHandler.HandleUpdateShowcaseRepo)
			r.Post("/activity/sync", aggregatorHandler.HandleSyncActivity)
			r.Post("/repos/{id}/threads", forumHandler.HandleCreateThread)
			r.Post("/threads/{id}/comments", forumHandler.HandleCreateComment)
			r.Get("/notifications", forumHandler.HandleListNotifications)
			r.Put("/notifications/{id}/read", forumHandler.HandleMarkNotificationRead)
			r.Get("/leaderboard/me", leaderboardHandler.HandleGetMyPoints)

			// Skill routes (auth required to add/endorse)
			r.Post("/profile/skills", skillHandler.HandleAddSkill)
			r.Delete("/profile/skills/{skill_id}", skillHandler.HandleRemoveSkill)
			r.Post("/skills/{user_skill_id}/endorse", skillHandler.HandleEndorseSkill)
			r.Delete("/skills/{user_skill_id}/endorse", skillHandler.HandleUnendorseSkill)
		})

		// Admin routes (super_admin only)
		r.Group(func(r chi.Router) {
			r.Use(mw.JWTAuth(cfg.JWTSecret))
			r.Use(mw.RequireSuperAdmin)
			r.Get("/admin/users", adminHandler.HandleListUsers)
			r.Put("/admin/users/{id}/role", adminHandler.HandleUpdateUserRole)
			r.Post("/admin/skills", skillHandler.HandleAdminCreateSkill)
			r.Delete("/admin/skills/{id}", skillHandler.HandleAdminDeleteSkill)
		})
	})

	// Start leaderboard refresh scheduler (every 15 minutes)
	leaderboardScheduler := scheduler.New(leaderboardSvc, logger, 15*time.Minute)
	leaderboardScheduler.SetCacheInvalidator(cachedLeaderboardSvc.(*cache.CachedLeaderboardService))
	leaderboardScheduler.Start()

	// Start HTTP server
	srv := &http.Server{
		Addr:         ":" + cfg.ServerPort,
		Handler:      r,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Graceful shutdown
	done := make(chan os.Signal, 1)
	signal.Notify(done, os.Interrupt, syscall.SIGTERM)

	go func() {
		logger.Info("server starting", zap.String("port", cfg.ServerPort))
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatal("server failed", zap.Error(err))
		}
	}()

	<-done
	logger.Info("server shutting down")

	// Stop background scheduler
	leaderboardScheduler.Stop()

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		logger.Fatal("server shutdown failed", zap.Error(err))
	}

	logger.Info("server stopped gracefully")
}
