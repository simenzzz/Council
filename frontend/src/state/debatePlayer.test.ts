// debatePlayer tests — drive the player with a scripted CONCURRENT stream (the
// shape the backend actually produces) under fake timers, then fold the events it
// dispatches back through the real reducer to assert the observable outcome:
// deterministic turn order, one active speaker at a time, faithful transcript, and
// correct terminal handling (verdict, truncation, cancel).

import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import type { DebateEvent, PersonaId } from "../lib/protocol";
import { debateReducer, initialState, type DebateInput, type DebateState } from "./debateReducer";
import { DebatePlayer } from "./debatePlayer";

const PANELISTS: PersonaId[] = ["skeptic", "optimist", "expert", "contrarian"];

// A few ticks in — enough to be mid-playback but nowhere near done.
const TICK_A_FEW = 1000;

/** A full concurrent debate: `rounds` panelist rounds then a moderator verdict. */
function concurrentDebate(rounds: number): DebateEvent[] {
  const events: DebateEvent[] = [];
  for (let r = 1; r <= rounds; r++) {
    // All four fan out "at once": interleave a couple of token bursts each.
    for (const p of PANELISTS) events.push({ type: "token", persona: p, round: r, delta: `${p} r${r} ` });
    for (const p of PANELISTS) events.push({ type: "token", persona: p, round: r, delta: "more words " });
    for (const p of PANELISTS) events.push({ type: "persona_done", persona: p, round: r });
    events.push({ type: "round_complete", round: r });
  }
  const modRound = rounds + 1;
  events.push({ type: "token", persona: "moderator", round: modRound, delta: "final verdict " });
  events.push({ type: "token", persona: "moderator", round: modRound, delta: "synthesis here" });
  events.push({ type: "verdict", verdict: "The council has decided." });
  return events;
}

/** Fold a dispatched input log through the real reducer, capturing every state. */
function foldStates(inputs: DebateInput[]): DebateState[] {
  const states: DebateState[] = [];
  let s = initialState;
  for (const input of inputs) {
    s = debateReducer(s, input);
    states.push(s);
  }
  return states;
}

function personaDoneOrder(inputs: DebateInput[]): string[] {
  return inputs
    .filter((i): i is Extract<DebateEvent, { type: "persona_done" }> => !("kind" in i) && i.type === "persona_done")
    .map((i) => `${i.persona}:${i.round}`);
}

describe("DebatePlayer", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function play(events: DebateEvent[], opts?: { close?: boolean; reducedMotion?: boolean }) {
    const inputs: DebateInput[] = [];
    const player = new DebatePlayer({
      dispatch: (i) => inputs.push(i),
      reducedMotion: opts?.reducedMotion ?? false,
    });
    player.feedStatus("connecting");
    for (const e of events) player.feed(e);
    if (opts?.close) player.feedStatus("closed");
    vi.runAllTimers();
    return { inputs, player };
  }

  it("replays a two-round debate one persona at a time, in registry order, moderator last", () => {
    const { inputs } = play(concurrentDebate(2), { close: true });

    expect(personaDoneOrder(inputs)).toEqual([
      "skeptic:1",
      "optimist:1",
      "expert:1",
      "contrarian:1",
      "skeptic:2",
      "optimist:2",
      "expert:2",
      "contrarian:2",
    ]);

    const states = foldStates(inputs);
    const maxActive = Math.max(...states.map((s) => s.activeSpeakers.length));
    expect(maxActive).toBeLessThanOrEqual(1);
  });

  it("reconstructs the full transcript and lands on the verdict", () => {
    const { inputs } = play(concurrentDebate(2), { close: true });
    const final = foldStates(inputs).at(-1)!;

    expect(final.phase).toBe("done");
    expect(final.verdict).toBe("The council has decided.");
    expect(final.transcript.skeptic?.[1]).toBe("skeptic r1 more words ");
    expect(final.transcript.contrarian?.[2]).toBe("contrarian r2 more words ");
    // The moderator's synthesis is paced into the transcript too.
    expect(final.transcript.moderator?.[3]).toBe("final verdict synthesis here");
  });

  it("does not error when the socket closes after the verdict", () => {
    const { inputs } = play(concurrentDebate(2), { close: true });
    // The deferred close must be swallowed, not turned into a terminal error.
    const forwardedClose = inputs.some((i) => "kind" in i && i.kind === "status" && i.status === "closed");
    expect(forwardedClose).toBe(false);
    expect(foldStates(inputs).at(-1)!.phase).toBe("done");
  });

  it("surfaces a truncated stream (close before verdict) as a terminal error after replaying what arrived", () => {
    // Only round 1 completes, then the socket drops with no verdict.
    const events: DebateEvent[] = [];
    for (const p of PANELISTS) events.push({ type: "token", persona: p, round: 1, delta: `${p} ` });
    for (const p of PANELISTS) events.push({ type: "persona_done", persona: p, round: 1 });
    events.push({ type: "round_complete", round: 1 });

    const { inputs } = play(events, { close: true });

    // Round 1 still played out fully, in order...
    expect(personaDoneOrder(inputs)).toEqual(["skeptic:1", "optimist:1", "expert:1", "contrarian:1"]);
    // ...and the truncation is surfaced as the reducer's terminal error.
    const final = foldStates(inputs).at(-1)!;
    expect(final.phase).toBe("error");
    expect(final.errors.some((e) => /closed/i.test(e.message))).toBe(true);
  });

  it("records a per-persona error without ending the debate", () => {
    const events: DebateEvent[] = [];
    for (const p of PANELISTS) {
      if (p === "optimist") {
        events.push({ type: "error", persona: "optimist", error: "optimist stream failed" });
      } else {
        events.push({ type: "token", persona: p, round: 1, delta: `${p} ` });
      }
    }
    for (const p of PANELISTS) if (p !== "optimist") events.push({ type: "persona_done", persona: p, round: 1 });
    events.push({ type: "round_complete", round: 1 });
    events.push({ type: "token", persona: "moderator", round: 2, delta: "verdict text" });
    events.push({ type: "verdict", verdict: "Decided despite the gap." });

    const { inputs } = play(events, { close: true });
    const final = foldStates(inputs).at(-1)!;

    expect(final.phase).toBe("done");
    expect(final.errors.some((e) => e.persona === "optimist")).toBe(true);
  });

  it("reveals each turn in a single dispatch under reduced motion", () => {
    const { inputs } = play(concurrentDebate(1), { close: true, reducedMotion: true });
    const skepticTokens = inputs.filter(
      (i): i is Extract<DebateEvent, { type: "token" }> =>
        !("kind" in i) && i.type === "token" && i.persona === "skeptic",
    );
    expect(skepticTokens).toHaveLength(1);
    expect(skepticTokens[0].delta).toBe("skeptic r1 more words ");
  });

  it("parks when playback outruns the arriving stream, then resumes as later rounds land", () => {
    // The core of the buffer-while-playing design: deliver only round 1, let the
    // player drain it, confirm it PARKs waiting for round 2, then feed round 2 +
    // the verdict and confirm feed() un-parks the scheduler.
    const inputs: DebateInput[] = [];
    const player = new DebatePlayer({ dispatch: (i) => inputs.push(i), reducedMotion: false });
    player.feedStatus("connecting");

    for (const p of PANELISTS) player.feed({ type: "token", persona: p, round: 1, delta: `${p} r1 ` });
    for (const p of PANELISTS) player.feed({ type: "persona_done", persona: p, round: 1 });
    player.feed({ type: "round_complete", round: 1 });

    // Drain everything round 1 has to offer; the scheduler then parks (no timer).
    vi.advanceTimersByTime(60_000);
    // The last speaker's persona_done is deferred (held active through the beat),
    // so only the first three round-1 dones have flushed while parked.
    expect(personaDoneOrder(inputs)).toEqual(["skeptic:1", "optimist:1", "expert:1"]);
    expect(foldStates(inputs).at(-1)!.activeSpeakers).toEqual(["contrarian"]);

    // Parked: more time alone dispatches nothing further.
    const parkedCount = inputs.length;
    vi.advanceTimersByTime(60_000);
    expect(inputs.length).toBe(parkedCount);

    // Later data un-parks playback via pump().
    for (const p of PANELISTS) player.feed({ type: "token", persona: p, round: 2, delta: `${p} r2 ` });
    for (const p of PANELISTS) player.feed({ type: "persona_done", persona: p, round: 2 });
    player.feed({ type: "round_complete", round: 2 });
    player.feed({ type: "token", persona: "moderator", round: 3, delta: "verdict" });
    player.feed({ type: "verdict", verdict: "Resumed and decided." });
    vi.runAllTimers();

    expect(personaDoneOrder(inputs)).toEqual([
      "skeptic:1",
      "optimist:1",
      "expert:1",
      "contrarian:1",
      "skeptic:2",
      "optimist:2",
      "expert:2",
      "contrarian:2",
    ]);
    const final = foldStates(inputs).at(-1)!;
    expect(final.phase).toBe("done");
    expect(final.verdict).toBe("Resumed and decided.");
  });

  it("reset() cancels any pending playback", () => {
    const inputs: DebateInput[] = [];
    const player = new DebatePlayer({ dispatch: (i) => inputs.push(i), reducedMotion: false });
    player.feedStatus("connecting");
    for (const e of concurrentDebate(2)) player.feed(e);

    // Let a few paced steps run, then abort mid-playback.
    vi.advanceTimersByTime(TICK_A_FEW);
    const countAtReset = inputs.length;
    player.reset();
    vi.runAllTimers();

    expect(inputs.length).toBe(countAtReset); // nothing dispatched after reset
  });
});
