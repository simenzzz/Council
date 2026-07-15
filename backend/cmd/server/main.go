package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/joho/godotenv"
	"github.com/simenzzz/council/backend/internal/config"
	"github.com/simenzzz/council/backend/internal/orchestrator"
	"github.com/simenzzz/council/backend/internal/protocol"
	"github.com/simenzzz/council/backend/internal/provider"
	"github.com/simenzzz/council/backend/internal/ratelimit"
	"github.com/simenzzz/council/backend/internal/store"
	"github.com/simenzzz/council/backend/internal/ws"
)

const maxConcurrency = 6

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))

	// Best-effort: load .env into the process environment before config.Load
	// reads it via os.Getenv. A missing .env is normal in production (real env
	// is exported there), so this is not fatal. godotenv does NOT override
	// variables already set in the environment — the real shell env wins.
	if err := godotenv.Load(); err != nil {
		logger.Debug("no .env file loaded; using process environment", "err", err)
	}

	cfg, err := config.Load()
	if err != nil {
		logger.Error("config load failed", "err", err)
		os.Exit(1)
	}

	panel := protocol.DefaultPanel()
	prov := provider.NewZaiProvider(cfg.ZaiAPIKey, cfg.LlmModel)
	orch := orchestrator.New(prov, cfg.LlmModel, min(maxConcurrency, len(panel)), logger)

	ctx, stop := signal.NotifyContext(
		context.Background(),
		syscall.SIGINT,
		syscall.SIGTERM)
	defer stop()

	// Phase 5 hardening: per-IP token bucket (with a janitor rooted at ctx so it
	// dies on shutdown), the durable per-IP daily quota (SQLite), and a counting
	// semaphore bounding concurrent debates. All three guards run inside
	// ratelimit.Middleware, ahead of the WebSocket upgrade.
	lim := ratelimit.New(cfg.RateLimitRPS, cfg.RateLimitBurst, cfg.RateLimitTTL)
	lim.StartJanitor(ctx, cfg.RateLimitSweepEvery)

	quotaStore, err := store.Open(cfg.DBPath)
	if err != nil {
		logger.Error("quota store open failed", "err", err)
		os.Exit(1)
	}
	defer quotaStore.Close()

	sem := make(chan struct{}, cfg.MaxConcurrentSessions)

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz",
		func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte("ok"))
		})
	mux.Handle("GET /ws/echo", ws.HandleEcho(logger, cfg.AllowedOrigins))
	mux.Handle("GET /ws", ratelimit.Middleware(lim, sem, quotaStore, cfg.DailyQuota, cfg.TrustProxy,
		ws.HandleSession(logger, cfg.AllowedOrigins, orch, panel)))

	srv := &http.Server{Addr: cfg.Addr, Handler: mux, ReadHeaderTimeout: 5 * time.Second, IdleTimeout: 120 * time.Second}

	go func() {
		logger.Info("listening on port", "addr", srv.Addr)
		err := srv.ListenAndServe()
		if err != nil && err != http.ErrServerClosed {
			logger.Error("server failed", "err", err)
			os.Exit(1)
		}
	}()
	<-ctx.Done()
	logger.Info("shutting down server")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		logger.Error("shutdown failed", "err", err)
	}

}
