// StatusDot — a small accent dot encoding a column's live state. Reads the
// persona accent from the `--accent` CSS var set on an ancestor (PersonaColumn).

export type ColumnStatus = "idle" | "streaming" | "done";

const LABEL: Record<ColumnStatus, string> = {
  idle: "Waiting",
  streaming: "Speaking",
  done: "Finished",
};

export function StatusDot({ status }: { status: ColumnStatus }) {
  const tone =
    status === "idle"
      ? "opacity-30"
      : status === "streaming"
        ? "animate-pulse motion-reduce:animate-none"
        : "opacity-90";
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted">
      <span
        className={`h-2 w-2 rounded-full bg-[var(--accent)] ${tone}`}
        aria-hidden="true"
      />
      <span className="sr-only">{LABEL[status]}</span>
    </span>
  );
}
