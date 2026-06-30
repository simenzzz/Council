import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Markdown } from "./Markdown";

describe("Markdown", () => {
  it("renders headings, emphasis, lists, and code", () => {
    render(
      <Markdown>{[
        "# Title",
        "## Subhead",
        "Plain **bold** and *italic* with `inline` code.",
        "",
        "- one",
        "- two",
        "",
        "1. first",
        "2. second",
        "",
        "> a quote",
      ].join("\n")}</Markdown>,
    );
    expect(screen.getByRole("heading", { level: 1, name: "Title" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Subhead" })).toBeInTheDocument();
    expect(screen.getByText("bold")).toBeInTheDocument();
    expect(screen.getByText("italic")).toBeInTheDocument();
    expect(screen.getByText("inline")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
  });

  it("renders GFM tables and safe external links", () => {
    render(
      <Markdown>{[
        "| A | B |",
        "| - | - |",
        "| 1 | 2 |",
        "",
        "[link](https://example.com)",
      ].join("\n")}</Markdown>,
    );
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getAllByRole("columnheader")).toHaveLength(2);
    const link = screen.getByRole("link", { name: "link" });
    expect(link).toHaveAttribute("href", "https://example.com");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });

  it("does not render raw HTML as markup (escaped, not injected)", () => {
    render(<Markdown>{"<script>alert(1)</script> safe"}</Markdown>);
    // The tag text is rendered as literal text; no <script> element is created.
    expect(document.querySelector("script")).toBeNull();
    expect(screen.getByText(/alert\(1\)/)).toBeInTheDocument();
  });
});
