// QuestionForm — the one input that drives a session. Validation reuses
// buildAsk() so it mirrors the backend exactly (non-empty trimmed, ≤1000 runes,
// even rounds 2–8); Convene stays disabled until the question would be accepted
// and while a session is live. Stop closes the socket (which cancels the run).
//
// Visually it's a "council console": HUD corner brackets frame the panel, a row
// of persona seat-pips (SeatIndicator) states who's about to answer, the query
// field blooms neon on focus, and Convene lights up into the full council
// spectrum — the signature. Motion fires on interaction only; the surface stays
// translucent (bg-panel/70) so the 3D chamber reads through on the desktop stage.

import { useId, useState } from "react";
import type { RefObject } from "react";
import { DEFAULT_ROUNDS, MAX_QUESTION_RUNES, buildAsk } from "../../lib/protocol";
import type { DebatePhase } from "../../state/debateReducer";
import { RoundsSelector } from "./RoundsSelector";
import { SeatIndicator } from "./SeatIndicator";
import { SoundToggle } from "./SoundToggle";
import { TopicPresets } from "./TopicPresets";

const LIVE_PHASES: ReadonlySet<DebatePhase> = new Set(["connecting", "debating", "moderating"]);

// Decorative HUD corner brackets — two-sided L's pinned to each panel corner.
const CORNERS = [
  "left-2 top-2 border-l-2 border-t-2",
  "right-2 top-2 border-r-2 border-t-2",
  "left-2 bottom-2 border-l-2 border-b-2",
  "right-2 bottom-2 border-r-2 border-b-2",
] as const;

export function QuestionForm({
  phase,
  onAsk,
  onStop,
  textareaRef,
  soundEnabled,
  onToggleSound,
}: {
  phase: DebatePhase;
  onAsk: (question: string, rounds: number) => void;
  onStop: () => void;
  textareaRef?: RefObject<HTMLTextAreaElement | null>;
  soundEnabled?: boolean;
  onToggleSound?: () => void;
}) {
  const [question, setQuestion] = useState("");
  const [rounds, setRounds] = useState<number>(DEFAULT_ROUNDS);
  const errorId = useId();
  const queryId = useId();

  const validation = buildAsk(question, rounds);
  const live = LIVE_PHASES.has(phase);
  const runeCount = [...question].length;
  const showError = !validation.ok && question.trim() !== "";

  const submit = () => {
    if (validation.ok && !live) onAsk(question.trim(), rounds);
  };

  const pickPreset = (preset: string) => {
    setQuestion(preset);
    textareaRef?.current?.focus();
  };

  return (
    <form
      className="group relative rounded-xl border border-panel-border bg-panel/70 p-5"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      {CORNERS.map((pos) => (
        <span
          key={pos}
          aria-hidden="true"
          className={`pointer-events-none absolute h-3 w-3 border-skeptic/40 ${pos}`}
        />
      ))}

      <div className="mb-4">
        <SeatIndicator />
      </div>

      <TopicPresets onPick={pickPreset} disabled={live} />

      <label
        htmlFor={queryId}
        className="mb-1.5 flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.3em] text-muted"
      >
        The motion
        <span aria-hidden="true" className="text-skeptic">
          ▍
        </span>
      </label>

      <div className="rounded-lg border border-panel-border bg-bg transition focus-within:border-skeptic focus-within:shadow-[0_0_24px_-6px_var(--color-skeptic)]">
        <textarea
          id={queryId}
          ref={textareaRef}
          className="w-full resize-y rounded-lg bg-transparent p-3 font-mono text-ink placeholder:text-muted focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-skeptic"
          rows={3}
          placeholder="Put a question to the council…"
          // Superset of the visible "The motion" label so the accessible name
          // matches what a sighted user reads (WCAG 2.5.3, Label in Name).
          aria-label="The motion — your question for the council"
          aria-invalid={showError}
          aria-describedby={showError ? errorId : undefined}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            // Cmd/Ctrl+Enter submits without forcing a newline-free textarea.
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
          }}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <RoundsSelector value={rounds} onChange={setRounds} disabled={live} />

        <button
          type="submit"
          disabled={!validation.ok || live}
          className="rounded-lg bg-[linear-gradient(90deg,var(--color-skeptic),var(--color-expert),var(--color-contrarian),var(--color-optimist),var(--color-skeptic))] bg-[length:200%_100%] px-5 py-2 font-mono font-semibold text-bg transition hover:shadow-[0_0_28px_-8px_var(--color-skeptic)] hover:motion-safe:animate-[council-sweep_2.5s_linear_infinite] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-skeptic disabled:animate-none disabled:bg-none disabled:bg-panel disabled:text-muted disabled:opacity-50 motion-reduce:hover:animate-none"
        >
          {live ? "Council in session…" : "Convene the council"}
        </button>

        {live && (
          <button
            type="button"
            onClick={onStop}
            className="rounded-lg border border-panel-border px-4 py-2 text-muted transition hover:border-danger hover:text-ink active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-skeptic"
          >
            Stop
          </button>
        )}

        {onToggleSound && <SoundToggle enabled={soundEnabled ?? false} onToggle={onToggleSound} />}

        <span
          className={
            "ml-auto font-mono text-[11px] uppercase tracking-[0.18em] " +
            (runeCount > MAX_QUESTION_RUNES ? "text-danger" : "text-muted")
          }
        >
          {runeCount} / {MAX_QUESTION_RUNES}
        </span>
      </div>

      {showError && (
        <p id={errorId} className="mt-2 text-sm text-danger" role="alert">
          {validation.error}
        </p>
      )}
    </form>
  );
}
