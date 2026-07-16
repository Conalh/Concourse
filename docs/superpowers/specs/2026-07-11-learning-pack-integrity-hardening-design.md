# Learning Pack Integrity Hardening Design

## Status

Approved for specification on 2026-07-11. Implementation planning requires
review of this committed document.

## Goal

Harden Concourse's local-first learning-pack lifecycle so every browser,
desktop, directory, archive, persistence, and restoration path uses one
validated release authority; retains the last known-good state across write
failure; re-establishes integrity from canonical bytes during restoration; and
rejects resource-exhaustion inputs before they can consume unbounded memory.

This design resolves the whole-branch findings identified as `R1` through
`R5`:

- `R1`: duplicate archive installation authority;
- `R2`: non-durable native JSON replacement;
- `R3`: non-atomic installed-record and issue reads;
- `R4`: restoration without canonical-byte integrity verification;
- `R5`: limits enforced only after decompression or full directory reads.

## Non-Goals

- `R6` CI platform-matrix and Tauri bundle-target work is not part of this
  design.
- The shared manifest SemVer contract, CSP cleanup, signing, remote catalogs,
  accounts, hosted learner state, and marketplace behavior are not added here.
- Logic Foundations content, learner evidence semantics, and practice behavior
  do not change.
- This design does not create rollback UI or automatic rollback activation.
- This design does not preserve restoration of legacy document-only installed
  records. Those records fail closed and require one re-sync.

## Trust Boundaries and Assets

### Trust Boundaries

1. Learning-pack archives and selected directory contents are untrusted input.
2. IndexedDB and native JSON installed-pack records may be stale, corrupted, or
   tampered with.
3. Native filesystem writes may fail, be interrupted, or overlap.
4. Browser, Node, and native directory metadata may describe inputs too large
   to read safely.

### Protected Assets

- the last known-good installed release record;
- the active and rollback release relationship;
- canonical pack identity, version, files, and content hash;
- learner sessions, evidence, and progress stored outside pack records;
- renderer and native-process memory availability;
- actionable diagnostics for invalid installed state.

### Abuse and Failure Cases

- bypassing downgrade or same-version-content-conflict protections through the
  legacy archive installer;
- changing stored documents while retaining a trusted `releaseId` or
  `contentHash`;
- crashing or losing a rename after deleting the destination JSON file;
- hiding native read or parse errors because issues are read before records;
- expanding a ZIP bomb before inspecting declared or actual output sizes;
- reading too many or oversized directory files into memory before SDK limits
  run.

## Selected Approach

Use one validated-candidate pipeline while preserving the existing application
facade and runtime-specific adapters:

```text
untrusted archive or directory
  -> bounded read
  -> SDK validation
  -> canonical file records plus content hash
  -> ValidatedLearningPackCandidate
  -> LearntApplication.installValidatedLearningPack
  -> shared release lifecycle planner
  -> runtime-specific atomic store write
  -> byte-backed installed release
  -> full SDK reconstruction during restore
  -> runtime registration only after integrity checks
```

The rejected alternatives are:

- local patches at each seam, which leave duplicate lifecycle and persistence
  models active;
- replacing the whole installed-pack system with an archive-only repository,
  which is broader than the five findings require.

## Core Runtime Contracts

### Validated Candidate

`ValidatedLearningPackCandidate` becomes the single handoff from an untrusted
source into the application lifecycle. It contains:

```ts
type ValidatedLearningPackCandidate = Readonly<{
  contentHash: string
  documents: LearningPackDocuments
  files: readonly PackFileRecord[]
}>
```

`files` contains the canonical public pack files used by the SDK to produce
`documents` and `contentHash`. The candidate is created only after SDK
validation succeeds. Browser and Tauri directory adapters must return the same
candidate shape.

### Installed Release

Each runtime `InstalledLearningPackRelease` contains:

```ts
type InstalledLearningPackRelease = Readonly<{
  releaseId: string
  packVersion: string
  contentHash: string
  documents: LearningPackDocuments
  files: readonly PackFileRecord[]
}>
```

`releaseId` remains equal to `contentHash`. `documents` is a runtime projection
reconstructed from `files` during store reads; persisted records do not gain
authority merely by carrying document-shaped JSON.

### Store Snapshot

The store interface replaces separate `list()` and `listIssues()` calls with
one operation:

```ts
type InstalledLearningPackStoreSnapshot = Readonly<{
  records: readonly InstalledLearningPackRecord[]
  issues: readonly PersistedLearningPackRecordIssue[]
}>

interface InstalledLearningPackStore {
  readSnapshot(): Promise<InstalledLearningPackStoreSnapshot>
  write(record: InstalledLearningPackRecord): Promise<void>
}
```

Both application restoration and installation planning read one snapshot.
Records and issues therefore describe the same underlying store read.

## R1: Single Release Authority

`src/learning-packs/learnt-archive-installer.ts` no longer writes `current` or
`rollback` pointers, compares versions independently, or creates an installed
release outside the application lifecycle.

The archive surface becomes a validation/loading operation that returns a
`ValidatedLearningPackCandidate` plus archive inspection diagnostics. The only
state-changing entry point is
`LearntApplication.installValidatedLearningPack(candidate)`.

The existing legacy installer has no runtime callers; its pointer helpers,
legacy release metadata, independent version comparison, and downgrade action
are removed. Tests and importer handoff documentation move to the candidate
loader plus application lifecycle path.

Required behavior remains centralized in `planInstalledPackChange`:

- first valid candidate installs;
- identical version and content hash is idempotent reinstall;
- identical version with different content is rejected;
- lower or equal semantic version with different content is rejected;
- higher semantic version activates and retains the previous active release as
  rollback;
- rejected candidates never write the store or replace runtime state.

## R2: Durable Native JSON Replacement

The native JSON writer uses a platform adapter with these invariants:

1. serialize same-path writes inside the Tauri process;
2. create a uniquely named temporary sibling using create-new semantics;
3. write all bytes and call `sync_all()` on the temporary file;
4. atomically replace the destination without deleting it first;
5. sync the parent directory where the platform supports it;
6. remove leftover temporary files after a failed replacement;
7. return a structured `storage-write-failed` diagnostic while leaving the old
   destination readable.

On Unix, replacement uses the platform's atomic same-filesystem rename after
the temporary file is flushed. On Windows, replacement uses target-specific
Windows file-replacement semantics through a direct, narrowly scoped system
API dependency. First creation uses an atomic move; replacement failure leaves
the old record intact.

The fixed `.tmp` path and delete-then-rename sequence are removed.

## R3: Atomic Records and Issues

Every store implementation produces records and issues together:

- Browser IndexedDB performs one readonly transaction and classifies every
  value before returning the snapshot.
- Tauri invokes the native bridge once, decodes the returned collection once,
  validates all records, and returns the corresponding issues in the same
  snapshot.
- In-memory test stores implement the same contract.

Native bridge read or parse failure returns an empty `records` collection plus
one issue with `packId: null`; it is not converted into a silently empty
library. The application adds every issue to the invalid installed-pack state
before registering valid records from that same snapshot.

## R4: Byte-Backed Persistence and Restore Verification

### Persisted Format

New installed records use `recordVersion: 2`. Each release persists canonical
file records rather than trusting serialized documents.

Browser IndexedDB stores `Uint8Array` file bytes through structured clone.
The Tauri TypeScript adapter maps file bytes to base64 only at the JSON bridge
boundary and decodes them before shared validation. Rust treats the record as
opaque JSON and does not become a pack validator.

### Restore Validation

For each persisted release, the store-side shared decoder:

1. validates the record and file-record structure;
2. reconstructs the pack through the shared SDK loader under default limits;
3. requires the reconstructed `contentHash` to equal stored `contentHash`;
4. requires `releaseId` to equal the reconstructed content hash;
5. requires the reconstructed manifest pack ID to equal the record pack ID;
6. requires the reconstructed manifest version to equal stored `packVersion`;
7. rebuilds runtime `documents` from the validated files;
8. excludes any failing record or release from runtime restoration and emits a
   specific persisted-record issue.

An invalid active release prevents that pack record from registering. A valid
record never borrows documents, hashes, or identity from an invalid sibling.

### Legacy Records

Records without `recordVersion: 2` and canonical files are reported as:

```text
Installed pack data uses a legacy format and must be re-synced. Learner progress was retained.
```

The legacy record is not deleted automatically. A subsequent validated sync
for the same pack ID overwrites it with the version-2 record. Learner sessions,
evidence, resource engagement, and progress live in separate repositories and
are neither deleted nor rewritten by this migration.

## R5: Limits Before Allocation

The existing default limits remain authoritative:

- maximum uncompressed total: 50 MiB;
- maximum file count: 512;
- maximum individual file: 10 MiB.

### Archives

Before decompression, the SDK parses the ZIP central directory into bounded
entry metadata and rejects:

- entry count over the limit;
- any declared uncompressed file over the per-file limit;
- declared total uncompressed size over the total limit;
- malformed, duplicate, path-unsafe, ZIP64, encrypted, or symlink entries;
- compressed archive input larger than the configured total-byte ceiling.

Decompression uses a bounded streaming or equivalent incremental inflater. It
tracks actual output per file and in total, aborting immediately if real output
exceeds declared sizes or configured limits. Limit diagnostics are returned
without passing partially inflated files to document parsing.

### Directories

Node, browser, and native directory readers share the same accumulator model:

- increment file count before reading;
- inspect `stat.size`, browser `File.size`, or native metadata length before
  allocating a file buffer;
- reject a file over the per-file limit;
- reject projected total bytes over the total limit;
- stop traversal on the first blocking limit diagnostic;
- retain existing path-containment and symbolic-link protections;
- pass the fully read files to the SDK only after the bounded traversal
  succeeds.

Browser file-handle types require `size` on the returned file object. Native
scan commands receive the resolved SDK limit values from the TypeScript bridge
so Rust and TypeScript do not maintain drifting hard-coded defaults.

## Error and Recovery Behavior

- Source validation and resource-limit failures produce structured pack
  diagnostics and do not write installed state.
- Persisted-record corruption produces a visible invalid-pack state and does
  not register the pack at runtime.
- Native read failure produces a visible store issue rather than an empty-state
  success.
- Native replacement failure returns an error and preserves the previous JSON
  file.
- Temporary files are never treated as installed state.
- Legacy installed records require re-sync but do not affect learner progress.
- A valid re-sync can replace an invalid or legacy record with the same pack
  ID.
- No hardening error path automatically activates rollback or deletes the
  active record.

## Test Design

### R1 Lifecycle Tests

- Archive bytes load into the same candidate contract as directory bytes.
- Archive installation through the application rejects downgrade and
  same-version changed content.
- Identical content is idempotent and a higher version retains one rollback.
- Rejected archive candidates do not write store state or change runtime state.
- No archive helper writes legacy pointer files.

### R2 Native Durability Tests

- Replacement failure leaves the prior JSON bytes readable and unchanged.
- First-write failure leaves no destination pretending to be valid.
- Concurrent writes serialize and always leave one complete valid JSON value.
- Unique temporary names cannot collide.
- Successful replacement removes its temporary file.

Native tests use a private file-operation seam or deterministic fault injection;
they do not depend on timing or machine-specific ACL behavior.

### R3 Snapshot Tests

- Browser, Tauri, and in-memory stores return records and issues from one read.
- A collection containing valid and invalid records returns both in one
  snapshot.
- Native bridge failure produces one visible issue.
- Application bootstrap registers valid records and exposes invalid issues from
  the same snapshot.

### R4 Integrity and Migration Tests

- Mutation of canonical bytes, stored content hash, release ID, pack ID,
  manifest version, or file metadata fails restoration.
- Missing and duplicate canonical files fail restoration.
- A valid byte-backed active and rollback pair restores.
- A legacy document-only record is excluded with the re-sync issue.
- Re-sync replaces the legacy record and restores the pack.
- A session/evidence fixture created before re-sync remains unchanged after
  re-sync.

### R5 Resource-Limit Tests

- ZIP metadata declaring too many files, an oversized file, or excessive total
  output is rejected before inflation.
- Actual inflated output exceeding declared or configured limits aborts.
- Duplicate, unsafe, encrypted, ZIP64, and symlink entries remain rejected.
- Browser traversal does not call `arrayBuffer()` for a file rejected from its
  `size` metadata.
- Node and native readers do not read file contents after metadata exceeds a
  limit.
- File counts and totals accumulate across nested directories.
- Exactly-at-limit packs remain accepted.

### Integration and Regression Gates

- Browser and Tauri directory adapters produce the same content hash and
  lifecycle decision for identical canonical files.
- Invalid sync preserves a known-good installed release.
- Logic Foundations `1.0.0` imports, persists, restores, and retains learner
  evidence after the record-format transition.
- Shared contract, SDK, application, browser product, Rust, and Tauri build
  gates pass.
- `npm audit` reports no reachable high or critical runtime vulnerability
  introduced by this work.

## Delivery Structure

Implementation uses five stable review IDs and five independently reviewed TDD
commits:

1. `R1` centralize archive candidates and release authority;
2. `R2` make native JSON replacement durable;
3. `R3` introduce atomic store snapshots;
4. `R4` persist canonical bytes and verify restoration integrity;
5. `R5` enforce limits before allocation across archive and directory paths.

Dependencies between commits may require adding the canonical-file candidate
field in `R1` before it is persisted in `R4`. Each commit must leave the branch
type-safe and testable; no commit may temporarily enable a weaker restoration
path.

## Acceptance Criteria

The hardening pass is complete only when:

- every state-changing install path delegates to the shared application
  lifecycle;
- archive and directory sources produce the same validated candidate contract;
- native JSON replacement never deletes the last good record before the new
  record is committed;
- records and issues are read atomically;
- every restored release is reconstructed and rehashed from canonical bytes;
- legacy records fail closed with a re-sync path that retains learner progress;
- resource limits apply before decompression and full directory reads and also
  cap actual decompression output;
- browser, Node, Tauri, and SDK limit behavior agrees;
- all `R1` through `R5` focused tests and repository verification gates pass;
- a final whole-branch security and quality review has no remaining Critical or
  Important findings in `R1` through `R5`.
