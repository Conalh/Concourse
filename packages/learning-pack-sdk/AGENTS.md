# Agent Instructions

## Project Direction

This package is the runtime tooling layer for the LearningPack format: read
and write pack directories/archives, compute and verify canonical hashes,
diff releases. It depends on `@learnt/learning-pack-contracts` for the
schema and validation; it does not redefine the schema itself.

## Current Goal

Stay the one place that knows how to correctly produce a pack's manifest
hashes. Anything that hand-authors or generates pack content (e.g. a course
generator script under `Courses/*`) should go through this package's
hashing/canonicalization functions rather than reimplementing them — a
second implementation is how hash mismatches happen.

## Repository Rules

- Read `README.md`, `CODING_STANDARDS.md`, and `MEMORY.md` before starting
  implementation work.
- Keep Node-specific code (`fs`, `crypto`, `child_process`) out of the
  `./browser` export surface (`src/*-browser.ts`, `src/browser.ts`). Browser
  consumers (Flashiet, the web build of Learnt/Concourse-Desktop) import
  that entry point and cannot resolve Node built-ins.
- Treat `pack.json`'s declared `sha256`/`bytes` as something this package
  computes, not something a caller hand-supplies and this package trusts.
- Do not revert unrelated dirty worktree changes.

## Verification

```bash
npm run typecheck
npm run test
npm run build
```

`npm run test` runs `build` first (per `package.json`) since the test suite
exercises the compiled CLI/archive behavior, not just source.

There is no lint script configured yet.

## Documentation

- This package currently has no `docs/` folder — the README and this file
  are the primary references. Add `docs/` if/when there's enough
  architecture history (archive format decisions, hashing-scheme changes)
  to warrant ADRs, matching the pattern in `learning-pack-contracts/docs/`.
- Keep `MEMORY.md` updated with stable decisions when the user asks for
  durable repo-local context — not a running log of every change.
