// useSound — the debate's optional audio cues, muted by default. The user's
// choice persists across sessions (localStorage); enabling resumes the
// WebAudio context synchronously inside the click handler that flips the
// preference, which is the only place a browser allows audio to start
// without an autoplay warning.

import { useEffect, useRef, useState } from "react";
import { createSoundEngine, type SoundEngine } from "../lib/sound";

const STORAGE_KEY = "council:sound-enabled";

function readStoredPreference(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function writeStoredPreference(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, String(enabled));
  } catch {
    // Storage may be unavailable (private browsing) — the preference just
    // won't persist across sessions; not worth surfacing as an error.
  }
}

export type UseSoundResult = {
  enabled: boolean;
  toggle: () => void;
  engine: SoundEngine;
};

export function useSound(): UseSoundResult {
  const engineRef = useRef<SoundEngine | null>(null);
  if (!engineRef.current) engineRef.current = createSoundEngine();
  const engine = engineRef.current;

  const [enabled, setEnabled] = useState(readStoredPreference);

  useEffect(() => {
    engine.setEnabled(enabled);
  }, [engine, enabled]);

  const toggle = () => {
    const next = !enabled;
    writeStoredPreference(next);
    setEnabled(next);
    if (next) {
      // The effect above runs after this handler returns; resume() needs to
      // fire synchronously within the click gesture, so flip the engine here too.
      engine.setEnabled(true);
      engine.resume();
    }
  };

  return { enabled, toggle, engine };
}
