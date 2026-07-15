package ratelimit

import (
	"context"
	"net/http"
	"time"

	"github.com/simenzzz/council/backend/internal/httpx"
)

// Quota is the per-IP daily-cap check the middleware enforces before the
// WebSocket upgrade. *store.Store satisfies it structurally, so the ratelimit
// package never imports store — the dependency points the other way (main wires
// a *store.Store in).
type Quota interface {
	CheckAndIncrement(ctx context.Context, ip, day string, limit int) (allowed bool, err error)
}

// Middleware rejects abusive or over-capacity requests BEFORE the WebSocket
// upgrade. websocket.Accept hijacks the connection, so any rejection must be a
// plain HTTP response written here, ahead of next.
//
// Three independent guards, ordered cheapest/most-frequent rejection first so
// floods die with zero DB writes and the scarce global slot is acquired last:
//   - per-IP token bucket (lim) → 429 Too Many Requests when a client is too
//     chatty.
//   - per-IP daily quota (q) → 429 when the soft daily cap is reached; 503 if
//     the quota store itself errors (fail closed: if we cannot verify the cap,
//     we do not serve).
//   - global counting semaphore (sem, a buffered channel) → 503 Service
//     Unavailable when all debate slots are in use. A WS handler holds its slot
//     for the whole debate (the handler blocks until the debate ends), so this
//     bounds concurrent upstream fan-out across all clients.
func Middleware(lim *Limiter, sem chan struct{}, q Quota, dailyLimit int, trustProxy bool, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ip := httpx.ClientIP(r, trustProxy)

		if !lim.Allow(ip) {
			http.Error(w, "rate limit exceeded", http.StatusTooManyRequests)
			return
		}

		// Soft daily cap: the UPSERT increments on every call (count-then-check),
		// so an over-limit request still counts — intentionally, to keep the
		// statement race-free. day is UTC so a client's local midnight never
		// mints a fresh bucket twice in one calendar day.
		day := time.Now().UTC().Format("2006-01-02")
		allowed, err := q.CheckAndIncrement(r.Context(), ip, day, dailyLimit)
		if err != nil {
			http.Error(w, "quota check failed", http.StatusServiceUnavailable)
			return
		}
		if !allowed {
			http.Error(w, "daily limit reached", http.StatusTooManyRequests)
			return
		}

		// Non-blocking acquire: reject rather than queue when full. The deferred
		// release fires when next.ServeHTTP returns — and for a WS handler that
		// is the end of the debate, so the slot is held for exactly one debate.
		select {
		case sem <- struct{}{}:
			defer func() { <-sem }()
		default:
			http.Error(w, "server busy, try again shortly", http.StatusServiceUnavailable)
			return
		}

		next.ServeHTTP(w, r)
	})
}
