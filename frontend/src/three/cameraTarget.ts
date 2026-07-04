// cameraTarget — the pure decision of *what the camera should frame* for a given
// DebateState. The CameraDirector eases the live camera toward this; keeping the
// choice pure (no React/Three) means the framing logic is unit-tested headlessly
// while only the easing curve is visual QA.
//
// The rule: buffered playback lets exactly one panelist hold the floor at a time
// (see state/debatePlayer), so the camera dollies into whichever seat is currently
// speaking. When no single panelist is streaming — idle, or any fallback where the
// roster isn't exactly one — we hold the wide council shot (all seats framed, no
// overlap). The moderator's solo deliberation/verdict is also a dolly-in moment.

import type { PersonaId } from "../design/tokens";
import { MODERATOR_ID } from "../personas/registry";
import type { DebateState } from "../state/debateReducer";
import { VERDICT_PHASES } from "./robotVisualState";
import { HEAD_LABEL_HEIGHT, SEATING } from "./seating";

export type CameraTarget = {
  /** Point the camera orbits/looks at. */
  lookAt: readonly [number, number, number];
  /** Desired distance from that point (dolly in to focus, out for the council). */
  distance: number;
};

// The wide establishing shot: the table centre, framing all five seats.
const COUNCIL_LOOK: readonly [number, number, number] = [0, 0.9, 0];
const COUNCIL_DISTANCE = 8.4;

// A focused shot on one seat: a touch below the bubble so both head and bubble
// sit in frame, pulled in closer than the establishing shot.
const FOCUS_HEIGHT = HEAD_LABEL_HEIGHT - 0.9;
const FOCUS_DISTANCE = 6.2;

/** Frame a single seat's head area. */
function focusSeat(id: PersonaId): CameraTarget {
  const [x, , z] = SEATING[id].position;
  return { lookAt: [x, FOCUS_HEIGHT, z], distance: FOCUS_DISTANCE };
}

/**
 * Where the camera should be looking for this state. Pure: derives from the phase
 * and the static seating; never mutates `state`.
 */
export function cameraTargetFor(state: DebateState): CameraTarget {
  // Hold on the moderator through its whole solo moment (synthesis → verdict, the
  // shared VERDICT_PHASES); every other phase (idle, the concurrent panelist
  // debate, terminal) stays wide.
  if (VERDICT_PHASES.has(state.phase)) {
    return focusSeat(MODERATOR_ID);
  }
  // Sequential playback means exactly one panelist streams at a time — dolly into
  // that speaker. Any other shape (idle, a between-turns gap, or a ≥2 concurrent
  // fallback) holds the wide establishing shot.
  if (state.phase === "debating" && state.activeSpeakers.length === 1) {
    return focusSeat(state.activeSpeakers[0]);
  }
  return { lookAt: COUNCIL_LOOK, distance: COUNCIL_DISTANCE };
}
