import { describe, expect, it } from "vitest";
import { buildAsk } from "../lib/protocol";
import { TOPIC_PRESETS } from "./topicPresets";

describe("TOPIC_PRESETS", () => {
  it("is non-empty", () => {
    expect(TOPIC_PRESETS.length).toBeGreaterThan(0);
  });

  it("gives every preset a distinct, non-empty label", () => {
    const labels = TOPIC_PRESETS.map((p) => p.label.trim());
    expect(labels.every((l) => l.length > 0)).toBe(true);
    expect(new Set(labels).size).toBe(TOPIC_PRESETS.length);
  });

  it("gives every preset a question that passes the outbound ask validation", () => {
    for (const preset of TOPIC_PRESETS) {
      const result = buildAsk(preset.question);
      expect(result.ok, preset.question).toBe(true);
    }
  });
});
