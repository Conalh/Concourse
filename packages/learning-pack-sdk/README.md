# @learnt/learning-pack-sdk

Archive and filesystem tooling for Learnt learning packs — the runtime
counterpart to `@learnt/learning-pack-contracts`, which owns the schema.
This package reads/writes pack directories and `.learntpack` archives,
computes canonical hashes, diffs releases, and ships a `learntpack` CLI.

## What's in this package

- `src/filesystem.ts` — `readDirectoryFiles`/`writeFilesToDirectory`, for
  authoring and loading an unpacked pack directory (what `Courses/*` packs
  use directly, without ever being zipped).
- `src/archive.ts` — `.learntpack` archive lifecycle: `packDirectory`,
  `unpackArchive`, `loadLearningPackArchive`, `loadLearningPackDirectory`,
  `installArchiveAtomically`, `inspectArchive`.
- `src/documents.ts` / `src/documents-browser.ts` — canonicalization:
  re-serializes pack JSON into stable, sorted-key form and recomputes the
  manifest's per-file `sha256`/`bytes` from that canonical form, not from
  whatever bytes happen to be on disk.
- `src/hash.ts` / `src/hash-browser.ts` — `sha256Hex`, `stableJsonBytes`,
  `contentHash`. Node and browser variants exist because the browser entry
  point (`./browser` export) can't use `node:crypto`.
- `src/zip.ts` — deterministic zip creation/reading for `.learntpack`.
- `src/diff.ts` — `diffLearningPacks`, used for update-plan/migration
  tooling between pack releases.
- `src/cli.ts` — the `learntpack` bin.

## Canonical hashing matters

A pack's `pack.json` manifest declares a `sha256`/`bytes` per file. Those
values are computed over the **canonical** (sorted-key, 2-space-indent,
trailing-newline) serialization of each document
(`stableJsonBytes` in `src/stable-json.ts`), not over whatever raw bytes a
hand-edited file happens to contain. If you hand-author or hand-edit a pack
JSON file without regenerating its manifest through this package, the
hashes will not match and structural validation will reject it. See
`Courses/llm-from-scratch/generate.mjs` for a working example of generating
a manifest correctly from scratch.

## Scripts

```bash
npm run build
npm run typecheck
npm run test
```

## License

This package is available under the [MIT License](LICENSE).

## Read next

- `AGENTS.md` — before starting implementation work.
- `CODING_STANDARDS.md` — conventions in use in this codebase.
- `MEMORY.md` — durable decisions and guardrails.
- `../learning-pack-contracts/README.md` — the schema this package operates
  on.
