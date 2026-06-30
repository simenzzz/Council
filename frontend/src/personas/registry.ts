// Persona registry — the frontend-owned identity layer. The wire carries only
// the lowercase persona ID (skeptic | optimist | … | moderator); display names,
// roles, and seating are 100% the frontend's job. Accent hues are NOT redefined
// here — they come from design/tokens.ts (the single source of truth shared with
// the F2+ procedural robots), so a hue change there propagates everywhere.

import { personaAccent, type PersonaId } from "../design/tokens";

export type PersonaMeta = {
  id: PersonaId;
  /** Display name, matching the backend's persona labels. */
  displayName: string;
  /** One-line, interface-voice description of what this seat does. */
  role: string;
};

/** ID → identity. Display names mirror the backend's `Persona.Name` values. */
export const personaMeta: Record<PersonaId, PersonaMeta> = {
  skeptic: { id: "skeptic", displayName: "The Skeptic", role: "Stress-tests the claim" },
  optimist: { id: "optimist", displayName: "The Optimist", role: "Argues the upside" },
  expert: { id: "expert", displayName: "Domain Expert", role: "Brings the evidence" },
  contrarian: { id: "contrarian", displayName: "The Contrarian", role: "Reframes the problem" },
  moderator: { id: "moderator", displayName: "The Moderator", role: "Synthesizes the verdict" },
} as const;

/** Panelists in seating order — the four debaters. Excludes the moderator. */
export const PANELISTS: readonly PersonaId[] = [
  "skeptic",
  "optimist",
  "expert",
  "contrarian",
] as const;

export const MODERATOR_ID: PersonaId = "moderator";

/** The persona's neon accent hex (re-exported for ergonomic component use). */
export function accentOf(id: PersonaId): string {
  return personaAccent[id];
}
