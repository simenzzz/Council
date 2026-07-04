// SoundToggle — mute/unmute the debate's optional audio cues. Off by default;
// the icon and label always reflect current state so the control never lies
// about what will happen next. A hand-drawn speaker glyph (no emoji) keeps it
// in step with the chamber's holographic-console look.

type SoundToggleProps = {
  enabled: boolean;
  onToggle: () => void;
};

export function SoundToggle({ enabled, onToggle }: SoundToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={enabled}
      aria-label={enabled ? "Mute sound" : "Unmute sound"}
      title={enabled ? "Mute sound" : "Unmute sound"}
      className="rounded-lg border border-panel-border px-3 py-2 text-muted transition hover:text-ink active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-skeptic"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        width="16"
        height="16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 9v6h4l5 4V5L8 9H4Z" />
        {enabled ? (
          <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" />
        ) : (
          <path d="M16 9l5 6M21 9l-5 6" />
        )}
      </svg>
    </button>
  );
}
