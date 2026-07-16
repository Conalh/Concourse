# @learnt/learning-pack-contracts

Framework-independent TypeScript contracts, JSON Schemas, validators, and
helpers for Learnt learning packs — the portable course-content format
shared by `Learnt`, `Concourse-Desktop`, and `Flashiet`.

This package owns the format. The three apps each project it differently
(structured `ActivityDefinition` sessions in Learnt/Concourse-Desktop, flat
flashcards/quizzes in Flashiet), but none of them define their own copy of
the schema for the canonical pack files — they validate against this
package, or in Concourse-Desktop's case, against a local TypeScript mirror
of it (see that repo's `MEMORY.md` for why, and keep the two in sync if you
change one).

## Pack format

A learning pack is a directory or `.learntpack` archive containing:

- `pack.json` — manifest: identity, version, capabilities, file integrity
  (sha256 + byte length per file)
- `catalog.json` — subjects, concepts (with `prerequisiteConceptIds` /
  `relatedConceptIds`), objectives
- `courses.json` — curriculum as `CurriculumNode` trees (modules → lessons)
- `items.json` — `LearningItem`s: `promptBlocks`, `response`, `evaluation`,
  `reviewedSolutionBlocks`
- `sets.json` — reusable decks/quizzes
- optional `theme.json`, `resources.json`, `migrations.json`

`SCHEMA_VERSION` is `"0.1"` (`src/constants.ts`).

## What's in this package

- `src/schemas.ts` — the Zod/JSON-Schema definitions.
- `src/structural-validation.ts` / `src/semantic-validation.ts` —
  `validateLearningPackDocuments(...)`, the function every consumer should
  call rather than hand-rolling shape checks.
- `src/helpers.ts` — ID/key helpers (`makeGlobalEntityKey`, etc.).
- `src/fixtures.ts` / `src/logic-foundations-golden.ts` — generated golden
  fixtures used by this package's own tests and by consumers' integration
  tests.

## Scripts

```bash
npm run build
npm run typecheck
npm run test
npm run generate:logic-foundations
```

## License

This package is available under the [MIT License](LICENSE).

## Read next

- `AGENTS.md` — before starting implementation work.
- `CODING_STANDARDS.md` — conventions in use in this codebase.
- `MEMORY.md` — durable decisions and guardrails.
