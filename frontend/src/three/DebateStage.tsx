// DebateStage — the R3F <Canvas> wrapper around StageScene. It owns the
// presentation-only concerns the scene graph shouldn't: the elevated 3/4 camera,
// the dark backdrop, and constrained OrbitControls so the user can nudge the view
// but never fly under the floor or behind the council.
//
// frameloop comes from useStageFrameloop: "demand" before the first ask and again
// once the robots have settled after a debate ends, "always" while anything is
// animating. dpr is clamped to [1, 2] so high-DPI displays don't pay for 3x+ pixel
// counts. DebateStage owns no debate state — it derives the robots' visual state
// purely from the reducer's DebateState.
//
// Bloom (StageEffects) and robot motion both respect prefers-reduced-motion:
// bloom is purely atmospheric (skipped outright), while the robots keep their
// emissive/light highlight but drop bob/sway/pulse (robotAnimation.targetsFor).

import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { palette } from "../design/tokens";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";
import type { DebateState } from "../state/debateReducer";
import { personaBubbles } from "./bubbleContent";
import { CameraDirector } from "./CameraDirector";
import { robotVisualState } from "./robotVisualState";
import { StageEffects } from "./StageEffects";
import { StageScene } from "./StageScene";
import { useStageFrameloop } from "./useStageFrameloop";

const CAMERA_POSITION: [number, number, number] = [5.2, 4.2, 6.4];
const CAMERA_FOV = 38;
const ORBIT_TARGET: [number, number, number] = [0, 0.9, 0];

type DebateStageProps = {
  state: DebateState;
};

export function DebateStage({ state }: DebateStageProps) {
  const visuals = robotVisualState(state);
  const bubbles = personaBubbles(state);
  const frameloop = useStageFrameloop(state.phase);
  const reducedMotion = usePrefersReducedMotion();

  return (
    <Canvas
      dpr={[1, 2]}
      frameloop={frameloop}
      camera={{ position: CAMERA_POSITION, fov: CAMERA_FOV }}
      gl={{ antialias: true }}
    >
      <color attach="background" args={[palette.bg]} />
      <StageScene visuals={visuals} bubbles={bubbles} reducedMotion={reducedMotion} />
      {!reducedMotion && <StageEffects />}
      {/* Auto-frames the active speaker; yields to manual orbit; no-op on reduced
          motion. Must sit inside the Canvas to reach the default OrbitControls. */}
      <CameraDirector state={state} reducedMotion={reducedMotion} />
      {/* Damping is safe now that a session runs frameloop="always"; before the
          first ask the stage is static, where damping's glide simply never starts.
          makeDefault registers this as the controls the CameraDirector drives. */}
      <OrbitControls
        makeDefault
        enableDamping
        target={ORBIT_TARGET}
        enablePan={false}
        minDistance={5}
        maxDistance={12}
        // Keep the camera above the floor (polar < π/2) and looking down at it.
        minPolarAngle={Math.PI * 0.18}
        maxPolarAngle={Math.PI * 0.46}
        // Allow a gentle left/right nudge, never a full orbit behind the council.
        minAzimuthAngle={-Math.PI * 0.33}
        maxAzimuthAngle={Math.PI * 0.33}
      />
    </Canvas>
  );
}
