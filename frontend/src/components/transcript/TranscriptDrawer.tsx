// TranscriptDrawer — the full, readable round-by-round history as a slide-in panel
// on the stage-first layout. The above-head bubbles show only each persona's
// latest line; this drawer is where the whole debate (and the final verdict) can
// be read and scrolled back through. It is opened on demand from StageControls.
//
// It stays mounted (so re-opening is instant and scroll position survives) but is
// aria-hidden + inert while closed: translated off-canvas, its controls must not
// leak into the keyboard tab order or the a11y tree. Live phase/round progress is
// announced separately by ConnectionStatus in the Docket; the streamed text itself
// is read here on demand rather than continuously announced.

import type { DebateState } from "../../state/debateReducer";
import { Markdown } from "../verdict/Markdown";
import { TranscriptGrid } from "./TranscriptGrid";

type TranscriptDrawerProps = {
  state: DebateState;
  open: boolean;
  onClose: () => void;
};

export function TranscriptDrawer({ state, open, onClose }: TranscriptDrawerProps) {
  return (
    <aside
      aria-label="Full transcript"
      aria-hidden={!open}
      // `inert` (a React 19 boolean attribute) pulls the off-canvas panel out of
      // the tab order + a11y tree when closed; omit it entirely when open.
      {...(open ? {} : { inert: true })}
      className={
        "fixed right-0 top-0 z-30 flex h-full w-[clamp(20rem,92vw,60rem)] flex-col border-l border-panel-border bg-panel/95 shadow-2xl backdrop-blur-md transition-transform duration-300 motion-reduce:transition-none " +
        (open ? "translate-x-0" : "translate-x-full")
      }
    >
      <header className="flex items-center justify-between border-b border-panel-border px-5 py-4">
        <h2 className="font-display text-lg font-semibold text-ink">Transcript</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close transcript"
          className="rounded-md px-2 py-1 text-muted transition hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-moderator"
        >
          ✕
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {state.verdict !== "" && (
          <section aria-label="Final verdict" className="mb-6">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-moderator">
              Final verdict
            </p>
            <div className="rounded-xl border border-panel-border bg-bg/60 p-4 text-sm">
              <Markdown>{state.verdict}</Markdown>
            </div>
          </section>
        )}
        <TranscriptGrid state={state} dimmed={false} />
      </div>
    </aside>
  );
}
