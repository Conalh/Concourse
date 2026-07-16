# Learning Pack Integrity Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve security and durability findings R1 through R5 by routing every learning-pack source through one validated release lifecycle, persisting canonical bytes, restoring only revalidated records, replacing native JSON durably, and enforcing resource limits before allocation.

**Architecture:** Browser, Node, and Tauri source adapters produce the same byte-backed `ValidatedLearningPackCandidate`; only `LearntApplication.installValidatedLearningPack` may change installed-release state. Runtime-specific stores serialize version-2 records but share one SDK-backed decoder, while the Rust shell remains an opaque JSON store and a bounded filesystem reader.

**Tech Stack:** TypeScript 6, Vitest 4, IndexedDB/fake-indexeddb, `@learnt/learning-pack-sdk`, fflate streaming unzip, Rust 1.77.2, Tauri 2, serde_json, windows-sys.

## Global Constraints

- Preserve the modular-monolith dependency boundaries in `docs/architecture.md`; UI must not import infrastructure or SDK internals.
- Keep the product local-first. Do not add accounts, hosted state, payments, ratings, marketplace behavior, signing, remote catalog behavior, or rollback UI.
- `R6` CI platform-matrix and Tauri bundle-target work is excluded.
- The default ceilings remain exactly 50 MiB total uncompressed bytes, 512 files, and 10 MiB per file.
- Legacy document-only installed records fail closed with one re-sync message and are not deleted automatically.
- Learner sessions, evidence, resource engagement, and progress remain in their existing repositories and must not be rewritten during pack-record migration.
- `releaseId` remains equal to the SDK-recomputed `contentHash`.
- Rejected candidates and failed native replacements must preserve the last known-good installed record and runtime state.
- Use TDD for every review ID and leave the branch type-safe and testable after each of the five implementation commits.

---

## File Map

- `src/learning-packs/installed-learning-pack-ports.ts`: canonical candidate, release, snapshot, and store contracts.
- `src/application/installed-learning-pack-lifecycle.ts`: sole install, reinstall, upgrade, downgrade, and rollback-planning authority.
- `src/learning-packs/learnt-archive-installer.ts`: stateless Node archive/directory candidate loader; no installed-state writes.
- `src/infrastructure/learning-packs/installed-learning-pack-record-codec.ts`: version-2 persisted-record encoder/decoder and SDK integrity reconstruction shared by browser and Tauri stores.
- `src/infrastructure/learning-packs/browser-learning-pack-state-store.ts`: IndexedDB snapshot and structured-clone byte persistence.
- `src/infrastructure/desktop/tauri-installed-learning-pack-store.ts`: one native read, base64 wire mapping, shared record decoding.
- `src/application/learnt-application.ts`: consume one snapshot for both restore and install planning.
- `packages/learning-pack-sdk/src/zip.ts`: bounded ZIP32 metadata preflight and incremental extraction.
- `packages/learning-pack-sdk/src/filesystem.ts`: Node metadata-first bounded directory traversal.
- `src/infrastructure/learning-packs/browser-learning-pack-source.ts`: browser `File.size` preflight and bounded traversal.
- `src/infrastructure/desktop/tauri-learning-pack-source.ts`: pass resolved SDK ceilings to the native scan and retain canonical files on candidates.
- `src-tauri/src/atomic_json.rs`: flushed unique-temporary write and platform-specific atomic replacement.
- `src-tauri/src/lib.rs`: bounded native directory scan and delegation to `atomic_json`.
- Focused tests next to each TypeScript unit plus Rust unit tests in `src-tauri/src/atomic_json.rs` and `src-tauri/src/lib.rs`.

### Task 1: R1 — Centralize Archive Candidates and Release Authority

**Files:**

- Modify: `src/learning-packs/installed-learning-pack-ports.ts`
- Modify: `src/application/installed-learning-pack-lifecycle.ts`
- Modify: `src/application/installed-learning-pack-lifecycle.test.ts`
- Modify: `src/learning-packs/learnt-archive-installer.ts`
- Modify: `src/learning-packs/learnt-importer.test.ts`
- Modify: `src/infrastructure/learning-packs/browser-learning-pack-source.ts`
- Modify: `src/infrastructure/desktop/tauri-learning-pack-source.ts`
- Modify: `src/app/desktop-composition-root.test.ts`
- Modify: `src/application/learnt-application.test.ts`
- Modify: `src/infrastructure/learning-packs/browser-learning-pack-state-store.test.ts`
- Modify: `src/infrastructure/desktop/tauri-installed-learning-pack-store.test.ts`
- Modify: `docs/learning-packs/learnt-importer-handoff.md`

**Interfaces:**

- Consumes: SDK `LoadedLearningPack.files`, `LoadedLearningPack.documents`, and `LoadedLearningPack.contentHash`.
- Produces: `ValidatedLearningPackCandidate = { contentHash, documents, files }`; all later persistence work relies on this exact shape.
- Produces: `loadLearningPackArchiveCandidate(input): Promise<ValidatedLearningPackCandidate>` and `loadLearningPackDirectoryCandidate(input): Promise<ValidatedLearningPackCandidate>`.

- [ ] **Step 1: Add failing lifecycle and archive-source tests for canonical files and single-authority behavior.**

  Extend the candidate helper in `installed-learning-pack-lifecycle.test.ts` to accept canonical files and assert that both active and rollback releases retain them:

  ```ts
  function candidate(
    version: Parameters<typeof createLogicFoundationsRelease>[0],
    contentHash: string,
  ): ValidatedLearningPackCandidate {
    const bytes = new TextEncoder().encode(version)
    return {
      contentHash,
      documents: createLogicFoundationsRelease(version),
      files: [
        { path: 'fixture.bin', bytes, sha256: contentHash, size: bytes.length },
      ],
    }
  }
  ```

  Replace the legacy pointer assertions in `learnt-importer.test.ts` with these cases:

  ```ts
  it('loads an archive into the application candidate contract', async () => {
    const archiveFile = await packGoldenRelease(await makeTempDir(), '1.0.0')
    const candidate = await loadLearningPackArchiveCandidate({ archiveFile })
    expect(candidate.documents.manifest.version).toBe('1.0.0')
    expect(candidate.files.map((file) => file.path)).toContain('pack.json')
    expect(candidate.contentHash).toMatch(/^[a-f0-9]{64}$/)
  })

  it('does not create legacy current or rollback pointer files', async () => {
    const temp = await makeTempDir()
    const archiveFile = await packGoldenRelease(temp, '1.0.0')
    await loadLearningPackArchiveCandidate({ archiveFile })
    await expect(pathExists(path.join(temp, 'current.json'))).resolves.toBe(
      false,
    )
    await expect(pathExists(path.join(temp, 'rollback.json'))).resolves.toBe(
      false,
    )
  })
  ```

- [ ] **Step 2: Run the focused tests and verify the new contract fails.**

  Run:

  ```powershell
  npx vitest run src/application/installed-learning-pack-lifecycle.test.ts src/learning-packs/learnt-importer.test.ts
  ```

  Expected: FAIL because candidates and releases lack `files` and `loadLearningPackArchiveCandidate` is not exported.

- [ ] **Step 3: Extend the application contracts and lifecycle projection.**

  In `installed-learning-pack-ports.ts`, import `PackFileRecord` as a type from the SDK and use these exact definitions:

  ```ts
  export type ValidatedLearningPackCandidate = Readonly<{
    contentHash: string
    documents: LearningPackDocuments
    files: readonly PackFileRecord[]
  }>

  export type InstalledLearningPackRelease = Readonly<{
    releaseId: string
    packVersion: string
    contentHash: string
    documents: LearningPackDocuments
    files: readonly PackFileRecord[]
  }>
  ```

  In `releaseFromCandidate`, copy the canonical file reference into the immutable release:

  ```ts
  return {
    releaseId: candidate.contentHash,
    packVersion: candidate.documents.manifest.version,
    contentHash: candidate.contentHash,
    documents: candidate.documents,
    files: candidate.files,
  }
  ```

- [ ] **Step 4: Replace the stateful legacy installer with candidate loaders.**

  Remove legacy release metadata, pointer helpers, version comparison, extraction staging, and JSON-writing code from `learnt-archive-installer.ts`. Keep only diagnostic conversion and expose:

  ```ts
  export type LearningPackArchiveCandidateInput = Readonly<
    LearningPackSdkOptions & { archiveFile: string }
  >

  export type LearningPackDirectoryCandidateInput = Readonly<
    LearningPackSdkOptions & { directory: string }
  >

  export async function loadLearningPackArchiveCandidate(
    input: LearningPackArchiveCandidateInput,
  ): Promise<ValidatedLearningPackCandidate> {
    return candidateFromLoaded(
      await loadLearningPackArchive(input.archiveFile, toSdkOptions(input)),
      'inspect',
      input.archiveFile,
    )
  }

  export async function loadLearningPackDirectoryCandidate(
    input: string | LearningPackDirectoryCandidateInput,
  ): Promise<ValidatedLearningPackCandidate> {
    const directory = typeof input === 'string' ? input : input.directory
    const options = typeof input === 'string' ? {} : toSdkOptions(input)
    return candidateFromLoaded(
      await loadLearningPackDirectory(directory, options),
      'validate',
      directory,
    )
  }

  function candidateFromLoaded(
    loaded: LoadedLearningPack | { diagnostics: LearningPackDiagnostic[] },
    stage: LearningPackInstallStage,
    sourcePath: string,
  ): ValidatedLearningPackCandidate {
    if (!('documents' in loaded)) {
      throw new LearningPackInstallError(
        `Learning pack validation failed for ${sourcePath}.`,
        loaded.diagnostics,
        { stage },
      )
    }
    return Object.freeze({
      contentHash: loaded.contentHash,
      documents: loaded.documents,
      files: loaded.files,
    })
  }
  ```

- [ ] **Step 5: Put canonical files on every browser, Tauri, and test candidate.**

  In both source adapters, change the validated candidate construction to:

  ```ts
  candidate: {
    contentHash: loaded.contentHash,
    documents: loaded.documents,
    files: loaded.files,
  }
  ```

  Update all focused test candidate helpers to create `files` from the same SDK-loaded fixture rather than inventing a second document authority. Assertions must cover: identical reinstall is idempotent, a same-version changed archive is rejected, a lower-version archive is rejected, and a higher version retains exactly one rollback release.

- [ ] **Step 6: Update importer handoff documentation to show the only state-changing call.**

  Replace examples that call `installLearningPackArchive` with:

  ```ts
  const candidate = await loadLearningPackArchiveCandidate({ archiveFile })
  const change = await application.installValidatedLearningPack(candidate)
  ```

  State explicitly that archive and directory helpers validate only and never write `current`, `rollback`, or installed-pack state.

- [ ] **Step 7: Run R1 and repository type gates.**

  Run:

  ```powershell
  npx vitest run src/application/installed-learning-pack-lifecycle.test.ts src/application/learnt-application.test.ts src/learning-packs/learnt-importer.test.ts src/infrastructure/desktop/tauri-learning-pack-source.test.ts src/ui/app/browser-learning-pack-directory-import.test.ts
  npm run typecheck
  ```

  Expected: all focused tests PASS and typecheck exits 0.

- [ ] **Step 8: Commit R1.**

  ```powershell
  git add src/learning-packs/installed-learning-pack-ports.ts src/application/installed-learning-pack-lifecycle.ts src/application/installed-learning-pack-lifecycle.test.ts src/learning-packs/learnt-archive-installer.ts src/learning-packs/learnt-importer.test.ts src/infrastructure/learning-packs/browser-learning-pack-source.ts src/infrastructure/desktop/tauri-learning-pack-source.ts src/app/desktop-composition-root.test.ts src/application/learnt-application.test.ts src/infrastructure/learning-packs/browser-learning-pack-state-store.test.ts src/infrastructure/desktop/tauri-installed-learning-pack-store.test.ts docs/learning-packs/learnt-importer-handoff.md
  git commit -m "fix: centralize learning pack release authority"
  ```

### Task 2: R2 — Make Native JSON Replacement Durable

**Files:**

- Create: `src-tauri/src/atomic_json.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/Cargo.lock`

**Interfaces:**

- Consumes: `serde_json::Value` and an app-private destination `Path`.
- Produces: `atomic_json::write_json_file(path: &Path, value: &Value) -> io::Result<()>`.
- Produces: an internal `replace_file(source, destination)` platform seam used by deterministic failure tests.

- [ ] **Step 1: Write Rust tests for preservation, uniqueness, cleanup, and concurrent completeness.**

  Add unit tests in `atomic_json.rs` using a private `write_json_file_with_replace` helper. The failure test injects this closure:

  ```rust
  let fail_replace = |_temporary: &Path, _destination: &Path| {
      Err(io::Error::new(io::ErrorKind::Other, "injected replacement failure"))
  };
  ```

  Assert the destination still contains the original JSON bytes, no `.concourse-tmp-*` sibling remains, first-write failure leaves no destination, 16 simultaneous writes all return complete JSON, and the final destination parses as one of the 16 submitted values.

- [ ] **Step 2: Run Rust tests and verify the seam is missing.**

  Run:

  ```powershell
  cargo test --manifest-path src-tauri/Cargo.toml atomic_json
  ```

  Expected: FAIL because `atomic_json` and `write_json_file_with_replace` do not exist.

- [ ] **Step 3: Implement unique, flushed temporary writes and serialized replacement.**

  `atomic_json.rs` must use a process-wide `Mutex<()>`, `AtomicU64`, and create-new semantics:

  ```rust
  static WRITE_LOCK: Mutex<()> = Mutex::new(());
  static TEMP_COUNTER: AtomicU64 = AtomicU64::new(0);

  pub fn write_json_file(path: &Path, value: &Value) -> io::Result<()> {
      let bytes = serde_json::to_vec_pretty(value).map_err(io::Error::other)?;
      write_json_file_with_replace(path, &bytes, replace_file)
  }

  fn write_json_file_with_replace<F>(path: &Path, bytes: &[u8], replace: F) -> io::Result<()>
  where
      F: FnOnce(&Path, &Path) -> io::Result<()>,
  {
      let _guard = WRITE_LOCK.lock().map_err(|_| io::Error::other("JSON write lock poisoned"))?;
      let parent = path.parent().ok_or_else(|| io::Error::other("destination has no parent"))?;
      fs::create_dir_all(parent)?;
      let temporary = unique_temporary_sibling(path);
      let result = (|| {
          let mut file = OpenOptions::new().write(true).create_new(true).open(&temporary)?;
          file.write_all(bytes)?;
          file.sync_all()?;
          drop(file);
          replace(&temporary, path)?;
          sync_parent_directory(parent)?;
          Ok(())
      })();
      if result.is_err() {
          let _ = fs::remove_file(&temporary);
      }
      result
  }
  ```

  The unique sibling name must contain the destination filename, process ID, and monotonically increasing counter.

- [ ] **Step 4: Implement platform-specific atomic replacement without destination deletion.**

  On Unix, use `fs::rename(source, destination)` and `File::open(parent)?.sync_all()`. On Windows, add:

  ```toml
  [target.'cfg(windows)'.dependencies]
  windows-sys = { version = "0.61", features = ["Win32_Foundation", "Win32_Storage_FileSystem"] }
  ```

  Call `ReplaceFileW(destination, source, null, REPLACEFILE_WRITE_THROUGH, null, null)` when the destination exists. For first creation call `MoveFileExW(source, destination, MOVEFILE_WRITE_THROUGH)`. Convert paths with `OsStrExt::encode_wide`, terminate with `0`, and return `io::Error::last_os_error()` on zero. Never call `remove_file(destination)`.

- [ ] **Step 5: Delegate `lib.rs` writes and preserve structured diagnostics.**

  Add `mod atomic_json;`, remove the old fixed `.tmp` implementation, and map the new I/O result at the existing boundary:

  ```rust
  atomic_json::write_json_file(path, value).map_err(|error| {
      storage_diagnostic(
          "storage-write-failed",
          format!("Could not durably replace {}: {error}", path.display()),
          path,
      )
  })
  ```

- [ ] **Step 6: Run R2 and native regression gates.**

  Run:

  ```powershell
  cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
  cargo test --manifest-path src-tauri/Cargo.toml
  cargo check --manifest-path src-tauri/Cargo.toml
  ```

  Expected: all Rust tests PASS, formatting is clean, and cargo check exits 0 on Windows.

- [ ] **Step 7: Commit R2.**

  ```powershell
  git add src-tauri/src/atomic_json.rs src-tauri/src/lib.rs src-tauri/Cargo.toml src-tauri/Cargo.lock
  git commit -m "fix: replace native JSON records durably"
  ```

### Task 3: R3 — Read Installed Records and Issues Atomically

**Files:**

- Modify: `src/learning-packs/installed-learning-pack-ports.ts`
- Modify: `src/application/learnt-application.ts`
- Modify: `src/application/learnt-application.test.ts`
- Modify: `src/infrastructure/learning-packs/browser-learning-pack-state-store.ts`
- Modify: `src/infrastructure/learning-packs/browser-learning-pack-state-store.test.ts`
- Modify: `src/infrastructure/desktop/tauri-installed-learning-pack-store.ts`
- Modify: `src/infrastructure/desktop/tauri-installed-learning-pack-store.test.ts`
- Modify: `src/app/desktop-composition-root.test.ts`
- Modify: `src/ui/app/LearningPackLibrary.product.test.tsx`

**Interfaces:**

- Produces: `InstalledLearningPackStoreSnapshot = { records, issues }`.
- Replaces: `list()` and optional `listIssues()` with required `readSnapshot()`.
- Consumes: one snapshot per restore operation and one snapshot per install-plan operation.

- [ ] **Step 1: Write failing snapshot tests.**

  Browser and Tauri tests must call `readSnapshot()` once and assert valid and invalid values are returned together:

  ```ts
  await expect(store.readSnapshot()).resolves.toEqual({
    records: [record],
    issues: [{ packId: 'corrupt-pack', message: expect.any(String) }],
  })
  ```

  In the application test store, increment `snapshotReads` in `readSnapshot()` and assert restore uses exactly one read. Add a Tauri bridge-rejection test expecting `{ records: [], issues: [{ packId: null, message: 'native read failed' }] }`.

- [ ] **Step 2: Run snapshot tests and verify the old interface fails.**

  Run:

  ```powershell
  npx vitest run src/application/learnt-application.test.ts src/infrastructure/learning-packs/browser-learning-pack-state-store.test.ts src/infrastructure/desktop/tauri-installed-learning-pack-store.test.ts
  ```

  Expected: FAIL because `readSnapshot` is absent and application restore calls the two legacy methods.

- [ ] **Step 3: Replace the store contract.**

  In `installed-learning-pack-ports.ts`, define:

  ```ts
  export type InstalledLearningPackStoreSnapshot = Readonly<{
    records: readonly InstalledLearningPackRecord[]
    issues: readonly PersistedLearningPackRecordIssue[]
  }>

  export interface InstalledLearningPackStore {
    readSnapshot(): Promise<InstalledLearningPackStoreSnapshot>
    write(record: InstalledLearningPackRecord): Promise<void>
  }
  ```

- [ ] **Step 4: Make browser and Tauri stores return one classified read.**

  Browser `readSnapshot()` opens one readonly transaction, calls `getAll()` once, classifies each value, awaits that same transaction, and returns both arrays. Tauri `readSnapshot()` invokes `readInstalledPackRecords()` once, validates the collection once, and returns bridge/shape errors directly in `issues`; remove the mutable `issues` cache.

- [ ] **Step 5: Consume snapshots once in application restore and install.**

  Restore begins with:

  ```ts
  const snapshot = await store.readSnapshot()
  for (const issue of snapshot.issues) {
    states.push(
      this.invalidInstalledPackState(
        issue.packId ?? 'unknown-installed-pack',
        null,
        issue.message,
        [],
      ),
    )
  }
  for (const record of snapshot.records) {
    // existing active-release restoration path
  }
  ```

  Installation finds its existing record from `(await store.readSnapshot()).records`. Update every in-memory store in tests to implement the required method.

- [ ] **Step 6: Run R3 and type gates.**

  Run:

  ```powershell
  npx vitest run src/application/learnt-application.test.ts src/infrastructure/learning-packs/browser-learning-pack-state-store.test.ts src/infrastructure/desktop/tauri-installed-learning-pack-store.test.ts src/app/desktop-composition-root.test.ts src/ui/app/LearningPackLibrary.product.test.tsx
  npm run typecheck
  ```

  Expected: all focused tests PASS and typecheck exits 0.

- [ ] **Step 7: Commit R3.**

  ```powershell
  git add src/learning-packs/installed-learning-pack-ports.ts src/application/learnt-application.ts src/application/learnt-application.test.ts src/infrastructure/learning-packs/browser-learning-pack-state-store.ts src/infrastructure/learning-packs/browser-learning-pack-state-store.test.ts src/infrastructure/desktop/tauri-installed-learning-pack-store.ts src/infrastructure/desktop/tauri-installed-learning-pack-store.test.ts src/app/desktop-composition-root.test.ts src/ui/app/LearningPackLibrary.product.test.tsx
  git commit -m "fix: read installed pack snapshots atomically"
  ```

### Task 4: R4 — Persist Canonical Bytes and Revalidate Restoration

**Files:**

- Create: `src/infrastructure/learning-packs/installed-learning-pack-record-codec.ts`
- Create: `src/infrastructure/learning-packs/installed-learning-pack-record-codec.test.ts`
- Modify: `src/infrastructure/learning-packs/browser-learning-pack-state-store.ts`
- Modify: `src/infrastructure/learning-packs/browser-learning-pack-state-store.test.ts`
- Modify: `src/infrastructure/desktop/tauri-installed-learning-pack-store.ts`
- Modify: `src/infrastructure/desktop/tauri-installed-learning-pack-store.test.ts`
- Modify: `src/infrastructure/desktop/tauri-desktop-bridge.ts`
- Modify: `src/infrastructure/desktop/tauri-desktop-bridge.test.ts`
- Modify: `src/application/learnt-application.ts`
- Modify: `src/application/learnt-application.test.ts`

**Interfaces:**

- Produces: version-2 persisted records containing canonical file bytes and no trusted `documents` field.
- Produces: `encodeInstalledLearningPackRecord(record, encodeBytes)` and async `decodeInstalledLearningPackRecord(value, decodeBytes)`.
- Consumes: SDK `loadLearningPackFromFilesAsync('memory', packId, files)` under default limits.

- [ ] **Step 1: Write corruption, migration, rollback, and round-trip tests against the new codec.**

  Define byte strategies:

  ```ts
  export type PersistedBytesEncoder = (bytes: Uint8Array) => unknown
  export type PersistedBytesDecoder = (value: unknown) => Uint8Array | null

  const structuredCloneBytes: PersistedBytesEncoder = (bytes) => bytes
  const readStructuredCloneBytes: PersistedBytesDecoder = (value) =>
    value instanceof Uint8Array ? value : null
  ```

  Tests must independently mutate file bytes, stored `contentHash`, `releaseId`, record `packId`, stored `packVersion`, file `size`, and file `sha256`; remove a required file; add a duplicate path; and assert each decode returns one issue and no record. Add a valid active-plus-rollback round-trip and a legacy record test expecting exactly:

  ```text
  Installed pack data uses a legacy format and must be re-synced. Learner progress was retained.
  ```

- [ ] **Step 2: Run codec tests and verify they fail.**

  Run:

  ```powershell
  npx vitest run src/infrastructure/learning-packs/installed-learning-pack-record-codec.test.ts
  ```

  Expected: FAIL because the codec module does not exist.

- [ ] **Step 3: Implement the version-2 persisted shape and encoder.**

  The internal persisted types are:

  ```ts
  type PersistedPackFileV2 = Readonly<{
    path: string
    bytes: unknown
    sha256: string
    size: number
  }>

  type PersistedReleaseV2 = Readonly<{
    releaseId: string
    packVersion: string
    contentHash: string
    files: readonly PersistedPackFileV2[]
  }>

  type PersistedRecordV2 = Readonly<{
    recordVersion: 2
    packId: string
    activeReleaseId: string
    rollbackReleaseId: string | null
    releases: readonly PersistedReleaseV2[]
  }>
  ```

  `encodeInstalledLearningPackRecord` copies identity fields and maps every file through the supplied byte encoder. It never serializes runtime `documents`.

- [ ] **Step 4: Implement fail-closed SDK reconstruction.**

  For every release, decode and structurally validate all file fields; reject duplicate paths; then call:

  ```ts
  const loaded = await loadLearningPackFromFilesAsync(
    'memory',
    persisted.packId,
    files,
  )
  ```

  Accept only when `loaded.contentHash === persistedRelease.contentHash`, `releaseId === loaded.contentHash`, `loaded.documents.manifest.packId === persisted.packId`, and `loaded.documents.manifest.version === persistedRelease.packVersion`. Return the reconstructed `documents` and SDK-normalized `loaded.files`, not persisted projections. Reject an invalid active release, missing active pointer, invalid rollback pointer, more than two releases, or any invalid sibling with one specific issue.

- [ ] **Step 5: Wire browser structured-clone bytes and Tauri base64 bytes.**

  Browser `write()` passes `bytes => bytes` to the encoder and `readSnapshot()` uses `value instanceof Uint8Array`. Tauri uses strict base64 helpers:

  ```ts
  function encodeBase64(bytes: Uint8Array): string {
    let binary = ''
    for (const byte of bytes) binary += String.fromCharCode(byte)
    return btoa(binary)
  }

  function decodeBase64(value: unknown): Uint8Array | null {
    if (typeof value !== 'string') return null
    try {
      return Uint8Array.from(atob(value), (character) =>
        character.charCodeAt(0),
      )
    } catch {
      return null
    }
  }
  ```

  The desktop bridge accepts and emits the encoded unknown wire record; Rust continues to store opaque JSON.

- [ ] **Step 6: Remove document reinstallation from application restore and prove re-sync preserves learner state.**

  Since stores now return reconstructed releases, application restore registers `activeRelease.documents` without treating it as persisted authority. Add an integration test that creates a session/evidence fixture, injects a legacy pack record, performs a validated re-sync for the same pack ID, and asserts the session record and evidence IDs are byte-for-byte unchanged.

- [ ] **Step 7: Run R4, application, and bridge gates.**

  Run:

  ```powershell
  npx vitest run src/infrastructure/learning-packs/installed-learning-pack-record-codec.test.ts src/infrastructure/learning-packs/browser-learning-pack-state-store.test.ts src/infrastructure/desktop/tauri-installed-learning-pack-store.test.ts src/infrastructure/desktop/tauri-desktop-bridge.test.ts src/application/learnt-application.test.ts
  npm run typecheck
  ```

  Expected: corruption and legacy cases fail closed, valid active/rollback records restore, re-sync preserves learner state, and typecheck exits 0.

- [ ] **Step 8: Commit R4.**

  ```powershell
  git add src/infrastructure/learning-packs/installed-learning-pack-record-codec.ts src/infrastructure/learning-packs/installed-learning-pack-record-codec.test.ts src/infrastructure/learning-packs/browser-learning-pack-state-store.ts src/infrastructure/learning-packs/browser-learning-pack-state-store.test.ts src/infrastructure/desktop/tauri-installed-learning-pack-store.ts src/infrastructure/desktop/tauri-installed-learning-pack-store.test.ts src/infrastructure/desktop/tauri-desktop-bridge.ts src/infrastructure/desktop/tauri-desktop-bridge.test.ts src/application/learnt-application.ts src/application/learnt-application.test.ts
  git commit -m "fix: verify installed packs from canonical bytes"
  ```

### Task 5: R5 — Enforce Resource Limits Before Allocation

**Files:**

- Modify: `packages/learning-pack-sdk/src/limits.ts`
- Modify: `packages/learning-pack-sdk/src/zip.ts`
- Modify: `packages/learning-pack-sdk/src/archive.ts`
- Modify: `packages/learning-pack-sdk/src/browser.ts`
- Modify: `packages/learning-pack-sdk/src/filesystem.ts`
- Modify: `packages/learning-pack-sdk/test/sdk.test.ts`
- Modify: `packages/learning-pack-sdk/test/browser-entry.test.ts`
- Modify: `src/infrastructure/learning-packs/browser-learning-pack-source.ts`
- Modify: `src/ui/app/browser-learning-pack-directory-import.test.ts`
- Modify: `src/infrastructure/desktop/tauri-learning-pack-source.ts`
- Modify: `src/infrastructure/desktop/tauri-learning-pack-source.test.ts`
- Modify: `src/infrastructure/desktop/tauri-desktop-bridge.ts`
- Modify: `src/infrastructure/desktop/tauri-desktop-bridge.test.ts`
- Modify: `src-tauri/src/lib.rs`

**Interfaces:**

- Produces: `ArchiveLimitAccumulator` with `acceptMetadata(path, size)` and actual-output accounting.
- Changes: `readZipEntries(bytes, limits)` to preflight all central-directory metadata before starting bounded extraction.
- Changes: `readDirectoryFiles(root, options)` to reject from `lstat.size` before `readFile`.
- Changes: native `read_course_folder_candidates(selectedRoot, limits)` to receive resolved values from TypeScript.

- [ ] **Step 1: Write failing archive limit tests that instrument decompression.**

  Add fixtures for too many entries, a declared oversized file, excessive declared total, compressed input over the total ceiling, encrypted flags, ZIP64 sentinel fields, symlinks, duplicates, and unsafe paths. Inject an extraction observer or decoder seam and assert metadata failures leave `inflatedEntries === 0`. Add a forged declared-size fixture whose actual output exceeds the configured per-file limit and assert extraction aborts before a `PackFileRecord` is returned. Exactly-at-limit fixtures must pass.

- [ ] **Step 2: Write failing metadata-first directory tests.**

  Browser test file objects must include `size`. Use a rejected file whose `arrayBuffer()` increments a counter and assert the counter stays zero. In Node, add an injectable file-reader seam or spy around `fs.readFile` and assert it is not called after `lstat.size` exceeds the limit. In Rust, use a tiny configured ceiling and assert an oversized file returns `resource-limit-exceeded` without adding bytes to the candidate.

- [ ] **Step 3: Run focused R5 tests and verify allocation currently occurs.**

  Run:

  ```powershell
  npm --workspace=@learnt/learning-pack-sdk test -- --run test/sdk.test.ts test/browser-entry.test.ts
  npx vitest run src/ui/app/browser-learning-pack-directory-import.test.ts src/infrastructure/desktop/tauri-learning-pack-source.test.ts
  cargo test --manifest-path src-tauri/Cargo.toml scan_course_folder
  ```

  Expected: FAIL because ZIP extraction uses `unzipSync`, browser files lack required metadata checks, and native/Node scans read bytes before applying ceilings.

- [ ] **Step 4: Add one shared TypeScript metadata accumulator.**

  In `limits.ts`, add:

  ```ts
  export type ArchiveLimitAccumulator = Readonly<{
    acceptMetadata(path: string, size: number): LearningPackDiagnostic[]
    acceptOutput(path: string, chunkBytes: number): LearningPackDiagnostic[]
    readonly fileCount: number
    readonly totalBytes: number
  }>

  export function createArchiveLimitAccumulator(
    limits: ArchiveLimits,
  ): ArchiveLimitAccumulator
  ```

  `acceptMetadata` increments count before reads, rejects a non-safe integer or negative size, per-file overflow, and projected total overflow. `acceptOutput` tracks actual bytes by path and globally and rejects output beyond declared metadata or configured ceilings.

- [ ] **Step 5: Replace `unzipSync` with central-directory preflight plus incremental extraction.**

  Parse ZIP32 central records completely before inflation, including flags, compression method, compressed/uncompressed sizes, external attributes, local-header offset, filename, and extra fields. Reject malformed offsets, duplicate/unsafe paths, encryption flag bit 0, ZIP64 sentinels or extra field `0x0001`, Unix symlinks, unsupported compression, entry-count overflow, declared byte overflow, and input bytes over `maxTotalBytes`.

  Use fflate `Unzip`, register `UnzipInflate` and `UnzipPassThrough`, collect bounded chunks per entry, and call `file.terminate()` immediately on an accumulator error. Only concatenate chunks and create `PackFileRecord` after that file reaches `final` within both declared and configured sizes. Throw one internal bounded-extraction error and convert it to the existing structured SDK diagnostic at the archive boundary.

- [ ] **Step 6: Apply metadata-first traversal to Node and browser directories.**

  Resolve limits once at traversal start. Node calls `lstat`, `acceptMetadata(archivePath, stat.size)`, and only then `readFile`; verify bytes read equal metadata size before appending. Browser `BrowserReadableFile` becomes:

  ```ts
  type BrowserReadableFile = Readonly<{
    size: number
    arrayBuffer(): Promise<ArrayBuffer>
  }>
  ```

  Call `getFile()`, check `file.size`, then call `arrayBuffer()`. Thread one accumulator through nested directories so file count and total bytes cannot reset per recursion.

- [ ] **Step 7: Pass resolved ceilings into the native scan and enforce metadata first in Rust.**

  Add serialized camelCase limits:

  ```rust
  #[derive(Clone, Copy, Deserialize)]
  #[serde(rename_all = "camelCase")]
  pub struct CourseFolderReadLimits {
      pub max_total_bytes: u64,
      pub max_file_count: usize,
      pub max_file_bytes: u64,
  }
  ```

  The Tauri bridge invokes `read_course_folder_candidates` with `{ selectedRoot, limits: resolveArchiveLimits() }`. Rust tracks file count and projected total in one mutable scan state, calls `fs::metadata` and rejects before `fs::read`, and emits `resource-limit-exceeded` with the offending path. Validate incoming ceilings are positive and convertible before traversal.

- [ ] **Step 8: Run R5 and full SDK/native gates.**

  Run:

  ```powershell
  npm --workspace=@learnt/learning-pack-sdk run typecheck
  npm --workspace=@learnt/learning-pack-sdk test
  npx vitest run src/ui/app/browser-learning-pack-directory-import.test.ts src/infrastructure/desktop/tauri-learning-pack-source.test.ts src/infrastructure/desktop/tauri-desktop-bridge.test.ts
  cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
  cargo test --manifest-path src-tauri/Cargo.toml
  cargo check --manifest-path src-tauri/Cargo.toml
  ```

  Expected: all archive and directory limit tests PASS, rejected metadata causes zero content reads/inflations, and exactly-at-limit inputs pass.

- [ ] **Step 9: Commit R5.**

  ```powershell
  git add packages/learning-pack-sdk/src/limits.ts packages/learning-pack-sdk/src/zip.ts packages/learning-pack-sdk/src/archive.ts packages/learning-pack-sdk/src/browser.ts packages/learning-pack-sdk/src/filesystem.ts packages/learning-pack-sdk/test/sdk.test.ts packages/learning-pack-sdk/test/browser-entry.test.ts src/infrastructure/learning-packs/browser-learning-pack-source.ts src/ui/app/browser-learning-pack-directory-import.test.ts src/infrastructure/desktop/tauri-learning-pack-source.ts src/infrastructure/desktop/tauri-learning-pack-source.test.ts src/infrastructure/desktop/tauri-desktop-bridge.ts src/infrastructure/desktop/tauri-desktop-bridge.test.ts src-tauri/src/lib.rs
  git commit -m "fix: bound learning pack reads before allocation"
  ```

### Task 6: Final Cross-Runtime Verification and Review

**Files:**

- Modify only files needed to correct failures caused by R1–R5; do not expand into R6.

**Interfaces:**

- Consumes: the five committed hardening increments.
- Produces: verified browser, SDK, application, and Tauri behavior with no remaining Critical or Important R1–R5 finding.

- [ ] **Step 1: Run formatting and static gates.**

  ```powershell
  npm run format:check
  npm run lint
  npm run typecheck
  cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
  cargo check --manifest-path src-tauri/Cargo.toml
  ```

  Expected: every command exits 0.

- [ ] **Step 2: Run complete TypeScript and Rust test suites.**

  ```powershell
  npm run test
  cargo test --manifest-path src-tauri/Cargo.toml
  ```

  Expected: every test passes with no unhandled rejection, panic, or timeout.

- [ ] **Step 3: Build browser and desktop surfaces.**

  ```powershell
  npm run build
  npm run desktop:build
  ```

  Expected: Vite build and the current Windows Tauri bundle complete successfully. Cross-platform bundle targets remain R6.

- [ ] **Step 4: Run the Logic Foundations regression scenario.**

  Execute the focused product tests and pack build:

  ```powershell
  npm run build:logic-foundations
  npx vitest run content/logic-foundations/course.test.ts src/ui/app/LogicFoundationsCourse.product.test.tsx src/ui/app/LearningPackLibrary.product.test.tsx
  ```

  Expected: Logic Foundations 1.0.0 imports, persists, restores, and leaves the learner-state regression fixture unchanged after a re-sync.

- [ ] **Step 5: Run dependency and diff security checks.**

  ```powershell
  npm audit --omit=dev
  git diff 4327933..HEAD --check
  git status --short
  ```

  Expected: no reachable high or critical runtime vulnerability introduced by this work, no whitespace errors, and no uncommitted implementation changes.

- [ ] **Step 6: Perform the final whole-branch R1–R5 review.**

  Reinspect every original finding against current code and record evidence for: one lifecycle authority; old native destination preservation; one snapshot read; SDK reconstruction from canonical bytes; and pre-allocation limits in ZIP, browser, Node, and Rust paths. Acceptance requires zero remaining Critical or Important finding within R1–R5. Record any R6 observation separately without changing scope.

- [ ] **Step 7: Push the five implementation commits after all gates pass.**

  ```powershell
  git push concourse codey/concourse-recovery-delivery
  git status --branch --short
  git rev-list --left-right --count "HEAD...@{upstream}"
  ```

  Expected: push succeeds, the worktree is clean, and the ahead/behind count is `0 0`.
