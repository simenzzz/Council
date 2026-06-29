package ws

import (
	"context"
	"log/slog"
	"net/http"
	"time"

	"github.com/coder/websocket"
	"github.com/coder/websocket/wsjson"
	"github.com/simenzzz/council/backend/internal/orchestrator"
	"github.com/simenzzz/council/backend/internal/protocol"
)

const (
	maxInboundBytes = 8 * 1024
	writeTimeout    = 10 * time.Second
)

func HandleSession(logger *slog.Logger, allowedOrigins []string, orch *orchestrator.Orchestrator, personas []protocol.Persona) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{
			OriginPatterns: allowedOrigins,
		})
		if err != nil {
			logger.Error("ws accept failed", "err", err)
			return
		}
		defer conn.CloseNow()
		conn.SetReadLimit(maxInboundBytes)

		ctx, cancel := context.WithCancel(r.Context())
		defer cancel()

		var msg protocol.ClientMessage
		if err := wsjson.Read(ctx, conn, &msg); err != nil {
			logger.Error("ws read failed", "err", err)
			return
		}
		if err := msg.Validate(); err != nil {
			logger.Info("invalid client message", "err", err)
			_ = wsjson.Write(ctx, conn, protocol.Error("", "invalid request"))
			return
		}
		// Spawn a reader that services ping/pong + close frames and cancels
		// ctx promptly when the client disconnects mid-debate.
		ctx = conn.CloseRead(ctx)
		rounds := msg.Rounds
		if rounds == 0 {
			rounds = protocol.DefaultRounds
		}
		events := orch.Run(ctx, msg.Question, personas, rounds)
		for ev := range events {
			wctx, wcancel := context.WithTimeout(ctx, writeTimeout)
			err := wsjson.Write(wctx, conn, ev)
			wcancel()
			if err != nil {
				cancel() // client gone → stop personas
				return
			}
		}

	}
}
