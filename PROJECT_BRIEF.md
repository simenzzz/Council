# Council — Project Brief

> Working name: **Council** · alternates: *Quorum*, *Symposium*, *Forum*
> Status: concept locked, not yet started · Authored: 2026-06-25

---

## 1. Overview

**Council** is a user-facing web app where you ask a question and a panel of
3–5 AI personas (e.g. skeptic, optimist, domain expert, contrarian) answer
**and rebut each other** across multiple rounds, streaming live into a
multi-column UI. A moderator persona then synthesizes a final verdict.

The product hook is the live, parallel debate: you type one question and watch
several agents argue in real time. The engineering hook is underneath — the
backend fans out N concurrent streaming LLM calls and multiplexes them over a
single WebSocket, which is exactly what Go is good at.

---

## 2. Why this project (rationale)

This project was chosen through a structured interview that first investigated
the existing workspace, then resolved a series of explicit trade-offs.

### Verified existing stack
- **Python (deep)** — FastAPI, applied ML (char-LSTM, conformal prediction in
  `secProj`), anomaly detection, ns-3 simulations (`CAPSTONE`).
- **TypeScript / Node (deep)** — Express, React 19, SvelteKit, Vite, pnpm/turbo
  monorepos (`TPToolProj`, `learningproj`, `Website`).
- **Rust (solid)** — Axum + SurrealDB (`discordClone`/Cove), edge / delay-tolerant
  distributed systems (`tideway`).
- **Java (moderate)** — Spring Boot 3 / JPA / Flyway (`ishtirak` system of record).
- **Signature theme** — LLM/agent engineering with "LLMs behind strict
  validation boundaries," polyglot microservices, real-time WebSocket protocols,
  research-grade rigor (ADRs, reference corpora).

### Verified gaps
- **Go** — nearly absent (one tiny dashboard across the whole workspace).
- **Mobile** — zero (no React Native / Flutter / Swift / Kotlin).
- **Real infra/DevOps at scale** — stops at Docker Compose + `render.yaml`/Vercel.
- **Data engineering at scale** — RabbitMQ + Redis only; no Kafka/Flink/ClickHouse.

### The decisions (all confirmed in the interview)
1. **Goal → fill a deliberate skill gap.** Chosen gap: **Go** — the biggest
   verified hole, and its sweet spot (concurrent network services) is
   underrepresented in the AI-infra world, so a serious Go entry stands out.
2. **Scope → a few weeks** (one focused, deployable project).
3. **Domain → AI / agents & applied ML** (the user's strongest, most
   differentiated theme).
4. **Pivot → user-facing.** The user already has enough infra/platform work
   (`tideway`, `secProj`, `ishtirak`, `anomaly-detection` — and even where those
   have a UI it's a Streamlit dashboard or operator console, not a consumer
   product). User-facing products are a **stronger recruiter signal**, so that
   became the priority.
5. **Resolution → web product + Go backend.** "User-facing" and "learn Go"
   pull in opposite directions (Go is not itself a UI language). The resolution:
   a **polished React/TS frontend is the recruiter-facing star**, and the **Go
   backend earns its place** because the core is concurrent fan-out streaming.
   Go is therefore *the architecture*, not a gratuitous choice — if the backend
   were simple CRUD, Go would teach nothing and the story would be incoherent.

**Net:** Council fills the Go gap *through* a user-facing product in the
AI/agents domain — satisfying every constraint at once.

---

## 3. Learning objectives (the deliberate-gap goal)

Primary purpose is **learning idiomatic Go**, so each build phase is chosen to
teach a specific idiom. Target competencies:

- `net/http` (stdlib `ServeMux`, Go 1.22+), structured logging with `log/slog`,
  config, graceful shutdown via `context` + `signal.NotifyContext`.
- Streaming HTTP **client** consumption (provider SSE → token deltas).
- Goroutines and channels; `select`; context trees and cancellation.
- `golang.org/x/sync/errgroup` for bounded concurrent fan-out.
- **Fan-out → fan-in → single-writer WebSocket pattern** — the signature lesson
  (see §4).
- Table-driven tests; deterministic testing of concurrent code via a **fake
  streaming provider**; `httptest`.
- Packaging/deploying a Go service; optional `pprof` profiling.

---

## 4. Architecture

```
  React + TS + Tailwind (the recruiter-facing star)
        │  one WebSocket, typed JSON events
        ▼
  Go backend
   ├─ WS handler   ──  single writer goroutine (serializes ALL ws writes)
   ├─ Orchestrator ──  errgroup: one goroutine per persona, per round
   │      │               each streams from the LLM concurrently
   │      └─ fan-in channel ── token deltas tagged {persona, round}
   ├─ Provider interface ── Anthropic (streaming); personas = system prompts
   └─ (Phase 4) SQLite ── persist transcripts for shareable replays
```

**The core design constraint = the central Go lesson.** WebSocket writes are
**not** concurrency-safe. So N persona goroutines stream in parallel, push their
tagged token deltas into a single **fan-in channel**, and exactly one
**writer goroutine** drains that channel to the socket. This fan-out → fan-in →
single-writer shape is the heart of the project.

**Typed event protocol** (server → client over WS):
`token` `{persona, round, delta}` · `persona_done` · `round_complete` ·
`verdict` · `error`.

**Round flow:** Round 1 = each persona answers · Round 2 = each persona rebuts
after seeing the others' transcript · Final = moderator synthesizes a verdict.

---

## 5. Tech stack

**Backend (Go):**
- WebSockets: `coder/websocket` (modern, context-aware, idiomatic — not the
  older gorilla library).
- Concurrency: `golang.org/x/sync/errgroup`.
- LLM: Anthropic streaming. One provider for MVP — distinct personas come from
  distinct **system prompts**, not distinct vendors.
- Persistence (Phase 4): SQLite via `modernc.org/sqlite` (pure Go, no cgo).

**Frontend:**
- Vite + React + TypeScript + Tailwind + shadcn/ui (fast path to a polished UI).

**Deploy:**
- Frontend → Vercel · Go backend → Fly.io or Render.

---

## 6. Phased build plan

Day estimates are rough; the Go-idiom callout is the point of each phase.

**Phase 0 — Foundations & skeleton** *(~2 days)*
Repo layout (`backend/` Go + `frontend/` Vite), `go.mod`, `log/slog`, config,
graceful shutdown, `/healthz`, a WS echo endpoint; frontend connects and renders
the echo.
→ *Go:* project layout, `net/http`, WebSocket basics, `context`.

**Phase 1 — One persona, end-to-end streaming** *(~3 days)*
Question → Go calls Anthropic streaming → forwards token deltas over WS →
frontend renders live text in one column. Define the typed event protocol.
→ *Go:* streaming HTTP client, `io`, goroutine forwarding, JSON event encoding.

**Phase 2 — Concurrent fan-out (the core)** *(~4 days)* ← the heart
N personas in parallel via `errgroup`; tagged tokens multiplexed onto one WS
through the fan-in channel + single-writer goroutine; bounded concurrency;
cancel everything on disconnect/stop.
→ *Go:* `errgroup`, fan-out/fan-in, single-writer pattern, `select`, context
trees, mutex-vs-channel judgment. **This phase is why the project exists.**

**Phase 3 — Rounds, rebuttal & moderator** *(~3 days)*
Multi-round orchestration + moderator verdict; a small turn state machine.
→ *Go:* multi-stage orchestration, immutable transcript passing between rounds,
`WaitGroup`/channel coordination.

**Phase 4 — Product polish (the recruiter surface)** *(~4 days)*
Persona avatars/colors, typing indicators, round progress, smooth token
animation, verdict panel, topic presets, and **shareable replay** (persist
transcript in SQLite, replay via a link). Responsive. Invest here — it's what
recruiters see first.
→ *Frontend (existing strength)* + a little Go persistence.

**Phase 5 — Ship & harden** *(~2 days)*
Per-session rate limiting, reconnect handling, Dockerfile, deploy, README +
short architecture note + demo GIF.
→ *Go:* deploying Go; **testing concurrent code deterministically with a fake
streaming provider.**

**"Done & demoable" line:** Phases 0–2 already produce the wow (several agents
streaming live in parallel). Phase 3 makes it a *debate* rather than parallel
monologues. Phase 4 makes it recruiter-worthy. Phase 5 ships it.
**Safe cuts if time runs short:** shareable replay (Phase 4) and a second
persona-tuning pass.

---

## 7. Stretch ideas

- Voting on the best argument.
- "Invite a custom persona" (user-defined system prompt).
- Voice output per persona.
- Spectator mode — others watch a live debate (reuses the WS hub).

---

## 8. Decision log — alternatives considered (and why Council won)

- **"Sluice" — a Go LLM gateway / control plane (DROPPED).** An earlier
  front-runner: a reverse proxy in front of LLM providers with routing, caching,
  rate limiting, validation, observability, plus a concurrent agent runtime.
  Excellent Go fit and on-theme — but it's **infra/platform**, and the user
  already has enough infra. It failed the user-facing pivot, so it was dropped.
- **Mobile (CONSIDERED, not chosen).** Mobile is also a verified gap *and*
  inherently user-facing (Expo/React Native would reuse the user's TS), and was
  arguably the single strongest recruiter surface. The user chose **web +
  Go backend** instead, keeping the Go gap as the learning target.
- **Frontend-only web product (NOT chosen).** Pure React/TS would fill no new
  gap — the user has already shipped a lot of React. Adding the Go backend is
  what makes this a *growth* project.
- **Other product ideas from the brainstorm (NOT chosen):**
  - *AI party game with a live game master* — most fun/memorable demo, but
    real-time multiplayer made it the tightest fit for a few weeks.
  - *Lecture-to-mastery companion* — strong consumer cut of the user's learning
    theme, but added a speech-to-text dependency.
  - *Multi-model "arena"* — leaned developer-tool, undercutting the
    user-facing goal.
  - **Council** won on balance: Go's concurrent fan-out streaming is the literal
    core (gap genuinely filled), the frontend is an instantly-graspable consumer
    surface (recruiter signal), it stays in the AI/agents domain, the demo lands
    in ~10 seconds, and the scope is realistic for a few weeks.
