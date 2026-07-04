// TranscriptGrid — the four panelist columns, derived purely from reducer state.
// The column COUNT adapts to the container's real width via an intrinsic auto-fit
// track: each column gets a clamp()'d min width (viewport-scaled) but never exceeds
// 100% of the container, and as many as fit are packed in. So the same grid stays
// readable in the narrow stage drawer and the wide mobile main alike — where a
// viewport-keyed column ladder forced 4 columns into the 448px drawer, crushing text
// to one letter per line. `dimmed` (driven by whether the verdict spotlight is open)
// fades/blurs the grid so the spotlight owns the stage; once the panel is dismissed
// the columns become readable again. The dim transition is gated under reduced motion.

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
        "grid gap-4 grid-cols-[repeat(auto-fit,minmax(min(100%,clamp(13rem,40vw,18rem)),1fr))] transition-[opacity,filter] duration-500 motion-reduce:transition-none " +
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
