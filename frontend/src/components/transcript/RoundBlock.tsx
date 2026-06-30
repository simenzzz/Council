// RoundBlock — one round's contribution within a persona column: a divider
// eyebrow (rounds are a genuine sequence, so numbering them is honest) plus the
// accumulated token text rendered as monospace "telemetry". Shows a typing
// indicator while this round is the persona's active stream.

import { useSmoothText } from "../../hooks/useSmoothText";
import { TypingIndicator } from "./TypingIndicator";

function roundLabel(round: number): string {
  return round === 1 ? "Round 1 · Opening" : `Round ${round} · Rebuttal`;
}

export function RoundBlock({
  round,
  text,
  streaming,
}: {
  round: number;
  text: string;
  streaming: boolean;
}) {
  // The streaming round types out smoothly; completed rounds snap to full text.
  const revealed = useSmoothText(text, streaming);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-[var(--accent)]">
          {roundLabel(round)}
        </span>
        <span className="h-px flex-1 bg-panel-border" aria-hidden="true" />
      </div>
      <p className="whitespace-pre-wrap break-words font-mono text-sm leading-relaxed text-ink">
        {revealed}
        {streaming && (
          <span className="ml-1 inline-block align-middle">
            <TypingIndicator label="Streaming this round" />
          </span>
        )}
      </p>
    </div>
  );
}
