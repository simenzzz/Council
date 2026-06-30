// ErrorBanner — a top-of-page banner for a session-ending error (phase "error":
// a session-level rejection or a moderator failure). Per-persona advisory errors
// are non-fatal and render inside their own column, so they are excluded here.

import type { DebateState } from "../../state/debateReducer";

/** Message that ended the session: prefer a session-level error, else the last. */
function terminalMessage(state: DebateState): string {
  const sessionLevel = state.errors.find((e) => e.persona === undefined);
  const fallback = state.errors[state.errors.length - 1];
  return sessionLevel?.message ?? fallback?.message ?? "The council could not finish this session.";
}

export function ErrorBanner({ state }: { state: DebateState }) {
  if (state.phase !== "error") return null;
  return (
    <div
      role="alert"
      className="rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger"
    >
      <span className="font-semibold">Session ended.</span> {terminalMessage(state)}
    </div>
  );
}
