import { describe, expect, it } from "vitest";
import { debateReducer, initialState, type DebateInput, type DebateState } from "./debateReducer";
import {
  debateWithPersonaError,
  fullDebate,
  sessionError,
} from "../test/fixtures/events";

function run(inputs: DebateInput[], from: DebateState = initialState): DebateState {
  return inputs.reduce(debateReducer, from);
}

describe("debateReducer — happy path", () => {
  it("streams a full 2-round debate to a verdict", () => {
    const state = run(fullDebate);
    expect(state.phase).toBe("done");
    expect(state.verdict).toContain("Final Verdict");
    expect(state.activeSpeakers).toEqual([]);
    expect(state.currentRound).toBe(3);
  });

  it("accumulates per-persona-per-round transcript text", () => {
    const state = run(fullDebate);
    // skeptic spoke in rounds 1 and 2 with deltas "sa","sb".
    expect(state.transcript.skeptic?.[1]).toBe("sasb");
    expect(state.transcript.skeptic?.[2]).toBe("sasb");
    expect(state.transcript.moderator?.[3]).toBe("Verdict follows.");
  });

  it("tracks active speakers as tokens stream and clears on done", () => {
    // Mid-round 1, before any persona_done, all four panelists are active.
    const midRound = fullDebate.slice(0, 8); // 2 delta passes × 4 personas
    const state = run(midRound);
    expect([...state.activeSpeakers].sort()).toEqual([
      "contrarian",
      "expert",
      "optimist",
      "skeptic",
    ]);
    expect(state.phase).toBe("debating");
  });

  it("enters the moderating phase on a moderator token", () => {
    const upToModerator = fullDebate.filter((e) => e.type !== "verdict");
    const state = run(upToModerator);
    expect(state.phase).toBe("moderating");
  });
});

describe("debateReducer — errors", () => {
  it("records a per-persona error without aborting the session", () => {
    const state = run(debateWithPersonaError);
    expect(state.phase).toBe("done");
    expect(state.errors).toHaveLength(1);
    expect(state.errors[0]).toEqual({ persona: "expert", message: "stream failed" });
  });

  it("aborts on a session-level error (no persona)", () => {
    const state = run(sessionError);
    expect(state.phase).toBe("error");
    expect(state.errors[0]).toEqual({ persona: undefined, message: "invalid request" });
  });

  it("treats a close before a verdict as an unexpected disconnect", () => {
    const state = run([
      { type: "token", persona: "skeptic", round: 1, delta: "x" },
      { kind: "status", status: "closed" },
    ]);
    expect(state.phase).toBe("error");
    expect(state.errors.at(-1)?.message).toMatch(/closed before a verdict/);
  });

  it("treats a close after a verdict as normal", () => {
    const state = run([...fullDebate, { kind: "status", status: "closed" }]);
    expect(state.phase).toBe("done");
    expect(state.errors).toEqual([]);
  });
});

describe("debateReducer — abnormal close after success (the C1 regression)", () => {
  it("stays 'done' through the browser's error→close that follows every CloseNow", () => {
    // The backend always closes abnormally, so the browser fires a transport
    // 'error' status then 'closed' even on a successful debate. Neither may
    // clobber the verdict's 'done' phase.
    const state = run([
      ...fullDebate,
      { kind: "status", status: "error" },
      { kind: "status", status: "closed" },
    ]);
    expect(state.phase).toBe("done");
    expect(state.errors).toEqual([]);
  });
});

describe("debateReducer — transport & cancel", () => {
  it("records a transport error without aborting a live debate", () => {
    const state = run([
      { type: "token", persona: "skeptic", round: 1, delta: "x" },
      { kind: "transport", message: "frame is not valid JSON" },
    ]);
    expect(state.phase).toBe("debating");
    expect(state.errors).toEqual([{ message: "frame is not valid JSON" }]);
  });

  it("treats a user cancel as a clean 'stopped' terminal, not an error", () => {
    const state = run([
      { type: "token", persona: "skeptic", round: 1, delta: "x" },
      { kind: "cancel" },
    ]);
    expect(state.phase).toBe("stopped");
    expect(state.activeSpeakers).toEqual([]);
    expect(state.errors).toEqual([]);
  });

  it("ignores a cancel once already done", () => {
    const state = run([...fullDebate, { kind: "cancel" }]);
    expect(state.phase).toBe("done");
  });
});

describe("debateReducer — per-persona error edge cases", () => {
  it("clears the failed persona from active speakers (no ghost streamer)", () => {
    const state = run([
      { type: "token", persona: "expert", round: 1, delta: "partial" },
      { type: "error", persona: "expert", error: "stream failed" },
    ]);
    expect(state.activeSpeakers).toEqual([]);
    expect(state.phase).toBe("debating"); // non-terminal: others continue
  });

  it("treats a moderator failure as terminal (no verdict will come)", () => {
    const state = run([
      { type: "token", persona: "moderator", round: 3, delta: "weighing…" },
      { type: "error", persona: "moderator", error: "stream failed" },
    ]);
    expect(state.phase).toBe("error");
    expect(state.activeSpeakers).toEqual([]);
  });
});

describe("debateReducer — lifecycle", () => {
  it("resets to a clean connecting state", () => {
    const dirty = run(fullDebate);
    const fresh = debateReducer(dirty, { kind: "status", status: "connecting" });
    expect(fresh.phase).toBe("connecting");
    expect(fresh.transcript).toEqual({});
    expect(fresh.verdict).toBe("");
  });
});

describe("debateReducer — immutability", () => {
  it("never mutates the prior state or its nested objects", () => {
    const before = run(fullDebate.slice(0, 4)); // one delta pass, round 1
    const beforeSnapshot = structuredClone(before);
    const after = debateReducer(before, {
      type: "token",
      persona: "skeptic",
      round: 1,
      delta: "!",
    });

    expect(after).not.toBe(before);
    expect(after.transcript).not.toBe(before.transcript);
    expect(after.transcript.skeptic).not.toBe(before.transcript.skeptic);
    // The original is byte-for-byte unchanged.
    expect(before).toEqual(beforeSnapshot);
  });
});
