import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { debateWithPersonaError, sessionError } from "../../test/fixtures/events";
import { buildState } from "../../test/helpers";
import { ErrorBanner } from "./ErrorBanner";

describe("ErrorBanner", () => {
  it("renders a session-level error message when the phase is error", () => {
    render(<ErrorBanner state={buildState(sessionError)} />);
    expect(screen.getByRole("alert")).toHaveTextContent("invalid request");
  });

  it("does not render for a non-fatal per-persona error (debate completes)", () => {
    // debateWithPersonaError ends in a verdict → phase "done", not "error".
    const { container } = render(<ErrorBanner state={buildState(debateWithPersonaError)} />);
    expect(container).toBeEmptyDOMElement();
  });
});
