// useStageFrameloop — F3 idled the Canvas at "demand" only before the very
// first ask (state.phase === "idle"); once a session started, the stage
// stayed "always" forever, even long after the debate finished and every
// robot settled to rest — burning render cycles for a static scene. This
// hook keeps "always" through any active phase, holds it a short settle
// window after the debate ends (letting robots ease to their resting pose),
// then drops to "demand"; a fresh ask re-arms "always" immediately.
//
// Mode is held in state (not recomputed per render) so a phase change from an
// active phase to a terminal one never has a one-frame gap where the loop
// would demand-stall before the settle window's timer takes over.

import { useEffect, useRef, useState } from "react";
import type { DebatePhase } from "../state/debateReducer";

const ACTIVE_PHASES: ReadonlySet<DebatePhase> = new Set(["connecting", "debating", "moderating"]);

// How long to keep the loop running after a debate ends, so bob/sway/emissive
// easing can settle to rest before the canvas goes static.
export const SETTLE_MS = 1200;

export type FrameloopMode = "always" | "demand";

function modeFor(phase: DebatePhase): FrameloopMode {
  if (ACTIVE_PHASES.has(phase)) return "always";
  if (phase === "idle") return "demand";
  return "always"; // terminal phase, still settling
}

export function useStageFrameloop(phase: DebatePhase): FrameloopMode {
  const [mode, setMode] = useState<FrameloopMode>(() => modeFor(phase));
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (ACTIVE_PHASES.has(phase) || phase === "idle") {
      setMode(modeFor(phase));
      return;
    }

    // Terminal phase: hold "always" through the settle window, then sleep.
    setMode("always");
    timeoutRef.current = setTimeout(() => setMode("demand"), SETTLE_MS);
    return () => {
      if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
    };
  }, [phase]);

  return mode;
}
