# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What Council is

Council is a user-facing web app: you ask one question and a panel of 3–5 AI
personas (skeptic, optimist, domain expert, contrarian, …) answer **and rebut
each other** across multiple rounds, streaming live into a multi-column UI; a
moderator persona then synthesizes a final verdict. The product hook is the live
parallel debate. The engineering core — and the **primary purpose of this
project — is learning idiomatic Go**: a Go backend fans out N concurrent
streaming LLM calls (z.ai / GLM) and multiplexes them over a single WebSocket.

## Status — read the brief first

**Backend Phases 0–3 are implemented** (`backend/`): foundations (ServeMux,
`log/slog`, config, graceful shutdown, `/healthz`), the typed event protocol,
the concurrent fan-out orchestrator (errgroup → fan-in channel → single
WebSocket writer), and multi-round debate with a moderator verdict. The provider
is **z.ai (GLM)**, not Anthropic (see Tech stack). Exercised by a fake streaming
provider under `-race`. **Not yet built:** the `frontend/` (Phase 4, still
greenfield) and deploy/hardening (Phase 5, incl. rate limiting/auth).

`PROJECT_BRIEF.md` is the **source of truth** for scope, the Go learning
objectives (§3), the phased build plan (§6, Phases 0–5), and the design
rationale. Read it before any non-trivial work. Each build phase is chosen to
teach a specific Go idiom — preserve that intent; don't collapse phases or
reach for shortcuts that skip the lesson.

## Planned layout

A two-part repo (per brief §6):

```
council/
  backend/    Go service
              net/http ServeMux (Go 1.22+), log/slog, config, graceful shutdown
              orchestrator (errgroup fan-out), provider interface (z.ai / GLM),
              WS handler + single writer goroutine, (deferred) SQLite persistence
  frontend/   Vite + React + TypeScript + Tailwind + shadcn/ui
```

Nothing is scaffolded yet, so the above is intent, not a literal tree. Favor
many small, cohesive files (≈200–400 lines) over few large ones.

## Architecture & the core invariant

One WebSocket per session carries **typed JSON events** server→client. The
orchestrator uses `golang.org/x/sync/errgroup` to run one goroutine per persona
per round, each streaming tokens from the LLM provider (z.ai / GLM) concurrently.

**Hard invariant (the heart of the project): WebSocket writes are NOT
concurrency-safe.** All persona goroutines push their tagged token deltas into a
single **fan-in channel**; exactly **one writer goroutine** drains that channel
and writes to the socket. Never write to the WebSocket from more than one
goroutine. This fan-out → fan-in → single-writer shape is the signature Go
lesson and is non-negotiable.

**Typed event protocol** (server → client):
- `token` `{persona, round, delta}`
- `persona_done`
- `round_complete`
- `verdict`
- `error`

**Round flow:** Round 1 = each persona answers · Round 2 = each persona rebuts
after seeing the others' transcript · Final = moderator synthesizes a verdict.
Distinct personas come from distinct **system prompts**, not distinct vendors —
one provider (z.ai / GLM) for the MVP. Pass transcripts between rounds
**immutably** (build new copies; never mutate a prior round's transcript).

**Cancellation:** root a `context` tree at the WebSocket connection so that a
client disconnect or stop cancels every persona goroutine for that session.

## Tech stack

**Backend (Go):**
- stdlib `net/http` `ServeMux` (Go 1.22+), `log/slog` for structured logging,
  graceful shutdown via `context` + `signal.NotifyContext`.
- WebSockets: `coder/websocket` (modern, context-aware) — **not** the older
  gorilla library.
- Concurrency: `golang.org/x/sync/errgroup` for bounded concurrent fan-out.
- LLM: z.ai (GLM) streaming over OpenAI-compatible SSE → token deltas (the
  brief specifies Anthropic; swapped to z.ai for this build).
- Persistence (deferred, Phase 6): SQLite via `modernc.org/sqlite` (pure Go, no
  cgo) for shareable transcript replays.

**Frontend:** Vite + React + TypeScript + Tailwind + shadcn/ui.

**Deploy:** frontend → Vercel · Go backend → Fly.io or Render.

## Build & test

> Conventional commands — nothing is scaffolded yet, so adjust once the modules
> exist.

**Backend (`backend/`):**
- Build: `go build ./...`
- Test: `go test ./...`
- Single test: `go test ./path/to/pkg -run TestName`
- Vet / format: `go vet ./...`, `gofmt -w .` (or `goimports -w .`)

**Frontend (`frontend/`, npm):**
- `npm install` · `npm run dev` · `npm run build` · `npm test`

**Docker Compose (full-stack local testing):**
- Copy `backend/.env.example` → `backend/.env` and fill in `ZAI_API_KEY`.
- `docker compose up --build` — backend on `ws://localhost:8080/ws`
  (`/healthz` at the same host:port), frontend on `http://localhost:5173`.
- The `council-data` volume is an inert placeholder reserved for Phase 6
  (SQLite persistence); nothing reads or writes it yet.

**Testing concurrent code:** test the orchestrator deterministically with a
**fake streaming provider** (an in-memory implementation of the provider
interface) plus `net/http/httptest`; prefer table-driven tests. This is an
explicit learning objective (brief §3, §5), not optional polish.

## Working rules

- **Mandatory review.** After any non-trivial change, run the
  `everything-claude-code:code-reviewer` sub agent before declaring work done.
  When the change touches the **WebSocket protocol surface**, the Anthropic
  provider or its secrets/API key, user input, or persistence, **also** run
  `everything-claude-code:security-reviewer` — in parallel (one message, multiple
  agent calls). Address every CRITICAL and HIGH finding before reporting done;
  fix or explicitly acknowledge MEDIUM. Trivial edits (typos, comments, one-line
  fixes) may skip the pass.
- **Idiomatic Go is a goal, not just a constraint.** Reach for
  channels / `errgroup` / `context` over ad-hoc mutexes where the brief's
  lesson calls for it; weigh mutex-vs-channel deliberately (brief §6, Phase 2).
- **Immutability.** Pass transcripts and shared state as new copies between
  rounds; never mutate in place.
- **Validate at boundaries.** Inbound WS messages, env/config, and provider
  responses are untrusted — validate before use; fail fast with clear errors.
- **The single-writer WebSocket invariant is non-negotiable** (see Architecture).
- **When unsure, ask the user** rather than guessing on scope or design
  trade-offs.
