import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PlaybackControls } from "./PlaybackControls";

function renderControls(overrides: Partial<React.ComponentProps<typeof PlaybackControls>> = {}) {
  const props: React.ComponentProps<typeof PlaybackControls> = {
    phase: "debating",
    rate: 1,
    onSetRate: () => {},
    isAtLive: true,
    onGoToLive: () => {},
    ...overrides,
  };
  return render(<PlaybackControls {...props} />);
}

describe("PlaybackControls", () => {
  it("renders speed presets while live, marking the current rate as pressed", () => {
    renderControls({ rate: 1.5 });
    const btn = screen.getByRole("button", { name: "1.5x" });
    expect(btn).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "1x" })).toHaveAttribute("aria-pressed", "false");
  });

  it("calls onSetRate with the clicked preset", async () => {
    const onSetRate = vi.fn();
    renderControls({ onSetRate });
    await userEvent.click(screen.getByRole("button", { name: "2x" }));
    expect(onSetRate).toHaveBeenCalledWith(2);
  });

  it("renders nothing once the session isn't live", () => {
    const { container } = renderControls({ phase: "done" });
    expect(container).toBeEmptyDOMElement();
  });

  it("shows Go to live only while live and behind", async () => {
    const onGoToLive = vi.fn();
    renderControls({ phase: "debating", isAtLive: false, onGoToLive });
    const btn = screen.getByRole("button", { name: "Go to live" });
    await userEvent.click(btn);
    expect(onGoToLive).toHaveBeenCalledOnce();
  });

  it("hides Go to live once caught up", () => {
    renderControls({ phase: "debating", isAtLive: true });
    expect(screen.queryByRole("button", { name: "Go to live" })).not.toBeInTheDocument();
  });

  it("renders nothing once the session isn't live, even if isAtLive is false", () => {
    const { container } = renderControls({ phase: "done", isAtLive: false });
    expect(container).toBeEmptyDOMElement();
  });
});
