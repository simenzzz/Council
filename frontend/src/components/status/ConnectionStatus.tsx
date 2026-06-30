// ConnectionStatus — a compact, interface-voice readout of where the session is.
// Round progress needs the requested total, which the reducer doesn't store, so
// App passes the last-asked `rounds`. Errors are surfaced by ErrorBanner, not here.

import type { DebatePhase } from "../../state/debateReducer";

function statusText(phase: DebatePhase, currentRound: number, rounds: number): string | null {
  switch (phase) {
    case "connecting":
      return "Convening the council…";
    case "debating":
      return `Round ${Math.min(currentRound, rounds)} of ${rounds}`;
    case "moderating":
      return "The Moderator is deliberating…";
    case "done":
      return "Verdict delivered";
    case "stopped":
      return "Session stopped";
    case "idle":
    case "error":
      return null;
  }
}

export function ConnectionStatus({
  phase,
  currentRound,
  rounds,
}: {
  phase: DebatePhase;
  currentRound: number;
  rounds: number;
}) {
  const text = statusText(phase, currentRound, rounds);
  if (text === null) return null;

  const live = phase === "connecting" || phase === "debating" || phase === "moderating";
  return (
    <p className="flex items-center gap-2 text-sm text-muted" role="status" aria-live="polite">
      <span
        className={
          "h-2 w-2 rounded-full bg-moderator " +
          (live ? "animate-pulse motion-reduce:animate-none" : "opacity-60")
        }
        aria-hidden="true"
      />
      {text}
    </p>
  );
}
