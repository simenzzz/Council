import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { fullDebate } from "../../test/fixtures/events";
import { buildState } from "../../test/helpers";
import { TranscriptGrid } from "./TranscriptGrid";

describe("TranscriptGrid", () => {
  it("renders one column per panelist (never the moderator)", () => {
    render(<TranscriptGrid state={buildState(fullDebate)} dimmed={false} />);
    expect(screen.getByRole("region", { name: "The Skeptic" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "The Optimist" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Domain Expert" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "The Contrarian" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "The Moderator" })).not.toBeInTheDocument();
  });

  it("accumulates each panelist's interleaved tokens into round text", () => {
    render(<TranscriptGrid state={buildState(fullDebate)} dimmed={false} />);
    // Per fixtures, each round's deltas for a persona concatenate (e.g. skeptic
    // "sa"+"sb" → "sasb"); both rounds produce the same text, so it appears twice
    // inside that persona's column.
    const skeptic = screen.getByRole("region", { name: "The Skeptic" });
    expect(within(skeptic).getAllByText("sasb")).toHaveLength(2);
    const contrarian = screen.getByRole("region", { name: "The Contrarian" });
    expect(within(contrarian).getAllByText("cacb")).toHaveLength(2);
  });

  it("reflects the dimmed prop (spotlight open)", () => {
    const { container } = render(<TranscriptGrid state={buildState(fullDebate)} dimmed={true} />);
    expect(container.querySelector("[data-dimmed]")).toHaveAttribute("data-dimmed", "true");
  });

  it("is readable (not dimmed) when the spotlight is closed", () => {
    const { container } = render(<TranscriptGrid state={buildState(fullDebate)} dimmed={false} />);
    expect(container.querySelector("[data-dimmed]")).toHaveAttribute("data-dimmed", "false");
  });
});
