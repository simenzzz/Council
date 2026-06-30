// PersonaColumn — one debater's glass panel: accent header (name, role, live
// status) and a RoundBlock per round that has content. A pure view over the
// reducer's transcript slice for this persona; it owns no state. The persona
// accent is injected as `--accent` so all colour comes from design/tokens.ts.

import type { CSSProperties } from "react";
import { accentOf, personaMeta } from "../../personas/registry";
import type { DebateError } from "../../state/debateReducer";
import type { PersonaId } from "../../lib/protocol";
import { RoundBlock } from "./RoundBlock";
import { StatusDot, type ColumnStatus } from "./StatusDot";

type AccentStyle = CSSProperties & { "--accent": string };

export function PersonaColumn({
  id,
  roundsText,
  isActive,
  currentRound,
  maxRound,
  errors,
}: {
  id: PersonaId;
  roundsText: Record<number, string> | undefined;
  isActive: boolean;
  currentRound: number;
  maxRound: number;
  errors: readonly DebateError[];
}) {
  const meta = personaMeta[id];
  const style: AccentStyle = { "--accent": accentOf(id) };

  const hasText = roundsText !== undefined && Object.keys(roundsText).length > 0;
  const status: ColumnStatus = isActive ? "streaming" : hasText ? "done" : "idle";

  // Spotlight: the still-speaking column is lit (full opacity + accent glow);
  // finished columns recede but stay readable; not-yet-spoken columns are muted.
  // The opacity transition is gated under prefers-reduced-motion via theme.css.
  const emphasis = isActive
    ? "opacity-100 shadow-[0_0_24px_-6px_var(--accent)] border-[var(--accent)]/50"
    : hasText
      ? "opacity-70 border-panel-border"
      : "opacity-50 border-panel-border";

  // Render a round only when it has content or is this persona's active stream.
  const rounds: number[] = [];
  for (let r = 1; r <= maxRound; r++) {
    if (roundsText?.[r] !== undefined || (isActive && r === currentRound)) rounds.push(r);
  }

  return (
    <section
      style={style}
      aria-label={meta.displayName}
      data-active={isActive}
      className={`flex min-w-0 flex-col rounded-xl border bg-panel/70 transition-[opacity,box-shadow,border-color] duration-500 motion-reduce:transition-none ${emphasis}`}
    >
      <header className="flex items-start justify-between gap-2 border-b border-panel-border px-4 py-3">
        <div className="min-w-0">
          <h3 className="truncate font-display text-base font-semibold text-[var(--accent)]">
            {meta.displayName}
          </h3>
          <p className="truncate text-xs text-muted">{meta.role}</p>
        </div>
        <StatusDot status={status} />
      </header>

      <div className="flex flex-col gap-4 px-4 py-4">
        {rounds.length === 0 && (
          <p className="font-mono text-sm italic text-muted">Awaiting opening…</p>
        )}
        {rounds.map((r) => (
          <RoundBlock
            key={r}
            round={r}
            text={roundsText?.[r] ?? ""}
            streaming={isActive && r === currentRound}
          />
        ))}
        {errors.map((err, i) => (
          <p key={`${err.message}-${i}`} className="font-mono text-xs text-danger" role="alert">
            ⚠ {err.message}
          </p>
        ))}
      </div>
    </section>
  );
}
