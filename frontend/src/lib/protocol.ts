// Wire protocol — TypeScript types + zod schemas mirroring the Go backend's
// single `Event` struct (backend/internal/protocol/event.go) and inbound `ask`
// message (inbound.go). The socket is untrusted: every inbound frame is parsed
// and validated here at the boundary before it reaches any app state.
//
// Backend gotchas encoded below:
//  - The backend serializes ONE struct with `omitempty` on every field but
//    `type`, so empty strings / zero ints arrive as ABSENT keys. `delta`,
//    `verdict`, and `error` therefore default to "" rather than being required.
//  - The error message key is `error` (not `errMessage`).
//  - Persona identity on the wire is the ID only.
//  - Rounds are 1-indexed; the moderator streams `token`s with round=rounds+1
//    and ends in a single `verdict` (no round, no persona, no persona_done).

import { z } from "zod";
import { PERSONA_IDS, type PersonaId } from "../design/tokens";

export const personaIdSchema = z.enum(PERSONA_IDS);

// Mirrors backend ClientMessage.Validate (inbound.go): rounds, if present, is
// an even integer in [2, 8]; declared here (ahead of the rest of the outbound
// `ask` section below) so the inbound round bound can derive from it.
export const MAX_ROUNDS = 8;

// 1-indexed; round 0 never on wire. The moderator streams at rounds+1, and
// rounds is capped at MAX_ROUNDS, so no legitimate frame can carry a round
// past MAX_ROUNDS + 1 — bound it so a malformed/hostile frame can't smuggle
// an unbounded number into state.
const MAX_WIRE_ROUND = MAX_ROUNDS + 1;
const roundSchema = z.number().int().positive().max(MAX_WIRE_ROUND);

// One schema per `type`, combined into a discriminated union. Fields that the
// backend may drop via omitempty are given defaults so a sparse frame is still
// valid and normalized.
const tokenSchema = z.object({
  type: z.literal("token"),
  persona: personaIdSchema,
  round: roundSchema,
  delta: z.string().default(""),
});

const personaDoneSchema = z.object({
  type: z.literal("persona_done"),
  persona: personaIdSchema,
  round: roundSchema,
});

const roundCompleteSchema = z.object({
  type: z.literal("round_complete"),
  round: roundSchema,
});

const verdictSchema = z.object({
  type: z.literal("verdict"),
  verdict: z.string().default(""),
});

// `persona` is omitted for session-level errors (e.g. "invalid request") and
// present for per-persona stream failures.
const errorSchema = z.object({
  type: z.literal("error"),
  error: z.string().default(""),
  persona: personaIdSchema.optional(),
});

export const debateEventSchema = z.discriminatedUnion("type", [
  tokenSchema,
  personaDoneSchema,
  roundCompleteSchema,
  verdictSchema,
  errorSchema,
]);

export type DebateEvent = z.infer<typeof debateEventSchema>;
export type TokenEvent = z.infer<typeof tokenSchema>;
export type PersonaDoneEvent = z.infer<typeof personaDoneSchema>;
export type RoundCompleteEvent = z.infer<typeof roundCompleteSchema>;
export type VerdictEvent = z.infer<typeof verdictSchema>;
export type ErrorEvent = z.infer<typeof errorSchema>;

export type ParseResult =
  | { ok: true; event: DebateEvent }
  | { ok: false; error: string };

/**
 * Parse one raw WebSocket frame into a validated DebateEvent. Never throws:
 * malformed JSON or a schema mismatch returns `{ ok: false }` so the caller can
 * surface the error without crashing the socket loop.
 */
export function parseEvent(raw: string): ParseResult {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, error: "frame is not valid JSON" };
  }
  const result = debateEventSchema.safeParse(json);
  if (!result.success) {
    return { ok: false, error: result.error.issues[0]?.message ?? "invalid event" };
  }
  return { ok: true, event: result.data };
}

// --- Outbound `ask` message ------------------------------------------------
// Mirrors backend ClientMessage.Validate (inbound.go): non-empty trimmed
// question of at most 1000 runes; rounds, if present, an even integer in
// [2, 8]; omit rounds to take the backend default of 2.

export const MAX_QUESTION_RUNES = 1000;
export const MIN_ROUNDS = 2;
export const DEFAULT_ROUNDS = 2;

export type AskMessage = {
  type: "ask";
  question: string;
  rounds?: number;
};

export type BuildAskResult =
  | { ok: true; message: AskMessage }
  | { ok: false; error: string };

/** Count Unicode code points, matching Go's utf8.RuneCountInString. */
function runeCount(s: string): number {
  return [...s].length;
}

/**
 * Build a validated `ask` message, applying the same rules as the backend so
 * the UI can fail fast before opening a socket. `rounds` is omitted from the
 * message when undefined, letting the server default it.
 */
export function buildAsk(question: string, rounds?: number): BuildAskResult {
  const trimmed = question.trim();
  if (trimmed === "") {
    return { ok: false, error: "Ask a question to convene the council." };
  }
  if (runeCount(trimmed) > MAX_QUESTION_RUNES) {
    return { ok: false, error: `Question must be ${MAX_QUESTION_RUNES} characters or fewer.` };
  }
  if (rounds !== undefined) {
    if (!Number.isInteger(rounds) || rounds < MIN_ROUNDS || rounds > MAX_ROUNDS || rounds % 2 !== 0) {
      return { ok: false, error: `Rounds must be an even number between ${MIN_ROUNDS} and ${MAX_ROUNDS}.` };
    }
  }
  const message: AskMessage = { type: "ask", question: trimmed };
  if (rounds !== undefined) message.rounds = rounds;
  return { ok: true, message };
}

export type { PersonaId };
