import { describe, expect, it } from "vitest";
import { PERSONA_IDS } from "../design/tokens";
import { MODERATOR_ID, PANELISTS } from "../personas/registry";
import { shapeFor } from "./robotShape";

describe("shapeFor", () => {
  it("has a shape for every persona", () => {
    for (const id of PERSONA_IDS) {
      expect(shapeFor(id)).toBeDefined();
    }
  });

  it("gives only the moderator a gavel", () => {
    expect(shapeFor(MODERATOR_ID).gavel).toBe(true);
    for (const id of PANELISTS) {
      expect(shapeFor(id).gavel).toBe(false);
    }
  });

  it("gives only the expert a mortarboard", () => {
    expect(shapeFor("expert").mortarboard).toBe(true);
    for (const id of PERSONA_IDS.filter((p) => p !== "expert")) {
      expect(shapeFor(id).mortarboard).toBe(false);
    }
  });

  it("gives the contrarian a diamond head — tilted with an offset antenna", () => {
    const shape = shapeFor("contrarian");
    expect(shape.head).toBe("diamond");
    expect(shape.headTiltBias).not.toBe(0);
    expect(shape.antennaOffsetX).not.toBe(0);
  });

  it("keeps every other persona's head centered (no tilt, no antenna offset)", () => {
    for (const id of PANELISTS.filter((p) => p !== "contrarian")) {
      const shape = shapeFor(id);
      expect(shape.headTiltBias).toBe(0);
      expect(shape.antennaOffsetX).toBe(0);
    }
    expect(shapeFor(MODERATOR_ID).headTiltBias).toBe(0);
  });

  it("gives every persona a distinct head kind", () => {
    const kinds = PERSONA_IDS.map((id) => shapeFor(id).head);
    expect(new Set(kinds).size).toBe(PERSONA_IDS.length);
  });

  it("keeps every torso scale, roughness, and metalness in a sane render range", () => {
    for (const id of PERSONA_IDS) {
      const shape = shapeFor(id);
      expect(shape.torsoScale).toBeGreaterThan(0);
      expect(shape.roughness).toBeGreaterThanOrEqual(0);
      expect(shape.roughness).toBeLessThanOrEqual(1);
      expect(shape.metalness).toBeGreaterThanOrEqual(0);
      expect(shape.metalness).toBeLessThanOrEqual(1);
    }
  });
});
