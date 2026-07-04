import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { SeatIndicator } from "./SeatIndicator";
import { MODERATOR_ID, PANELISTS, accentOf, personaMeta } from "../../personas/registry";
import type { PersonaId } from "../../design/tokens";

const SEATS: PersonaId[] = [...PANELISTS, MODERATOR_ID];

describe("SeatIndicator", () => {
  it("renders one accessibly-named pip per council seat", () => {
    render(<SeatIndicator />);
    const group = screen.getByRole("group", { name: /council seats/i });
    // 4 debaters + moderator = 5.
    expect(SEATS).toHaveLength(5);

    for (const id of SEATS) {
      const meta = personaMeta[id];
      const pip = within(group).getByLabelText(`${meta.displayName} — ${meta.role}`);
      // Hue comes from the registry, not a hardcoded value in the component.
      expect(pip).toHaveStyle({ "--pip": accentOf(id) });
    }
  });

  it("shows the seat-count status readout", () => {
    render(<SeatIndicator />);
    expect(screen.getByText(/council · 5 seats ready/i)).toBeInTheDocument();
  });
});
