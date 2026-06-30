// Design tokens — single source of truth for Council's "Holographic council"
// aesthetic: a deep space-navy deliberation chamber where each persona owns a
// distinct neon accent and streamed tokens read like live telemetry.
//
// These values are mirrored into CSS custom properties in styles/theme.css and
// mapped into Tailwind's @theme. The per-persona accents are a contract reused
// downstream by F1's persona registry and the F2+ procedural robots — change a
// hue here and it propagates everywhere.

export const PERSONA_IDS = [
  "skeptic",
  "optimist",
  "expert",
  "contrarian",
  "moderator",
] as const;

export type PersonaId = (typeof PERSONA_IDS)[number];

/** Base chamber palette (named hex, 6 values). */
export const palette = {
  bg: "#0B1020", // space-navy backdrop
  panel: "#141A2E", // glass panel surface
  panelBorder: "#243049", // hairline edge on panels
  ink: "#E6ECFF", // primary cool-white text
  muted: "#8A93B2", // secondary / labels
  danger: "#FF6B7A", // error state
} as const;

/**
 * Per-persona neon accent. One vivid hue each, equal energy, so all five read
 * as distinct seats around the table without any one dominating.
 */
export const personaAccent: Record<PersonaId, string> = {
  skeptic: "#36D6FF", // ice-cyan — cold, analytical
  optimist: "#FFC24B", // amber — warmth, upside
  expert: "#34E0A1", // signal-green — rigor
  contrarian: "#C77DFF", // violet — alternative framing
  moderator: "#9FB4FF", // platinum-blue — synthesis, central
} as const;

/** Type roles: characterful display, readable body, monospace token telemetry. */
export const fonts = {
  display: '"Space Grotesk", system-ui, sans-serif',
  body: '"Inter", system-ui, sans-serif',
  mono: '"IBM Plex Mono", ui-monospace, monospace',
} as const;
