// robotAnimation tests — the animation envelope is pure, so assert its shape by
// relative magnitude (not exact tuning constants, which are free to be retuned for
// visual QA): louder statuses glow and swing more, and the verdict-moment dim
// collapses a robot's glow toward dark.

import { describe, expect, it } from "vitest";
import type { PersonaId } from "../design/tokens";
import type { RobotStatus, RobotVisualState } from "./robotVisualState";
import { targetsFor } from "./robotAnimation";

function visual(status: RobotStatus, dimmed = false): RobotVisualState {
  return {
    id: "skeptic" as PersonaId,
    status,
    speaking: status === "talking",
    dimmed,
    round: 1,
  };
}

describe("targetsFor — status envelope", () => {
  it("orders emissive glow talking > thinking > idle", () => {
    const talking = targetsFor(visual("talking")).emissive;
    const thinking = targetsFor(visual("thinking")).emissive;
    const idle = targetsFor(visual("idle")).emissive;
    expect(talking).toBeGreaterThan(thinking);
    expect(thinking).toBeGreaterThan(idle);
  });

  it("gives the talking speaker the strongest motion and light", () => {
    const talking = targetsFor(visual("talking"));
    const idle = targetsFor(visual("idle"));
    expect(talking.sway).toBeGreaterThan(idle.sway);
    expect(talking.bob).toBeGreaterThan(idle.bob);
    expect(talking.speed).toBeGreaterThan(idle.speed);
    expect(talking.light).toBeGreaterThan(idle.light);
  });

  it("settles done to a calm steady glow, quieter than talking", () => {
    const done = targetsFor(visual("done"));
    const talking = targetsFor(visual("talking"));
    expect(done.sway).toBeLessThan(talking.sway);
    expect(done.speed).toBeLessThan(talking.speed);
    expect(done.emissive).toBeGreaterThan(0);
  });
});

describe("targetsFor — verdict-moment dim", () => {
  it("collapses emissive and light toward dark without touching motion", () => {
    const lit = targetsFor(visual("done", false));
    const dimmed = targetsFor(visual("done", true));
    expect(dimmed.emissive).toBeLessThan(lit.emissive);
    expect(dimmed.light).toBeLessThan(lit.light);
    // Dimming is a lighting cue only — the bob/sway envelope is unchanged.
    expect(dimmed.bob).toBe(lit.bob);
    expect(dimmed.sway).toBe(lit.sway);
  });
});

describe("targetsFor — reduced motion", () => {
  it("zeroes the oscillatory channels for a talking speaker", () => {
    const talking = targetsFor(visual("talking"), true);
    expect(talking.bob).toBe(0);
    expect(talking.sway).toBe(0);
    expect(talking.speed).toBe(0);
  });

  it("still highlights the active speaker via emissive/light, just without motion", () => {
    const reduced = targetsFor(visual("talking"), true);
    const idleReduced = targetsFor(visual("idle"), true);
    expect(reduced.emissive).toBeGreaterThan(0);
    expect(reduced.emissive).toBeGreaterThan(idleReduced.emissive);
    expect(reduced.light).toBeGreaterThan(idleReduced.light);
  });

  it("leaves emissive/light identical to full motion (only motion channels change)", () => {
    const full = targetsFor(visual("talking"));
    const reduced = targetsFor(visual("talking"), true);
    expect(reduced.emissive).toBe(full.emissive);
    expect(reduced.light).toBe(full.light);
  });

  it("composes with the verdict dim (motion zeroed, glow still collapsed)", () => {
    const reducedDimmed = targetsFor(visual("done", true), true);
    expect(reducedDimmed.bob).toBe(0);
    expect(reducedDimmed.sway).toBe(0);
    expect(reducedDimmed.emissive).toBeLessThan(targetsFor(visual("done", false), true).emissive);
  });
});
