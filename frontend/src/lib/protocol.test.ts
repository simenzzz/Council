import { describe, expect, it } from "vitest";
import { buildAsk, parseEvent, MAX_QUESTION_RUNES } from "./protocol";

function frame(obj: unknown): string {
  return JSON.stringify(obj);
}

describe("parseEvent — valid frames", () => {
  it("accepts each event type", () => {
    const cases: unknown[] = [
      { type: "token", persona: "skeptic", round: 1, delta: "hi" },
      { type: "persona_done", persona: "optimist", round: 2 },
      { type: "round_complete", round: 1 },
      { type: "verdict", verdict: "final" },
      { type: "error", error: "stream failed", persona: "expert" },
    ];
    for (const c of cases) {
      const r = parseEvent(frame(c));
      expect(r.ok, JSON.stringify(c)).toBe(true);
    }
  });

  it("tolerates omitempty drops (token without delta → '')", () => {
    const r = parseEvent(frame({ type: "token", persona: "contrarian", round: 1 }));
    expect(r.ok).toBe(true);
    if (r.ok && r.event.type === "token") expect(r.event.delta).toBe("");
  });

  it("tolerates a session error without a persona", () => {
    const r = parseEvent(frame({ type: "error", error: "invalid request" }));
    expect(r.ok).toBe(true);
    if (r.ok && r.event.type === "error") expect(r.event.persona).toBeUndefined();
  });

  it("defaults an omitted verdict string to ''", () => {
    const r = parseEvent(frame({ type: "verdict" }));
    expect(r.ok).toBe(true);
    if (r.ok && r.event.type === "verdict") expect(r.event.verdict).toBe("");
  });
});

describe("parseEvent — rejects malformed frames", () => {
  const bad: Array<[string, unknown]> = [
    ["not JSON", undefined], // handled separately below
    ["unknown type", { type: "explode", round: 1 }],
    ["bad persona id", { type: "token", persona: "villain", round: 1, delta: "x" }],
    ["non-string delta", { type: "token", persona: "skeptic", round: 1, delta: 5 }],
    ["missing round on token", { type: "token", persona: "skeptic", delta: "x" }],
    ["zero round (1-indexed)", { type: "persona_done", persona: "skeptic", round: 0 }],
    ["missing round on round_complete", { type: "round_complete" }],
  ];

  it("rejects non-JSON text", () => {
    const r = parseEvent("{not json");
    expect(r.ok).toBe(false);
  });

  it.each(bad.slice(1))("rejects %s", (_label, payload) => {
    const r = parseEvent(frame(payload));
    expect(r.ok).toBe(false);
  });

  it("never throws on arbitrary input", () => {
    expect(() => parseEvent("")).not.toThrow();
    expect(() => parseEvent("[]")).not.toThrow();
    expect(() => parseEvent("null")).not.toThrow();
  });
});

describe("buildAsk — mirrors backend validation", () => {
  it("accepts a normal question with default rounds omitted", () => {
    const r = buildAsk("Should we ship?");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.message).toEqual({ type: "ask", question: "Should we ship?" });
      expect("rounds" in r.message).toBe(false);
    }
  });

  it("trims and includes valid rounds", () => {
    const r = buildAsk("  hello  ", 4);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.message).toEqual({ type: "ask", question: "hello", rounds: 4 });
  });

  it.each([
    ["empty", "", undefined],
    ["whitespace only", "   ", undefined],
    ["too long", "x".repeat(MAX_QUESTION_RUNES + 1), undefined],
    ["odd rounds", "q", 3],
    ["rounds below min", "q", 0],
    ["rounds above max", "q", 10],
    ["non-integer rounds", "q", 2.5],
  ])("rejects %s", (_label, q, rounds) => {
    const r = buildAsk(q as string, rounds as number | undefined);
    expect(r.ok).toBe(false);
  });

  it("counts runes, not UTF-16 units, for the length limit", () => {
    // Emoji are 2 UTF-16 units but 1 rune; 1000 of them is exactly the limit.
    const r = buildAsk("🙂".repeat(MAX_QUESTION_RUNES));
    expect(r.ok).toBe(true);
  });
});
