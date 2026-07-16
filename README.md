# Concourse

[![CI](https://github.com/Conalh/Concourse/actions/workflows/ci.yml/badge.svg)](https://github.com/Conalh/Concourse/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Local-first](https://img.shields.io/badge/data-local--first-39a8ff)](#privacy-and-network-boundary)

Concourse is a local-first learning suite for building routes, practicing
retrieval, and exchanging portable course packs. The same application facade
runs in the browser and in a Tauri desktop shell.

- Project site: <https://concourse.conalhickey.com>
- Contributing: [CONTRIBUTING.md](CONTRIBUTING.md)
- Roadmap: [ROADMAP.md](ROADMAP.md)
- Security: [SECURITY.md](SECURITY.md)

## What Works Today

- A polished learning workspace for Today, Routes, Loop retrieval practice,
  Transfer pack management, Progress, profiles, and settings.
- Deterministic learning sessions with evidence, feedback, recaps, concept side
  paths, and local persistence.
- Portable learning-pack contracts and an SDK for validation, canonical hashes,
  deterministic archives, release diffs, and atomic installation.
- Browser directory imports and a Tauri desktop adapter for a user-selected
  Courses folder and durable installed-pack records.
- Defensive handling for untrusted packs: bounded archive reads, path checks,
  capability validation, canonical-byte verification, and known-good release
  preservation.
- Three built-in subjects plus a distributable Logic Foundations course pack
  adapted from CC BY 4.0 source material.
- 406 TypeScript tests and 12 Rust tests across contracts, pack tooling,
  application flows, browser persistence, React UI, and native storage.

## Product Language

- **Concourse**: the suite and app shell
- **Route**: course creation and course learning
- **Loop**: flashcards, retrieval practice, and review
- **Transfer**: course and pack exchange
- **Modes**: configurable learning and presentation settings

## Quick Start

Requirements: Node.js 22.12 or newer and npm 11.

```bash
npm ci
npm run dev
```

The browser app opens at <http://127.0.0.1:5173>.

For the desktop shell, install the
[Tauri system prerequisites](https://v2.tauri.app/start/prerequisites/), then
run:

```bash
npm run desktop:dev
```

## Verification

```bash
npm run verify
npm audit --omit=dev
cargo test --locked --manifest-path src-tauri/Cargo.toml
```

`npm run verify` checks formatting, lint, workspace packages, all TypeScript
tests, type safety, and the production browser build.

## Workspace Map

```text
src/                              learning core, application, adapters, and UI
src-tauri/                        native desktop shell and filesystem commands
packages/learning-pack-contracts portable pack schema and validators
packages/learning-pack-sdk       archive, hashing, diff, and CLI tooling
content/logic-foundations        authored Logic Foundations course source
courses/logic-foundations        generated canonical pack documents
```

The learning core remains framework-agnostic. Browser and desktop behavior
enters through adapters, while imported pack documents remain canonical and
runtime views are derived projections. See [docs/architecture.md](docs/architecture.md)
and [docs/decisions/](docs/decisions/) for the boundaries and decision history.

## Privacy And Network Boundary

Concourse has no accounts, hosted learner state, analytics, or application
backend. Browser progress stays in browser-local storage; desktop pack state and
the selected Courses folder stay on the local machine. Imported packs may
contain external resource links such as YouTube or Vimeo, but opening those
links is an explicit learner action.

The bundled learner profile is fictional demo data and does not represent a
real person.

## Learning Packs

Pack authoring and integration guidance lives under
[docs/learning-packs/](docs/learning-packs/). The example Logic Foundations
pack can be rebuilt with:

```bash
npm run build:logic-foundations
```

## License

Concourse software and the two workspace packages are available under the
[MIT License](LICENSE). Learning-pack content carries its own license in pack
metadata; the bundled Logic Foundations course is CC BY 4.0 with attribution in
[courses/logic-foundations/README.md](courses/logic-foundations/README.md).
