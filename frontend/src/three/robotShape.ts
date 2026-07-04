// robotShape — pure per-persona geometry descriptor for the procedural robots.
// F2/F3 gave every persona the same head shape; only accent (and the
// moderator's overall scale) told them apart. F4 differentiates silhouettes
// (faceted / round / visored / diamond / centered), plus head accessories —
// the expert's mortarboard cap, the moderator's gavel — while keeping one shared
// chassis (pedestal, torso capsule, chest light,
// antenna) — the five should still read as a matched council bench, not a
// grab-bag of unrelated forms. Pure data + a lookup function, so the shape
// contract is unit-testable without mounting a scene; RobotHead.tsx is the
// only place that turns a shape into geometry.

import { PERSONA_IDS, type PersonaId } from "../design/tokens";

export type HeadKind = "faceted" | "round" | "visored" | "diamond" | "centered";

export type RobotShape = {
  /** Head silhouette — the primary at-a-glance identity cue. */
  head: HeadKind;
  /** Permanent head yaw bias (radians), layered under the animated sway. */
  headTiltBias: number;
  /** Antenna lateral offset (world units) from center. */
  antennaOffsetX: number;
  /** Head/torso material roughness — lower reads cooler/harder. */
  roughness: number;
  /** Head/torso material metalness — higher reads more machined. */
  metalness: number;
  /** Uniform XZ scale on the torso capsule — narrower/fuller proportions. */
  torsoScale: number;
  /** Renders the presiding gavel prop; moderator only. */
  gavel: boolean;
  /** Renders a graduation cap + tassel atop the head; expert only. */
  mortarboard: boolean;
};

const SHAPES: Record<PersonaId, Readonly<RobotShape>> = {
  // Angular and cool: a faceted head, narrower torso, hard metallic finish.
  skeptic: Object.freeze({
    head: "faceted",
    headTiltBias: 0,
    antennaOffsetX: 0,
    roughness: 0.2,
    metalness: 0.65,
    torsoScale: 0.88,
    gavel: false,
    mortarboard: false,
  }),
  // Bright and round: a soft spherical head, fuller torso, warmer matte finish.
  optimist: Object.freeze({
    head: "round",
    headTiltBias: 0,
    antennaOffsetX: 0,
    roughness: 0.7,
    metalness: 0.15,
    torsoScale: 1.14,
    gavel: false,
    mortarboard: false,
  }),
  // Scholarly: a visor brow over the eyes plus a graduation cap; neutral
  // proportions and finish.
  expert: Object.freeze({
    head: "visored",
    headTiltBias: 0,
    antennaOffsetX: 0,
    roughness: 0.45,
    metalness: 0.4,
    torsoScale: 1.0,
    gavel: false,
    mortarboard: true,
  }),
  // Off-kilter by design: a corner-standing diamond head, a permanent tilt, and
  // an antenna set to one side.
  contrarian: Object.freeze({
    head: "diamond",
    headTiltBias: 0.22,
    antennaOffsetX: 0.14,
    roughness: 0.5,
    metalness: 0.35,
    torsoScale: 1.0,
    gavel: false,
    mortarboard: false,
  }),
  // Centered and authoritative: symmetric head, presiding gavel prop.
  moderator: Object.freeze({
    head: "centered",
    headTiltBias: 0,
    antennaOffsetX: 0,
    roughness: 0.35,
    metalness: 0.5,
    torsoScale: 1.05,
    gavel: true,
    mortarboard: false,
  }),
};

/** Persona → shape descriptor. Pure lookup; fails fast on an unknown id. */
export function shapeFor(id: PersonaId): RobotShape {
  const shape = SHAPES[id];
  if (!shape) throw new Error(`robotShape: no shape defined for persona "${id}"`);
  return shape;
}

// Fail fast if the registry ever grows a persona without a shape (mirrors
// seating.ts's coverage guard) rather than handing the stage an undefined one.
for (const id of PERSONA_IDS) {
  if (!SHAPES[id]) throw new Error(`robotShape: no shape defined for persona "${id}"`);
}
