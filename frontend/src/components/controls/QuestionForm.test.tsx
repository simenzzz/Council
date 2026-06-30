import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QuestionForm } from "./QuestionForm";

function setup(phase: Parameters<typeof QuestionForm>[0]["phase"] = "idle") {
  const onAsk = vi.fn();
  const onStop = vi.fn();
  render(<QuestionForm phase={phase} onAsk={onAsk} onStop={onStop} />);
  return { onAsk, onStop };
}

describe("QuestionForm", () => {
  it("disables Convene until a valid question is entered", async () => {
    const { onAsk } = setup();
    const convene = screen.getByRole("button", { name: /convene the council/i });
    expect(convene).toBeDisabled();

    await userEvent.type(screen.getByLabelText(/question for the council/i), "  Is AI conscious?  ");
    expect(convene).toBeEnabled();

    await userEvent.click(convene);
    // Trimmed question, default rounds.
    expect(onAsk).toHaveBeenCalledWith("Is AI conscious?", 2);
  });

  it("shows an error and stays disabled when the question exceeds 1000 runes", async () => {
    setup();
    await userEvent.type(screen.getByLabelText(/question for the council/i), "x".repeat(1001), {
      // typing 1001 chars one-by-one is slow; skip per-key delay
      delay: null,
    });
    expect(screen.getByRole("alert")).toHaveTextContent(/1000 characters or fewer/i);
    expect(screen.getByRole("button", { name: /convene the council/i })).toBeDisabled();
    expect(screen.getByText("1001 / 1000")).toBeInTheDocument();
  });

  it("submits the selected round count", async () => {
    const { onAsk } = setup();
    await userEvent.type(screen.getByLabelText(/question for the council/i), "Question?");
    await userEvent.selectOptions(screen.getByRole("combobox"), "4");
    await userEvent.click(screen.getByRole("button", { name: /convene the council/i }));
    expect(onAsk).toHaveBeenCalledWith("Question?", 4);
  });

  it("shows a live, disabled session and wires Stop", async () => {
    const { onStop, onAsk } = setup("debating");
    const convene = screen.getByRole("button", { name: /council in session/i });
    expect(convene).toBeDisabled();
    expect(onAsk).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: /stop/i }));
    expect(onStop).toHaveBeenCalledOnce();
  });
});
