package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/simenzzz/council/backend/internal/config"
	"github.com/simenzzz/council/backend/internal/orchestrator"
	"github.com/simenzzz/council/backend/internal/protocol"
	"github.com/simenzzz/council/backend/internal/provider"
	"github.com/simenzzz/council/backend/internal/ws"
)

const maxConcurrency = 6

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
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

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz",
		func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte("ok"))
		})
	mux.Handle("GET /ws/echo", ws.HandleEcho(logger, cfg.AllowedOrigins))
	mux.Handle("GET /ws", ws.HandleSession(logger, cfg.AllowedOrigins, orch, panel))

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
