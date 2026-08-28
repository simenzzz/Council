# Council

Ask one question. A panel of 3-5 AI personas answers it, rebuts each other, and
a moderator delivers a final verdict — all streaming live into a multi-column UI.

The product hook is the live parallel debate. The engineering core is the Go
backend: it fans out N concurrent streaming LLM calls and multiplexes them onto
a single WebSocket.

## How a debate runs

1. **Round 1 — answer.** Each persona answers the question independently.
2. **Round 2 — rebut.** Each persona reads the other transcripts and responds.
3. **Verdict.** A moderator persona synthesizes the debate into one answer.

Personas differ by system prompt, not by vendor. One provider (z.ai / GLM)
serves the whole panel.

## The core invariant

WebSocket writes are **not** concurrency-safe. Council enforces one rule
everywhere:

```
persona goroutine ─┐
persona goroutine ─┼──► fan-in channel ──► single writer goroutine ──► WebSocket
persona goroutine ─┘
```

`errgroup` runs one goroutine per persona per round. Every goroutine pushes
tagged token deltas into one fan-in channel. Exactly one writer goroutine drains
that channel and touches the socket. No other goroutine ever writes to it.

A `context` tree rooted at the connection carries cancellation. When the client
disconnects or presses stop, every persona goroutine for that session stops.

Transcripts pass between rounds immutably. Each round builds new copies and
never mutates a previous round.

## Wire protocol

One WebSocket per session carries typed JSON events, server to client:

| Event | Payload |
|---|---|
| `token` | `{persona, round, delta}` |
| `persona_done` | persona finished the round |
| `round_complete` | all personas finished the round |
| `verdict` | the moderator answer |
| `error` | a structured failure |

## Stack

| Layer | Technology |
|---|---|
| Backend | Go 1.25, stdlib `net/http` ServeMux, `log/slog`, `errgroup` |
| WebSocket | `github.com/coder/websocket` |
| Persistence | SQLite (`modernc.org/sqlite`, pure Go, no cgo) |
| LLM provider | z.ai / GLM, behind a `Provider` interface |
| Frontend | React 19, TypeScript, Vite, react-three-fiber |
| Tests | `go test -race`, Vitest |

## Quick start

Backend:

```bash
cd backend
export ZAI_API_KEY=your-key-here
go run ./cmd/server        # listens on :8080
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Smoke-test the backend without spending tokens:

```bash
curl localhost:8080/healthz          # liveness
# /ws/echo is a debug endpoint that echoes frames back
```

`GET /ws` starts a real debate and makes paid provider calls.

## Configuration

The backend reads its configuration from the environment. A `.env` file works
through `godotenv`.

| Variable | Purpose |
|---|---|
| `ZAI_API_KEY` | Provider credential. Required. |
| `BACKEND_ADDR` | Listen address. |
| `FRONTEND_ORIGINS` | Allowed WebSocket origins, comma-separated. |
| `LLM_MODEL` | Model name passed to the provider. |
| `DB_PATH` | SQLite file for the daily quota. |
| `DAILY_QUOTA` | Debates permitted per day. |
| `MAX_CONCURRENT_SESSIONS` | Cap on live debates. |
| `RATE_LIMIT_RPS`, `RATE_LIMIT_BURST` | Per-IP token bucket. |
| `RATE_LIMIT_TTL`, `RATE_LIMIT_SWEEP` | Limiter entry expiry and sweep period. |
| `TRUST_PROXY` | Read the client IP from proxy headers. |

## Hardening

- Per-IP rate limiting with a token bucket, plus a sweeper for stale entries.
- A SQLite daily quota that survives a restart.
- Timeouts on every HTTP and provider call.
- Graceful shutdown that drains live WebSocket sessions.
- Origin checks on the WebSocket upgrade.

## Tests

The orchestrator runs against a fake streaming provider, so the test suite makes
no network calls and spends no tokens.

```bash
cd backend  && go test -race ./...
cd frontend && npm test
```

## Layout

```
backend/
  cmd/server/            entry point, signal handling, graceful shutdown
  internal/config/       environment loading and validation
  internal/protocol/     typed server-to-client event definitions
  internal/orchestrator/ fan-out over personas, fan-in to one channel
  internal/provider/     Provider interface and the z.ai implementation
  internal/ws/           upgrade, single writer goroutine, session lifetime
  internal/ratelimit/    per-IP token bucket
  internal/store/        SQLite daily quota
  internal/httpx/        middleware, timeouts, health
frontend/
  src/personas/          persona definitions and column state
  src/state/             debate reducer and WebSocket client
  src/components/        transcript columns, verdict panel
  src/three/             background scene
```

`PROJECT_BRIEF.md` holds the full design rationale and the phased build plan.

## License

MIT. See [LICENSE](./LICENSE).
