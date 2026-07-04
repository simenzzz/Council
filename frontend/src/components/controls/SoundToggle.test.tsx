import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SoundToggle } from "./SoundToggle";

describe("SoundToggle", () => {
  it("labels itself Unmute when disabled and Mute when enabled", () => {
    const { rerender } = render(<SoundToggle enabled={false} onToggle={vi.fn()} />);
    expect(screen.getByRole("button", { name: /unmute sound/i })).toHaveAttribute(
      "aria-pressed",
      "false",
    );

    rerender(<SoundToggle enabled onToggle={vi.fn()} />);
    expect(screen.getByRole("button", { name: /mute sound/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("calls onToggle when clicked", async () => {
    const onToggle = vi.fn();
    render(<SoundToggle enabled={false} onToggle={onToggle} />);
    await userEvent.click(screen.getByRole("button"));
    expect(onToggle).toHaveBeenCalledOnce();
  });
});
