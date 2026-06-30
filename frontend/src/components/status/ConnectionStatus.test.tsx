import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ConnectionStatus } from "./ConnectionStatus";

describe("ConnectionStatus", () => {
  it("shows round progress while debating", () => {
    render(<ConnectionStatus phase="debating" currentRound={1} rounds={2} />);
    expect(screen.getByRole("status")).toHaveTextContent("Round 1 of 2");
  });

  it("clamps progress to the requested total (moderator round is not counted)", () => {
    render(<ConnectionStatus phase="debating" currentRound={5} rounds={2} />);
    expect(screen.getByRole("status")).toHaveTextContent("Round 2 of 2");
  });

  it("reports deliberation and the delivered verdict", () => {
    const { rerender } = render(
      <ConnectionStatus phase="moderating" currentRound={3} rounds={2} />,
    );
    expect(screen.getByRole("status")).toHaveTextContent(/deliberating/i);
    rerender(<ConnectionStatus phase="done" currentRound={3} rounds={2} />);
    expect(screen.getByRole("status")).toHaveTextContent(/verdict delivered/i);
  });

  it("renders nothing when idle", () => {
    const { container } = render(<ConnectionStatus phase="idle" currentRound={0} rounds={2} />);
    expect(container).toBeEmptyDOMElement();
  });
});
