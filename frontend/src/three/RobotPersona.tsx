// RobotPersona — a procedural robot built entirely from Three.js primitives (no
// GLB pipeline). The body is matte and dark so the emissive accent (visor, antenna
// tip, chest light) is what distinguishes each persona — a literal "each mind owns
// a neon signal" telemetry look. F4 differentiates the head silhouette, torso
// proportions, and material finish per persona (see robotShape.ts /
// three/parts/RobotHead.tsx) so the five read as distinct characters at a glance,
// not just five recolored clones — while keeping one shared chassis (pedestal,
// torso, chest light) so they still read as a matched council bench.
//
// F3 makes the robot react to the debate: a `visual` prop (derived purely in
// robotVisualState) drives a useFrame loop that eases the emissive glow, a vertical
// bob, head/antenna sway, and an accent spotlight toward the targets in
// robotAnimation — with a live pulse layered on while the robot transmits. All
// animation mutates refs directly, so it never triggers a React re-render.
//
// F4 adds one more one-shot cue on top of the steady state-driven glow: the
// moderator gets a brief emissive flash the instant its status crosses into
// "done" (the verdict just landed), decaying back to its normal steady glow
// over about a second. Detected locally (a status ref, not a new pure module)
// since it's a timing effect on an otherwise-pure animation, not new reactive
// state; skipped when the user prefers reduced motion, same as the pulse.
//
// The root group is tagged with the persona id (name + userData.personaId) so the
// scene-graph tests — and the animation layer — can find each robot.

import { memo, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Group, MathUtils, MeshStandardMaterial, PointLight } from "three";
import type { PersonaId } from "../design/tokens";
import { palette } from "../design/tokens";
import { MODERATOR_ID } from "../personas/registry";
import { targetsFor } from "./robotAnimation";
import type { RobotStatus, RobotVisualState } from "./robotVisualState";
import { GavelProp } from "./parts/GavelProp";
import { RobotHead } from "./parts/RobotHead";
import { shapeFor, type RobotShape } from "./robotShape";

type RobotPersonaProps = {
  id: PersonaId;
  /** Neon accent hex (from personas/registry → design tokens). */
  accent: string;
  position: readonly [number, number, number];
  rotationY: number;
  /** Subtle size cue; the moderator is rendered slightly larger. */
  scale?: number;
  /** Reactive state for this robot; defaults to a resting idle robot. */
  visual?: RobotVisualState;
  /** Silhouette/material descriptor; defaults to this persona's registry shape. */
  shape?: RobotShape;
  /** Freezes bob/sway/pulse when the user prefers reduced motion. */
  reducedMotion?: boolean;
};

// Matte dark chassis — low emissive so the accent reads as the only light source
// on the robot itself.
const BODY_COLOR = palette.panel;
const CHASSIS_DARK = "#0A0E1A";

// Base emissiveIntensity per accent mesh; the animation scales these by the
// status envelope's `emissive` multiplier (and a live pulse while speaking).
const RING_BASE = 1.8;
const CHEST_BASE = 2;
const VISOR_BASE = 2.6;
const TIP_BASE = 2.4;

// Depth of the speaking pulse (±35% of the eased glow) and its overall smoothing
// rate. Higher lambda = snappier easing toward each frame's target.
const PULSE_DEPTH = 0.35;
const LAMBDA = 4;

// The moderator's verdict-arrival flash: a brief additive boost on top of the
// normal pulse multiplier, decaying back to 0 (lambda ~3 fades to ~5% in ~1s).
const FLASH_PEAK = 1.2;
const FLASH_LAMBDA = 3;

function restingVisual(id: PersonaId): RobotVisualState {
  return { id, status: "idle", speaking: false, dimmed: false, round: 0 };
}

function RobotPersonaImpl({
  id,
  accent,
  position,
  rotationY,
  scale = 1,
  visual,
  shape,
  reducedMotion = false,
}: RobotPersonaProps) {
  // Stable resting fallback so the frame loop allocates nothing when `visual` is
  // absent (the default/standalone path; production always supplies one).
  const resting = useMemo(() => restingVisual(id), [id]);
  const robotShape = shape ?? shapeFor(id);
  const bob = useRef<Group>(null);
  const headTilt = useRef<Group>(null);
  const spotlight = useRef<PointLight>(null);
  const ring = useRef<MeshStandardMaterial>(null);
  const chest = useRef<MeshStandardMaterial>(null);
  const visor = useRef<MeshStandardMaterial>(null);
  const tip = useRef<MeshStandardMaterial>(null);
  const prevStatus = useRef<RobotStatus>("idle");
  const flashLevel = useRef(0);

  useFrame((frame, delta) => {
    const v = visual ?? resting;
    const t = targetsFor(v, reducedMotion);
    const clock = frame.clock.elapsedTime;
    // Clamp dt so a background-tab stall doesn't produce a huge easing step.
    const dt = Math.min(delta, 0.1);

    // Live pulse while transmitting; a steady 1 otherwise.
    const pulse = v.speaking ? 1 + PULSE_DEPTH * Math.sin(clock * t.speed * 2) : 1;

    // Verdict-arrival flash: fire once, the instant the moderator's status
    // crosses into "done" (the verdict just landed), then decay away.
    if (id === MODERATOR_ID && !reducedMotion && prevStatus.current !== "done" && v.status === "done") {
      flashLevel.current = FLASH_PEAK;
    }
    prevStatus.current = v.status;
    flashLevel.current = MathUtils.damp(flashLevel.current, 0, FLASH_LAMBDA, dt);
    const glowPulse = pulse + flashLevel.current;

    if (bob.current) {
      const target = t.bob * Math.sin(clock * t.speed);
      bob.current.position.y = MathUtils.damp(bob.current.position.y, target, LAMBDA, dt);
    }
    if (headTilt.current) {
      const z = t.sway * Math.sin(clock * t.speed * 0.9);
      const x = t.sway * 0.5 * Math.sin(clock * t.speed * 1.3);
      headTilt.current.rotation.z = MathUtils.damp(headTilt.current.rotation.z, z, LAMBDA, dt);
      headTilt.current.rotation.x = MathUtils.damp(headTilt.current.rotation.x, x, LAMBDA, dt);
    }
    if (spotlight.current) {
      spotlight.current.intensity = MathUtils.damp(
        spotlight.current.intensity,
        t.light * glowPulse,
        LAMBDA,
        dt,
      );
    }
    easeEmissive(ring.current, RING_BASE * t.emissive * glowPulse, dt);
    easeEmissive(chest.current, CHEST_BASE * t.emissive * glowPulse, dt);
    easeEmissive(visor.current, VISOR_BASE * t.emissive * glowPulse, dt);
    easeEmissive(tip.current, TIP_BASE * t.emissive * glowPulse, dt);
  });

  return (
    <group
      name={id}
      userData={{ personaId: id }}
      position={[position[0], position[1], position[2]]}
      rotation={[0, rotationY, 0]}
      scale={scale}
    >
      {/* Accent spotlight — swells while this robot holds the floor, fades to near
          dark when dimmed for the moderator's verdict moment. */}
      <pointLight
        ref={spotlight}
        color={accent}
        position={[0, 2.4, 0.6]}
        intensity={0}
        distance={5}
        decay={2}
      />

      {/* Everything below bobs together; the head/antenna add extra sway on top. */}
      <group ref={bob}>
        {/* Pedestal base */}
        <mesh position={[0, 0.12, 0]}>
          <cylinderGeometry args={[0.55, 0.62, 0.24, 24]} />
          <meshStandardMaterial color={CHASSIS_DARK} roughness={0.85} metalness={0.25} />
        </mesh>

        {/* Glowing accent ring around the base */}
        <mesh position={[0, 0.26, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.5, 0.035, 12, 48]} />
          <meshStandardMaterial
            ref={ring}
            color={CHASSIS_DARK}
            emissive={accent}
            emissiveIntensity={RING_BASE}
            toneMapped={false}
          />
        </mesh>

        {/* Torso — uniform XZ scale gives each persona a narrower/fuller build
            without a different geometry. */}
        <mesh position={[0, 0.92, 0]} scale={[robotShape.torsoScale, 1, robotShape.torsoScale]}>
          <capsuleGeometry args={[0.42, 0.7, 6, 16]} />
          <meshStandardMaterial color={BODY_COLOR} roughness={0.6} metalness={0.35} />
        </mesh>

        {/* Chest signal light */}
        <mesh position={[0, 0.98, 0.34]}>
          <boxGeometry args={[0.2, 0.2, 0.06]} />
          <meshStandardMaterial
            ref={chest}
            color={CHASSIS_DARK}
            emissive={accent}
            emissiveIntensity={CHEST_BASE}
            toneMapped={false}
          />
        </mesh>

        {/* Head + antenna — pivots around the neck for the sway; silhouette and
            finish come from this persona's shape descriptor. */}
        <RobotHead
          ref={headTilt}
          shape={robotShape}
          accent={accent}
          bodyColor={BODY_COLOR}
          chassisDark={CHASSIS_DARK}
          visorRef={visor}
          tipRef={tip}
        />

        {/* Presiding gavel — moderator only. */}
        {robotShape.gavel && <GavelProp accent={accent} />}
      </group>
    </group>
  );
}

// Ease a material's emissiveIntensity toward its target; a no-op if the ref isn't
// attached yet (materials mount a frame before the first useFrame tick can fire).
function easeEmissive(material: MeshStandardMaterial | null, target: number, dt: number): void {
  if (!material) return;
  material.emissiveIntensity = MathUtils.damp(material.emissiveIntensity, target, LAMBDA, dt);
}

// Only the derived visual changes per token, and robotVisualState hands back a
// fresh object every render — so compare the fields that actually drive the robot.
// Seat props (position/rotationY/scale) are stable across a session.
function visualEqual(a: RobotVisualState | undefined, b: RobotVisualState | undefined): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.status === b.status &&
    a.speaking === b.speaking &&
    a.dimmed === b.dimmed &&
    a.round === b.round
  );
}

function propsEqual(a: RobotPersonaProps, b: RobotPersonaProps): boolean {
  return (
    a.id === b.id &&
    a.accent === b.accent &&
    a.rotationY === b.rotationY &&
    a.scale === b.scale &&
    a.position === b.position &&
    a.shape === b.shape &&
    a.reducedMotion === b.reducedMotion &&
    visualEqual(a.visual, b.visual)
  );
}

// Memoized so a streamed token doesn't reconcile the ~20-element subtree of every
// robot whose derived status didn't change. Animation is ref-driven, independent
// of React re-renders, so skipping them costs nothing visually.
export const RobotPersona = memo(RobotPersonaImpl, propsEqual);
