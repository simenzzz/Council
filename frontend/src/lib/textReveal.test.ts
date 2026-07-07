import { describe, expect, it } from "vitest";
import { nextChunkEnd } from "./textReveal";

describe("nextChunkEnd", () => {
  it("groups a word with its trailing whitespace", () => {
    const text = "hello world foo";
    const end = nextChunkEnd(text, 0);
    expect(text.slice(0, end)).toBe("hello ");
  });

  it("groups multiple consecutive trailing whitespace characters", () => {
    const text = "hello   world";
    const end = nextChunkEnd(text, 0);
    expect(text.slice(0, end)).toBe("hello   ");
  });

  it("never stalls when the remainder is entirely whitespace", () => {
    const text = "hello   ";
    const end = nextChunkEnd(text, 5); // pos already inside the trailing spaces
    expect(end).toBeGreaterThan(5);
    expect(end).toBeLessThanOrEqual(text.length);
  });

  it("reveals the final word with no trailing whitespace up to end of string", () => {
    const text = "hello world";
    const end = nextChunkEnd(text, 6);
    expect(end).toBe(text.length);
  });

  it("advances by at least one character even at the very last position", () => {
    const text = "hello";
    const end = nextChunkEnd(text, text.length - 1);
    expect(end).toBe(text.length);
  });

  it("is a no-op past the end of the string", () => {
    const text = "hi";
    expect(nextChunkEnd(text, text.length)).toBe(text.length);
  });
});
