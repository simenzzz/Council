# Frontend Roadmap — Council (Phase 4)

> Detailed plan for **PROJECT_BRIEF.md Phase 4 (Frontend)**. Read the brief's §4
> (architecture) and the backend wire protocol before starting.
> Status: greenfield — no `frontend/` exists yet.

## Goal

The product's visual hook: a **live 3D panel of LLM "characters"** debating,
streaming over one WebSocket into a multi-column UI, with a moderator verdict.

### Confirmed design decisions
- **Characters = procedural robots** built from Three.js geometry — **no GLB
  asset pipeline**. Fully code-controlled; each persona is distinct via
  color / shape / materials.
- **Hybrid layout** — a 3D stage (animated robots; the active speaker lights up)
  sits **above** the actual streamed debate text, which renders in **readable
  2D transcript columns**. The 3D scene is the stage; the 2D panel is the text.
- **Sequencing: 2D backbone first, then 3D.** Build the tested headless core and
  a working 2D debate UI first (demoable, de-risked), then layer 3D on top of
  the **same reducer state**. If 3D slips, a complete product still ships.

## The backend contract (what the frontend must mirror)

The Go backend is the source of truth. The frontend is a pure consumer of one
WebSocket.

- **Connect:** `ws://localhost:8080/ws` in dev (the Vite origin
  `localhost:5173` is already in the backend's `OriginPatterns` allowlist).
  Prod endpoint via `VITE_WS_URL`.
- **Send exactly one message**, then only receive:
  ```json
  { "type": "ask", "question": "<1..1000 chars>", "rounds": <even 2..8, omit→2> }
  ```
- **Receive a single discriminated-union event** (one struct, discriminated by
  `type` — mirrors `backend/internal/protocol/event.go`):
  | `type` | fields |
  |---|---|
  | `token` | `{ persona, round, delta }` |
  | `persona_done` | `{ persona, round }` |
  | `round_complete` | `{ round }` |
  | `verdict` | `{ verdict }` |
  | `error` | `{ persona?, error }` |
- **Gotchas the TS types must encode:**
  - The error message JSON key is **`error`** (not `errMessage`).
  - Persona identity on the wire is the **ID** only:
    `skeptic | optimist | expert | contrarian | moderator`. **Display names,
    colors, seats, and characters are 100% the frontend's job** — none are sent.
  - Rounds are **1-indexed**. The moderator streams as ordinary `token` events
    with `persona:"moderator"`, `round: rounds+1`, ending in **one** `verdict`
    event (full text), then the socket closes. The moderator gets **no**
    `persona_done`.
  - Per-round ordering: interleaved `token*` → one `persona_done` per panelist →
    `round_complete`. A per-persona `error` does **not** abort the session.
  - **No in-band stop** — closing the socket cancels the whole session.

## Tech stack

- **Vite + React + TypeScript + Tailwind** (+ shadcn/ui where useful).
- **3D:** `@react-three/fiber` + `@react-three/drei` + `three`. (R3F, not vanilla
  Three.js — idiomatic for React.)
- **Boundary validation:** `zod` schemas validate every inbound event before it
  reaches state (validate-at-boundary; never trust the socket).
- **Testing:** Vitest + React Testing Library (unit/component);
  `@react-three/test-renderer` (3D scene-graph smoke tests, no GPU); Playwright +
  a mock-WS harness (E2E). Testing is **front-loaded** — F0–F1 are a heavily
  tested headless + 2D core; the 3D phases isolate their reactive logic into a
  few **pure mapping functions** that are unit-tested, leaving only animation for
  visual QA.

## Architecture sketch

```
  wsClient (lib)  ──parsed+validated events──▶  debateReducer (pure)
                                                      │  one state tree
                        ┌─────────────────────────────┴───────────────┐
                        ▼                                              ▼
              DebateStage (R3F 3D)                       Transcript (2D columns)
              robots read robotVisualState               readable streamed text
              (pure: state → visual[])                   + verdict panel
```

One reducer state feeds both the 3D stage and the 2D transcript — the 3D layer
never owns debate state, it only *renders* a derived view of it.

---

## Phases (each independently testable)

### F0 — Scaffold & contract *(headless, fully tested)*
- Vite + React + TS + Tailwind scaffold under `frontend/`.
- `src/lib/protocol.ts` — discriminated-union TS types mirroring the wire, plus
  **zod** schemas validating every inbound event (reject malformed; encode the
  `error`-key / persona-ID / 1-indexed gotchas).
- `src/lib/wsClient.ts` — thin WS wrapper: connect, send the one `ask` message,
  parse + validate frames, emit typed events, expose lifecycle
  (`connecting | open | closed | error`). **Holds no app state.**
- `src/state/debateReducer.ts` — pure `(state, event) → state`. State: per-
  persona-per-round accumulated text, current round, phase
  (`idle | connecting | debating | moderating | done | error`), active-speaker
  set, verdict text, errors. Immutable updates (new objects, never mutate).
- Throwaway debug view dumping raw state as text, to validate vs. the live
  backend.
- **Tests:** reducer table-driven tests (canned event sequences → asserted
  state); `wsClient` against a mock `WebSocket`; zod rejects malformed frames.
- **Done when:** against the running Go backend, a question streams text + a
  verdict into the debug view; unit tests green.

### F1 — Working 2D debate UI *(fully tested, demoable)*
- Question input + rounds selector; client-side validation mirroring the backend
  (non-empty ≤ 1000 runes; rounds even 2–8); submit disabled while invalid.
- `src/personas/registry.ts` — frontend-owned `ID → { displayName, color, role }`
  (reuse backend display names: The Skeptic / The Optimist / Domain Expert /
  The Contrarian / The Moderator).
- Multi-column transcript from reducer state: a column per persona, round
  dividers, live token append, typing indicator while a persona streams,
  `persona_done` state, round-progress indicator.
- Verdict panel (render moderator markdown). Error banners. Connection-lifecycle
  UI (connecting / disconnected / done). Responsive.
- **Tests:** RTL component tests rendered from canned reducer states; validation
  tests; markdown render test.
- **Done when:** a full debate is usable end-to-end in 2D. **This is the
  de-risked demoable product.**

### F2 — 3D stage, static *(React Three Fiber)*
- Add `@react-three/fiber`, `@react-three/drei`, `three`.
- `src/three/DebateStage.tsx` — `<Canvas>` with room/table, lighting, camera,
  constrained `OrbitControls`.
- `src/three/RobotPersona.tsx` — procedural robot from geometry (body, head,
  emissive eyes, antenna), parametrized by persona color/accent so all 5 are
  distinct. Seat 4 panelists in an arc + the moderator at the head.
- Extend the persona registry with 3D params (color, accent, seat position).
- Hybrid layout: 3D stage on top, 2D transcript columns (F1) below; stack/hide
  the canvas on small screens.
- **Tests:** `@react-three/test-renderer` scene-graph smoke tests (Canvas
  mounts; exactly 5 robots; correct IDs) + visual QA.
- **Done when:** 5 distinct robots seated, lit, camera framed, 60 fps idle.

### F3 — Characters react to the debate
- `src/three/robotVisualState.ts` — **pure** `reducerState → RobotVisualState[]`
  (`idle | thinking | talking | done` + active-speaker highlight + round).
  Robots read this; full text stays in the 2D panel.
- Animate: idle bob; talking (head/antenna motion + eye pulse while that
  persona's tokens stream); settle on done; spotlight / emissive boost for the
  active speaker. Moderator "verdict moment": spotlight the moderator, dim the
  others, while the verdict streams into its panel.
- **Tests:** `robotVisualState` table-driven unit tests (keeps the reactive
  logic headless-testable); the animation itself is visual QA.
- **Done when:** the speaking robot is visibly animated/highlighted in sync with
  its streaming column; the moderator gets its moment.

### F4 — Identity & polish *("dressed up")*
- Distinct silhouettes/materials per persona using geometry only (e.g. skeptic
  angular/cool, optimist bright/round, expert visor, contrarian asymmetric,
  moderator centered/gavel). Emissive palettes; optional bloom
  (`@react-three/postprocessing`), perf-guarded.
- Smooth token animation, micro-interactions, topic presets, polished verdict
  reveal; optional sound (off by default); `prefers-reduced-motion` respected.
- Responsive/perf fallback: low-end/mobile → 2D-only mode (reuse F1).
- **Tests:** logic tests stay green; visual + perf QA pass.
- **Done when:** each robot reads as its persona; smooth; graceful 2D fallback.

### F5 — E2E & deploy prep
- Playwright E2E against a **mock-WS harness** replaying canned event logs
  (deterministic, no live LLM) — mirrors the backend's fake-provider testing
  ethos. Assert: ask → columns fill → robots animate (smoke) → verdict.
- `VITE_WS_URL` for the prod WS endpoint; build; deploy to Vercel; README +
  demo GIF.
- **Done when:** E2E green in CI; deployed; prod points at the deployed Go
  backend.

---

## Representative file layout
```
frontend/
  src/
    lib/protocol.ts          types + zod validation of the wire
    lib/wsClient.ts          WS lifecycle, emits typed events (no state)
    state/debateReducer.ts   pure (state, event) → state
    personas/registry.ts     ID → display name / color / role / 3D params
    components/controls/      question input, rounds selector
    components/transcript/    columns, round dividers, typing indicator
    components/verdict/        moderator verdict panel
    three/DebateStage.tsx     R3F Canvas, room, lights, camera
    three/RobotPersona.tsx    procedural robot geometry
    three/robotVisualState.ts pure state → robot visual[]
    test/fixtures/            canned event logs (shared by unit + E2E)
```
Favor many small, cohesive files (≈200–400 lines) over few large ones.

## Working rules (carried from CLAUDE.md)
- Validate inbound WS frames at the boundary (zod); never trust the socket.
- Immutable state updates — new objects between reducer steps, never mutate.
- Run `everything-claude-code:code-reviewer` after each non-trivial phase; add
  `security-reviewer` for the WS-client / inbound-validation surface in F0.
