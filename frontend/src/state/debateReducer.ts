// debateReducer — a pure, immutable (state, input) => state function. It is the
// single source of debate state; F1's transcript columns and F2+'s 3D stage
// both derive their views from it. Every update returns NEW objects — no input
// is ever mutated (immutability is a hard project rule).
//
// Inputs are either a validated wire DebateEvent or a control signal (transport
// status, a boundary/transport error, or a user cancel). Termination is decided
// here, not by the socket: the backend always closes abnormally (CloseNow, no
// close frame), so the browser fires `error` THEN `close` on every session,
// success included. We therefore key "done" off the `verdict` event and treat a
// transport `error` status as advisory — only a `close` that arrives before a
// verdict (and isn't a deliberate cancel) is an unexpected disconnect.

import type { DebateEvent, PersonaId } from "../lib/protocol";
import type { WsStatus } from "../lib/wsClient";

export type DebatePhase =
  | "idle"
  | "connecting"
  | "debating"
  | "moderating"
  | "done"
  | "stopped"
  | "error";

export type DebateError = {
  persona?: PersonaId;
  message: string;
};

export type DebateState = {
  phase: DebatePhase;
  currentRound: number;
  /** Accumulated text keyed by persona, then by round number. */
  transcript: Partial<Record<PersonaId, Record<number, string>>>;
  /** Personas whose tokens are currently streaming. */
  activeSpeakers: readonly PersonaId[];
  verdict: string;
  errors: readonly DebateError[];
};

/** Control signals, distinct from wire events. */
export type ControlInput =
  | { kind: "status"; status: WsStatus }
  | { kind: "transport"; message: string }
  | { kind: "cancel" };

export type DebateInput = DebateEvent | ControlInput;

// Bounds so a hostile or runaway stream can't grow state without limit.
const MAX_ERRORS = 50;
const MAX_CELL_CHARS = 200_000;

export const initialState: DebateState = {
  phase: "idle",
  currentRound: 0,
  transcript: {},
  activeSpeakers: [],
  verdict: "",
  errors: [],
};

const TERMINAL: ReadonlySet<DebatePhase> = new Set(["done", "stopped", "error"]);

function withActive(active: readonly PersonaId[], persona: PersonaId): readonly PersonaId[] {
  return active.includes(persona) ? active : [...active, persona];
}

function withoutActive(active: readonly PersonaId[], persona: PersonaId): readonly PersonaId[] {
  return active.filter((p) => p !== persona);
}

function withError(errors: readonly DebateError[], err: DebateError): readonly DebateError[] {
  const next = [...errors, err];
  return next.length > MAX_ERRORS ? next.slice(next.length - MAX_ERRORS) : next;
}

function appendDelta(
  transcript: DebateState["transcript"],
  persona: PersonaId,
  round: number,
  delta: string,
): DebateState["transcript"] {
  const personaRounds = transcript[persona] ?? {};
  const existing = personaRounds[round] ?? "";
  const combined = existing + delta;
  const capped = combined.length > MAX_CELL_CHARS ? combined.slice(0, MAX_CELL_CHARS) : combined;
  return {
    ...transcript,
    [persona]: { ...personaRounds, [round]: capped },
  };
}

function reduceControl(state: DebateState, input: ControlInput): DebateState {
  switch (input.kind) {
    case "transport":
      // Boundary/transport failure: record it, but never tear down a live
      // debate — one bad frame or a flaky socket shouldn't abort the session.
      return { ...state, errors: withError(state.errors, { message: input.message }) };
    case "cancel":
      // A deliberate user stop is a clean terminal state, not an error.
      return TERMINAL.has(state.phase) ? state : { ...state, phase: "stopped", activeSpeakers: [] };
    case "status":
      return reduceStatus(state, input.status);
  }
}

function reduceStatus(state: DebateState, status: WsStatus): DebateState {
  switch (status) {
    case "connecting":
      return { ...initialState, phase: "connecting" };
    case "closed":
      // The verdict (→ "done") or a deliberate cancel (→ "stopped") is the real
      // end; a close in any other phase is an unexpected mid-debate disconnect.
      if (TERMINAL.has(state.phase)) return state;
      return {
        ...state,
        phase: "error",
        errors: withError(state.errors, { message: "connection closed before a verdict" }),
      };
    default:
      // "open" / "idle" / "error" are advisory — the browser fires a transport
      // "error" before every abnormal close, so it must not change phase.
      return state;
  }
}

function reduceEvent(state: DebateState, event: DebateEvent): DebateState {
  switch (event.type) {
    case "token": {
      const phase: DebatePhase = event.persona === "moderator" ? "moderating" : "debating";
      return {
        ...state,
        phase,
        currentRound: event.round,
        transcript: appendDelta(state.transcript, event.persona, event.round, event.delta),
        activeSpeakers: withActive(state.activeSpeakers, event.persona),
      };
    }
    case "persona_done":
      return { ...state, activeSpeakers: withoutActive(state.activeSpeakers, event.persona) };
    case "round_complete":
      return { ...state, currentRound: event.round };
    case "verdict":
      return {
        ...state,
        phase: "done",
        verdict: event.verdict,
        activeSpeakers: withoutActive(state.activeSpeakers, "moderator"),
      };
    case "error": {
      // A persona that errored is no longer streaming. A session-level error
      // (no persona) or a moderator failure (the sole source of the verdict) is
      // terminal; any other per-persona failure is recorded and the debate
      // continues.
      const activeSpeakers = event.persona
        ? withoutActive(state.activeSpeakers, event.persona)
        : state.activeSpeakers;
      const errors = withError(state.errors, {
        persona: event.persona,
        message: event.error || "an error occurred",
      });
      const terminal = event.persona === undefined || event.persona === "moderator";
      return { ...state, phase: terminal ? "error" : state.phase, activeSpeakers, errors };
    }
  }
}

export function debateReducer(state: DebateState, input: DebateInput): DebateState {
  if ("kind" in input) return reduceControl(state, input);
  return reduceEvent(state, input);
}
