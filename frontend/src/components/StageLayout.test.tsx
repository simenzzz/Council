import { describe, expect, it, vi } from "vitest";
import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { initialState } from "../state/debateReducer";
import { buildState } from "../test/helpers";
import { fullDebate } from "../test/fixtures/events";
import { StageLayout } from "./StageLayout";

// The 3D stage pulls in R3F/three and needs a real canvas; stub it so these tests
// exercise only the overlay composition (the stage itself is visual QA).
vi.mock("../three/DebateStage", () => ({ DebateStage: () => null }));

function renderStage(overrides: Partial<React.ComponentProps<typeof StageLayout>> = {}) {
  const props: React.ComponentProps<typeof StageLayout> = {
    state: initialState,
    question: "",
    rounds: 2,
    onAsk: () => {},
    onStop: () => {},
    soundEnabled: false,
    onToggleSound: () => {},
    questionRef: createRef<HTMLTextAreaElement>(),
    ...overrides,
  };
  return render(<StageLayout {...props} />);
}

describe("StageLayout", () => {
  it("opens with the hero question form and no docket (nothing asked yet)", () => {
    renderStage();
    expect(screen.getByLabelText(/question for the council/i)).toBeInTheDocument();
    expect(screen.queryByLabelText("Debate docket")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show transcript" })).toBeInTheDocument();
  });

  it("folds the hero form away and dockets the question once convened", async () => {
    const onAsk = vi.fn();
    const ref = createRef<HTMLTextAreaElement>();
    renderStage({ onAsk, questionRef: ref });

    await userEvent.type(
      screen.getByLabelText(/question for the council/i),
      "Should we ship on Friday?",
    );
    await userEvent.click(screen.getByRole("button", { name: "Convene the council" }));

    expect(onAsk).toHaveBeenCalledWith("Should we ship on Friday?", 2);
    // The overlay wrapper is now hidden/inert (folded away).
    const overlay = screen
      .getByLabelText(/question for the council/i)
      .closest("[aria-hidden]");
    expect(overlay).toHaveAttribute("aria-hidden", "true");
  });

  it("shows Stop (not Ask-another) while a debate is live", () => {
    renderStage({ state: buildState(fullDebate.slice(0, 4)), question: "Q?" });
    expect(screen.getByRole("button", { name: "Stop" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ask another" })).not.toBeInTheDocument();
    // Docket now carries the question.
    expect(screen.getByLabelText("Debate docket")).toBeInTheDocument();
  });

  it("toggles the transcript drawer open", async () => {
    const { container } = renderStage({ state: buildState(fullDebate), question: "Q?" });
    // Closed drawer is aria-hidden/inert (name blanked), so select by attribute.
    const drawer = container.querySelector('aside[aria-label="Full transcript"]') as HTMLElement;
    expect(drawer).toHaveClass("translate-x-full");
    await userEvent.click(screen.getByRole("button", { name: "Show transcript" }));
    expect(drawer).toHaveClass("translate-x-0");
  });
});
