// Chamber — the static room the council sits in: floor, the round council table,
// fog for depth, and the lighting rig. The signature look is the lighting: a low
// hemisphere/ambient fill keeps the room dark, a soft cool key gives form, and one
// accent-colored light per seat makes the five personas read as distinct neon
// presences in the gloom. These are plain scene contents (no <Canvas>), so the
// scene-graph tests can mount them headlessly via StageScene.

import { palette, PERSONA_IDS } from "../design/tokens";
import { accentOf } from "../personas/registry";
import { SEATING } from "./seating";

// Table centered on the origin the robots face; they sit on the arc at radius
// ~3.2, so a radius-1.7 table leaves the camera-facing front edge open.
const TABLE_RADIUS = 1.7;
const TABLE_HEIGHT = 0.95;

// The signature look: each seat gets its own accent point light. Tune here.
const ACCENT_LIGHT_HEIGHT = 2.5;
const ACCENT_LIGHT_INTENSITY = 7;
const ACCENT_LIGHT_DISTANCE = 6;

export function Chamber() {
  return (
    <group>
      {/* Soft depth fog tinted to the backdrop so robots fade into the dark. */}
      <fog attach="fog" args={[palette.bg, 9, 24]} />

      {/* Lighting rig: low fill + cool key + one accent light per seat. */}
      <ambientLight intensity={0.12} />
      <hemisphereLight color="#2A3358" groundColor="#05070D" intensity={0.45} />
      <directionalLight position={[5, 9, 6]} intensity={0.5} color="#AFC0FF" />

      {PERSONA_IDS.map((id) => {
        const [x, , z] = SEATING[id].position;
        return (
          <pointLight
            key={id}
            position={[x, ACCENT_LIGHT_HEIGHT, z]}
            color={accentOf(id)}
            intensity={ACCENT_LIGHT_INTENSITY}
            distance={ACCENT_LIGHT_DISTANCE}
          />
        );
      })}

      {/* Floor — a wide dark disc that the fog dissolves at its edge. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <circleGeometry args={[14, 64]} />
        <meshStandardMaterial color={palette.bg} roughness={1} metalness={0} />
      </mesh>

      {/* Round council table: a faint glass top with a glowing rim. */}
      <mesh position={[0, TABLE_HEIGHT, 0]}>
        <cylinderGeometry args={[TABLE_RADIUS, TABLE_RADIUS, 0.06, 64]} />
        <meshStandardMaterial
          color={palette.panel}
          roughness={0.3}
          metalness={0.5}
          transparent
          opacity={0.65}
        />
      </mesh>
      <mesh position={[0, TABLE_HEIGHT + 0.04, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[TABLE_RADIUS, 0.04, 16, 96]} />
        <meshStandardMaterial
          color={palette.panelBorder}
          emissive={palette.ink}
          emissiveIntensity={0.35}
          toneMapped={false}
        />
      </mesh>

      {/* Table pedestal */}
      <mesh position={[0, TABLE_HEIGHT / 2, 0]}>
        <cylinderGeometry args={[0.35, 0.5, TABLE_HEIGHT, 24]} />
        <meshStandardMaterial color={palette.panel} roughness={0.7} metalness={0.4} />
      </mesh>
    </group>
  );
}
