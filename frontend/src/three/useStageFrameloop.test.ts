import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DebatePhase } from "../state/debateReducer";
import { SETTLE_MS, useStageFrameloop } from "./useStageFrameloop";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("useStageFrameloop", () => {
  it("idles at demand before the first ask", () => {
    const { result } = renderHook(() => useStageFrameloop("idle"));
    expect(result.current).toBe("demand");
  });

  it("runs always through every active phase", () => {
    for (const phase of ["connecting", "debating", "moderating"] as const) {
      const { result } = renderHook(() => useStageFrameloop(phase));
      expect(result.current).toBe("always");
    }
  });

  it("holds always through the settle window after a debate ends, then sleeps", () => {
    const { result, rerender } = renderHook(({ phase }) => useStageFrameloop(phase), {
      initialProps: { phase: "debating" as DebatePhase },
    });
    expect(result.current).toBe("always");

    rerender({ phase: "done" });
    // Still settling — no gap immediately after the terminal transition.
    expect(result.current).toBe("always");

    act(() => vi.advanceTimersByTime(SETTLE_MS - 1));
    expect(result.current).toBe("always");

    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe("demand");
  });

  it("re-arms always immediately if a new ask starts mid-settle", () => {
    const { result, rerender } = renderHook(({ phase }) => useStageFrameloop(phase), {
      initialProps: { phase: "debating" as DebatePhase },
    });

    rerender({ phase: "done" });
    act(() => vi.advanceTimersByTime(SETTLE_MS / 2));
    expect(result.current).toBe("always");

    rerender({ phase: "connecting" });
    // The stale settle timeout must not fire and drop back to demand later.
    act(() => vi.advanceTimersByTime(SETTLE_MS));
    expect(result.current).toBe("always");
  });

  it("settles after stopped and error too, not just done", () => {
    for (const terminal of ["stopped", "error"] as const) {
      const { result, rerender } = renderHook(({ phase }) => useStageFrameloop(phase), {
        initialProps: { phase: "debating" as DebatePhase },
      });
      rerender({ phase: terminal });
      expect(result.current).toBe("always");
      act(() => vi.advanceTimersByTime(SETTLE_MS));
      expect(result.current).toBe("demand");
    }
  });
});
