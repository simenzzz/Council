// seating.ts — pure seat geometry for the 3D council chamber. The council is a
// shallow bowl that opens toward the camera: every persona sits on an arc and
// faces the table center (the origin), so the four panelists read as a curved
// front bench with the moderator presiding at the head — dead center, set a
// little farther back on a larger radius. This is plain maths/data with no React
// or Three.js runtime dependency, reused by the static stage now and by F3's
// animations later. Identity (names, accents) stays in personas/registry.ts;
// only the geometry lives here.

import { PERSONA_IDS, type PersonaId } from "../design/tokens";
import { MODERATOR_ID, PANELISTS } from "../personas/registry";

export type Seat = {
  /** World position of the robot's base, on the chamber floor (y = 0). */
  position: readonly [number, number, number];
  /** Y-axis rotation (radians) so the robot faces the table center. */
  rotationY: number;
};

const DEG = Math.PI / 180;

// Radius of the seating arc; the moderator sits slightly farther out so it reads
// as presiding at the head rather than as a fifth panelist.
const PANEL_RADIUS = 3.2;
const MODERATOR_RADIUS = 3.6;

// Height (world units, above the seat base at y=0) at which a persona's speech
// bubble floats — clear of the robot's head. Shared by PersonaLabel (the <Html>
// anchor) and the camera director (what it frames), so both agree on "the head".
export const HEAD_LABEL_HEIGHT = 2.5;

// Panelist fan angles (degrees from the back-center −Z axis), in PANELISTS
// seating order: outer seats sit wider and nearer the camera, so the four curve
// around the front of the table.
const PANEL_ANGLES_DEG = [-70, -35, 35, 70] as const;

if (PANEL_ANGLES_DEG.length !== PANELISTS.length) {
  // Fail fast if the registry's panelist list and the fan angles drift apart.
  throw new Error(
    `seating: ${PANELISTS.length} panelists but ${PANEL_ANGLES_DEG.length} seat angles`,
  );
}

// A seat on the circle of the given radius, at `angleDeg` from back-center.
// rotateY(a)·(0,0,−1) places it on the arc; facing the center means the robot's
// front (+Z) points back to the origin, which is exactly rotationY = a.
function seatAt(angleDeg: number, radius: number): Seat {
  const a = angleDeg * DEG;
  return {
    position: [-radius * Math.sin(a), 0, -radius * Math.cos(a)],
    rotationY: a,
  };
}

const panelEntries = PANELISTS.map(
  (id, i) => [id, seatAt(PANEL_ANGLES_DEG[i], PANEL_RADIUS)] as const,
);

/** PersonaId → seat. All five personas; immutable lookup for the stage. */
export const SEATING: Record<PersonaId, Seat> = {
  ...Object.fromEntries(panelEntries),
  [MODERATOR_ID]: seatAt(0, MODERATOR_RADIUS),
} as Record<PersonaId, Seat>;

// The `as` cast above can't prove full coverage, so enforce it at module load:
// if the registry ever grows a persona without a seat, fail fast rather than
// hand the stage an undefined seat.
for (const id of PERSONA_IDS) {
  if (!SEATING[id]) {
    throw new Error(`seating: no seat defined for persona "${id}"`);
  }
}
