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
	mw "github.com/FallCatsinSeng/SWU_OSR/backend/internal/middleware"
	"github.com/FallCatsinSeng/SWU_OSR/backend/internal/repository"
	"github.com/FallCatsinSeng/SWU_OSR/backend/internal/scheduler"
	"github.com/FallCatsinSeng/SWU_OSR/backend/internal/service"
	"github.com/FallCatsinSeng/SWU_OSR/backend/internal/siakad"
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
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, cfg.DatabaseURL)
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

	// Initialize external services
	githubSvc := github.NewService(cfg.GitHubClientID, cfg.GitHubClientSecret, cfg.GitHubRedirectURI)
	siakadSvc := siakad.NewService(cfg.SIAKADBaseURL, 30*time.Second)

	// Initialize application services
	encryptionKey := cfg.EncryptionKey
	webhookURL := fmt.Sprintf("https://api.example.com/api/webhooks/github") // configured via env in production

	authSvc := service.NewAuthService(siakadSvc, githubSvc, userRepo, refreshTokenRepo, rdb, cfg)
	profileSvc := service.NewProfileService(userRepo, showcaseRepo, activityRepo, githubSvc, encryptionKey)
	showcaseSvc := service.NewShowcaseService(showcaseRepo, userRepo, githubSvc, encryptionKey, webhookURL, cfg.WebhookSecret)
	aggregatorSvc := service.NewAggregatorService(activityRepo, userRepo, showcaseRepo, githubSvc, encryptionKey, cfg.WebhookSecret)
	forumSvc := service.NewForumService(threadRepo, commentRepo, notifRepo, showcaseRepo, userRepo, logger)
	leaderboardSvc := service.NewLeaderboardService(leaderboardRepo, logger)
	cachedLeaderboardSvc := cache.NewCachedLeaderboardService(leaderboardSvc, rdb, logger)

	// Wire aggregator into showcase for auto-sync on repo add
	showcaseSvc.SetAggregatorService(aggregatorSvc)

	// Initialize banner upload directory
	bannerUploadDir := "/data/uploads/banners"
	if err := os.MkdirAll(bannerUploadDir, 0755); err != nil {
		logger.Fatal("failed to create banner upload directory", zap.Error(err))
	}

	// Initialize handlers
	authHandler := handler.NewAuthHandler(authSvc, cfg.CookieSecure)
	profileHandler := handler.NewProfileHandler(profileSvc)
	showcaseHandler := handler.NewShowcaseHandler(showcaseSvc)
	aggregatorHandler := handler.NewAggregatorHandler(aggregatorSvc)
	forumHandler := handler.NewForumHandler(forumSvc)
	communityHandler := handler.NewCommunityHandler(pool)
	leaderboardHandler := handler.NewLeaderboardHandler(cachedLeaderboardSvc)
	bannerHandler := handler.NewBannerHandler(userRepo, bannerUploadDir)

	// Set up router
	r := chi.NewRouter()

	// Global middleware
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(mw.CORS(cfg.CORSOrigin))

	// Rate limiter (IP-only applied globally)
	rateLimiter := mw.NewRateLimiter(rdb, cfg.RateLimitIP, cfg.RateLimitUser)
	r.Use(rateLimiter.IPMiddleware)

	// Health check
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		handler.RespondJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	// Serve uploaded banner files (public, static)
	fileServer := http.StripPrefix("/uploads/banners/", http.FileServer(http.Dir(bannerUploadDir)))
	r.Get("/uploads/banners/*", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		fileServer.ServeHTTP(w, r)
	})

	// API route groups
	r.Route("/api", func(r chi.Router) {
		// Apply 1MB body limit to all API routes EXCEPT banner upload
		r.Use(mw.MaxBodySize(1 << 20))

		// Public routes (no auth)
		r.Group(func(r chi.Router) {
			r.Get("/profiles/{alias}", profileHandler.HandleGetPublicProfile)
			r.Get("/members", profileHandler.HandleListMembers)
			r.Get("/feed", aggregatorHandler.HandleGetFeed)
			r.Get("/stats", communityHandler.HandleGetStats)
			r.Get("/repos/popular", communityHandler.HandleGetPopularRepos)
			r.Get("/users/{id}/activity", aggregatorHandler.HandleGetUserActivity)
			r.Get("/repos/{id}/activity", aggregatorHandler.HandleGetRepoActivity)
			r.Get("/repos/{id}/threads", forumHandler.HandleListThreads)
			r.Get("/threads/{id}", forumHandler.HandleGetThread)
			r.Get("/leaderboard", leaderboardHandler.HandleGetLeaderboard)
			r.Get("/leaderboard/users/{id}", leaderboardHandler.HandleGetUserSummary)
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

		// Protected routes (auth required, 1MB body limit inherited from parent)
		r.Group(func(r chi.Router) {
			r.Use(mw.JWTAuth(cfg.JWTSecret))
			r.Use(rateLimiter.UserMiddleware)

			r.Put("/profile", profileHandler.HandleUpdateProfile)
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
		})
	})

	// Banner upload route — OUTSIDE the /api group's 1MB MaxBodySize.
	// Has its own 10MB limit applied inside the handler itself.
	r.Route("/api/profile", func(r chi.Router) {
		r.Use(mw.JWTAuth(cfg.JWTSecret))
		r.Post("/banner", bannerHandler.HandleUploadBanner)
	})

	// Start leaderboard refresh scheduler (every 15 minutes)
	leaderboardScheduler := scheduler.New(leaderboardSvc, logger, 15*time.Minute)
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
