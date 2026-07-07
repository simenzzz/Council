import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StageControls } from "./StageControls";

function renderControls(overrides: Partial<React.ComponentProps<typeof StageControls>> = {}) {
  const props: React.ComponentProps<typeof StageControls> = {
    phase: "idle",
    composing: false,
    onStop: () => {},
    onAskAnother: () => {},
    drawerOpen: false,
    onToggleDrawer: () => {},
    soundEnabled: false,
    onToggleSound: () => {},
    rate: 1,
    onSetRate: () => {},
    isAtLive: true,
    onGoToLive: () => {},
    ...overrides,
  };
  return render(<StageControls {...props} />);
}

describe("StageControls", () => {
  it("offers Stop (not Ask-another) while a session is live", () => {
    renderControls({ phase: "debating" });
    expect(screen.getByRole("button", { name: "Stop" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ask another" })).not.toBeInTheDocument();
  });

  it("offers Ask-another (not Stop) once a run has ended and the form is closed", () => {
    renderControls({ phase: "done", composing: false });
    expect(screen.getByRole("button", { name: "Ask another" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Stop" })).not.toBeInTheDocument();
  });

  it("hides Ask-another while the question form is already open", () => {
    renderControls({ phase: "idle", composing: true });
    expect(screen.queryByRole("button", { name: "Ask another" })).not.toBeInTheDocument();
  });

  it("toggles the transcript drawer, reflecting open state via aria-pressed", async () => {
    const onToggleDrawer = vi.fn();
    renderControls({ drawerOpen: true, onToggleDrawer });
    const btn = screen.getByRole("button", { name: "Hide transcript" });
    expect(btn).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(btn);
    expect(onToggleDrawer).toHaveBeenCalledOnce();
  });

  it("threads playback controls through to the embedded PlaybackControls", async () => {
    const onGoToLive = vi.fn();
    renderControls({ phase: "debating", isAtLive: false, onGoToLive });
    await userEvent.click(screen.getByRole("button", { name: "Go to live" }));
    expect(onGoToLive).toHaveBeenCalledOnce();
  });
});
