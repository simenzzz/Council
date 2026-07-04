// robotVisualState tests — fold the shared canned event logs through the REAL
// reducer (via buildState), then assert the derived per-persona visual state at
// key moments of a debate. This matches debateReducer.test.ts's style: never
// hand-build state, always drive the same fixtures the E2E harness will replay.

import { describe, expect, it } from "vitest";
import { buildState } from "../test/helpers";
import {
  debateWithPersonaError,
  fullDebate,
  sessionError,
} from "../test/fixtures/events";
import { initialState, type DebateState } from "../state/debateReducer";
import type { PersonaId } from "../design/tokens";
import { robotVisualState, type RobotStatus } from "./robotVisualState";

// Lookup helper — the array is in PERSONA_IDS order, but tests read by id.
function statusOf(state: DebateState, id: PersonaId): RobotStatus {
  return robotVisualState(state).find((v) => v.id === id)!.status;
}

function visualOf(state: DebateState, id: PersonaId) {
  return robotVisualState(state).find((v) => v.id === id)!;
}

// fullDebate layout: each round is 8 tokens + 4 persona_done + 1 round_complete
// = 13 events. Round 1 = [0,13); round 2 = [13,26); moderator + verdict = [26,29).
const PANEL: readonly PersonaId[] = ["skeptic", "optimist", "expert", "contrarian"];

describe("robotVisualState — before a debate starts", () => {
  it("reports every robot idle at initial state", () => {
    const visuals = robotVisualState(initialState);
    expect(visuals).toHaveLength(5);
    expect(visuals.every((v) => v.status === "idle")).toBe(true);
    expect(visuals.every((v) => !v.speaking && !v.dimmed)).toBe(true);
    expect(visuals.every((v) => v.round === 0)).toBe(true);
  });

  it("keeps robots idle while merely connecting", () => {
    const state = buildState([{ kind: "status", status: "connecting" }]);
    expect(robotVisualState(state).every((v) => v.status === "idle")).toBe(true);
  });
});

describe("robotVisualState — mid debate", () => {
  it("marks every panelist talking while their tokens stream, moderator idle", () => {
    // First 8 events of round 1 = two token passes across the four panelists,
    // before any persona_done.
    const state = buildState(fullDebate.slice(0, 8));
    for (const id of PANEL) {
      expect(statusOf(state, id)).toBe("talking");
    }
    expect(statusOf(state, "moderator")).toBe("idle");
    expect(visualOf(state, "skeptic").speaking).toBe(true);
  });

  it("settles a panelist to done after its persona_done while others talk on", () => {
    // 8 tokens + skeptic's persona_done: skeptic is quiet, the rest still stream.
    const state = buildState(fullDebate.slice(0, 9));
    expect(statusOf(state, "skeptic")).toBe("done");
    expect(statusOf(state, "optimist")).toBe("talking");
    expect(statusOf(state, "expert")).toBe("talking");
    expect(statusOf(state, "contrarian")).toBe("talking");
  });

  it("shows panelists thinking when the next round opens before they speak", () => {
    // Round 1 fully done (13 events) + round 2's first token (skeptic): the round
    // has advanced to 2, skeptic transmits, the others await their turn.
    const state = buildState(fullDebate.slice(0, 14));
    expect(state.currentRound).toBe(2);
    expect(statusOf(state, "skeptic")).toBe("talking");
    expect(statusOf(state, "optimist")).toBe("thinking");
    expect(statusOf(state, "expert")).toBe("thinking");
    expect(statusOf(state, "contrarian")).toBe("thinking");
  });
});

describe("robotVisualState — the verdict moment", () => {
  it("spotlights the moderator and dims the panel while it synthesizes", () => {
    // Through the first moderator token (index 26): phase = moderating.
    const state = buildState(fullDebate.slice(0, 27));
    expect(state.phase).toBe("moderating");
    expect(statusOf(state, "moderator")).toBe("talking");
    expect(visualOf(state, "moderator").dimmed).toBe(false);
    for (const id of PANEL) {
      expect(statusOf(state, id)).toBe("done");
      expect(visualOf(state, id).dimmed).toBe(true);
    }
  });

  it("settles the moderator to done and keeps the panel dimmed once the verdict lands", () => {
    const state = buildState(fullDebate);
    expect(state.phase).toBe("done");
    expect(statusOf(state, "moderator")).toBe("done");
    expect(visualOf(state, "moderator").dimmed).toBe(false);
    for (const id of PANEL) {
      expect(visualOf(state, id).dimmed).toBe(true);
    }
  });
});

describe("robotVisualState — errors", () => {
  it("never leaves an errored persona stuck talking", () => {
    // After the expert's stream error (event index 2), the expert never spoke and
    // is not active — it must not read as talking.
    const state = buildState(debateWithPersonaError.slice(0, 2));
    expect(statusOf(state, "expert")).not.toBe("talking");
    expect(statusOf(state, "skeptic")).toBe("talking");
  });

  it("reports idle robots for a session-level rejection", () => {
    const state = buildState(sessionError);
    expect(state.phase).toBe("error");
    // Nobody produced any text, so no robot is falsely lit.
    expect(robotVisualState(state).every((v) => v.status === "idle")).toBe(true);
  });

  it("never leaves a robot stuck talking after a mid-stream disconnect", () => {
    // Panelists are streaming (round 1) when the socket drops before any verdict.
    const state = buildState([...fullDebate.slice(0, 8), { kind: "status", status: "closed" }]);
    expect(state.phase).toBe("error");
    expect(robotVisualState(state).every((v) => v.status !== "talking")).toBe(true);
    // Those that had produced text settle to done; the moderator (silent) stays idle.
    for (const id of PANEL) expect(statusOf(state, id)).toBe("done");
    expect(statusOf(state, "moderator")).toBe("idle");
  });

  it("never leaves a robot stuck talking after a mid-stream session error", () => {
    const state = buildState([
      ...fullDebate.slice(0, 8),
      { type: "error", error: "backend exploded" },
    ]);
    expect(state.phase).toBe("error");
    expect(robotVisualState(state).every((v) => v.status !== "talking")).toBe(true);
  });
});

describe("robotVisualState — purity", () => {
  it("does not mutate the input state", () => {
    const state = buildState(fullDebate.slice(0, 14));
    const before = structuredClone(state);
    robotVisualState(state);
    expect(state).toEqual(before);
  });

  it("returns fresh objects on each call", () => {
    const a = robotVisualState(initialState);
    const b = robotVisualState(initialState);
    expect(a).not.toBe(b);
    expect(a[0]).not.toBe(b[0]);
    expect(a).toEqual(b);
  });
});
