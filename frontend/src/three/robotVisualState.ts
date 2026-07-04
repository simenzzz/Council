// robotVisualState — the pure heart of F3's reactivity. It maps the single
// DebateState (the same tree the 2D transcript reads) to one RobotVisualState per
// persona, so the 3D stage never owns debate state — it only *renders* a derived
// view. Kept dependency-free (no React/Three), like seating.ts, so the reactive
// logic is unit-tested headlessly; only the animation curves are visual QA.
//
// The semantic vocabulary mirrors the transcript's status derivation
// (activeSpeakers → speaking; text-but-quiet → done) and adds a "thinking" state
// for a panelist awaiting its turn, plus the moderator "verdict moment": while the
// moderator synthesizes, the panel is dimmed and only the moderator stays lit.

import { PERSONA_IDS, type PersonaId } from "../design/tokens";
import { MODERATOR_ID } from "../personas/registry";
import type { DebatePhase, DebateState } from "../state/debateReducer";

export type RobotStatus = "idle" | "thinking" | "talking" | "done";

export type RobotVisualState = {
  id: PersonaId;
  /** Semantic activity of this robot, derived purely from debate state. */
  status: RobotStatus;
  /** status === "talking": the transmitting speaker (spotlight + strongest motion). */
  speaking: boolean;
  /** Verdict moment: a non-moderator while the moderator holds the floor. */
  dimmed: boolean;
  /** Current debate round (1-indexed; 0 before the first token). */
  round: number;
};

// The moderator holds the floor during these phases; panelists dim behind it.
// Exported as the single source of truth: the same phase set gates panelist
// dimming (here), the bubble suppression in bubbleContent, and the moderator
// camera zoom in cameraTarget — they must never desync.
export const VERDICT_PHASES: ReadonlySet<DebatePhase> = new Set(["moderating", "done"]);

/** Has this persona produced any text in the given round? */
function hasSpokenIn(state: DebateState, id: PersonaId, round: number): boolean {
  const rounds = state.transcript[id];
  return rounds !== undefined && round in rounds;
}

/** Has this persona produced any text at all, in any round? */
function hasSpokenEver(state: DebateState, id: PersonaId): boolean {
  const rounds = state.transcript[id];
  return rounds !== undefined && Object.keys(rounds).length > 0;
}

// A panelist: talking while its tokens stream; done once it has spoken and gone
// quiet; thinking while a round is underway but it hasn't spoken this round yet.
// activeSpeakers is only honored while debating — a terminal phase must settle
// robots to rest even if a disconnect left a stale speaker on the roster.
function panelistStatus(state: DebateState, id: PersonaId): RobotStatus {
  switch (state.phase) {
    case "idle":
    case "connecting":
      return "idle";
    case "debating":
      if (state.activeSpeakers.includes(id)) return "talking";
      // A token is what sets `debating`, so currentRound is always >= 1 here.
      return hasSpokenIn(state, id, state.currentRound) ? "done" : "thinking";
    case "moderating":
    case "done":
    case "stopped":
    case "error":
      // The debate is over for panelists: those that contributed settle to done.
      return hasSpokenEver(state, id) ? "done" : "idle";
  }
}

// The moderator presides quietly (idle) through the debate, holds the floor while
// synthesizing (talking), and settles once the verdict lands (done). `moderating`
// coincides exactly with the moderator being active (a moderator token sets both,
// and only the verdict → `done` clears it), so phase alone is authoritative.
function moderatorStatus(state: DebateState): RobotStatus {
  if (state.phase === "moderating") return "talking";
  if (state.phase === "done") return "done";
  if (state.phase === "stopped" || state.phase === "error") {
    return hasSpokenEver(state, MODERATOR_ID) ? "done" : "idle";
  }
  return "idle";
}

/**
 * Derive one RobotVisualState per persona, in PERSONA_IDS order. Pure: returns
 * fresh objects and never reads mutably from or writes to `state`.
 */
export function robotVisualState(state: DebateState): RobotVisualState[] {
  const inVerdict = VERDICT_PHASES.has(state.phase);
  return PERSONA_IDS.map((id) => {
    const status = id === MODERATOR_ID ? moderatorStatus(state) : panelistStatus(state, id);
    return {
      id,
      status,
      speaking: status === "talking",
      dimmed: inVerdict && id !== MODERATOR_ID,
      round: state.currentRound,
    };
  });
}
