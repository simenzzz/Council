// TypingIndicator — three dots pulsing in the persona accent while that persona
// streams. Animation is staggered for a "thinking" feel and disabled under
// prefers-reduced-motion. Reads the `--accent` var set by PersonaColumn.

const DELAYS = ["0ms", "150ms", "300ms"];

export function TypingIndicator({ label = "Streaming" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1" role="status" aria-label={label}>
      {DELAYS.map((delay) => (
        <span
          key={delay}
          className="h-1.5 w-1.5 rounded-full bg-[var(--accent)] animate-pulse motion-reduce:animate-none"
          style={{ animationDelay: delay }}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}
