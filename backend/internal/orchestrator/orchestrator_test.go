package orchestrator

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"slices"
	"testing"
	"time"

	"github.com/simenzzz/council/backend/internal/protocol"
	"github.com/simenzzz/council/backend/internal/provider"
)

// moderatorPrompt is the system prompt the orchestrator uses for the moderator.
// Routing-based tests register a script under this key so the moderator pass
// (which always runs after the rounds) has a provider to stream from.
var moderatorPrompt = protocol.Moderator().SystemPrompt

// quietLogger discards orchestrator log output so test runs stay clean.
func quietLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}

// routingProvider dispatches Stream to a per-persona FakeProvider keyed by the
// request's system prompt. The orchestrator does not put the persona ID in the
// request, so tests give each persona a distinct SystemPrompt and route on it.
// Delegating to FakeProvider means we inherit its ctx-cancellation behaviour.
type routingProvider struct {
	byPrompt map[string]*provider.FakeProvider
}

func (r routingProvider) Stream(ctx context.Context, req provider.Request) (<-chan provider.StreamEvent, error) {
	f, ok := r.byPrompt[req.SystemPrompt]
	if !ok {
		return nil, fmt.Errorf("no script for prompt %q", req.SystemPrompt)
	}
	return f.Stream(ctx, req)
}

// collect drains the event channel until it closes, failing if that takes too
// long (which would indicate the orchestrator never closed the channel).
func collect(t *testing.T, ch <-chan protocol.Event) []protocol.Event {
	t.Helper()
	var evs []protocol.Event
	done := make(chan struct{})
	go func() {
		for ev := range ch {
			evs = append(evs, ev)
		}
		close(done)
	}()
	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("orchestrator did not close event channel within 2s")
	}
	return evs
}

// tokensByPersona returns the ordered deltas emitted for each persona (flattened
// across rounds).
func tokensByPersona(evs []protocol.Event) map[string][]string {
	out := make(map[string][]string)
	for _, ev := range evs {
		if ev.Type == protocol.EventToken {
			out[ev.Persona] = append(out[ev.Persona], ev.Delta)
		}
	}
	return out
}

// tokensByPersonaRound buckets deltas by persona AND round, so multi-round
// tagging can be asserted.
func tokensByPersonaRound(evs []protocol.Event) map[string]map[int][]string {
	out := make(map[string]map[int][]string)
	for _, ev := range evs {
		if ev.Type != protocol.EventToken {
			continue
		}
		if out[ev.Persona] == nil {
			out[ev.Persona] = make(map[int][]string)
		}
		out[ev.Persona][ev.Round] = append(out[ev.Persona][ev.Round], ev.Delta)
	}
	return out
}

// verdicts returns the text of every verdict event, in order.
func verdicts(evs []protocol.Event) []string {
	var out []string
	for _, ev := range evs {
		if ev.Type == protocol.EventVerdict {
			out = append(out, ev.Verdict)
		}
	}
	return out
}

func countType(evs []protocol.Event, typ protocol.EventType) int {
	n := 0
	for _, ev := range evs {
		if ev.Type == typ {
			n++
		}
	}
	return n
}

func donePersonas(evs []protocol.Event) map[string]bool {
	out := make(map[string]bool)
	for _, ev := range evs {
		if ev.Type == protocol.EventPersonaDone {
			out[ev.Persona] = true
		}
	}
	return out
}

func errorPersonas(evs []protocol.Event) map[string]bool {
	out := make(map[string]bool)
	for _, ev := range evs {
		if ev.Type == protocol.EventError {
			out[ev.Persona] = true
		}
	}
	return out
}

func keys(m map[string][]string) []string {
	out := make([]string, 0, len(m))
	for k := range m {
		out = append(out, k)
	}
	return out
}

// TestOrchestratorRun exercises a single round (rounds=1) plus the always-on
// moderator pass: per-persona token tagging, persona_done, error handling, and
// the terminal verdict.
func TestOrchestratorRun(t *testing.T) {
	streamErr := errors.New("cannot start stream")
	midErr := errors.New("stream blew up midway")

	tests := []struct {
		name     string
		personas []protocol.Persona
		// scripts non-nil → routingProvider (must include a moderatorPrompt entry);
		// nil → a single shared FakeProvider returning sharedDeltas for everyone,
		// including the moderator.
		scripts      map[string]*provider.FakeProvider
		sharedDeltas []string

		wantTokens map[string][]string // expected deltas per persona (moderator excluded)
		wantDone   []string
		wantErr    []string
	}{
		{
			name: "all personas stream and finish",
			personas: []protocol.Persona{
				{ID: "skeptic", SystemPrompt: "sys-skeptic"},
				{ID: "optimist", SystemPrompt: "sys-optimist"},
				{ID: "expert", SystemPrompt: "sys-expert"},
			},
			sharedDeltas: []string{"a", "b", "c"},
			wantTokens: map[string][]string{
				"skeptic":  {"a", "b", "c"},
				"optimist": {"a", "b", "c"},
				"expert":   {"a", "b", "c"},
			},
			wantDone: []string{"skeptic", "optimist", "expert"},
		},
		{
			name: "one persona fails to start, others complete",
			personas: []protocol.Persona{
				{ID: "good", SystemPrompt: "sys-good"},
				{ID: "bad", SystemPrompt: "sys-bad"},
			},
			scripts: map[string]*provider.FakeProvider{
				"sys-good":      {Deltas: []string{"x", "y"}},
				"sys-bad":       {StreamErr: streamErr},
				moderatorPrompt: {}, // moderator emits no tokens, just an empty verdict
			},
			wantTokens: map[string][]string{"good": {"x", "y"}},
			wantDone:   []string{"good"},
			wantErr:    []string{"bad"},
		},
		{
			name: "mid-stream error stops one persona, others complete",
			personas: []protocol.Persona{
				{ID: "good", SystemPrompt: "sys-good"},
				{ID: "flaky", SystemPrompt: "sys-flaky"},
			},
			scripts: map[string]*provider.FakeProvider{
				"sys-good":      {Deltas: []string{"x", "y"}},
				"sys-flaky":     {Deltas: []string{"p"}, Err: midErr},
				moderatorPrompt: {},
			},
			wantTokens: map[string][]string{
				"good":  {"x", "y"},
				"flaky": {"p"}, // delta emitted before the terminal error
			},
			wantDone: []string{"good"}, // flaky never reaches persona_done
			wantErr:  []string{"flaky"},
		},
		{
			name: "single persona",
			personas: []protocol.Persona{
				{ID: "solo", SystemPrompt: "sys-solo"},
			},
			sharedDeltas: []string{"only"},
			wantTokens:   map[string][]string{"solo": {"only"}},
			wantDone:     []string{"solo"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var prov provider.Provider
			if tt.scripts != nil {
				prov = routingProvider{byPrompt: tt.scripts}
			} else {
				prov = &provider.FakeProvider{Deltas: tt.sharedDeltas}
			}

			orch := New(prov, "test-model", len(tt.personas), quietLogger())
			evs := collect(t, orch.Run(context.Background(), "question?", tt.personas, 1))

			gotTokens := tokensByPersona(evs)
			delete(gotTokens, "moderator") // asserted separately below
			for persona, want := range tt.wantTokens {
				if !slices.Equal(gotTokens[persona], want) {
					t.Errorf("tokens[%s] = %v, want %v", persona, gotTokens[persona], want)
				}
			}
			if len(gotTokens) != len(tt.wantTokens) {
				t.Errorf("got tokens for personas %v, want exactly %d personas", keys(gotTokens), len(tt.wantTokens))
			}

			gotDone := donePersonas(evs)
			for _, persona := range tt.wantDone {
				if !gotDone[persona] {
					t.Errorf("missing persona_done for %s", persona)
				}
			}
			if len(gotDone) != len(tt.wantDone) {
				t.Errorf("persona_done set = %v, want %v", gotDone, tt.wantDone)
			}

			gotErr := errorPersonas(evs)
			for _, persona := range tt.wantErr {
				if !gotErr[persona] {
					t.Errorf("missing error event for %s", persona)
				}
			}
			if len(gotErr) != len(tt.wantErr) {
				t.Errorf("error set = %v, want %v", gotErr, tt.wantErr)
			}

			// One round → one round_complete; then the moderator caps the debate
			// with exactly one verdict, which must be the final event.
			if n := countType(evs, protocol.EventRoundComplete); n != 1 {
				t.Errorf("round_complete count = %d, want 1", n)
			}
			if vs := verdicts(evs); len(vs) != 1 {
				t.Errorf("verdict count = %d, want 1", len(vs))
			}
			if len(evs) == 0 || evs[len(evs)-1].Type != protocol.EventVerdict {
				t.Errorf("last event = %+v, want verdict to be last", evs[len(evs)-1])
			}
		})
	}
}

// TestOrchestratorMultiRound verifies the Model-B debate flow: tokens are tagged
// per round across multiple rounds, persona_done fires once per persona per
// round, and the moderator runs once at round rounds+1 with a terminal verdict.
func TestOrchestratorMultiRound(t *testing.T) {
	personas := []protocol.Persona{
		{ID: "a", Name: "A", SystemPrompt: "sys-a"},
		{ID: "b", Name: "B", SystemPrompt: "sys-b"},
	}
	prov := &provider.FakeProvider{Deltas: []string{"x", "y"}}
	orch := New(prov, "test-model", len(personas), quietLogger())

	const rounds = 2
	evs := collect(t, orch.Run(context.Background(), "q?", personas, rounds))

	byPR := tokensByPersonaRound(evs)
	for _, p := range personas {
		for round := 1; round <= rounds; round++ {
			if got := byPR[p.ID][round]; !slices.Equal(got, []string{"x", "y"}) {
				t.Errorf("tokens[%s][round %d] = %v, want [x y]", p.ID, round, got)
			}
		}
	}

	doneCount := make(map[string]int)
	for _, ev := range evs {
		if ev.Type == protocol.EventPersonaDone {
			doneCount[ev.Persona]++
		}
	}
	for _, p := range personas {
		if doneCount[p.ID] != rounds {
			t.Errorf("persona_done[%s] = %d, want %d", p.ID, doneCount[p.ID], rounds)
		}
	}

	if n := countType(evs, protocol.EventRoundComplete); n != rounds {
		t.Errorf("round_complete = %d, want %d", n, rounds)
	}

	// Moderator streams after the final round (tagged rounds+1) then one verdict.
	if got := byPR["moderator"][rounds+1]; !slices.Equal(got, []string{"x", "y"}) {
		t.Errorf("moderator tokens[round %d] = %v, want [x y]", rounds+1, got)
	}
	if vs := verdicts(evs); len(vs) != 1 || vs[0] != "xy" {
		t.Errorf("verdicts = %v, want [xy]", vs)
	}
	if last := evs[len(evs)-1]; last.Type != protocol.EventVerdict {
		t.Errorf("last event = %+v, want verdict", last)
	}
}

// TestOrchestratorCancel verifies that cancelling the context unwinds every
// persona goroutine and closes the event channel rather than deadlocking or
// leaking. Each persona has more deltas than we read, so goroutines are blocked
// on a send to the fan-in channel when we cancel.
func TestOrchestratorCancel(t *testing.T) {
	personas := []protocol.Persona{
		{ID: "a", SystemPrompt: "sys-a"},
		{ID: "b", SystemPrompt: "sys-b"},
	}
	prov := &provider.FakeProvider{Deltas: []string{"1", "2", "3", "4", "5"}}
	orch := New(prov, "test-model", len(personas), quietLogger())

	ctx, cancel := context.WithCancel(context.Background())
	ch := orch.Run(ctx, "question?", personas, 2)

	// Read a single event to prove the pipeline started, then cancel.
	if _, ok := <-ch; !ok {
		t.Fatal("expected at least one event before cancel")
	}
	cancel()

	// Drain whatever is left; the channel must close promptly.
	done := make(chan struct{})
	go func() {
		for range ch { //nolint:revive // draining remaining events
		}
		close(done)
	}()
	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("event channel did not close after cancel (possible goroutine leak)")
	}
}
