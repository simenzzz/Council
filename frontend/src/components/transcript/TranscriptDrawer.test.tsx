import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { fullDebate } from "../../test/fixtures/events";
import { buildState } from "../../test/helpers";
import { TranscriptDrawer } from "./TranscriptDrawer";

describe("TranscriptDrawer", () => {
  it("stays mounted but off-canvas and inert (no tab-order leak) when closed", () => {
    const { container } = render(
      <TranscriptDrawer state={buildState(fullDebate)} open={false} onClose={() => {}} />,
    );
    // aria-hidden blanks the accessible name, so select by the label attribute.
    const drawer = container.querySelector('aside[aria-label="Full transcript"]') as HTMLElement;
    expect(drawer).toHaveClass("translate-x-full");
    expect(drawer).toHaveAttribute("aria-hidden", "true");
    expect(drawer).toHaveAttribute("inert");
    // Mounted (content still in the DOM), just pulled out of the a11y tree.
    expect(within(drawer).getByText("The Skeptic")).toBeInTheDocument();
  });

  it("slides in and shows the final verdict when open", () => {
    render(<TranscriptDrawer state={buildState(fullDebate)} open={true} onClose={() => {}} />);
    expect(screen.getByRole("complementary", { name: "Full transcript" })).toHaveClass(
      "translate-x-0",
    );
    expect(screen.getByRole("region", { name: "Final verdict" })).toBeInTheDocument();
    expect(screen.getByText(/carries the round/)).toBeInTheDocument();
  });

  it("calls onClose from the close button", async () => {
    const onClose = vi.fn();
    render(<TranscriptDrawer state={buildState(fullDebate)} open={true} onClose={onClose} />);
    await userEvent.click(screen.getByRole("button", { name: "Close transcript" }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
