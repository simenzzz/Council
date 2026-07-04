import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

function stubMatchMedia(initial: boolean) {
  const mql = {
    matches: initial,
    media: "",
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  const matchMedia = vi.fn().mockReturnValue(mql);
  vi.stubGlobal("matchMedia", matchMedia);
  return matchMedia;
}

afterEach(() => vi.unstubAllGlobals());

describe("usePrefersReducedMotion", () => {
  it("queries prefers-reduced-motion: reduce", () => {
    const matchMedia = stubMatchMedia(false);
    renderHook(() => usePrefersReducedMotion());
    expect(matchMedia).toHaveBeenCalledWith("(prefers-reduced-motion: reduce)");
  });

  it("reflects a reduced-motion preference", () => {
    stubMatchMedia(true);
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(true);
  });

  it("reports false when matchMedia is unavailable", () => {
    vi.stubGlobal("matchMedia", undefined);
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(false);
  });
});
