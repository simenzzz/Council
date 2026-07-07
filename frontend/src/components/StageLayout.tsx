// StageLayout — the desktop stage-first experience: the 3D council fills the whole
// screen as the focal point, with everything else floating over it as overlays.
// The question form is a transparent hero on the idle stage; once a question is
// convened it folds away and the debate plays out in bubbles above the robots'
// heads (see three/PersonaLabel), the docket keeps the question + round on screen,
// the controls keep the session drivable, and the full transcript lives in a
// slide-in drawer. This replaces the old hybrid "stage band above a text grid".
//
// The heavy R3F/three bundle is lazy-loaded, so it is fetched only when this
// desktop layout actually mounts (App renders the 2D MobileLayout below md).

import { lazy, Suspense, useEffect, useState } from "react";
import type { RefObject } from "react";
import type { DebatePhase, DebateState } from "../state/debateReducer";
import { Docket } from "./overlay/Docket";
import { QuestionOverlay } from "./overlay/QuestionOverlay";
import { StageAnnouncer } from "./overlay/StageAnnouncer";
import { StageControls } from "./overlay/StageControls";
import { ErrorBanner } from "./status/ErrorBanner";
import { TranscriptDrawer } from "./transcript/TranscriptDrawer";

const DebateStage = lazy(() =>
  import("../three/DebateStage").then((module) => ({ default: module.DebateStage })),
);

const LIVE_PHASES: ReadonlySet<DebatePhase> = new Set(["connecting", "debating", "moderating"]);

type StageLayoutProps = {
  state: DebateState;
  /** The asked question, lifted into App state (the reducer doesn't track it). */
  question: string;
  /** Last-requested round total (for the docket's progress readout). */
  rounds: number;
  onAsk: (question: string, rounds: number) => void;
  onStop: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  questionRef: RefObject<HTMLTextAreaElement | null>;
  rate: number;
  onSetRate: (multiplier: number) => void;
  isAtLive: boolean;
  onGoToLive: () => void;
};

export function StageLayout({
  state,
  question,
  rounds,
  onAsk,
  onStop,
  soundEnabled,
  onToggleSound,
  questionRef,
  rate,
  onSetRate,
  isAtLive,
  onGoToLive,
}: StageLayoutProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  // The hero form is open on the idle stage and after "ask another"; convening a
  // question folds it away so the stage takes over. Seeded from the phase so a
  // debate that's already live never opens behind a duplicate form.
  const [composing, setComposing] = useState(() => state.phase === "idle");

  const handleAsk = (q: string, r: number) => {
    setComposing(false);
    onAsk(q, r);
  };

  const live = LIVE_PHASES.has(state.phase);

  // Reopen the hero to ask another — but never over a live session (its disabled
  // form + no-op Stop would just shadow the real controls).
  const openCompose = () => {
    if (live) return;
    setComposing(true);
  };

  // Focus the question field whenever the hero opens. Keyed on `composing` (not a
  // raw rAF) so focus lands after QuestionOverlay clears `inert` in the same
  // commit — a focus attempt on a still-inert element would be silently dropped.
  useEffect(() => {
    if (composing) questionRef.current?.focus();
  }, [composing, questionRef]);

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-bg">
      {/* Screen-reader-only announcements for events the visual stage hides. */}
      <StageAnnouncer state={state} />

      {/* The stage fills the screen — the focal point. */}
      <div className="absolute inset-0">
        <Suspense fallback={null}>
          <DebateStage state={state} />
        </Suspense>
      </div>

      {/* Compact wordmark, top-left above the docket. */}
      <div className="pointer-events-none absolute left-4 top-4 z-10 flex flex-col gap-3">
        <span className="font-display text-sm font-semibold uppercase tracking-[0.28em] text-muted">
          Council
        </span>
        <div className="pointer-events-auto">
          <Docket
            question={question}
            phase={state.phase}
            currentRound={state.currentRound}
            rounds={rounds}
            onEdit={openCompose}
            editDisabled={live}
          />
        </div>
      </div>

      {/* Errors surface top-center, above the stage. */}
      <div className="pointer-events-none absolute inset-x-0 top-4 z-10 mx-auto w-full max-w-lg px-4">
        <div className="pointer-events-auto">
          <ErrorBanner state={state} />
        </div>
      </div>

      {/* The transparent hero question form (fades out once convened). */}
      <QuestionOverlay
        visible={composing}
        phase={state.phase}
        onAsk={handleAsk}
        textareaRef={questionRef}
      />

      {/* Persistent controls, bottom-center. */}
      <div className="absolute inset-x-0 bottom-4 z-10 flex justify-center px-4">
        <StageControls
          phase={state.phase}
          composing={composing}
          onStop={onStop}
          onAskAnother={openCompose}
          drawerOpen={drawerOpen}
          onToggleDrawer={() => setDrawerOpen((v) => !v)}
          soundEnabled={soundEnabled}
          onToggleSound={onToggleSound}
          rate={rate}
          onSetRate={onSetRate}
          isAtLive={isAtLive}
          onGoToLive={onGoToLive}
        />
      </div>

      <TranscriptDrawer state={state} open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </main>
  );
}
