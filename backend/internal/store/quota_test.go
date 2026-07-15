package store

import (
	"context"
	"sync"
	"sync/atomic"
	"testing"
)

func TestCheckAndIncrementLimit(t *testing.T) {
	s := newTestStore(t)
	const limit = 3
	ip, day := "203.0.113.10", "2026-01-01"

	for i := 1; i <= limit; i++ {
		ok, err := s.CheckAndIncrement(context.Background(), ip, day, limit)
		if err != nil {
			t.Fatalf("call %d: %v", i, err)
		}
		if !ok {
			t.Fatalf("call %d within limit should be allowed", i)
		}
	}
	ok, err := s.CheckAndIncrement(context.Background(), ip, day, limit)
	if err != nil {
		t.Fatalf("over-limit call: %v", err)
	}
	if ok {
		t.Fatal("call beyond limit should be denied")
	}
}

// day is part of the key, so a new UTC day is a fresh counter.
func TestCheckAndIncrementDayRollover(t *testing.T) {
	s := newTestStore(t)
	const limit = 2
	ip := "198.51.100.7"

	// Exhaust day 1.
	if ok, err := s.CheckAndIncrement(context.Background(), ip, "2026-01-01", limit); err != nil || !ok {
		t.Fatalf("day1 call1: ok=%v err=%v", ok, err)
	}
	if ok, err := s.CheckAndIncrement(context.Background(), ip, "2026-01-01", limit); err != nil || !ok {
		t.Fatalf("day1 call2: ok=%v err=%v", ok, err)
	}
	if ok, err := s.CheckAndIncrement(context.Background(), ip, "2026-01-01", limit); err != nil || ok {
		t.Fatalf("day1 call3 should be denied: ok=%v err=%v", ok, err)
	}

	// Day 2 starts fresh.
	if ok, err := s.CheckAndIncrement(context.Background(), ip, "2026-01-02", limit); err != nil || !ok {
		t.Fatalf("day2 rollover should be allowed: ok=%v err=%v", ok, err)
	}
}

// Under -race: N goroutines increment the same (ip, day). Because the UPSERT is
// atomic and the pool is capped at one connection, every call returns a distinct
// count in 1..N — so exactly `limit` are allowed and the persisted count is N.
// A lost update would surface as count != N.
func TestCheckAndIncrementConcurrent(t *testing.T) {
	s := newTestStore(t)
	const (
		N     = 50
		limit = 10
	)
	ip, day := "203.0.113.99", "2026-01-01"

	var allowed, denied int64
	var wg sync.WaitGroup
	start := make(chan struct{})

	for i := 0; i < N; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			<-start
			ok, err := s.CheckAndIncrement(context.Background(), ip, day, limit)
			if err != nil {
				t.Errorf("CheckAndIncrement: %v", err)
				return
			}
			if ok {
				atomic.AddInt64(&allowed, 1)
			} else {
				atomic.AddInt64(&denied, 1)
			}
		}()
	}
	close(start)
	wg.Wait()

	if got := atomic.LoadInt64(&allowed); got != limit {
		t.Errorf("allowed = %d, want %d", got, limit)
	}
	if got := atomic.LoadInt64(&denied); got != N-limit {
		t.Errorf("denied = %d, want %d", got, N-limit)
	}

	var count int
	if err := s.db.QueryRowContext(context.Background(),
		`SELECT count FROM daily_usage WHERE ip = ? AND day = ?`, ip, day).Scan(&count); err != nil {
		t.Fatalf("read back count: %v", err)
	}
	if count != N {
		t.Errorf("persisted count = %d, want %d (every call must increment exactly once)", count, N)
	}
}
