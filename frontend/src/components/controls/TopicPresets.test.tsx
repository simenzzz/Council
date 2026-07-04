import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TOPIC_PRESETS } from "../../data/topicPresets";
import { TopicPresets } from "./TopicPresets";

describe("TopicPresets", () => {
  it("renders one chip per preset", () => {
    render(<TopicPresets onPick={vi.fn()} />);
    for (const preset of TOPIC_PRESETS) {
      expect(screen.getByRole("button", { name: preset.label })).toBeInTheDocument();
    }
  });

  it("calls onPick with the preset's question when clicked", async () => {
    const onPick = vi.fn();
    render(<TopicPresets onPick={onPick} />);
    const first = TOPIC_PRESETS[0];
    await userEvent.click(screen.getByRole("button", { name: first.label }));
    expect(onPick).toHaveBeenCalledWith(first.question);
  });

  it("disables every chip while a session is live", () => {
    render(<TopicPresets onPick={vi.fn()} disabled />);
    for (const preset of TOPIC_PRESETS) {
      expect(screen.getByRole("button", { name: preset.label })).toBeDisabled();
    }
  });
});
