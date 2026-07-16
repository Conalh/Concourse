# Project Memory

This is repo-local durable context for future contributors and agents. It is
not a changelog and should only contain stable decisions that affect future
work.

## What This Package Owns

- Reading/writing pack directories and `.learntpack` archives.
- Canonical hashing: a pack's manifest hashes are computed over
  `stableJsonBytes` (sorted-key, 2-space, trailing-newline JSON), not over
  arbitrary on-disk formatting. This is the single most common source of
  confusion when hand-authoring a pack — see
  `Courses/llm-from-scratch/generate.mjs` for a script that gets it right
  by computing hashes from the same in-memory objects it writes to disk.
- The `learntpack` CLI.

## Consumers

- `Flashiet`'s `readLearningPackDirectoryFiles` does **not** go through this
  package's strict `loadLearningPackDirectory` — it reads the five named
  JSON files directly and hands them to
  `@learnt/learning-pack-contracts`' `validateLearningPackDocuments`,
  ignoring any other files in the directory (README, generator scripts,
  etc.). This package's own `loadLearningPackDirectory` is stricter — it
  flags any undeclared file in the directory as an error. Don't assume
  every consumer uses the strict path; check which validation function a
  given app actually calls before asserting what "should" fail.
- `Concourse-Desktop` uses `TauriCourseFolderScanner` for its real
  filesystem access (Tauri IPC, not this package's Node `fs` calls) when
  running as the desktop shell, but composes with this package's
  document/hash logic for the parts that aren't platform-specific.

## Engineering Guardrails

- Don't trust a caller-supplied `sha256`/`bytes` on a manifest without
  recomputing and comparing it — `verifyManifestFileHashes` exists for
  exactly this.
- Keep the `./browser` export genuinely free of Node-only APIs. A passing
  Node build does not prove the browser entry point is clean.
