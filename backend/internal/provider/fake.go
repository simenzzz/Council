package provider

import "context"

// FakeProvider is a deterministic Provider double for tests. It emits a fixed
// sequence of deltas, then an optional terminal error, mirroring the streaming
// shape of a real provider (one goroutine, a closed-when-done channel, and a
// select on ctx.Done() before every send).
//
// It lives in package provider (rather than a _test.go file) so future packages
// — notably the orchestrator — can reuse it in their own tests. The tradeoff is
// that it ships in the binary; promote it to an internal/provider/providertest
// subpackage (the net/http/httptest idiom) once an external consumer exists.
type FakeProvider struct {
	// Deltas are emitted in order, each as StreamEvent{Delta: d}.
	Deltas []string
	// Err, if non-nil, is emitted as a terminal StreamEvent{Err: ...} after the
	// deltas.
	Err error
	// StreamErr, if non-nil, is returned as the error from Stream itself (with a
	// nil channel), mirroring a request-construction failure in a real provider.
	StreamErr error
}

var _ Provider = (*FakeProvider)(nil)

// Stream returns a channel that yields the configured deltas and optional
// terminal error. The producing goroutine closes the channel when done and
// stops early if ctx is cancelled, so callers that abandon the stream do not
// leak the goroutine.
func (f *FakeProvider) Stream(ctx context.Context, req Request) (<-chan StreamEvent, error) {
	if f.StreamErr != nil {
		return nil, f.StreamErr
	}

	out := make(chan StreamEvent)
	go func() {
		defer close(out)

		for _, delta := range f.Deltas {
			select {
			case <-ctx.Done():
				return
			case out <- StreamEvent{Delta: delta}:
			}
		}

		if f.Err != nil {
			select {
			case <-ctx.Done():
			case out <- StreamEvent{Err: f.Err}:
			}
		}
	}()
	return out, nil
}
