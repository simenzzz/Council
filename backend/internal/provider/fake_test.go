package provider

import (
	"context"
	"errors"
	"slices"
	"testing"
	"time"
)

// drain consumes ch until it closes, returning the deltas in order and the
// first error seen. It is shared by the provider tests.
func drain(t *testing.T, ch <-chan StreamEvent) ([]string, error) {
	t.Helper()
	var deltas []string
	var firstErr error
	for ev := range ch {
		if ev.Err != nil {
			if firstErr == nil {
				firstErr = ev.Err
			}
			continue
		}
		deltas = append(deltas, ev.Delta)
	}
	return deltas, firstErr
}

func TestFakeProviderStream(t *testing.T) {
	sentinel := errors.New("boom")

	tests := []struct {
		name       string
		fake       *FakeProvider
		wantDeltas []string
		wantErr    error
	}{
		{
			name:       "deltas in order",
			fake:       &FakeProvider{Deltas: []string{"a", "b", "c"}},
			wantDeltas: []string{"a", "b", "c"},
		},
		{
			name:       "terminal error after deltas",
			fake:       &FakeProvider{Deltas: []string{"a"}, Err: sentinel},
			wantDeltas: []string{"a"},
			wantErr:    sentinel,
		},
		{
			name: "no deltas, no error",
			fake: &FakeProvider{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ch, err := tt.fake.Stream(context.Background(), Request{})
			if err != nil {
				t.Fatalf("Stream returned unexpected error: %v", err)
			}

			deltas, gotErr := drain(t, ch)
			if !slices.Equal(deltas, tt.wantDeltas) {
				t.Errorf("deltas = %v, want %v", deltas, tt.wantDeltas)
			}
			if !errors.Is(gotErr, tt.wantErr) {
				t.Errorf("error = %v, want %v", gotErr, tt.wantErr)
			}
		})
	}
}

func TestFakeProviderStreamErr(t *testing.T) {
	sentinel := errors.New("cannot build request")
	f := &FakeProvider{StreamErr: sentinel}

	ch, err := f.Stream(context.Background(), Request{})
	if !errors.Is(err, sentinel) {
		t.Errorf("Stream error = %v, want %v", err, sentinel)
	}
	if ch != nil {
		t.Errorf("Stream channel = %v, want nil", ch)
	}
}

func TestFakeProviderContextCancel(t *testing.T) {
	f := &FakeProvider{Deltas: []string{"a", "b", "c", "d"}}
	ctx, cancel := context.WithCancel(context.Background())

	ch, err := f.Stream(ctx, Request{})
	if err != nil {
		t.Fatalf("Stream returned unexpected error: %v", err)
	}

	// Consume the first event, then cancel: the producer goroutine must stop
	// and close the channel rather than delivering the remaining deltas.
	first, ok := <-ch
	if !ok {
		t.Fatal("expected at least one event before cancel")
	}
	if first.Delta != "a" {
		t.Errorf("first delta = %q, want %q", first.Delta, "a")
	}
	cancel()

	done := make(chan struct{})
	go func() {
		for range ch { //nolint:revive // draining remaining events
		}
		close(done)
	}()

	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("stream did not stop after context cancel (possible goroutine leak)")
	}
}
