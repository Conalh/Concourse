# Project Memory

This is repo-local durable context for future contributors and agents. It is
not a changelog and should only contain stable decisions that affect future
work.

## What This Package Owns

- The Learning Pack Contract (`SCHEMA_VERSION = "0.1"`): `pack.json`,
  `catalog.json`, `courses.json`, `items.json`, `sets.json`, optional
  `theme.json`/`resources.json`/`migrations.json`.
- It is the public interchange format for `Learnt`, `Concourse-Desktop`, and
  `Flashiet` — not a copy of any one app's local data model. See
  `docs/adr/001-learning-pack-contract.md`.
- The legacy Flashcard Pack Markdown format (Flashiet's native authoring
  format) is a separate, simpler import adapter, not this contract. It is
  documented in `Flashiet/FLASHCARD_PACKS.md`, owned there.

## Consumers and Their Boundaries

- `Learnt`/`Concourse-Desktop` map `catalog.json` + `items.json` into
  structured `SubjectPackage`/`ActivityDefinition` sessions.
- `Flashiet` maps `items.json` + `sets.json` into flat flashcards/quizzes,
  and separately reads `catalog.json`'s `prerequisiteConceptIds` to drive a
  lock-gated topic path (see `Flashiet/MEMORY.md`).
- **Concourse-Desktop does not currently import this package directly for
  the LearningPack document schema** — it maintains a local TypeScript
  mirror in `src/core/contracts/learning-pack.schema.ts`. If you change a
  field shape here, check that mirror too, or it will silently drift.

## Engineering Guardrails

- Imported pack documents are canonical, never mutated by a consumer.
  Runtime projections (subjects, activities, flat cards) are derived, not
  stored back into the pack.
- Concept `prerequisiteConceptIds`/`relatedConceptIds` are author-declared,
  not inferred from usage. Don't add code anywhere that tries to
  auto-generate a prerequisite graph from card/item co-occurrence — that's a
  different feature with different trust implications.
- A pack must validate before any consumer registers/installs it. Don't add
  a "trust it anyway" escape hatch for convenience.
