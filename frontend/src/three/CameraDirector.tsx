// CameraDirector — eases the live camera toward whatever cameraTargetFor() says
// the state should frame (the active speaker, the moderator's moment, or the wide
// council). Lives *inside* the <Canvas> because it drives the shared OrbitControls
// (registered as the default controls via makeDefault) and runs in useFrame.
//
// It yields to the user: any manual orbit/zoom pauses auto-framing for a short
// window, so the camera never wrestles a drag. Under prefers-reduced-motion it
// does nothing at all — the user keeps a fully manual camera. Pure framing choices
// live in cameraTarget.ts; this file is only the easing + hand-off, so it is
// visual QA rather than unit-tested.

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { Vector3 } from "three";
import type { DebateState } from "../state/debateReducer";
import { cameraTargetFor, type CameraTarget } from "./cameraTarget";

// Easing responsiveness (higher = snappier). Framerate-independent via MathUtils.damp.
const LAMBDA = 2.4;
// How long manual interaction suppresses auto-framing.
const USER_PAUSE_MS = 2500;

// Minimal structural view of OrbitControls — avoids a hard three-stdlib type import.
type Controls = {
  target: Vector3;
  update: () => void;
  addEventListener: (type: "start", fn: () => void) => void;
  removeEventListener: (type: "start", fn: () => void) => void;
};

type CameraDirectorProps = {
  state: DebateState;
  reducedMotion?: boolean;
};

export function CameraDirector({ state, reducedMotion = false }: CameraDirectorProps) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as Controls | null;

  // Scratch vectors reused each frame (no per-frame allocation).
  const desiredLook = useMemo(() => new Vector3(), []);
  const desiredPos = useMemo(() => new Vector3(), []);
  const dir = useMemo(() => new Vector3(), []);

  // The framing target only changes when `state` does (a React re-render), so
  // derive it here — never per frame. useFrame re-subscribes its closure each
  // render, so reading this directly stays fresh.
  const target: CameraTarget = useMemo(() => cameraTargetFor(state), [state]);

  // Suspend auto-framing until this timestamp after any manual interaction.
  const pausedUntil = useRef(0);
  useEffect(() => {
    if (!controls) return;
    const onStart = () => {
      pausedUntil.current = performance.now() + USER_PAUSE_MS;
    };
    controls.addEventListener("start", onStart);
    return () => controls.removeEventListener("start", onStart);
  }, [controls]);

  useFrame((_, delta) => {
    if (reducedMotion || !controls) return;
    if (performance.now() < pausedUntil.current) return;

    desiredLook.set(target.lookAt[0], target.lookAt[1], target.lookAt[2]);

    // Keep the current view direction; only ease the framing point and distance,
    // so auto-framing never yanks the camera around the user's chosen angle.
    dir.copy(camera.position).sub(controls.target);
    if (dir.lengthSq() < 1e-6) dir.set(0, 0, 1);
    dir.normalize();
    desiredPos.copy(desiredLook).addScaledVector(dir, target.distance);

    const k = 1 - Math.exp(-LAMBDA * delta);
    controls.target.lerp(desiredLook, k);
    camera.position.lerp(desiredPos, k);
    // update() re-enforces OrbitControls' distance/polar/azimuth clamps.
    controls.update();
  });

  return null;
}
