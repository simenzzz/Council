import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Header } from "./Header";

describe("Header", () => {
  it("renders the masthead title", () => {
    render(<Header />);
    expect(screen.getByRole("heading", { level: 1, name: "Council" })).toBeInTheDocument();
  });
});
