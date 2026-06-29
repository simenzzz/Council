package ws

import (
	"context"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/coder/websocket"
	"github.com/coder/websocket/wsjson"

	"github.com/simenzzz/council/backend/internal/orchestrator"
	"github.com/simenzzz/council/backend/internal/protocol"
	"github.com/simenzzz/council/backend/internal/provider"
)

func quietLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}

// newSessionServer wires a FakeProvider-backed orchestrator into the session
// handler and serves it over httptest, returning the ws:// URL for the route.
func newSessionServer(t *testing.T, deltas []string, personas []protocol.Persona) string {
	t.Helper()
	prov := &provider.FakeProvider{Deltas: deltas}
	orch := orchestrator.New(prov, "test-model", len(personas), quietLogger())

	mux := http.NewServeMux()
	// allowedOrigins is nil: the coder/websocket Go client sends no Origin
	// header, so the accept-time origin check passes without configuration.
	mux.Handle("GET /ws", HandleSession(quietLogger(), nil, orch, personas))

	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)
	return "ws" + strings.TrimPrefix(srv.URL, "http") + "/ws"
}

// readEvents reads events until the connection closes, failing on timeout.
func readEvents(t *testing.T, ctx context.Context, conn *websocket.Conn) []protocol.Event {
	t.Helper()
	var evs []protocol.Event
	for {
		var ev protocol.Event
		if err := wsjson.Read(ctx, conn, &ev); err != nil {
			// Normal termination: the server closed after the verdict (or after an
			// error event). Anything else is a genuine timeout/failure.
			if ctx.Err() != nil {
				t.Fatalf("timed out waiting for events; got so far: %+v", evs)
			}
			return evs
		}
		evs = append(evs, ev)
	}
}

func TestHandleSessionStreamsDebate(t *testing.T) {
	personas := []protocol.Persona{
		{ID: "skeptic", Name: "The Skeptic", SystemPrompt: "sys-skeptic"},
		{ID: "optimist", Name: "The Optimist", SystemPrompt: "sys-optimist"},
	}
	url := newSessionServer(t, []string{"a", "b"}, personas)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	conn, _, err := websocket.Dial(ctx, url, nil)
	if err != nil {
		t.Fatalf("dial failed: %v", err)
	}
	defer conn.CloseNow()

	if err := wsjson.Write(ctx, conn, protocol.ClientMessage{Type: "ask", Question: "why?", Rounds: 2}); err != nil {
		t.Fatalf("write ask failed: %v", err)
	}

	evs := readEvents(t, ctx, conn)

	tokens := map[string]string{} // joined deltas per persona, across rounds
	roundComplete := 0
	verdictCount := 0
	for _, ev := range evs {
		switch ev.Type {
		case protocol.EventToken:
			tokens[ev.Persona] += ev.Delta
		case protocol.EventRoundComplete:
			roundComplete++
		case protocol.EventVerdict:
			verdictCount++
		case protocol.EventError:
			t.Errorf("unexpected error event: %+v", ev)
		}
	}

	// Two rounds of "ab" each → "abab" per panelist.
	for _, p := range personas {
		if tokens[p.ID] != "abab" {
			t.Errorf("tokens[%s] = %q, want %q", p.ID, tokens[p.ID], "abab")
		}
	}
	// The moderator streams once after the debate.
	if tokens["moderator"] != "ab" {
		t.Errorf("moderator tokens = %q, want %q", tokens["moderator"], "ab")
	}
	if roundComplete != 2 {
		t.Errorf("round_complete count = %d, want 2", roundComplete)
	}
	if verdictCount != 1 {
		t.Errorf("verdict count = %d, want 1", verdictCount)
	}
	if last := evs[len(evs)-1]; last.Type != protocol.EventVerdict {
		t.Errorf("last event = %+v, want verdict", last)
	}
}

func TestHandleSessionRejectsInvalidType(t *testing.T) {
	assertRejected(t, protocol.ClientMessage{Type: "nope", Question: "hi"})
}

func TestHandleSessionRejectsOddRounds(t *testing.T) {
	// Rounds must be even; an odd count is rejected at the validation boundary.
	assertRejected(t, protocol.ClientMessage{Type: "ask", Question: "hi", Rounds: 3})
}

// assertRejected sends one invalid client message and asserts the server replies
// with a single error event and then closes — no debate is streamed.
func assertRejected(t *testing.T, msg protocol.ClientMessage) {
	t.Helper()
	url := newSessionServer(t, []string{"a"}, []protocol.Persona{{ID: "solo", SystemPrompt: "sys"}})

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	conn, _, err := websocket.Dial(ctx, url, nil)
	if err != nil {
		t.Fatalf("dial failed: %v", err)
	}
	defer conn.CloseNow()

	if err := wsjson.Write(ctx, conn, msg); err != nil {
		t.Fatalf("write failed: %v", err)
	}

	var ev protocol.Event
	if err := wsjson.Read(ctx, conn, &ev); err != nil {
		t.Fatalf("expected an error event before close, got read error: %v", err)
	}
	if ev.Type != protocol.EventError {
		t.Fatalf("event type = %q, want %q", ev.Type, protocol.EventError)
	}
	if ev.ErrMessage == "" {
		t.Error("error event has empty message")
	}

	// No debate should follow an invalid request: the next read must fail
	// because the server closed the connection.
	if err := wsjson.Read(ctx, conn, &ev); err == nil {
		t.Errorf("expected connection close after invalid message, got event: %+v", ev)
	}
}
