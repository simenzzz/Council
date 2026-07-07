// PlaybackControls — the playback-speed presets and "Go to live" catch-up
// button layered onto DebatePlayer's paced reveal (see state/debatePlayer,
// state/useDebate). Deliberately layout-agnostic (no floating/positioning
// assumptions) so it can be embedded both in StageControls' floating pill
// cluster (desktop stage) and inline in MobileLayout's document flow — each
// parent supplies its own container styling.

import type { DebatePhase } from "../../state/debateReducer";

const LIVE_PHASES: ReadonlySet<DebatePhase> = new Set(["connecting", "debating", "moderating"]);

const RATE_PRESETS = [0.5, 1, 1.5, 2] as const;

const BTN =
  "rounded-lg border border-panel-border bg-panel/80 px-3 py-2 text-sm text-ink backdrop-blur-md transition hover:text-moderator focus-visible:outline focus-visible:outline-2 focus-visible:outline-moderator";

const BTN_PRESSED = BTN + " text-moderator";

type PlaybackControlsProps = {
  phase: DebatePhase;
  rate: number;
  onSetRate: (multiplier: number) => void;
  isAtLive: boolean;
  onGoToLive: () => void;
};

export function PlaybackControls({ phase, rate, onSetRate, isAtLive, onGoToLive }: PlaybackControlsProps) {
  // Pacing only matters while something is actively playing back; renders
  // nothing (not even an empty wrapper) once the session isn't live.
  if (!LIVE_PHASES.has(phase)) return null;

  return (
    <div className="flex items-center gap-2">
      <div role="group" aria-label="Playback speed" className="flex items-center gap-1">
        {RATE_PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => onSetRate(preset)}
            aria-pressed={rate === preset}
            className={rate === preset ? BTN_PRESSED : BTN}
          >
            {preset}x
          </button>
        ))}
      </div>

      {!isAtLive && (
        <button type="button" onClick={onGoToLive} className={BTN}>
          Go to live
        </button>
      )}
    </div>
  );
}
