// DebugView — a THROWAWAY F0 harness to validate the headless core against the
// live backend. It is not the product UI (that's F1); it just drives useDebate
// and dumps raw reducer state. Lightly styled with the theme tokens so the
// "Holographic council" foundation gets exercised early.

import { useState } from "react";
import { DEFAULT_ROUNDS, MAX_ROUNDS, MIN_ROUNDS, buildAsk } from "../lib/protocol";
import { useDebate } from "../state/useDebate";

const ROUND_OPTIONS = Array.from(
  { length: (MAX_ROUNDS - MIN_ROUNDS) / 2 + 1 },
  (_, i) => MIN_ROUNDS + i * 2,
);

export function DebugView() {
  const { state, ask, stop } = useDebate();
  const [question, setQuestion] = useState("");
  const [rounds, setRounds] = useState<number>(DEFAULT_ROUNDS);

  const validation = buildAsk(question, rounds);
  const canAsk = validation.ok && state.phase !== "connecting";

  return (
    <main className="mx-auto max-w-3xl p-6 font-mono text-ink">
      <h1 className="font-display text-2xl tracking-wide">
        Council <span className="text-muted">· F0 debug</span>
      </h1>

      <section className="mt-4 rounded-lg border border-panel-border bg-panel p-4">
        <textarea
          className="w-full resize-y rounded bg-bg p-3 text-ink outline-none"
          rows={3}
          placeholder="Ask the council…"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />
        <div className="mt-3 flex items-center gap-3">
          <label className="text-muted">
            rounds{" "}
            <select
              className="rounded bg-bg p-1 text-ink"
              value={rounds}
              onChange={(e) => setRounds(Number(e.target.value))}
            >
              {ROUND_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          <button
            className="rounded bg-skeptic px-4 py-1 font-semibold text-bg disabled:opacity-40"
            disabled={!canAsk}
            onClick={() => ask(question, rounds)}
          >
            Convene
          </button>
          <button
            className="rounded border border-panel-border px-4 py-1 text-muted"
            onClick={stop}
          >
            Stop
          </button>
          <span className="ml-auto text-muted">phase: {state.phase}</span>
        </div>
        {!validation.ok && question.trim() !== "" && (
          <p className="mt-2 text-danger">{validation.error}</p>
        )}
      </section>

      <pre className="mt-4 overflow-auto rounded-lg border border-panel-border bg-panel p-4 text-xs leading-relaxed">
        {JSON.stringify(state, null, 2)}
      </pre>
    </main>
  );
}
