# Coding Standards

## Architecture

- Keep the learning core deterministic and framework-agnostic.
- Keep contracts schema-first and explicit.
- Use application ports for storage, clocks, IDs, file access, catalog fetching,
  and platform-specific behavior.
- Treat imported learning-pack documents as canonical. Runtime subjects,
  modules, activities, and UI views are projections.
- Desktop, browser, and future cloud runtimes must compose the same application
  facade rather than forking product logic.

## TypeScript

- Use strict TypeScript.
- Prefer precise readonly types at boundaries.
- Validate external, persisted, downloaded, or imported data before adapting it.
- Do not use `any` to bypass contract gaps. Add or refine types instead.
- Keep functions small enough that their dependencies and side effects are
  obvious.

## React UI

- UI reads through the product facade and application read models.
- UI must not import infrastructure implementations, concrete subjects,
  profile wiring, repositories, browser storage, or desktop shell APIs directly.
- Route state is not domain state unless a contract explicitly says so.
- Preserve accessibility basics: semantic controls, labels, focus states,
  reduced-motion handling, and no text overflow on mobile.

## Local-First Desktop Work

- Put filesystem operations behind a desktop/course-library adapter.
- Store app-managed downloads in a configurable Courses folder.
- Sync should be idempotent: repeated syncs should not duplicate courses or
  corrupt installed releases.
- Failed pack validation must not replace a known-good installed release.
- Downloads must verify hashes before installation.
- No remote dependency should be required to open already-downloaded courses.

## Tests

- Add focused unit tests for contract, adapter, and error-path behavior.
- Add product-flow tests when a user-visible workflow changes.
- Add integration-style tests for pack sync, catalog parsing, and update plans.
- Run the strongest practical verification before claiming completion.

## Git

- Work on short-lived `codey/` branches.
- Keep commits scoped to one logical change.
- Do not stage unrelated dirty files.
- Do not rewrite or discard user changes without explicit permission.
