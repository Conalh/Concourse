# Agent Instructions

## Project Direction

This package is the single source of truth for the LearningPack format:
schemas, structural/semantic validation, and shared helpers. It has no UI,
no app-specific logic, and no knowledge of Learnt, Concourse-Desktop, or
Flashiet specifically — those consume it (or, for Concourse-Desktop, mirror
it locally; see `MEMORY.md`).

## Current Goal

Keep the contract package the actual source of truth as the suite grows —
new pack content (e.g. `Courses/llm-from-scratch`) and new consuming
features (e.g. Concourse-Desktop's imported-route practice, Flashiet's
lock-gated topic path) should be expressible with the existing schema, not
require ad hoc extensions in a consumer.

## Repository Rules

- Read `README.md`, `CODING_STANDARDS.md`, and `MEMORY.md` before starting
  implementation work.
- A schema change here is a breaking-or-not decision for every consumer
  (`Learnt`, `Concourse-Desktop`, `Flashiet`, every pack under `Courses/`).
  Bump `SCHEMA_VERSION` (`src/constants.ts`) for breaking changes; additive,
  backward-compatible fields don't need a version bump but should still be
  optional.
- Keep this package framework-agnostic — no React, no DOM APIs, no
  filesystem access (that's `learning-pack-sdk`'s job).
- Do not revert unrelated dirty worktree changes.

## Verification

```bash
npm run typecheck
npm run test
npm run build
```

There is no lint script configured yet.

## Documentation

- `docs/contract-reference.md` and `docs/integration-guide.md` are the
  primary references for consumers. `docs/adr/` holds this package's own
  architecture decisions. Add a new ADR there for schema-shape decisions,
  not just a code comment.
- The simpler native flashcard format (not this package's concern) is
  documented separately in `Flashiet/FLASHCARD_PACKS.md`.
- Keep `MEMORY.md` updated with stable decisions when the user asks for
  durable repo-local context — not a running log of every change.
