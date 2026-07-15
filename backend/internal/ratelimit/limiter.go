package ratelimit

import (
	"context"
	"sync"
	"time"

	"golang.org/x/time/rate"
)

// Limiter is a per-IP token-bucket rate limiter. Each IP gets its own
// *rate.Limiter, created lazily on first sight and evicted once idle for longer
// than ttl (the janitor). The map is guarded by a mutex — a short critical
// section around a per-key map mutation, which is the right tool here (contrast
// the channel semaphore in middleware.go).
type Limiter struct {
	mu    sync.Mutex
	ips   map[string]*ipEntry
	rps   rate.Limit
	burst int
	ttl   time.Duration
}

type ipEntry struct {
	lim      *rate.Limiter
	lastSeen time.Time
}

// New builds a Limiter. rps is the steady-state per-IP refill rate (tokens/sec)
// and burst is the bucket size; ttl is how long an idle IP is retained before
// the janitor evicts it.
func New(rps float64, burst int, ttl time.Duration) *Limiter {
	return &Limiter{
		ips:   make(map[string]*ipEntry),
		rps:   rate.Limit(rps),
		burst: burst,
		ttl:   ttl,
	}
}

// Allow reports whether a request from ip may proceed, creating the per-IP
// bucket on first sight and refreshing its lastSeen timestamp.
func (l *Limiter) Allow(ip string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()

	now := time.Now()
	e, ok := l.ips[ip]
	if !ok {
		e = &ipEntry{
			lim:      rate.NewLimiter(l.rps, l.burst),
			lastSeen: now,
		}
		l.ips[ip] = e
	} else {
		e.lastSeen = now
	}
	return e.lim.AllowN(now, 1)
}

// StartJanitor runs a background goroutine that evicts IP entries idle longer
// than ttl, so the map cannot grow unbounded. It stops when ctx is cancelled —
// root it at the server base context so it dies on shutdown.
func (l *Limiter) StartJanitor(ctx context.Context, interval time.Duration) {
	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case now := <-ticker.C:
				l.sweep(now)
			}
		}
	}()
}

// sweep removes entries not seen within ttl. Split out so a test can drive one
// eviction pass deterministically without waiting on the ticker.
func (l *Limiter) sweep(now time.Time) {
	l.mu.Lock()
	defer l.mu.Unlock()
	for ip, e := range l.ips {
		if now.Sub(e.lastSeen) >= l.ttl {
			delete(l.ips, ip)
		}
	}
}
