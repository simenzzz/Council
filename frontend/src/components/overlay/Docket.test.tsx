import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Docket } from "./Docket";

describe("Docket", () => {
  it("renders nothing before a question has been asked", () => {
    const { container } = render(
      <Docket question="" phase="idle" currentRound={0} rounds={2} onEdit={() => {}} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the question and the live round readout", () => {
    render(
      <Docket question="Should we ship on Friday?" phase="debating" currentRound={2} rounds={4} onEdit={() => {}} />,
    );
    expect(screen.getByText("Should we ship on Friday?")).toBeInTheDocument();
    expect(screen.getByText("Round 2 of 4")).toBeInTheDocument();
  });

  it("re-opens the question form when the docket question is clicked", async () => {
    const onEdit = vi.fn();
    render(<Docket question="Why?" phase="done" currentRound={3} rounds={2} onEdit={onEdit} />);
    await userEvent.click(screen.getByText("Why?"));
    expect(onEdit).toHaveBeenCalledOnce();
  });
});
