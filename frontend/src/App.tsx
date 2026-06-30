// App — composes the F1 debate UI over the headless core. It owns only view-level
// glue: the last-requested round count (for progress, which the reducer doesn't
// track) and whether the verdict spotlight is open. All debate state lives in the
// reducer behind useDebate(); the 3D stage (F2) will mount above the grid, reading
// the same state.

import { useRef, useState } from "react";
import { Header } from "./components/Header";
import { QuestionForm } from "./components/controls/QuestionForm";
import { ConnectionStatus } from "./components/status/ConnectionStatus";
import { ErrorBanner } from "./components/status/ErrorBanner";
import { TranscriptGrid } from "./components/transcript/TranscriptGrid";
import { VerdictPanel } from "./components/verdict/VerdictPanel";
import { DEFAULT_ROUNDS } from "./lib/protocol";
import { useDebate } from "./state/useDebate";
import { useVerdictSpotlight } from "./state/useVerdictSpotlight";

export default function App() {
  const { state, ask, stop } = useDebate();
  const [rounds, setRounds] = useState<number>(DEFAULT_ROUNDS);
  const { open: verdictOpen, dismiss: dismissVerdict } = useVerdictSpotlight(state.phase);
  const questionRef = useRef<HTMLTextAreaElement>(null);

  const handleAsk = (question: string, r: number) => {
    setRounds(r);
    dismissVerdict();
    ask(question, r);
  };

  // Return focus to the question input after the dialog unmounts (it restores
  // focus to its opener first, so defer past that with rAF).
  const handleAskAnother = () => {
    dismissVerdict();
    requestAnimationFrame(() => questionRef.current?.focus());
  };

  const moderatorText = Object.values(state.transcript.moderator ?? {}).join("");
  const showVerdict =
    verdictOpen && (state.phase === "moderating" || state.phase === "done");

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
      <Header />

      <QuestionForm phase={state.phase} onAsk={handleAsk} onStop={stop} textareaRef={questionRef} />

      <ConnectionStatus phase={state.phase} currentRound={state.currentRound} rounds={rounds} />
      <ErrorBanner state={state} />

      {/* F2: the <DebateStage> R3F canvas mounts here, above the transcript. */}

      <TranscriptGrid state={state} dimmed={showVerdict} />

      {showVerdict && (
        <VerdictPanel
          phase={state.phase === "done" ? "done" : "moderating"}
          verdict={state.verdict}
          streamingText={moderatorText}
          onClose={dismissVerdict}
          onAskAnother={handleAskAnother}
        />
      )}
    </main>
  );
}
