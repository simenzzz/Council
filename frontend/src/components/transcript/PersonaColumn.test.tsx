import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { PersonaColumn } from "./PersonaColumn";

describe("PersonaColumn", () => {
  it("renders identity, accumulated round text, and a finished status when idle", () => {
    render(
      <PersonaColumn
        id="skeptic"
        roundsText={{ 1: "Opening words", 2: "A rebuttal" }}
        isActive={false}
        currentRound={2}
        maxRound={2}
        errors={[]}
      />,
    );
    const col = screen.getByRole("region", { name: "The Skeptic" });
    expect(within(col).getByText("Stress-tests the claim")).toBeInTheDocument();
    expect(within(col).getByText("Opening words")).toBeInTheDocument();
    expect(within(col).getByText("A rebuttal")).toBeInTheDocument();
    expect(within(col).getByText("Round 1 · Opening")).toBeInTheDocument();
    expect(within(col).getByText("Round 2 · Rebuttal")).toBeInTheDocument();
    expect(within(col).getByText("Finished")).toBeInTheDocument();
  });

  it("spotlights an active column and recedes a finished one", () => {
    const { rerender } = render(
      <PersonaColumn
        id="skeptic"
        roundsText={{ 1: "live" }}
        isActive={true}
        currentRound={1}
        maxRound={1}
        errors={[]}
      />,
    );
    const active = screen.getByRole("region", { name: "The Skeptic" });
    expect(active).toHaveAttribute("data-active", "true");
    expect(active.className).toContain("shadow-[0_0_24px_-6px_var(--accent)]");

    rerender(
      <PersonaColumn
        id="skeptic"
        roundsText={{ 1: "live" }}
        isActive={false}
        currentRound={1}
        maxRound={1}
        errors={[]}
      />,
    );
    const done = screen.getByRole("region", { name: "The Skeptic" });
    expect(done).toHaveAttribute("data-active", "false");
    expect(done.className).toContain("opacity-70");
  });

  it("shows a streaming indicator for the active round", () => {
    render(
      <PersonaColumn
        id="optimist"
        roundsText={{ 1: "Streaming" }}
        isActive={true}
        currentRound={1}
        maxRound={1}
        errors={[]}
      />,
    );
    expect(screen.getByText("Speaking")).toBeInTheDocument();
    // The round's typing indicator is a live region.
    expect(screen.getByRole("status", { name: /streaming this round/i })).toBeInTheDocument();
  });

  it("renders a placeholder when the persona has not spoken", () => {
    render(
      <PersonaColumn
        id="expert"
        roundsText={undefined}
        isActive={false}
        currentRound={0}
        maxRound={0}
        errors={[]}
      />,
    );
    expect(screen.getByText(/awaiting opening/i)).toBeInTheDocument();
    expect(screen.getByText("Waiting")).toBeInTheDocument();
  });

  it("surfaces a per-persona error inline without removing the column", () => {
    render(
      <PersonaColumn
        id="contrarian"
        roundsText={{ 1: "partial" }}
        isActive={false}
        currentRound={1}
        maxRound={1}
        errors={[{ persona: "contrarian", message: "stream failed" }]}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("stream failed");
    expect(screen.getByText("partial")).toBeInTheDocument();
  });
});
