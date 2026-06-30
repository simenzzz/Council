import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { DebatePhase } from "./debateReducer";
import { useVerdictSpotlight } from "./useVerdictSpotlight";

function renderSpotlight(initial: DebatePhase) {
  return renderHook(({ phase }) => useVerdictSpotlight(phase), {
    initialProps: { phase: initial },
  });
}

describe("useVerdictSpotlight", () => {
  it("starts closed and opens on entering the moderator flow", () => {
    const { result, rerender } = renderSpotlight("idle");
    expect(result.current.open).toBe(false);

    rerender({ phase: "debating" });
    expect(result.current.open).toBe(false);

    rerender({ phase: "moderating" });
    expect(result.current.open).toBe(true);
  });

  it("stays open across moderating → done", () => {
    const { result, rerender } = renderSpotlight("debating");
    rerender({ phase: "moderating" });
    rerender({ phase: "done" });
    expect(result.current.open).toBe(true);
  });

  it("does not re-open on moderating → done after a dismiss (sticky close)", () => {
    const { result, rerender } = renderSpotlight("debating");
    rerender({ phase: "moderating" });
    expect(result.current.open).toBe(true);

    act(() => result.current.dismiss());
    expect(result.current.open).toBe(false);

    rerender({ phase: "done" });
    expect(result.current.open).toBe(false);
  });

  it("re-opens for a fresh session that re-enters the moderator flow", () => {
    const { result, rerender } = renderSpotlight("debating");
    // First session reaches the verdict, user dismisses.
    rerender({ phase: "moderating" });
    rerender({ phase: "done" });
    expect(result.current.open).toBe(true);
    act(() => result.current.dismiss());
    expect(result.current.open).toBe(false);

    // New ask: phase walks back out and into moderating again.
    rerender({ phase: "connecting" });
    rerender({ phase: "debating" });
    rerender({ phase: "moderating" });
    expect(result.current.open).toBe(true);
  });
});
