# Coding Standards

## Architecture

- This package defines the contract. It does not implement filesystem
  access, archive packing/unpacking, or any app-specific projection — those
  belong in `learning-pack-sdk` or in the consuming app.
- No React, no DOM APIs, no Node-only APIs (filesystem, child_process) in
  `src/`. Anything that needs those belongs in `learning-pack-sdk`.
- Validation is layered: `structural-validation.ts` checks shape and ID
  syntax per document; `semantic-validation.ts` checks whole-pack
  referential integrity (missing references, capability compatibility).
  Don't merge these — a structural failure should be reportable even if
  semantic validation can't run yet.
- `validateLearningPackDocuments(...)` is the one function consumers should
  call. Don't expose a second, looser validation path for convenience.

## TypeScript

- Schema-first: define the Zod schema, derive the TypeScript type from it
  (`z.infer<typeof Schema>`), not the other way around.
- Keep schemas strict where the format requires it, but don't over-constrain
  fields that are genuinely open-ended (tags, keywords) — that's a tax on
  every pack author for no integrity benefit.
- Diagnostics (`LearningPackDiagnostic`) carry a `code`, `severity`, `path`,
  and `message`. Keep new diagnostics consistent with that shape rather than
  inventing a parallel error type.

## Versioning

- `SCHEMA_VERSION` in `src/constants.ts` is the single version string
  stamped on every persisted/distributed document. Bump it for breaking
  changes. Additive optional fields don't require a bump.
- Capability IDs (`SUPPORTED_CAPABILITIES`) gate optional features
  (`learnt.evaluation.self-grade`, resource/curriculum capabilities, etc.).
  Add a new capability rather than silently changing existing behavior when
  introducing an optional feature a consumer might not support yet.

## Tests

- `npm run test` runs Vitest. Cover both valid-pack and invalid-pack cases
  for any new validation rule — a validator that only has happy-path tests
  hasn't proven it actually rejects bad data.
- `src/fixtures.ts` / `src/logic-foundations-golden.ts` are the canonical
  test fixtures. Prefer extending these over hand-rolling a one-off fixture
  inline, so consumer repos' tests can reuse the same golden data.

## Git

- Keep commits scoped to one logical change.
- Do not stage unrelated dirty files.
- Do not rewrite or discard user changes without explicit permission.
