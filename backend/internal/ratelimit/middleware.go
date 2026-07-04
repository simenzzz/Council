package ratelimit

import (
	"net/http"

	"github.com/simenzzz/council/backend/internal/httpx"
)

// Middleware rejects abusive or over-capacity requests BEFORE the WebSocket
// upgrade. websocket.Accept hijacks the connection, so any rejection must be a
// plain HTTP response written here, ahead of next.
//
// Two independent guards:
//   - per-IP token bucket (lim) → 429 Too Many Requests when a client is too
//     chatty.
//   - global counting semaphore (sem, a buffered channel) → 503 Service
//     Unavailable when all debate slots are in use. A WS handler holds its slot
//     for the whole debate (the handler blocks until the debate ends), so this
//     bounds concurrent upstream fan-out across all clients.
func Middleware(lim *Limiter, sem chan struct{}, trustProxy bool, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ip := httpx.ClientIP(r, trustProxy)

		if !lim.Allow(ip) {
			http.Error(w, "rate limit exceeded", http.StatusTooManyRequests)
			return
		}

		// Non-blocking acquire: reject rather than queue when full.
		select {
		case sem <- struct{}{}:
			defer func() { <-sem }()
		default:
			http.Error(w, "server busy, try again shortly", http.StatusServiceUnavailable)
			return
		}

		// NOTE(you): if the session handler needs the resolved IP for the quota
		// check, either re-call httpx.ClientIP there or stash it in the request
		// context here (context.WithValue) and read it back. Re-calling is
		// simplest and cheap.
		next.ServeHTTP(w, r)
	})
}
