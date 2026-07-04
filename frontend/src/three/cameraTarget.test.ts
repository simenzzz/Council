import { describe, expect, it } from "vitest";
import { initialState } from "../state/debateReducer";
import { buildState } from "../test/helpers";
import { fullDebate } from "../test/fixtures/events";
import { cameraTargetFor } from "./cameraTarget";
import { SEATING } from "./seating";

describe("cameraTargetFor", () => {
  it("frames the whole council when idle", () => {
    const t = cameraTargetFor(initialState);
    expect(t.lookAt).toEqual([0, 0.9, 0]);
    expect(t.distance).toBeGreaterThan(8);
  });

  it("dollies into the lone streaming panelist (sequential playback)", () => {
    // Buffered playback surfaces one speaker at a time, so the camera frames it.
    const [sx, , sz] = SEATING.skeptic.position;
    const t = cameraTargetFor(buildState([{ type: "token", persona: "skeptic", round: 1, delta: "hi" }]));
    expect(t.lookAt[0]).toBe(sx);
    expect(t.lookAt[2]).toBe(sz);
    expect(t.distance).toBeLessThan(8); // pulled in closer than the council shot
  });

  it("holds wide when no single panelist is streaming", () => {
    // Between turns (spoke, then went quiet, round complete) — nobody active.
    const between = cameraTargetFor(
      buildState([
        { type: "token", persona: "skeptic", round: 1, delta: "hi" },
        { type: "persona_done", persona: "skeptic", round: 1 },
        { type: "round_complete", round: 1 },
      ]),
    );
    expect(between.lookAt).toEqual([0, 0.9, 0]);
    expect(between.distance).toBeGreaterThan(8);

    // Fallback: if two panelists were ever active at once, don't chase one — hold.
    const concurrent = cameraTargetFor(
      buildState([
        { type: "token", persona: "skeptic", round: 1, delta: "a" },
        { type: "token", persona: "optimist", round: 1, delta: "b" },
      ]),
    );
    expect(concurrent.lookAt).toEqual([0, 0.9, 0]);
  });

  it("holds on the moderator while deliberating and on done", () => {
    const [mx, , mz] = SEATING.moderator.position;
    const moderating = cameraTargetFor(buildState(fullDebate.slice(0, fullDebate.length - 1)));
    expect(moderating.lookAt[0]).toBe(mx);
    expect(moderating.lookAt[2]).toBe(mz);

    const done = cameraTargetFor(buildState(fullDebate));
    expect(done.lookAt[0]).toBe(mx);
    expect(done.lookAt[2]).toBe(mz);
  });
});
