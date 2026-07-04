// Docket — the persistent corner plaque that keeps the asked question on screen
// after the input overlay fades, alongside the live round readout. It is the
// "what is the council deliberating, and where are we" annotation. Clicking it
// re-opens the question form to ask another. Renders nothing until a question has
// actually been asked (nothing to docket while idle).

import type { DebatePhase } from "../../state/debateReducer";
import { ConnectionStatus } from "../status/ConnectionStatus";

type DocketProps = {
  question: string;
  phase: DebatePhase;
  currentRound: number;
  rounds: number;
  /** Re-open the question form (ask another / edit). */
  onEdit: () => void;
  /** Editing is unavailable mid-session — the affordance is shown disabled. */
  editDisabled?: boolean;
};

export function Docket({ question, phase, currentRound, rounds, onEdit, editDisabled }: DocketProps) {
  if (question.trim() === "") return null;

  return (
    <aside
      aria-label="Debate docket"
      className="max-w-sm rounded-xl border border-panel-border bg-panel/80 p-3 shadow-lg backdrop-blur-md"
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
        The council is deliberating
      </p>
      <button
        type="button"
        onClick={onEdit}
        disabled={editDisabled}
        title={editDisabled ? "Available once the debate finishes" : "Edit or ask another question"}
        className="mt-1 line-clamp-3 text-left font-display text-sm font-semibold text-ink transition hover:text-moderator focus-visible:outline focus-visible:outline-2 focus-visible:outline-moderator disabled:cursor-default disabled:text-ink disabled:hover:text-ink"
      >
        {question}
      </button>
      <div className="mt-2">
        <ConnectionStatus phase={phase} currentRound={currentRound} rounds={rounds} />
      </div>
    </aside>
  );
}
