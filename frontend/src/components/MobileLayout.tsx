// MobileLayout — the 2D stacked debate UI, used below the md breakpoint where the
// 3D stage isn't mounted (no R3F bundle downloaded). This is the original F1
// experience and remains a complete, accessible product on its own: masthead,
// question form, status, the four transcript columns, and the verdict modal.
//
// Sound cues are owned by App (they track state, not layout); this component owns
// only the verdict-spotlight toggle, which is meaningful solely on this 2D path.

import type { RefObject } from "react";
import { Header } from "./Header";
import { QuestionForm } from "./controls/QuestionForm";
import { ConnectionStatus } from "./status/ConnectionStatus";
import { ErrorBanner } from "./status/ErrorBanner";
import { TranscriptGrid } from "./transcript/TranscriptGrid";
import { VerdictPanel } from "./verdict/VerdictPanel";
import { useVerdictSpotlight } from "../state/useVerdictSpotlight";
import type { DebateState } from "../state/debateReducer";

type MobileLayoutProps = {
  state: DebateState;
  rounds: number;
  onAsk: (question: string, rounds: number) => void;
  onStop: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  questionRef: RefObject<HTMLTextAreaElement | null>;
};

export function MobileLayout({
  state,
  rounds,
  onAsk,
  onStop,
  soundEnabled,
  onToggleSound,
  questionRef,
}: MobileLayoutProps) {
  const { open: verdictOpen, dismiss: dismissVerdict } = useVerdictSpotlight(state.phase);

  const handleAsk = (question: string, r: number) => {
    dismissVerdict();
    onAsk(question, r);
  };

  const handleAskAnother = () => {
    dismissVerdict();
    requestAnimationFrame(() => questionRef.current?.focus());
  };

  // The verdict modal appears only once the verdict is final (never mid-stream).
  const showVerdict = verdictOpen && state.phase === "done";

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
      <Header />

      <QuestionForm
        phase={state.phase}
        onAsk={handleAsk}
        onStop={onStop}
        textareaRef={questionRef}
        soundEnabled={soundEnabled}
        onToggleSound={onToggleSound}
      />

      <ConnectionStatus phase={state.phase} currentRound={state.currentRound} rounds={rounds} />
      <ErrorBanner state={state} />

      <TranscriptGrid state={state} dimmed={showVerdict} />

      {showVerdict && (
        <VerdictPanel
          phase="done"
          verdict={state.verdict}
          streamingText=""
          onClose={dismissVerdict}
          onAskAnother={handleAskAnother}
        />
      )}
    </main>
  );
}
