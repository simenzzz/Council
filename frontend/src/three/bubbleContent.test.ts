import { describe, expect, it } from "vitest";
import { initialState } from "../state/debateReducer";
import { buildState } from "../test/helpers";
import { fullDebate } from "../test/fixtures/events";
import { personaBubbles, type PersonaBubble } from "./bubbleContent";

function byId(bubbles: PersonaBubble[]): Record<string, PersonaBubble> {
  return Object.fromEntries(bubbles.map((b) => [b.id, b]));
}

describe("personaBubbles", () => {
  it("shows only nameplates when idle", () => {
    const bubbles = personaBubbles(initialState);
    expect(bubbles).toHaveLength(5);
    for (const b of bubbles) {
      expect(b.mode).toBe("nameplate");
      expect(b.text).toBe("");
      expect(b.streaming).toBe(false);
      expect(b.dimmed).toBe(false);
      // Identity always present, even in nameplate mode.
      expect(b.displayName).not.toBe("");
      expect(b.role).not.toBe("");
    }
  });

  it("streams the active panelists mid-round with their latest text", () => {
    // First 8 events of round 1: all four panelists have tokens, none done yet.
    const bubbles = byId(personaBubbles(buildState(fullDebate.slice(0, 8))));
    for (const id of ["skeptic", "optimist", "expert", "contrarian"]) {
      expect(bubbles[id].mode).toBe("streaming");
      expect(bubbles[id].streaming).toBe(true);
      expect(bubbles[id].text.length).toBeGreaterThan(0);
    }
    // The moderator stays a nameplate through the debate.
    expect(bubbles.moderator.mode).toBe("nameplate");
    expect(bubbles.moderator.streaming).toBe(false);
  });

  it("settles panelists once their round tokens stop", () => {
    // Full round 1 (tokens + persona_done + round_complete): all four are quiet.
    const bubbles = byId(personaBubbles(buildState(fullDebate.slice(0, 13))));
    for (const id of ["skeptic", "optimist", "expert", "contrarian"]) {
      expect(bubbles[id].mode).toBe("settled");
      expect(bubbles[id].streaming).toBe(false);
      expect(bubbles[id].text.length).toBeGreaterThan(0);
    }
  });

  it("streams the verdict above the moderator while deliberating, reducing panelists to dimmed nameplates", () => {
    // Everything except the final verdict event: phase is `moderating`.
    const moderating = fullDebate.slice(0, fullDebate.length - 1);
    const bubbles = byId(personaBubbles(buildState(moderating)));
    expect(bubbles.moderator.mode).toBe("verdict");
    expect(bubbles.moderator.streaming).toBe(true);
    expect(bubbles.moderator.text).toBe("Verdict follows.");
    // Panelists step back to bare, dimmed nameplates so they don't crowd the
    // spotlit moderator (no leftover text bubble to overlap the verdict).
    for (const id of ["skeptic", "optimist", "expert", "contrarian"]) {
      expect(bubbles[id].dimmed).toBe(true);
      expect(bubbles[id].mode).toBe("nameplate");
      expect(bubbles[id].text).toBe("");
    }
  });

  it("keeps panelists' settled text on a terminal stop (only the verdict phases suppress it)", () => {
    // Some round-1 tokens, then the user stops → phase "stopped", not a verdict
    // phase, so panelists must still show what they said (not blanked nameplates).
    const stopped = buildState([...fullDebate.slice(0, 8), { kind: "cancel" }]);
    const bubbles = byId(personaBubbles(stopped));
    for (const id of ["skeptic", "optimist", "expert", "contrarian"]) {
      expect(bubbles[id].mode).toBe("settled");
      expect(bubbles[id].text.length).toBeGreaterThan(0);
    }
  });

  it("shows the authoritative verdict text on done, no longer streaming", () => {
    const done = buildState(fullDebate);
    const bubbles = byId(personaBubbles(done));
    expect(bubbles.moderator.mode).toBe("verdict");
    expect(bubbles.moderator.streaming).toBe(false);
    expect(bubbles.moderator.text).toBe(done.verdict);
    expect(bubbles.moderator.text).toContain("Final Verdict");
  });
});
