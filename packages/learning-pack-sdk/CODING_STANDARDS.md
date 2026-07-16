# Coding Standards

## Architecture

- This package implements I/O and hashing. It does not define schema shape
  or validation rules — those live in `@learnt/learning-pack-contracts` and
  should be imported, not duplicated.
- Keep the Node entry point (`src/index.ts` → `./` export) and the browser
  entry point (`src/browser.ts` → `./browser` export) genuinely separable.
  A function that needs `node:fs` or `node:crypto` belongs behind the Node
  entry point only; give it a browser-safe counterpart
  (`*-browser.ts`) if browser consumers need the equivalent capability.
- Archive operations (`archive.ts`) should be atomic where the function name
  says so (`installArchiveAtomically`) — partial writes on failure are a
  real risk for a tool that manages a learner's local pack installation.

## TypeScript

- Use strict TypeScript.
- Prefer precise readonly types at I/O boundaries (`PackFileRecord`,
  `LoadedLearningPack`, etc.) — callers should not be able to mutate what
  this package hands back and expect it to be reflected anywhere.
- Don't use `any` to bypass a contract-package type gap; if the contract
  package's types don't cover something this package needs, that's a
  signal to fix the contract package, not to cast around it here.

## Hashing and Canonicalization

- Any function that produces a `pack.json` manifest must derive each file's
  `sha256`/`bytes` from `stableJsonBytes(value)` of the actual document
  object, not from independently-formatted JSON text. Pretty-printing for
  human readability on disk is fine; the hash must still be computed over
  the canonical form, not the pretty-printed bytes, unless they happen to
  be byte-identical (they are, if you write the canonical bytes directly —
  see `Courses/llm-from-scratch/generate.mjs` for the working pattern).
- `verifyManifestFileHashes` exists to catch drift between a manifest and
  its files. Don't add a path that skips this check for "trusted" input —
  trusted-but-wrong is exactly the failure mode it exists to catch.

## Tests

- `npm run test` builds first, then runs Vitest against the compiled
  output — keep that ordering; tests that only exercise `src/` TypeScript
  directly would miss build-time issues (e.g. a missing export).
- Cover both the directory-based and archive-based load paths for any new
  feature that touches install/load — they're meant to behave identically
  from a consumer's perspective and have drifted before.

## Git

- Keep commits scoped to one logical change.
- Do not stage unrelated dirty files.
- Do not rewrite or discard user changes without explicit permission.
