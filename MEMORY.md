# Project Memory

This is repo-local durable context for future contributors and agents. It is not
a changelog and should only contain stable decisions that affect future work.

## Product Language

- Concourse is the suite/app shell.
- Route is course creation and course learning.
- Loop is flashcards, retrieval practice, and review.
- Transfer is course and pack exchange.
- Modes are configurable learning and presentation settings.

Use this language in new user-facing surfaces unless a later naming decision
supersedes it.

## Content Model

- Learning packs are the portable content unit.
- The canonical pack layout is:
  - `pack.json`
  - `catalog.json`
  - `courses.json`
  - `items.json`
  - `sets.json`
  - optional `resources.json`
  - optional `theme.json`
  - optional `migrations.json`
- Imported canonical pack documents remain intact. Runtime Learnt subjects and
  activities are projections.
- Packs must validate before registration.
- The app should support downloadable/distributable packs that can move between
  people and between future app shells.

## Desktop/Catalog Direction

- First desktop direction is local-first packs only.
- Users should be able to choose or create a Courses folder.
- Users can download packs into that folder manually or through an in-app
  official catalog.
- Sync scans the Courses folder, validates packs, imports valid releases, and
  reports invalid releases without breaking installed courses.
- The official catalog is a static index plus downloadable pack archives.
- Full marketplace behavior is deferred. Do not add accounts, ratings,
  payments, creator dashboards, or moderation workflows in the local-first
  desktop MVP.

## Engineering Guardrails

- Keep browser, desktop, and future cloud capabilities behind adapters.
- Do not let the desktop shell fork learning logic.
- Do not treat a remote catalog as learner state.
- Preserve offline use after packs have been downloaded.
