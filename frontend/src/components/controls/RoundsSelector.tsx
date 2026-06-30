// RoundsSelector — choose the (even) number of debate rounds. The option list is
// derived from the backend's bounds (MIN/MAX_ROUNDS, even-only) so the control
// can only ever emit a value the backend accepts.

import { MAX_ROUNDS, MIN_ROUNDS } from "../../lib/protocol";

const ROUND_OPTIONS: number[] = Array.from(
  { length: (MAX_ROUNDS - MIN_ROUNDS) / 2 + 1 },
  (_, i) => MIN_ROUNDS + i * 2,
);

export function RoundsSelector({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (rounds: number) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-muted">
      <span>Rounds</span>
      <select
        className="rounded-md border border-panel-border bg-bg px-2 py-1.5 text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-skeptic disabled:opacity-40"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
      >
        {ROUND_OPTIONS.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
    </label>
  );
}
