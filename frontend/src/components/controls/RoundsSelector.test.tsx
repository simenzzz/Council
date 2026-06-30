import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RoundsSelector } from "./RoundsSelector";

describe("RoundsSelector", () => {
  it("offers only even round counts in [2, 8]", () => {
    render(<RoundsSelector value={2} onChange={vi.fn()} />);
    const options = screen.getAllByRole("option").map((o) => o.textContent);
    expect(options).toEqual(["2", "4", "6", "8"]);
  });

  it("emits the chosen value as a number", async () => {
    const onChange = vi.fn();
    render(<RoundsSelector value={2} onChange={onChange} />);
    await userEvent.selectOptions(screen.getByRole("combobox"), "6");
    expect(onChange).toHaveBeenCalledWith(6);
  });

  it("can be disabled while a session is live", () => {
    render(<RoundsSelector value={4} onChange={vi.fn()} disabled />);
    expect(screen.getByRole("combobox")).toBeDisabled();
  });
});
