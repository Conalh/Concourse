# Contributing To Concourse

Concourse is being prepared as an open-source local-first learning suite. The
near-term product is a desktop/catalog track for local Courses folders,
validated learning packs, a static official catalog, and local learner progress.

## Good First Contributions

- Improve docs under `docs/`, especially learning-pack authoring guidance.
- Add tests around pack validation, import diagnostics, sync reporting, and
  static catalog parsing.
- Improve accessibility, responsive behavior, and copy in the React app.
- Build small example learning packs using public-domain, open-license, or
  user-supplied source material.
- Report reproducible bugs with exact steps, browser or OS details, and console
  output when available.

## Current Product Boundaries

Do not add these without an accepted spec:

- user accounts
- hosted learner state
- paid packs or marketplace behavior
- ratings, reviews, comments, or creator dashboards
- community submission workflows
- cloud sync

Downloaded packs and learner state are local-first. The official catalog may be
hosted, but it is not learner state and must not be required to use already
downloaded courses.

## Local Setup

Requirements: Node.js 22.12 or newer and npm 11. Desktop work also requires the
[Tauri system prerequisites](https://v2.tauri.app/start/prerequisites/).

```bash
npm ci
npm run dev
```

Useful verification commands:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
npm run verify
cargo test --locked --manifest-path src-tauri/Cargo.toml
```

## Architecture Rules

Concourse is a modular monolith. Preserve the dependency boundaries in
`docs/architecture.md`.

- Core contracts and engine stay independent from UI, infrastructure, React,
  browser APIs, and platform shells.
- UI reads through the application facade and read models.
- Browser, desktop, and future cloud behavior belongs behind adapters at
  application or infrastructure boundaries.
- Imported learning-pack documents remain canonical. Runtime subjects, modules,
  activities, and UI views are projections.
- External, persisted, downloaded, or imported data must be validated before it
  is adapted.

## Learning Pack Contributions

For course or pack work, read:

- `docs/learning-packs/agent-course-authoring-guide.md`
- `docs/learning-packs/learnt-importer-handoff.md`
- `docs/learning-packs/learnt-exporter-handoff.md`

Use open-license, public-domain, or user-supplied sources. Track source titles,
URLs, licenses, chapters, and page ranges where available. Do not copy long
source passages into pack content.

## Pull Request Expectations

- Keep each PR scoped to one logical change.
- Include focused tests for changed behavior and error paths.
- Run the strongest practical verification before opening the PR.
- Note any verification you did not run.
- Do not include generated design documents unless the PR is explicitly about
  design-doc ingestion or export.
- Do not mix unrelated formatting or cleanup with feature work.

## Licensing

Code contributions are accepted under the project's [MIT License](LICENSE).
Learning-pack content must use public-domain, open-license, or contributor-owned
material and preserve its source, attribution, and license metadata.
