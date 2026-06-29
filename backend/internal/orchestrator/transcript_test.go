package orchestrator

import "testing"

// TestTranscriptAppendImmutable is the core Phase-3 invariant: Append must return
// a new Transcript and never mutate the receiver, even when two appends branch
// off the same base (which would expose a shared/aliased backing array).
func TestTranscriptAppendImmutable(t *testing.T) {
	var base Transcript
	r1 := Round{Number: 1, Answers: []personaAnswer{{PersonaID: "a", Name: "A", Text: "one"}}}
	t1 := base.Append(r1)

	if len(base.rounds) != 0 {
		t.Errorf("Append mutated the receiver: base has %d rounds, want 0", len(base.rounds))
	}
	if len(t1.rounds) != 1 {
		t.Fatalf("t1 has %d rounds, want 1", len(t1.rounds))
	}

	// Branch two appends off t1. If Append reused t1's backing array, the second
	// append would overwrite the first's round-2 slot.
	t2 := t1.Append(Round{Number: 2, Answers: []personaAnswer{{PersonaID: "a", Text: "two"}}})
	t3 := t1.Append(Round{Number: 2, Answers: []personaAnswer{{PersonaID: "a", Text: "three"}}})

	if len(t1.rounds) != 1 {
		t.Errorf("t1 grew to %d rounds after later appends; Append is not immutable", len(t1.rounds))
	}
	if got2, got3 := t2.rounds[1].Answers[0].Text, t3.rounds[1].Answers[0].Text; got2 != "two" || got3 != "three" {
		t.Errorf("aliased backing array: t2=%q t3=%q, want two/three", got2, got3)
	}
}

func TestTranscriptQueries(t *testing.T) {
	tr := Transcript{}.Append(Round{Number: 1, Answers: []personaAnswer{
		{PersonaID: "a", Name: "A", Text: "ta"},
		{PersonaID: "b", Name: "B", Text: "tb"},
	}})

	others := tr.othersFor("a")
	if len(others) != 1 || others[0].PersonaID != "b" {
		t.Errorf("othersFor(a) = %+v, want only b", others)
	}

	own, ok := tr.ownLatest("a")
	if !ok || own.Text != "ta" {
		t.Errorf("ownLatest(a) = %+v ok=%v, want {a … ta} true", own, ok)
	}
	if _, ok := tr.ownLatest("missing"); ok {
		t.Error("ownLatest(missing) ok=true, want false")
	}
}

// TestRenderAnswers confirms the shared formatter skips empty (errored) answers
// and labels the rest by display name.
func TestRenderAnswers(t *testing.T) {
	got := renderAnswers([]personaAnswer{
		{Name: "A", Text: "alpha"},
		{Name: "B", Text: ""}, // errored / produced nothing → skipped
		{Name: "C", Text: "gamma"},
	})
	want := "[A]: alpha\n\n[C]: gamma\n\n"
	if got != want {
		t.Errorf("renderAnswers = %q, want %q", got, want)
	}
}
