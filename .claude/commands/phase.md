---
description: Begin a Council frontend phase (fN) from FRONTEND_ROADMAP.md
argument-hint: f0 | f1 | f2 | f3 | f4 | f5
---
Let's begin with **$ARGUMENTS** in @FRONTEND_ROADMAP.md (the Council frontend roadmap; read the relevant phase section before starting).

- Ask me questions about the backend shape if anything is unclear (the Go backend in `backend/` is the source of truth for the wire protocol).
- Ask me questions about frontend design decisions if anything is unclear.
- Use the **frontend-design** skill to unleash your creativity.

Honor the working rules in CLAUDE.md: validate inbound WebSocket frames at the boundary with zod, keep reducer updates immutable (new objects, never mutate), respect the backend's single-writer WebSocket invariant, and favor many small cohesive files. After the phase, run `everything-claude-code:code-reviewer` (and `everything-claude-code:security-reviewer` for the WS-client / inbound-validation surface) before declaring the work done.
