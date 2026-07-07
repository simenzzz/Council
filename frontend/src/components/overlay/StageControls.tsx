// StageControls — the floating control cluster that keeps the session drivable
// once the question overlay folds away: Stop while live, Ask-another when a run
// has ended, the transcript-drawer toggle, and the sound toggle. Without it the
// user would be stranded on a full-screen stage with no affordances.

import type { DebatePhase } from "../../state/debateReducer";
import { PlaybackControls } from "../controls/PlaybackControls";
import { SoundToggle } from "../controls/SoundToggle";

const LIVE_PHASES: ReadonlySet<DebatePhase> = new Set(["connecting", "debating", "moderating"]);

type StageControlsProps = {
  phase: DebatePhase;
  /** True while the question overlay is open (hide Ask-another to avoid redundancy). */
  composing: boolean;
  onStop: () => void;
  onAskAnother: () => void;
  drawerOpen: boolean;
  onToggleDrawer: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  rate: number;
  onSetRate: (multiplier: number) => void;
  isAtLive: boolean;
  onGoToLive: () => void;
};

const BTN =
  "rounded-lg border border-panel-border bg-panel/80 px-3 py-2 text-sm text-ink backdrop-blur-md transition hover:text-moderator focus-visible:outline focus-visible:outline-2 focus-visible:outline-moderator";

export function StageControls({
  phase,
  composing,
  onStop,
  onAskAnother,
  drawerOpen,
  onToggleDrawer,
  soundEnabled,
  onToggleSound,
  rate,
  onSetRate,
  isAtLive,
  onGoToLive,
}: StageControlsProps) {
  const live = LIVE_PHASES.has(phase);

  return (
    <div className="flex items-center gap-2">
      <PlaybackControls phase={phase} rate={rate} onSetRate={onSetRate} isAtLive={isAtLive} onGoToLive={onGoToLive} />
      {live && (
        <button type="button" onClick={onStop} className={BTN}>
          Stop
        </button>
      )}
      {!live && !composing && (
        <button type="button" onClick={onAskAnother} className={BTN}>
          Ask another
        </button>
      )}
      <button
        type="button"
        onClick={onToggleDrawer}
        aria-pressed={drawerOpen}
        aria-label={drawerOpen ? "Hide transcript" : "Show transcript"}
        className={BTN}
      >
        Transcript
      </button>
      <span className="rounded-lg border border-panel-border bg-panel/80 px-1 backdrop-blur-md">
        <SoundToggle enabled={soundEnabled} onToggle={onToggleSound} />
      </span>
    </div>
  );
}
