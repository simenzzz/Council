// TranscriptGrid — the four panelist columns, derived purely from reducer state.
// Responsive: 1 column on mobile, 2 on small screens, 4 on wide. `dimmed` (driven
// by whether the verdict spotlight is open) fades/blurs the grid so the spotlight
// owns the stage; once the panel is dismissed the columns become readable again.
// The dim transition is gated under prefers-reduced-motion.

import { PANELISTS } from "../../personas/registry";
import type { DebateState } from "../../state/debateReducer";
import { PersonaColumn } from "./PersonaColumn";

/** Highest panelist round to render — ignores the moderator's round=rounds+1. */
function panelMaxRound(state: DebateState): number {
  const seen = PANELISTS.flatMap((id) =>
    Object.keys(state.transcript[id] ?? {}).map(Number),
  );
  const fromText = seen.length > 0 ? Math.max(...seen) : 0;
  // While debating, currentRound may lead the text if a round just started.
  return state.phase === "debating" ? Math.max(fromText, state.currentRound) : fromText;
}

export function TranscriptGrid({ state, dimmed }: { state: DebateState; dimmed: boolean }) {
  const maxRound = panelMaxRound(state);

  return (
    <div
      data-dimmed={dimmed}
      className={
        "grid grid-cols-1 gap-4 transition-[opacity,filter] duration-500 motion-reduce:transition-none sm:grid-cols-2 xl:grid-cols-4 " +
        (dimmed ? "pointer-events-none opacity-40 blur-[1px]" : "opacity-100")
      }
    >
      {PANELISTS.map((id) => (
        <PersonaColumn
          key={id}
          id={id}
          roundsText={state.transcript[id]}
          isActive={state.activeSpeakers.includes(id)}
          currentRound={state.currentRound}
          maxRound={maxRound}
          errors={state.errors.filter((e) => e.persona === id)}
        />
      ))}
    </div>
  );
}
