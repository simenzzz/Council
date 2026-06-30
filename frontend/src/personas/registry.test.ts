import { describe, expect, it } from "vitest";
import { PERSONA_IDS } from "../design/tokens";
import { MODERATOR_ID, PANELISTS, accentOf, personaMeta } from "./registry";

describe("persona registry", () => {
  it("has metadata for every wire persona id, self-consistently keyed", () => {
    for (const id of PERSONA_IDS) {
      const meta = personaMeta[id];
      expect(meta).toBeDefined();
      expect(meta.id).toBe(id);
      expect(meta.displayName.length).toBeGreaterThan(0);
      expect(meta.role.length).toBeGreaterThan(0);
    }
  });

  it("mirrors the backend display names", () => {
    expect(personaMeta.skeptic.displayName).toBe("The Skeptic");
    expect(personaMeta.optimist.displayName).toBe("The Optimist");
    expect(personaMeta.expert.displayName).toBe("Domain Expert");
    expect(personaMeta.contrarian.displayName).toBe("The Contrarian");
    expect(personaMeta.moderator.displayName).toBe("The Moderator");
  });

  it("lists the four panelists in seating order, excluding the moderator", () => {
    expect(PANELISTS).toEqual(["skeptic", "optimist", "expert", "contrarian"]);
    expect(PANELISTS).not.toContain(MODERATOR_ID);
    expect(MODERATOR_ID).toBe("moderator");
  });

  it("exposes the design-token accent for an id", () => {
    expect(accentOf("skeptic")).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });
});
