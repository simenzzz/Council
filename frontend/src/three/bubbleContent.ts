// bubbleContent — the pure model behind the in-scene speech bubbles (the 3D
// counterpart to the 2D transcript). It maps the single DebateState to one
// PersonaBubble per persona: the nameplate identity plus, when relevant, the
// text to float above that robot's head. Like robotVisualState/seating, it is
// dependency-free (no React/Three) so the bubble logic is unit-tested headlessly
// and the <Html> placement stays pure visual QA.
//
// Bubbles show only each persona's *latest round* contribution (a compact live
// view); the full round-by-round history lives in the transcript drawer. The
// moderator's bubble carries the verdict: the streaming synthesis while
// `moderating`, then the authoritative verdict text on `done`.

import { PERSONA_IDS, type PersonaId } from "../design/tokens";
import { MODERATOR_ID, personaMeta } from "../personas/registry";
import type { DebateState } from "../state/debateReducer";
import { robotVisualState, VERDICT_PHASES, type RobotVisualState } from "./robotVisualState";

// nameplate: identity only (no text panel). streaming: a panelist's live tokens.
// settled: a panelist's finished contribution. verdict: the moderator's synthesis.
export type BubbleMode = "nameplate" | "streaming" | "settled" | "verdict";

export type PersonaBubble = {
  id: PersonaId;
  displayName: string;
  role: string;
  /** Text to float above the head; "" when mode === "nameplate". */
  text: string;
  mode: BubbleMode;
  /** Tokens are actively streaming — drives the typing indicator + smooth reveal. */
  streaming: boolean;
  /** Verdict moment: a non-moderator dimmed while the moderator holds the floor. */
  dimmed: boolean;
};

/** The persona's most recent round contribution, or "" if it hasn't spoken. */
function latestRoundText(state: DebateState, id: PersonaId): string {
  const rounds = state.transcript[id];
  if (rounds === undefined) return "";
  const keys = Object.keys(rounds).map(Number);
  if (keys.length === 0) return "";
  const latest = Math.max(...keys);
  return rounds[latest] ?? "";
}

function panelistBubble(state: DebateState, visual: RobotVisualState): PersonaBubble {
  const meta = personaMeta[visual.id];
  const base = { id: visual.id, displayName: meta.displayName, role: meta.role, dimmed: visual.dimmed };
  // During the moderator's moment (shared VERDICT_PHASES) a panelist steps back to
  // its bare, dimmed nameplate so it doesn't crowd/overlap the spotlit verdict.
  if (VERDICT_PHASES.has(state.phase)) {
    return { ...base, text: "", mode: "nameplate", streaming: false };
  }
  switch (visual.status) {
    case "talking":
      return { ...base, text: latestRoundText(state, visual.id), mode: "streaming", streaming: true };
    case "done":
      return { ...base, text: latestRoundText(state, visual.id), mode: "settled", streaming: false };
    case "idle":
    case "thinking":
      return { ...base, text: "", mode: "nameplate", streaming: false };
  }
}

function moderatorBubble(state: DebateState, visual: RobotVisualState): PersonaBubble {
  const meta = personaMeta[MODERATOR_ID];
  const base = { id: MODERATOR_ID, displayName: meta.displayName, role: meta.role, dimmed: visual.dimmed };
  // Streaming synthesis mid-deliberation; the authoritative verdict once done.
  if (state.phase === "moderating") {
    return { ...base, text: latestRoundText(state, MODERATOR_ID), mode: "verdict", streaming: true };
  }
  if (state.phase === "done") {
    return { ...base, text: state.verdict, mode: "verdict", streaming: false };
  }
  return { ...base, text: "", mode: "nameplate", streaming: false };
}

/**
 * Derive one PersonaBubble per persona, in PERSONA_IDS order. Pure: builds fresh
 * objects from a fresh robotVisualState pass; never mutates `state`.
 */
export function personaBubbles(state: DebateState): PersonaBubble[] {
  const byId = new Map<PersonaId, RobotVisualState>(
    robotVisualState(state).map((v) => [v.id, v]),
  );
  return PERSONA_IDS.map((id) => {
    const visual = byId.get(id)!;
    return id === MODERATOR_ID ? moderatorBubble(state, visual) : panelistBubble(state, visual);
  });
}
