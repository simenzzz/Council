// App — the single owner of debate state and the layout switch. It holds only
// view-level glue the reducer doesn't: the last-requested round count and the
// asked question (both needed for on-screen readouts), plus the state-driven sound
// cues. Below the md breakpoint it renders the 2D MobileLayout (no 3D bundle);
// at md+ it renders the stage-first StageLayout, where the debate plays out in
// bubbles above the robots inside a full-screen 3D council.

import { useEffect, useRef, useState } from "react";
import { MobileLayout } from "./components/MobileLayout";
import { StageLayout } from "./components/StageLayout";
import { useMediaQuery } from "./hooks/useMediaQuery";
import { useSound } from "./hooks/useSound";
import { DEFAULT_ROUNDS } from "./lib/protocol";
import { useDebate } from "./state/useDebate";

const STAGE_MIN_WIDTH = "(min-width: 768px)";

export default function App() {
  const { state, ask, stop } = useDebate();
  const [rounds, setRounds] = useState<number>(DEFAULT_ROUNDS);
  const [question, setQuestion] = useState<string>("");
  const questionRef = useRef<HTMLTextAreaElement>(null);
  const { enabled: soundEnabled, toggle: toggleSound, engine: sound } = useSound();
  const stageFirst = useMediaQuery(STAGE_MIN_WIDTH);

  // Cue off state transitions, not raw tokens: a soft tick each time the round
  // boundary advances (but not on the very first token, which only marks round
  // 1 starting rather than a round completing), a chime the moment the verdict
  // lands. Both are no-ops while muted (the sound engine gates internally).
  const previousRound = useRef(state.currentRound);
  const previousPhase = useRef(state.phase);
  useEffect(() => {
    if (previousRound.current > 0 && state.currentRound > previousRound.current) {
      sound.playRoundCue();
    }
    previousRound.current = state.currentRound;
  }, [state.currentRound, sound]);
  useEffect(() => {
    if (state.phase === "done" && previousPhase.current !== "done") sound.playVerdictChime();
    previousPhase.current = state.phase;
  }, [state.phase, sound]);

  // The reducer tracks neither the requested round total nor the question text, so
  // capture both here for the status/docket readouts before handing off to ask().
  const handleAsk = (q: string, r: number) => {
    setRounds(r);
    setQuestion(q);
    ask(q, r);
  };

  const shared = {
    state,
    rounds,
    onAsk: handleAsk,
    onStop: stop,
    soundEnabled,
    onToggleSound: toggleSound,
    questionRef,
  };

  return stageFirst ? (
    <StageLayout {...shared} question={question} />
  ) : (
    <MobileLayout {...shared} />
  );
}
