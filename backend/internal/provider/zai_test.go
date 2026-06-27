package provider

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"slices"
	"strings"
	"testing"
	"time"
)

// newTestProvider builds a ZaiProvider pointed at a test server. It constructs
// the struct directly (white-box) so no production constructor change is needed
// to inject the URL and client.
func newTestProvider(baseURL string, client *http.Client) *ZaiProvider {
	return &ZaiProvider{
		apiKey:     "test-key",
		baseURL:    baseURL,
		model:      "test-model",
		httpClient: client,
	}
}

// sseServer returns a test server that writes the given SSE lines, flushing
// after each so the client's scanner sees them incrementally.
func sseServer(t *testing.T, lines []string) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		flusher, ok := w.(http.Flusher)
		if !ok {
			t.Error("ResponseWriter does not support flushing")
			return
		}
		for _, line := range lines {
			if _, err := io.WriteString(w, line+"\n"); err != nil {
				return
			}
			flusher.Flush()
		}
	}))
}

func TestZaiStream(t *testing.T) {
	tests := []struct {
		name       string
		lines      []string
		wantDeltas []string
	}{
		{
			name: "happy path",
			lines: []string{
				`data: {"choices":[{"delta":{"content":"Hel"}}]}`,
				``,
				`data: {"choices":[{"delta":{"content":"lo"}}]}`,
				``,
				`data: [DONE]`,
			},
			wantDeltas: []string{"Hel", "lo"},
		},
		{
			name: "skips blanks, non-data, malformed, and empty content",
			lines: []string{
				``,
				`event: ping`,
				`data: {bad json`,
				`data: {"choices":[]}`,
				`data: {"choices":[{"delta":{"content":""}}]}`,
				`data: {"choices":[{"delta":{"content":"ok"}}]}`,
				`data: [DONE]`,
			},
			wantDeltas: []string{"ok"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ts := sseServer(t, tt.lines)
			defer ts.Close()

			z := newTestProvider(ts.URL, ts.Client())
			ch, err := z.Stream(context.Background(), Request{})
			if err != nil {
				t.Fatalf("Stream returned unexpected error: %v", err)
			}

			deltas, gotErr := drain(t, ch)
			if gotErr != nil {
				t.Errorf("unexpected stream error: %v", gotErr)
			}
			if !slices.Equal(deltas, tt.wantDeltas) {
				t.Errorf("deltas = %v, want %v", deltas, tt.wantDeltas)
			}
		})
	}
}

func TestZaiStreamNon200(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		_, _ = io.WriteString(w, "server exploded")
	}))
	defer ts.Close()

	z := newTestProvider(ts.URL, ts.Client())
	ch, err := z.Stream(context.Background(), Request{})
	if err != nil {
		t.Fatalf("Stream returned unexpected error: %v", err)
	}

	deltas, gotErr := drain(t, ch)
	if len(deltas) != 0 {
		t.Errorf("deltas = %v, want none", deltas)
	}
	if gotErr == nil {
		t.Fatal("expected an error for non-200 response, got nil")
	}
	if !strings.Contains(gotErr.Error(), "status 500") {
		t.Errorf("error = %q, want it to mention status 500", gotErr)
	}
	if !strings.Contains(gotErr.Error(), "server exploded") {
		t.Errorf("error = %q, want it to include the response body snippet", gotErr)
	}
}

func TestZaiStreamRequestShape(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if got := r.Header.Get("Authorization"); got != "Bearer test-key" {
			t.Errorf("Authorization = %q, want %q", got, "Bearer test-key")
		}
		if got := r.Header.Get("Content-Type"); got != "application/json" {
			t.Errorf("Content-Type = %q, want %q", got, "application/json")
		}

		body, err := io.ReadAll(r.Body)
		if err != nil {
			t.Errorf("reading request body: %v", err)
			return
		}
		var wire wireRequest
		if err := json.Unmarshal(body, &wire); err != nil {
			t.Errorf("unmarshalling request body: %v", err)
			return
		}
		if !wire.Stream {
			t.Error("wire.Stream = false, want true")
		}
		if wire.Thinking.Type != "disabled" {
			t.Errorf("wire.Thinking.Type = %q, want %q", wire.Thinking.Type, "disabled")
		}
		if wire.Model != "test-model" {
			t.Errorf("wire.Model = %q, want %q (provider default)", wire.Model, "test-model")
		}
		want := []wireMessage{
			{Role: "system", Content: "sys prompt"},
			{Role: "user", Content: "hi"},
		}
		if len(wire.Messages) != len(want) {
			t.Errorf("messages = %v, want %v", wire.Messages, want)
		} else {
			for i := range want {
				if wire.Messages[i] != want[i] {
					t.Errorf("messages[%d] = %v, want %v", i, wire.Messages[i], want[i])
				}
			}
		}

		_, _ = io.WriteString(w, "data: [DONE]\n")
	}))
	defer ts.Close()

	z := newTestProvider(ts.URL, ts.Client())
	ch, err := z.Stream(context.Background(), Request{
		SystemPrompt:   "sys prompt",
		MessageHistory: []Message{{Role: RoleUser, Message: "hi"}},
	})
	if err != nil {
		t.Fatalf("Stream returned unexpected error: %v", err)
	}
	if _, gotErr := drain(t, ch); gotErr != nil {
		t.Errorf("unexpected stream error: %v", gotErr)
	}
}

func TestZaiStreamContextCancel(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		flusher, ok := w.(http.Flusher)
		if !ok {
			t.Error("ResponseWriter does not support flushing")
			return
		}
		_, _ = io.WriteString(w, `data: {"choices":[{"delta":{"content":"first"}}]}`+"\n")
		flusher.Flush()
		// Hold the response open until the client disconnects.
		<-r.Context().Done()
	}))
	defer ts.Close()

	z := newTestProvider(ts.URL, ts.Client())
	ctx, cancel := context.WithCancel(context.Background())

	ch, err := z.Stream(ctx, Request{})
	if err != nil {
		t.Fatalf("Stream returned unexpected error: %v", err)
	}

	first, ok := <-ch
	if !ok {
		t.Fatal("expected at least one delta before cancel")
	}
	if first.Delta != "first" {
		t.Errorf("first delta = %q, want %q", first.Delta, "first")
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
	case <-time.After(2 * time.Second):
		t.Fatal("stream did not stop after context cancel (possible goroutine leak)")
	}
}
