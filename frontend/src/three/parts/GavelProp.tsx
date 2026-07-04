// GavelProp — a small procedural gavel resting by the moderator's seat. The
// one purely decorative identity cue that reads "presides" at a glance,
// without touching the shared five-robot chassis. Static geometry — no
// animation of its own; it bobs along with the rest of the moderator's body.
// Tagged with userData.prop so scene-graph tests can assert it's
// moderator-only.

const HANDLE_COLOR = "#3B2A1E";
const HEAD_COLOR = "#0A0E1A";
const HEAD_EMISSIVE_INTENSITY = 0.55;

type GavelPropProps = {
  accent: string;
};

export function GavelProp({ accent }: GavelPropProps) {
  return (
    <group name="gavel" userData={{ prop: "gavel" }} position={[0.5, 0.55, 0.3]} rotation={[0, 0, -0.4]}>
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.5, 8]} />
        <meshStandardMaterial color={HANDLE_COLOR} roughness={0.7} metalness={0.1} />
      </mesh>
      <mesh position={[0, 0.28, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.09, 0.09, 0.22, 12]} />
        <meshStandardMaterial
          color={HEAD_COLOR}
          emissive={accent}
          emissiveIntensity={HEAD_EMISSIVE_INTENSITY}
          toneMapped={false}
          roughness={0.4}
          metalness={0.5}
        />
      </mesh>
    </group>
  );
}
