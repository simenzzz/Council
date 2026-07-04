import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { QuestionOverlay } from "./QuestionOverlay";

describe("QuestionOverlay", () => {
  it("is interactive and exposed when visible", () => {
    const { container } = render(
      <QuestionOverlay visible={true} phase="idle" onAsk={() => {}} />,
    );
    const wrapper = container.firstElementChild!;
    expect(wrapper).toHaveAttribute("aria-hidden", "false");
    expect(wrapper).not.toHaveAttribute("inert");
    expect(screen.getByLabelText(/question for the council/i)).toBeInTheDocument();
  });

  it("is hidden and inert (out of the tab/a11y tree) when not visible", () => {
    const { container } = render(
      <QuestionOverlay visible={false} phase="debating" onAsk={() => {}} />,
    );
    const wrapper = container.firstElementChild!;
    expect(wrapper).toHaveAttribute("aria-hidden", "true");
    expect(wrapper).toHaveAttribute("inert");
    // Still mounted (draft survives), just not reachable.
    expect(screen.getByLabelText(/question for the council/i)).toBeInTheDocument();
  });
});
