package ratelimit

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"
)

type fakeQuota struct {
	mu      sync.Mutex
	calls   int
	allowed bool
	err     error
}

func (f *fakeQuota) CheckAndIncrement(context.Context, string, string, int) (bool, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.calls++
	return f.allowed, f.err
}

func (f *fakeQuota) Calls() int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.calls
}

func TestMiddleware(t *testing.T) {
	tests := []struct {
		name           string
		configure      func() (*Limiter, chan struct{}, *fakeQuota)
		wantStatus     int
		wantQuotaCalls int
	}{
		{
			"allow through to next",
			func() (*Limiter, chan struct{}, *fakeQuota) {
				return New(1000, 100, time.Minute), make(chan struct{}, 2), &fakeQuota{allowed: true}
			},
			http.StatusOK, 1,
		},
		{
			// Guard order: rate runs first, so the DB quota is never touched.
			"rate limited -> 429, quota untouched",
			func() (*Limiter, chan struct{}, *fakeQuota) {
				return New(0, 0, time.Minute), make(chan struct{}, 2), &fakeQuota{allowed: true}
			},
			http.StatusTooManyRequests, 0,
		},
		{
			"quota exceeded -> 429",
			func() (*Limiter, chan struct{}, *fakeQuota) {
				return New(1000, 100, time.Minute), make(chan struct{}, 2), &fakeQuota{allowed: false}
			},
			http.StatusTooManyRequests, 1,
		},
		{
			"quota store error -> 503 (fail closed)",
			func() (*Limiter, chan struct{}, *fakeQuota) {
				return New(1000, 100, time.Minute), make(chan struct{}, 2), &fakeQuota{err: errors.New("boom")}
			},
			http.StatusServiceUnavailable, 1,
		},
		{
			"semaphore full -> 503",
			func() (*Limiter, chan struct{}, *fakeQuota) {
				sem := make(chan struct{}, 1)
				sem <- struct{}{} // pre-fill so the non-blocking acquire fails
				return New(1000, 100, time.Minute), sem, &fakeQuota{allowed: true}
			},
			http.StatusServiceUnavailable, 1,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			lim, sem, q := tt.configure()
			next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusOK)
			})
			h := Middleware(lim, sem, q, 20, false, next)

			rec := httptest.NewRecorder()
			req := httptest.NewRequest(http.MethodGet, "/ws", nil)
			req.RemoteAddr = "192.0.2.1:1234"

			h.ServeHTTP(rec, req)

			if rec.Code != tt.wantStatus {
				t.Errorf("status = %d (%q), want %d", rec.Code, rec.Body.String(), tt.wantStatus)
			}
			if q.Calls() != tt.wantQuotaCalls {
				t.Errorf("quota calls = %d, want %d", q.Calls(), tt.wantQuotaCalls)
			}
		})
	}
}
