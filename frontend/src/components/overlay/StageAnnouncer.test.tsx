import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { initialState } from "../../state/debateReducer";
import { buildState } from "../../test/helpers";
import { debateWithPersonaError, fullDebate } from "../../test/fixtures/events";
import { StageAnnouncer } from "./StageAnnouncer";

describe("StageAnnouncer", () => {
  it("is silent with no persona errors and no verdict", () => {
    const { container } = render(<StageAnnouncer state={initialState} />);
    expect(container.textContent).toBe("");
  });

  it("assertively voices a per-persona stream failure (trapped in the desktop drawer)", () => {
    render(<StageAnnouncer state={buildState(debateWithPersonaError)} />);
    const msg = screen.getByText(/Domain Expert.*stream failed/);
    expect(msg.closest("[aria-live]")).toHaveAttribute("aria-live", "assertive");
  });

  it("politely points to the transcript once the verdict is ready", () => {
    render(<StageAnnouncer state={buildState(fullDebate)} />);
    const hint = screen.getByText(/verdict is ready\. Open the transcript/i);
    expect(hint).toHaveAttribute("aria-live", "polite");
  });
});
