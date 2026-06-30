// QuestionForm — the one input that drives a session. Validation reuses
// buildAsk() so it mirrors the backend exactly (non-empty trimmed, ≤1000 runes,
// even rounds 2–8); Convene stays disabled until the question would be accepted
// and while a session is live. Stop closes the socket (which cancels the run).

import { useId, useState } from "react";
import type { RefObject } from "react";
import { DEFAULT_ROUNDS, MAX_QUESTION_RUNES, buildAsk } from "../../lib/protocol";
import type { DebatePhase } from "../../state/debateReducer";
import { RoundsSelector } from "./RoundsSelector";

const LIVE_PHASES: ReadonlySet<DebatePhase> = new Set(["connecting", "debating", "moderating"]);

export function QuestionForm({
  phase,
  onAsk,
  onStop,
  textareaRef,
}: {
  phase: DebatePhase;
  onAsk: (question: string, rounds: number) => void;
  onStop: () => void;
  textareaRef?: RefObject<HTMLTextAreaElement | null>;
}) {
  const [question, setQuestion] = useState("");
  const [rounds, setRounds] = useState<number>(DEFAULT_ROUNDS);
  const errorId = useId();

  const validation = buildAsk(question, rounds);
  const live = LIVE_PHASES.has(phase);
  const runeCount = [...question].length;
  const showError = !validation.ok && question.trim() !== "";

  const submit = () => {
    if (validation.ok && !live) onAsk(question.trim(), rounds);
  };

  return (
    <form
      className="rounded-xl border border-panel-border bg-panel/70 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <textarea
        ref={textareaRef}
        className="w-full resize-y rounded-lg border border-panel-border bg-bg p-3 font-sans text-ink placeholder:text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-skeptic"
        rows={3}
        placeholder="Put a question to the council…"
        aria-label="Question for the council"
        aria-invalid={showError}
        aria-describedby={showError ? errorId : undefined}
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        onKeyDown={(e) => {
          // Cmd/Ctrl+Enter submits without forcing a newline-free textarea.
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
        }}
      />

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <RoundsSelector value={rounds} onChange={setRounds} disabled={live} />

        <button
          type="submit"
          disabled={!validation.ok || live}
          className="rounded-lg bg-skeptic px-5 py-2 font-semibold text-bg transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-skeptic disabled:cursor-not-allowed disabled:opacity-40"
        >
          {live ? "Council in session…" : "Convene the council"}
        </button>

        {live && (
          <button
            type="button"
            onClick={onStop}
            className="rounded-lg border border-panel-border px-4 py-2 text-muted transition hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-skeptic"
          >
            Stop
          </button>
        )}

        <span
          className={
            "ml-auto font-mono text-xs " +
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
