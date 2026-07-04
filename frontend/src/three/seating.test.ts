import { describe, expect, it } from "vitest";
import { PERSONA_IDS } from "../design/tokens";
import { MODERATOR_ID, PANELISTS } from "../personas/registry";
import { SEATING } from "./seating";

describe("SEATING", () => {
  it("has a seat for every persona", () => {
    for (const id of PERSONA_IDS) {
      expect(SEATING[id]).toBeDefined();
    }
    expect(Object.keys(SEATING)).toHaveLength(PERSONA_IDS.length);
  });

  it("places every robot on the floor (y = 0)", () => {
    for (const id of PERSONA_IDS) {
      expect(SEATING[id].position[1]).toBe(0);
    }
  });

  it("gives every persona a distinct position", () => {
    const keys = PERSONA_IDS.map((id) => SEATING[id].position.join(","));
    expect(new Set(keys).size).toBe(PERSONA_IDS.length);
  });

  it("seats the moderator at the head — farthest back and centered", () => {
    const mod = SEATING[MODERATOR_ID];
    // Dead center on X, facing straight toward the camera (no rotation).
    expect(mod.position[0]).toBeCloseTo(0);
    expect(mod.rotationY).toBeCloseTo(0);
    // Farthest from the camera (most negative Z) of all seats.
    const modZ = mod.position[2];
    for (const id of PANELISTS) {
      expect(modZ).toBeLessThan(SEATING[id].position[2]);
    }
  });

  it("arranges the panelists as a symmetric front arc facing the center", () => {
    const [skeptic, optimist, expert, contrarian] = PANELISTS.map((id) => SEATING[id]);

    // Mirror-symmetric pairs across the X axis.
    expect(skeptic.position[0]).toBeCloseTo(-contrarian.position[0]);
    expect(optimist.position[0]).toBeCloseTo(-expert.position[0]);
    expect(skeptic.position[2]).toBeCloseTo(contrarian.position[2]);
    expect(optimist.position[2]).toBeCloseTo(expert.position[2]);

    // Outer seats sit wider and nearer the camera than the inner pair (an arc).
    expect(Math.abs(skeptic.position[0])).toBeGreaterThan(Math.abs(optimist.position[0]));
    expect(skeptic.position[2]).toBeGreaterThan(optimist.position[2]);

    // Each panelist is yawed away from straight-ahead to face the table center.
    for (const id of PANELISTS) {
      expect(SEATING[id].rotationY).not.toBeCloseTo(0);
    }
  });
});
