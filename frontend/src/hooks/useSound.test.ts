import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useSound } from "./useSound";

const STORAGE_KEY = "council:sound-enabled";

beforeEach(() => window.localStorage.clear());
afterEach(() => window.localStorage.clear());

describe("useSound", () => {
  it("defaults to muted", () => {
    const { result } = renderHook(() => useSound());
    expect(result.current.enabled).toBe(false);
  });

  it("toggles on and persists the preference", () => {
    const { result } = renderHook(() => useSound());
    act(() => result.current.toggle());
    expect(result.current.enabled).toBe(true);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("true");
  });

  it("toggles back off and persists that too", () => {
    const { result } = renderHook(() => useSound());
    act(() => result.current.toggle());
    act(() => result.current.toggle());
    expect(result.current.enabled).toBe(false);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("false");
  });

  it("reads a previously stored preference on mount", () => {
    window.localStorage.setItem(STORAGE_KEY, "true");
    const { result } = renderHook(() => useSound());
    expect(result.current.enabled).toBe(true);
  });
});
