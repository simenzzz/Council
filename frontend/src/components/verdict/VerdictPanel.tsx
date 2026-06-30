// VerdictPanel — the signature moment. When the moderator takes the floor the
// panelist grid dims (see TranscriptGrid) and this panel spotlights to centre
// stage. While `moderating` it streams the moderator's tokens as plain mono text
// (rendering partial markdown mid-stream flickers); on `done` it renders the
// authoritative verdict as markdown. Presentational only — App decides mounting.

import { useEffect, useRef } from "react";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent } from "react";
import { accentOf } from "../../personas/registry";
import { useSmoothText } from "../../hooks/useSmoothText";
import { TypingIndicator } from "../transcript/TypingIndicator";
import { Markdown } from "./Markdown";

type AccentStyle = CSSProperties & { "--accent": string };

const FOCUSABLE =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function VerdictPanel({
  phase,
  verdict,
  streamingText,
  onClose,
  onAskAnother,
}: {
  phase: "moderating" | "done";
  verdict: string;
  streamingText: string;
  onClose: () => void;
  onAskAnother: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Escape dismisses the spotlight to inspect the (dimmed) columns behind.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Move focus into the dialog on open and restore it to the opener on close,
  // so keyboard/screen-reader users land in (and leave) the spotlight cleanly.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    return () => opener?.focus?.();
  }, []);

  // Keep Tab focus cycling inside the dialog while it's open (focus trap).
  const trapFocus = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Tab" || dialogRef.current === null) return;
    const items = dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE);
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const style: AccentStyle = { "--accent": accentOf("moderator") };
  const deliberating = phase === "moderating";
  // Reveal the moderator's live deliberation with the same calm cadence.
  const revealedStream = useSmoothText(streamingText, deliberating);

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Dismiss verdict"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-bg/70 backdrop-blur-sm"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Moderator verdict"
        tabIndex={-1}
        onKeyDown={trapFocus}
        style={style}
        className="relative z-10 flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl border border-[var(--accent)]/40 bg-panel shadow-[0_0_60px_-12px_var(--accent)] outline-none motion-safe:animate-[verdict-in_320ms_ease-out]"
      >
        <header className="flex items-start justify-between gap-3 border-b border-panel-border px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
              The Moderator
            </p>
            <h2 className="mt-0.5 font-display text-xl font-semibold text-ink">
              {deliberating ? "Deliberating…" : "Final verdict"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md px-2 py-1 text-muted hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
          >
            ✕
          </button>
        </header>

        <div className="overflow-y-auto px-6 py-5">
          {deliberating ? (
            <div className="space-y-3">
              <p className="whitespace-pre-wrap break-words font-mono text-sm leading-relaxed text-ink/90">
                {revealedStream}
                <span className="ml-1 inline-block align-middle">
                  <TypingIndicator label="Moderator deliberating" />
                </span>
              </p>
            </div>
          ) : (
            <div className="text-base">
              <Markdown>{verdict}</Markdown>
            </div>
          )}
        </div>

        {!deliberating && (
          <footer className="border-t border-panel-border px-6 py-4">
            <button
              type="button"
              onClick={onAskAnother}
              className="rounded-lg bg-[var(--accent)] px-4 py-2 font-semibold text-bg transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            >
              Ask another question
            </button>
          </footer>
        )}
      </div>
    </div>
  );
}
