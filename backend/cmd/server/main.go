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
	"github.com/simenzzz/council/backend/internal/ws"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	cfg := config.Load()

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
	mux.Handle("GET /ws", ws.HandleEcho(logger, cfg.AllowedOrigins))

	srv := &http.Server{Addr: cfg.Addr, Handler: mux}

	go func(){
		logger.Info("listening on port", "addr", srv.Addr)
		err := srv.ListenAndServe()
		if err != nil && err != http.ErrServerClosed {
			logger.Error("Server failed", "err", err)
			os.Exit(1)
		}
	} () 
	<-ctx.Done()
	logger.Info("shutting down server")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	err := srv.Shutdown(shutdownCtx)
	if err != nil {
		logger.Error("shutdown failed", "err", err)
	}


}