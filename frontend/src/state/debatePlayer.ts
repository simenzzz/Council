// DebatePlayer — a buffering, paced re-scheduler that sits between the socket and
// the reducer. The backend fans out all personas concurrently and LLM tokens
// arrive far faster than anyone can read, so the raw stream is unwatchable. This
// player RECORDS the concurrent stream without dispatching it, then REPLAYS it into
// the reducer one persona at a time, in a deterministic order (panelists
// round-robin per round, the moderator last), revealing each turn at a calm,
// human-readable cadence.
//
// It re-emits the SAME wire `DebateEvent` shapes the reducer already understands,
// only reordered and slowed — so phase transitions, sounds, the robot spotlight,
// the head bubbles, and the verdict panel all keep working unchanged. Because
// tokens now reach the reducer one persona at a time, `activeSpeakers` naturally
// collapses to a single id, which is what the camera and robot highlight key off.
//
// Kept free of React so the scheduling logic is unit-tested headlessly with fake
// timers; only the on-screen cadence is visual QA. The reducer stays the single,
// pure source of truth — this changes cadence and order, never data.

import type { DebateEvent, ErrorEvent, PersonaId } from "../lib/protocol";
import type { WsStatus } from "../lib/wsClient";
import type { DebateInput } from "./debateReducer";
import { MODERATOR_ID, PANELISTS } from "../personas/registry";

// Pacing (tunable): reveal one whitespace-delimited word per TICK_MS (~3 words/s),
// with a short beat between speakers so the camera can settle on the new one.
const TICK_MS = 300;
const TURN_GAP_MS = 550;

// Cap buffered text per (persona, round) exactly as the reducer caps display
// (MAX_CELL_CHARS), so a runaway or hostile stream can't grow the buffer without
// bound before it ever reaches the reducer.
const MAX_TURN_CHARS = 200_000;

// step() sentinels, distinct from any real (positive) delay in ms.
const PARK = -1; // blocked: waiting for more recorded data before the next turn.
const DONE = -2; // playback finished (or finalized); nothing left to schedule.

export type Dispatch = (input: DebateInput) => void;

export type DebatePlayerOptions = {
  dispatch: Dispatch;
  /** Override reduced-motion (tests); defaults to the OS preference. */
  reducedMotion?: boolean;
};

type Cursor =
  | { kind: "panelist"; round: number; index: number }
  | { kind: "moderator" }
  | { kind: "done" };

type ActiveTurn = {
  persona: PersonaId;
  round: number;
  /** Panelist seat index, or -1 for the moderator. */
  index: number;
  text: string;
  pos: number;
  isModerator: boolean;
};

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function isSpace(ch: string): boolean {
  return ch === " " || ch === "\n" || ch === "\t" || ch === "\r";
}

/** End index of the next word (plus its trailing whitespace) from `pos`. Never stalls. */
function nextChunkEnd(text: string, pos: number): number {
  let i = pos;
  while (i < text.length && !isSpace(text[i])) i++; // the word
  while (i < text.length && isSpace(text[i])) i++; // its trailing spaces
  return i > pos ? i : Math.min(text.length, pos + 1);
}

export class DebatePlayer {
  private readonly dispatch: Dispatch;
  private readonly reducedMotion: boolean;
  private timer: ReturnType<typeof setTimeout> | null = null;

  // --- Recording (populated by feed*, never dispatched as it arrives) ---------
  private text = new Map<PersonaId, Map<number, string>>();
  private roundComplete = new Set<number>();
  private personaErrors = new Map<PersonaId, ErrorEvent>();
  private verdict: string | null = null;
  private sessionError: ErrorEvent | null = null;
  private closed = false;
  private moderatorRound: number | null = null;

  // --- Playback schedule ------------------------------------------------------
  private cursor: Cursor = { kind: "panelist", round: 1, index: 0 };
  private active: ActiveTurn | null = null;
  // The just-finished speaker's done/round_complete/errors are deferred until the
  // next turn starts, so that speaker stays "active" (camera + spotlight hold on
  // it) through the inter-turn beat, then A→B flips in a single synchronous batch.
  private pendingDone: { persona: PersonaId; round: number } | null = null;
  private pendingRoundComplete: number | null = null;
  private pendingErrors: ErrorEvent[] = [];

  constructor(opts: DebatePlayerOptions) {
    this.dispatch = opts.dispatch;
    this.reducedMotion = opts.reducedMotion ?? prefersReducedMotion();
  }

  // --- Inbound: record, then try to make progress ----------------------------

  /** Record one validated wire event. Nothing is dispatched here. */
  feed(event: DebateEvent): void {
    switch (event.type) {
      case "token":
        this.appendText(event.persona, event.round, event.delta);
        if (event.persona === MODERATOR_ID) this.moderatorRound = event.round;
        break;
      case "persona_done":
        // Ignored: the player synthesizes its own persona_done on replay.
        break;
      case "round_complete":
        this.roundComplete.add(event.round);
        break;
      case "verdict":
        this.verdict = event.verdict;
        break;
      case "error":
        // A session-level (no persona) or moderator error is terminal; any other
        // per-persona failure is surfaced during that persona's turn. Deferring a
        // per-persona error to its turn is safe because `round_complete` is the
        // backend's per-round terminal signal — no per-persona error can arrive
        // after that round is playable, so it is never replayed past its turn.
        if (event.persona === undefined || event.persona === MODERATOR_ID) {
          this.sessionError = event;
        } else {
          this.personaErrors.set(event.persona, event);
        }
        break;
    }
    this.pump();
  }

  /** Transport status. `connecting` and `closed` are handled specially. */
  feedStatus(status: WsStatus): void {
    if (status === "connecting") {
      // A new session: clear any prior recording/schedule, then let the reducer
      // reset to its connecting phase.
      this.reset();
      this.dispatch({ kind: "status", status: "connecting" });
      return;
    }
    if (status === "closed") {
      // The socket closes right after the verdict, while we may still be mid
      // replay. Never forward it live (the reducer would abort playback with a
      // "closed before a verdict" error); capture it and decide at the end.
      this.closed = true;
      this.pump();
      return;
    }
    // open / error / idle are advisory — the reducer no-ops on them.
    this.dispatch({ kind: "status", status });
  }

  /** A boundary/transport error: advisory, non-fatal — pass straight through. */
  feedTransport(message: string): void {
    this.dispatch({ kind: "transport", message });
  }

  /** Cancel playback and clear all recorded/scheduled state. Dispatches nothing. */
  reset(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.text = new Map();
    this.roundComplete = new Set();
    this.personaErrors = new Map();
    this.verdict = null;
    this.sessionError = null;
    this.closed = false;
    this.moderatorRound = null;
    this.cursor = { kind: "panelist", round: 1, index: 0 };
    this.active = null;
    this.pendingDone = null;
    this.pendingRoundComplete = null;
    this.pendingErrors = [];
  }

  // --- Scheduler --------------------------------------------------------------

  /** Kick the scheduler if idle; a no-op while a step is already scheduled. */
  private pump(): void {
    if (this.timer !== null) return;
    const delay = this.step();
    if (delay === PARK || delay === DONE) return; // parked or finished: stay idle
    this.timer = setTimeout(() => {
      this.timer = null;
      this.pump();
    }, delay);
  }

  /** Perform one unit of work synchronously; return the delay until the next. */
  private step(): number {
    if (this.active === null) {
      const started = this.prepareNextTurn();
      if (started !== null) return started; // PARK or DONE
      // active is now set — fall through and reveal its first chunk in this same
      // synchronous step, bundled with the previous turn's flushed persona_done.
    }
    return this.revealStep();
  }

  /**
   * Advance the cursor to the next playable turn and make it active, or return
   * PARK (waiting for data) / DONE (nothing left). Flushes the previous turn's
   * deferred done/round_complete/errors as it commits, so they land in the same
   * synchronous batch as the new turn's first token (no wide-shot flicker).
   */
  private prepareNextTurn(): number | null {
    const c = this.cursor;
    if (c.kind === "done") return DONE;

    if (c.kind === "panelist") {
      if (!this.roundComplete.has(c.round)) {
        // This round isn't buffered yet. If the stream has terminated, no further
        // panelist rounds are coming — hand off to the moderator/terminal.
        if (this.terminalKnown()) {
          this.cursor = { kind: "moderator" };
          return this.prepareNextTurn();
        }
        return PARK;
      }
      const persona = PANELISTS[c.index];
      this.flushPending();
      this.active = {
        persona,
        round: c.round,
        index: c.index,
        text: this.getText(persona, c.round),
        pos: 0,
        isModerator: false,
      };
      return null;
    }

    // Moderator turn: playable once the verdict is recorded.
    if (this.verdict === null) {
      if (this.sessionError !== null || this.closed) {
        this.flushPending();
        this.finalizeTerminal();
        this.cursor = { kind: "done" };
        return DONE;
      }
      return PARK;
    }
    this.flushPending();
    const round = this.moderatorRound ?? this.maxPanelRound() + 1;
    const text = this.getText(MODERATOR_ID, round);
    if (text === "") {
      // No synthesis text buffered — go straight to the authoritative verdict.
      this.dispatch({ type: "verdict", verdict: this.verdict });
      this.cursor = { kind: "done" };
      return DONE;
    }
    this.active = { persona: MODERATOR_ID, round, index: -1, text, pos: 0, isModerator: true };
    return null;
  }

  /** Reveal one chunk of the active turn, or finalize it when fully revealed. */
  private revealStep(): number {
    const a = this.active!;
    if (a.pos >= a.text.length) {
      if (a.isModerator) {
        // The moderator emits no persona_done; the verdict is its terminal signal.
        this.dispatch({ type: "verdict", verdict: this.verdict ?? "" });
        this.active = null;
        this.cursor = { kind: "done" };
        return DONE;
      }
      // Defer this panelist's done/error/round_complete until the next turn opens.
      this.pendingDone = { persona: a.persona, round: a.round };
      const err = this.personaErrors.get(a.persona);
      if (err !== undefined) {
        this.pendingErrors.push(err);
        this.personaErrors.delete(a.persona);
      }
      if (a.index === PANELISTS.length - 1) this.pendingRoundComplete = a.round;
      this.cursor =
        a.index < PANELISTS.length - 1
          ? { kind: "panelist", round: a.round, index: a.index + 1 }
          : { kind: "panelist", round: a.round + 1, index: 0 };
      this.active = null;
      return TURN_GAP_MS;
    }
    const end = this.reducedMotion ? a.text.length : nextChunkEnd(a.text, a.pos);
    const delta = a.text.slice(a.pos, end);
    a.pos = end;
    this.dispatch({ type: "token", persona: a.persona, round: a.round, delta });
    return TICK_MS;
  }

  private terminalKnown(): boolean {
    return this.verdict !== null || this.sessionError !== null || this.closed;
  }

  /** Emit the recorded terminal signal (reached only when no verdict arrived). */
  private finalizeTerminal(): void {
    if (this.sessionError !== null) {
      this.dispatch(this.sessionError); // reducer → phase "error"
    } else if (this.closed) {
      this.dispatch({ kind: "status", status: "closed" }); // → "closed before a verdict"
    }
  }

  private flushPending(): void {
    if (this.pendingDone !== null) {
      this.dispatch({
        type: "persona_done",
        persona: this.pendingDone.persona,
        round: this.pendingDone.round,
      });
      this.pendingDone = null;
    }
    if (this.pendingRoundComplete !== null) {
      this.dispatch({ type: "round_complete", round: this.pendingRoundComplete });
      this.pendingRoundComplete = null;
    }
    for (const err of this.pendingErrors) this.dispatch(err);
    this.pendingErrors = [];
  }

  // --- Recording helpers ------------------------------------------------------

  private appendText(persona: PersonaId, round: number, delta: string): void {
    let rounds = this.text.get(persona);
    if (rounds === undefined) {
      rounds = new Map();
      this.text.set(persona, rounds);
    }
    const combined = (rounds.get(round) ?? "") + delta;
    rounds.set(round, combined.length > MAX_TURN_CHARS ? combined.slice(0, MAX_TURN_CHARS) : combined);
  }

  private getText(persona: PersonaId, round: number): string {
    return this.text.get(persona)?.get(round) ?? "";
  }

  private maxPanelRound(): number {
    let max = 0;
    for (const r of this.roundComplete) if (r > max) max = r;
    return max;
  }
}
