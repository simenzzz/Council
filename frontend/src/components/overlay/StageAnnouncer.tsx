// StageAnnouncer — a visually-hidden live region voicing the desktop debate events
// that would otherwise be trapped in the aria-hidden bubbles / inert transcript
// drawer. Phase and round beats are already announced by ConnectionStatus in the
// Docket, so this deliberately covers only what desktop drops:
//   • per-persona stream failures — non-fatal, so they never reach ErrorBanner,
//     and on desktop they live inside the inert drawer where a screen reader can't
//     reach them (on mobile they announce from the visible column).
//   • a one-time pointer to the transcript once the verdict is ready, since on
//     desktop the verdict text lives in an aria-hidden bubble + on-demand drawer.
// A per-speaker "turn" cue is intentionally absent: the orchestrator streams all
// panelists concurrently, so announcing each would be unintelligible crosstalk.

import { personaMeta } from "../../personas/registry";
import type { DebateState } from "../../state/debateReducer";

export function StageAnnouncer({ state }: { state: DebateState }) {
  // Only per-persona (non-fatal) errors; session/moderator failures are ErrorBanner's.
  const personaErrors = state.errors.filter((e) => e.persona !== undefined);
  const verdictReady = state.phase === "done";

  return (
    <div className="sr-only">
      {/* Polite: the verdict hint queues behind ConnectionStatus's "Verdict delivered". */}
      <p aria-live="polite">
        {verdictReady ? "The verdict is ready. Open the transcript to read the full debate." : ""}
      </p>
      {/* Assertive + non-atomic: each newly-appended failure is announced on its own. */}
      <div aria-live="assertive" aria-atomic="false">
        {personaErrors.map((err, i) => (
          <p key={`${err.persona}-${i}`}>
            {personaMeta[err.persona!].displayName}’s response failed: {err.message}
          </p>
        ))}
      </div>
    </div>
  );
}
