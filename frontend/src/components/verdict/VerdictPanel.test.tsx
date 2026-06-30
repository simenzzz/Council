import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VerdictPanel } from "./VerdictPanel";

describe("VerdictPanel", () => {
  it("streams the moderator as plain text while deliberating", () => {
    render(
      <VerdictPanel
        phase="moderating"
        verdict=""
        streamingText="The council leans yes"
        onClose={vi.fn()}
        onAskAnother={vi.fn()}
      />,
    );
    expect(screen.getByRole("heading", { name: /deliberating/i })).toBeInTheDocument();
    expect(screen.getByText(/the council leans yes/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /ask another question/i })).not.toBeInTheDocument();
  });

  it("renders the final verdict as markdown", () => {
    render(
      <VerdictPanel
        phase="done"
        verdict={"## Final Verdict\n\n- Point one\n- Point two"}
        streamingText="ignored once done"
        onClose={vi.fn()}
        onAskAnother={vi.fn()}
      />,
    );
    expect(screen.getByRole("heading", { level: 2, name: "Final Verdict" })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("moves focus into the dialog on open and restores it on close", () => {
    const opener = document.createElement("button");
    document.body.appendChild(opener);
    opener.focus();
    expect(document.activeElement).toBe(opener);

    const { unmount } = render(
      <VerdictPanel
        phase="done"
        verdict="Done."
        streamingText=""
        onClose={vi.fn()}
        onAskAnother={vi.fn()}
      />,
    );
    expect(document.activeElement).toBe(screen.getByRole("dialog"));

    unmount();
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });

  it("traps Tab focus within the dialog", () => {
    render(
      <VerdictPanel
        phase="done"
        verdict="Done."
        streamingText=""
        onClose={vi.fn()}
        onAskAnother={vi.fn()}
      />,
    );
    const dialog = screen.getByRole("dialog");
    const close = screen.getByRole("button", { name: /^close$/i });
    const askAnother = screen.getByRole("button", { name: /ask another question/i });

    // Tab off the last focusable wraps to the first.
    askAnother.focus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(document.activeElement).toBe(close);

    // Shift+Tab off the first wraps to the last.
    close.focus();
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(askAnother);
  });

  it("invokes callbacks for ask-another, close, and Escape", async () => {
    const onClose = vi.fn();
    const onAskAnother = vi.fn();
    render(
      <VerdictPanel
        phase="done"
        verdict="Done."
        streamingText=""
        onClose={onClose}
        onAskAnother={onAskAnother}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /ask another question/i }));
    expect(onAskAnother).toHaveBeenCalledOnce();

    await userEvent.click(screen.getByRole("button", { name: /^close$/i }));
    expect(onClose).toHaveBeenCalledOnce();

    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
