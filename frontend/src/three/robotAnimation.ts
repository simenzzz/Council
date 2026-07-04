// robotAnimation — the pure status → animation-target map. Splitting the tunable
// curves out of RobotPersona keeps the component lean and puts the "how energetic"
// decision behind a testable boundary: targetsFor is a pure numeric function, so
// the relative magnitudes (talking louder than thinking louder than idle; dimmed
// collapses toward dark) are asserted headlessly. The time-varying pulse itself
// stays in the component's frame loop.
//
// Tuning is "energetic broadcast": visible bob, clear head/antenna sway, and bright
// accent pulses while a robot transmits — with the verdict moment (dimmed) fading
// the panel almost to black so the moderator owns the frame.

import type { RobotStatus, RobotVisualState } from "./robotVisualState";

export type RobotTargets = {
  /** Multiplier applied to each mesh's base emissiveIntensity. */
  emissive: number;
  /** Vertical bob amplitude, in world units. */
  bob: number;
  /** Head/antenna sway amplitude, in radians. */
  sway: number;
  /** Oscillation frequency multiplier for bob/sway/pulse. */
  speed: number;
  /** Accent point-light intensity. */
  light: number;
};

// Per-status envelopes. Ordered dark→bright so the relative magnitudes are
// self-evident and test-checkable: talking > thinking > idle on emissive/light.
// Frozen so the pure contract (a hot-path consumer only reads these) is enforced,
// not merely conventional — an accidental mutation would corrupt every robot.
const BASE: Record<RobotStatus, Readonly<RobotTargets>> = {
  idle: Object.freeze({ emissive: 0.7, bob: 0.015, sway: 0.02, speed: 0.6, light: 0.35 }),
  thinking: Object.freeze({ emissive: 0.95, bob: 0.03, sway: 0.05, speed: 1.4, light: 0.9 }),
  talking: Object.freeze({ emissive: 1.6, bob: 0.05, sway: 0.14, speed: 3.2, light: 2.6 }),
  done: Object.freeze({ emissive: 1.05, bob: 0.02, sway: 0.015, speed: 0.8, light: 1.0 }),
};

// How far a dimmed (verdict-moment) robot's glow collapses toward dark.
const DIM_EMISSIVE = 0.12;
const DIM_LIGHT = 0.05;

/**
 * Animation targets for a robot's current visual state. Pure.
 *
 * `reducedMotion` zeroes the oscillatory channels (bob, sway, and the speed
 * that drives both them and the speaking pulse) so the frame loop settles to
 * a still pose — but leaves `emissive`/`light` untouched, so the active
 * speaker is still highlighted, just without any motion.
 */
export function targetsFor(v: RobotVisualState, reducedMotion = false): RobotTargets {
  const base = BASE[v.status];
  const dimmed = v.dimmed
    ? { ...base, emissive: base.emissive * DIM_EMISSIVE, light: base.light * DIM_LIGHT }
    : base;
  if (!reducedMotion) return dimmed;
  return { ...dimmed, bob: 0, sway: 0, speed: 0 };
}
