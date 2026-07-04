# Council — Frontend

A live, multi-column debate UI: one question, a panel of AI personas answer and
rebut each other across rounds streaming over a single WebSocket, then a
moderator delivers a verdict. See `../FRONTEND_ROADMAP.md` for the phased plan
and `../backend` for the Go service that is the source of truth for the wire
protocol.

## Status — F0–F4 done (headless core → 2D UI → 3D robot stage → polish)

Built and tested:

- `src/lib/protocol.ts` — TypeScript discriminated-union types + **zod** schemas
  validating every inbound frame at the boundary (mirrors
  `backend/internal/protocol/event.go`), plus `buildAsk` mirroring the backend's
  inbound validation.
- `src/lib/wsClient.ts` — stateless WebSocket wrapper: connect, send one `ask`,
  validate + emit typed events, expose lifecycle status. Holds no app state.
- `src/state/debateReducer.ts` — pure, immutable `(state, input) => state`.
- `src/components/transcript`, `src/components/verdict`, `src/components/controls`,
  `src/components/status` — the 2D multi-column debate UI: question input,
  live streaming columns, round dividers, moderator verdict, connection state.
- `src/three` — the R3F "robot panel" stage (`DebateStage`, `RobotPersona`,
  `robotVisualState`), driven by the same reducer state as the 2D transcript.
- `src/personas/registry.ts` — persona display names, colors, 3D params.
- `src/design/tokens.ts` + `src/styles/theme.css` — the "Holographic council"
  design tokens (palette incl. per-persona neon accents, type roles).

F5 (CI + deploy prep) is next — see `../FRONTEND_ROADMAP.md`.

## Develop

```bash
npm install
npm run dev      # Vite dev server on http://localhost:5173
npm test         # Vitest unit suite
npm run coverage # coverage for the headless core (lib + state)
npm run build    # typecheck + production build
npm run lint     # oxlint
```

The dev client connects to `ws://localhost:8080/ws` by default. Run the backend
(`cd ../backend && ZAI_API_KEY=… go run ./cmd/server`) to drive a real debate;
the Vite origin `localhost:5173` is already in the backend's allowlist.

## Config

- `VITE_WS_URL` — production WebSocket endpoint (see `.env.example`). Defaults to
  `ws://localhost:8080/ws` in dev.
