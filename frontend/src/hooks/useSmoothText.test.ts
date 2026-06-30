import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useSmoothText } from "./useSmoothText";

// Controllable requestAnimationFrame: callbacks are keyed by id so cancel really
// removes them (verifying cleanup), and flushed manually so reveal progression is
// deterministic instead of wall-clock dependent.
let rafMap = new Map<number, FrameRequestCallback>();
let nextRafId = 1;

function flushFrames(n: number) {
  for (let i = 0; i < n; i++) {
    const batch = [...rafMap.values()];
    rafMap = new Map(); // frames scheduled during this batch land in the next one
    act(() => batch.forEach((cb) => cb(0)));
  }
}

beforeEach(() => {
  rafMap = new Map();
  nextRafId = 1;
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    const id = nextRafId++;
    rafMap.set(id, cb);
    return id;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => {
    rafMap.delete(id);
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  // Ensure matchMedia stubs don't leak between tests.
  // @ts-expect-error allow deletion in test teardown
  delete window.matchMedia;
});

describe("useSmoothText", () => {
  it("snaps to the full target when not animating", () => {
    const { result } = renderHook(() => useSmoothText("complete answer", false));
    expect(result.current).toBe("complete answer");
  });

  it("grows from empty as tokens arrive and reaches the full target", () => {
    const { result, rerender } = renderHook(({ t }) => useSmoothText(t, true), {
      initialProps: { t: "" },
    });
    expect(result.current).toBe("");

    rerender({ t: "hello world" });
    flushFrames(1);
    expect(result.current.length).toBeGreaterThan(0);
    expect(result.current.length).toBeLessThan("hello world".length);
    expect("hello world".startsWith(result.current)).toBe(true);

    flushFrames(20);
    expect(result.current).toBe("hello world");
  });

  it("catches up to a target that jumps ahead, then settles", () => {
    const { result, rerender } = renderHook(({ t }) => useSmoothText(t, true), {
      initialProps: { t: "ab" },
    });
    // Initial mount reveals the small current target.
    expect(result.current).toBe("ab");

    rerender({ t: "ab" + "x".repeat(40) });
    // Partway: revealed has advanced but not yet complete.
    flushFrames(1);
    const mid = result.current.length;
    expect(mid).toBeGreaterThan(2);
    expect(mid).toBeLessThan(42);

    // Enough frames to fully catch up.
    flushFrames(40);
    expect(result.current).toBe("ab" + "x".repeat(40));
  });

  it("snaps to full when the user prefers reduced motion (no frames needed)", () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia;
    const { result, rerender } = renderHook(({ t }) => useSmoothText(t, true), {
      initialProps: { t: "ab" },
    });
    rerender({ t: "ab" + "x".repeat(40) });
    // No flushFrames: reduced motion must reveal the full target immediately.
    expect(result.current).toBe("ab" + "x".repeat(40));
  });

  it("cancels its pending frame on unmount (no leak)", () => {
    const { rerender, unmount } = renderHook(({ t }) => useSmoothText(t, true), {
      initialProps: { t: "ab" },
    });
    rerender({ t: "ab" + "x".repeat(40) });
    expect(rafMap.size).toBeGreaterThan(0); // a frame is scheduled mid-animation
    unmount();
    expect(rafMap.size).toBe(0); // cleanup cancelled it
  });

  it("never shows a stale prefix when the target shrinks (session reset)", () => {
    const { result, rerender } = renderHook(({ t }) => useSmoothText(t, true), {
      initialProps: { t: "a long previous answer" },
    });
    flushFrames(20);
    expect(result.current).toBe("a long previous answer");

    // New session resets the transcript → target becomes empty.
    rerender({ t: "" });
    expect(result.current).toBe("");
  });
});
