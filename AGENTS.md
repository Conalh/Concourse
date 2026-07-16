# Agent Instructions

## Project Direction

Concourse is the Learnt suite shell for building, practicing, importing, and
sharing learning routes. Current suite language:

- Concourse: umbrella suite and app shell
- Route: course creation and course learning
- Loop: flashcards, retrieval practice, and review
- Transfer: course and pack exchange
- Modes: configurable learning chips and session presentation settings

The desktop/catalog track is local-first. Do not introduce accounts, hosted
state, payments, ratings, or marketplace behavior unless a later spec explicitly
approves it.

## Current Goal

Build toward a cross-platform desktop executable that can:

1. Use a configured local Courses folder.
2. Sync validated learning packs from that folder into the app.
3. Browse an official static pack catalog.
4. Download selected packs into the Courses folder.
5. Keep learning sessions and progress local.

The catalog may live on the internet, but downloaded packs and learner state are
local-first.

## Repository Rules

- Read `README.md`, `CODING_STANDARDS.md`, `MEMORY.md`, and the active spec
  before starting implementation work.
- Preserve the modular-monolith dependency boundaries in `docs/architecture.md`.
- Keep core contracts, engine, and subject SDK independent from UI,
  infrastructure, React, browser APIs, and concrete platform shells.
- Put browser, desktop, and future cloud behavior behind adapters at existing
  application/infrastructure boundaries.
- Do not modify generated design documents unless the task is explicitly about
  design-doc ingestion or export.
- Do not revert unrelated dirty worktree changes.

## Verification

Prefer the repo scripts:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

For UI or runtime-shell work, also run browser or desktop smoke checks that touch
the changed surfaces.

## Documentation

- Significant architecture choices go in `docs/decisions/`.
- Feature designs go in `docs/superpowers/specs/`.
- Pack-format and authoring details belong under `docs/learning-packs/`.
- Keep `MEMORY.md` updated with stable project decisions when the user asks for
  durable repo-local context.
