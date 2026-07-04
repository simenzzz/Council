// TopicPresets — quick-start chips that fill the question field with a ready
// example, so a first-time visitor doesn't need to think one up before seeing
// the council in action. Disabled (not hidden) while a session is live, same
// convention as the rest of QuestionForm's controls.

import { TOPIC_PRESETS } from "../../data/topicPresets";

type TopicPresetsProps = {
  onPick: (question: string) => void;
  disabled?: boolean;
};

export function TopicPresets({ onPick, disabled }: TopicPresetsProps) {
  return (
    <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Example questions">
      {TOPIC_PRESETS.map((preset) => (
        <button
          key={preset.label}
          type="button"
          disabled={disabled}
          onClick={() => onPick(preset.question)}
          className="rounded-full border border-panel-border bg-panel/60 px-3 py-1 font-mono text-xs tracking-wide text-muted transition hover:border-skeptic hover:text-ink hover:shadow-[0_0_12px_-4px_var(--color-skeptic)] active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-skeptic disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none disabled:active:scale-100"
        >
          {preset.label}
        </button>
      ))}
    </div>
  );
}
