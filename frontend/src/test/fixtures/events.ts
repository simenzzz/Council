// Canned event logs mirroring the backend's emission order. Shared by reducer
// unit tests now and the F5 mock-WS E2E harness later. Each array is a sequence
// of validated wire events as they'd arrive over the socket.

import type { DebateEvent } from "../../lib/protocol";

const PANEL = ["skeptic", "optimist", "expert", "contrarian"] as const;

/** Tokens for a round, interleaved across personas (as the backend fans out). */
function interleavedRound(round: number): DebateEvent[] {
  const out: DebateEvent[] = [];
  // Two interleaved passes of deltas, then a persona_done per panelist.
  for (const delta of ["a", "b"]) {
    for (const persona of PANEL) {
      out.push({ type: "token", persona, round, delta: `${persona[0]}${delta}` });
    }
  }
  for (const persona of PANEL) {
    out.push({ type: "persona_done", persona, round });
  }
  out.push({ type: "round_complete", round });
  return out;
}

/** A complete, well-formed 2-round debate ending in a verdict. */
export const fullDebate: DebateEvent[] = [
  ...interleavedRound(1),
  ...interleavedRound(2),
  { type: "token", persona: "moderator", round: 3, delta: "Verdict " },
  { type: "token", persona: "moderator", round: 3, delta: "follows." },
  { type: "verdict", verdict: "## Final Verdict\nThe expert carries the round." },
];

/** A debate where one panelist's stream fails mid-round but the session goes on. */
export const debateWithPersonaError: DebateEvent[] = [
  { type: "token", persona: "skeptic", round: 1, delta: "hi" },
  { type: "error", persona: "expert", error: "stream failed" },
  { type: "persona_done", persona: "skeptic", round: 1 },
  { type: "round_complete", round: 1 },
  { type: "verdict", verdict: "done despite a failure" },
];

/** The session-level rejection the backend sends for an invalid request. */
export const sessionError: DebateEvent[] = [{ type: "error", error: "invalid request" }];
