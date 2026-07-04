// RobotHead — the head geometry switch driven by a persona's RobotShape. The
// head is the primary at-a-glance identity cue (faceted / round / visored /
// diamond / centered); the visor and antenna-tip materials stay refs so
// RobotPersona's useFrame loop can keep easing their emissive glow exactly as
// it did before F4 — only the silhouette around them changed. The diamond head
// rolls its box mesh 45° (a corner-standing cube) while its visor/eyes stay
// upright; the expert's mortarboard is a matte-dark cap + tassel seated on top.

import type { Ref } from "react";
import type { Group, MeshStandardMaterial } from "three";
import type { RobotShape } from "../robotShape";

const VISOR_BASE = 2.6;
const TIP_BASE = 2.4;

type HeadGeometry =
  | { kind: "box"; boxSize: [number, number, number]; visorZ: number; roll?: number }
  | { kind: "sphere"; sphereRadius: number; visorZ: number }
  | { kind: "octahedron"; octRadius: number; visorZ: number };

const BOX_SIZE: [number, number, number] = [0.62, 0.46, 0.5];

const HEAD_GEOMETRY: Record<RobotShape["head"], HeadGeometry> = {
  faceted: { kind: "octahedron", octRadius: 0.34, visorZ: 0.22 },
  round: { kind: "sphere", sphereRadius: 0.32, visorZ: 0.2 },
  visored: { kind: "box", boxSize: BOX_SIZE, visorZ: 0.26 },
  // Corner-standing cube: a square-faced box (equal X/Y so it reads as a clean
  // ◇ rather than a lopsided rectangle) rolled 45° about Z. The roll preserves
  // the Z extent, so the visor still sits just in front.
  diamond: { kind: "box", boxSize: [0.5, 0.5, 0.5], visorZ: 0.26, roll: Math.PI / 4 },
  centered: { kind: "box", boxSize: BOX_SIZE, visorZ: 0.26 },
};

type RobotHeadProps = {
  ref?: Ref<Group>;
  shape: RobotShape;
  accent: string;
  bodyColor: string;
  chassisDark: string;
  visorRef: Ref<MeshStandardMaterial>;
  tipRef: Ref<MeshStandardMaterial>;
};

export function RobotHead({
  ref,
  shape,
  accent,
  bodyColor,
  chassisDark,
  visorRef,
  tipRef,
}: RobotHeadProps) {
  const geo = HEAD_GEOMETRY[shape.head];

  return (
    <group ref={ref} name="head" position={[0, 1.4, 0]} rotation={[0, shape.headTiltBias, 0]}>
      {geo.kind === "box" && (
        <mesh position={[0, 0.22, 0]} rotation={[0, 0, geo.roll ?? 0]}>
          <boxGeometry args={geo.boxSize} />
          <meshStandardMaterial color={bodyColor} roughness={shape.roughness} metalness={shape.metalness} />
        </mesh>
      )}
      {geo.kind === "sphere" && (
        <mesh position={[0, 0.22, 0]}>
          <sphereGeometry args={[geo.sphereRadius, 20, 16]} />
          <meshStandardMaterial color={bodyColor} roughness={shape.roughness} metalness={shape.metalness} />
        </mesh>
      )}
      {geo.kind === "octahedron" && (
        <mesh position={[0, 0.22, 0]}>
          <octahedronGeometry args={[geo.octRadius, 0]} />
          <meshStandardMaterial
            color={bodyColor}
            roughness={shape.roughness}
            metalness={shape.metalness}
            flatShading
          />
        </mesh>
      )}

      {/* Visor brow — a scholarly ridge over the eyes; expert only. */}
      {shape.head === "visored" && (
        <mesh position={[0, 0.34, 0.18]}>
          <boxGeometry args={[0.5, 0.06, 0.2]} />
          <meshStandardMaterial color={chassisDark} roughness={0.3} metalness={0.6} />
        </mesh>
      )}

      {/* Graduation cap + tassel — a matte, non-emissive head accessory seated
          on top of the head, set at a jaunty yaw so its square corners read;
          expert only. Nested in its own group so it stays a Group child of the
          head, not another Mesh child. */}
      {shape.mortarboard && (
        <group name="mortarboard" position={[0, 0.48, 0]} rotation={[0, 0.35, 0]}>
          {/* Flat square board */}
          <mesh>
            <boxGeometry args={[0.72, 0.04, 0.72]} />
            <meshStandardMaterial color={bodyColor} roughness={0.55} metalness={0.35} />
          </mesh>
          {/* Center button */}
          <mesh position={[0, 0.04, 0]}>
            <cylinderGeometry args={[0.05, 0.05, 0.04, 12]} />
            <meshStandardMaterial color={chassisDark} roughness={0.6} metalness={0.3} />
          </mesh>
          {/* Tassel — a stalk hanging off a front corner with a small knot tip */}
          <mesh position={[0.32, -0.09, 0.32]}>
            <cylinderGeometry args={[0.012, 0.012, 0.2, 6]} />
            <meshStandardMaterial color={chassisDark} roughness={0.8} metalness={0.2} />
          </mesh>
          <mesh position={[0.32, -0.21, 0.32]}>
            <sphereGeometry args={[0.045, 12, 12]} />
            <meshStandardMaterial color={chassisDark} roughness={0.8} metalness={0.2} />
          </mesh>
        </group>
      )}

      {/* Visor / eyes — the strongest accent emissive, present on every head. */}
      <mesh position={[0, 0.24, geo.visorZ]}>
        <boxGeometry args={[0.44, 0.12, 0.05]} />
        <meshStandardMaterial
          ref={visorRef}
          color={chassisDark}
          emissive={accent}
          emissiveIntensity={VISOR_BASE}
          toneMapped={false}
        />
      </mesh>

      {/* Antenna stalk + glowing tip — offset laterally for the diamond head. */}
      <mesh position={[shape.antennaOffsetX, 0.6, 0]}>
        <cylinderGeometry args={[0.025, 0.025, 0.36, 8]} />
        <meshStandardMaterial color={chassisDark} roughness={0.8} metalness={0.3} />
      </mesh>
      <mesh position={[shape.antennaOffsetX, 0.82, 0]}>
        <sphereGeometry args={[0.07, 16, 16]} />
        <meshStandardMaterial
          ref={tipRef}
          color={chassisDark}
          emissive={accent}
          emissiveIntensity={TIP_BASE}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
