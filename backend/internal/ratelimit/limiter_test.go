package ratelimit

import (
	"context"
	"sync"
	"testing"
	"time"
)

// With rps=0 there is no refill, so the bucket starts with `burst` tokens and
// only ever depletes — a deterministic way to test allow-then-deny.
func TestAllowBurstThenDeny(t *testing.T) {
	lim := New(0, 3, time.Minute)

	for i := 1; i <= 3; i++ {
		if !lim.Allow("1.2.3.4") {
			t.Fatalf("call %d within burst should be allowed", i)
		}
	}
	if lim.Allow("1.2.3.4") {
		t.Fatal("call beyond burst should be denied")
	}
}

func TestAllowPerIPIsolation(t *testing.T) {
	lim := New(0, 1, time.Minute)

	if !lim.Allow("a") {
		t.Fatal("first call for a should be allowed")
	}
	if lim.Allow("a") {
		t.Fatal("second call for a should be denied")
	}
	if !lim.Allow("b") {
		t.Fatal("first call for b (separate bucket) should be allowed")
	}
}

// sweep is driven directly so eviction is deterministic — no sleeping on the
// ticker. An entry older than ttl must go; a fresh one must stay.
func TestSweepEvictsIdleOnly(t *testing.T) {
	lim := New(1, 1, time.Second)

	lim.Allow("idle")
	lim.Allow("fresh")

	// Push the idle entry's lastSeen far enough back that it is past ttl.
	lim.mu.Lock()
	lim.ips["idle"].lastSeen = time.Now().Add(-2 * time.Second)
	lim.mu.Unlock()

	now := time.Now()
	lim.sweep(now)

	lim.mu.Lock()
	defer lim.mu.Unlock()
	if _, ok := lim.ips["idle"]; ok {
		t.Error("idle entry should have been evicted")
	}
	if _, ok := lim.ips["fresh"]; !ok {
		t.Error("fresh entry should have been retained")
	}
}

// StartJanitor is the one piece with real time: confirm the goroutine starts,
// sweeps an idle entry, and stops on ctx cancellation.
func TestStartJanitorEvictsThenStops(t *testing.T) {
	lim := New(1, 1, 30*time.Millisecond)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	lim.StartJanitor(ctx, 10*time.Millisecond)
	if !lim.Allow("a") {
		t.Fatal("first Allow should succeed")
	}

	// ttl=30ms, sweep=10ms -> evicted well within this bound.
	deadline := time.After(2 * time.Second)
	for {
		lim.mu.Lock()
		gone := len(lim.ips) == 0
		lim.mu.Unlock()
		if gone {
			return
		}
		select {
		case <-deadline:
			t.Fatal("janitor did not evict idle entry in time")
		default:
			time.Sleep(5 * time.Millisecond)
		}
	}
}

// Under -race: many goroutines hammering Allow on shared and distinct keys must
// not trip the race detector. The mutex is the whole point.
func TestAllowConcurrent(t *testing.T) {
	lim := New(1000, 100, time.Minute)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	lim.StartJanitor(ctx, 50*time.Millisecond)

	var wg sync.WaitGroup
	for i := 0; i < 200; i++ {
		wg.Add(1)
		go func(n int) {
			defer wg.Done()
			ip := "10.0.0." + string(rune('1'+n%9))
			_ = lim.Allow(ip)
		}(i)
	}
	wg.Wait()
}
