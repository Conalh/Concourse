# Concourse Pack-Asset Convergence Design

## Status

Approved in design and written-specification review on 2026-07-16. Approved
for staged implementation.

## Summary

Restore Concourse's reusable, non-executing pack-asset delivery capability on
top of the published `Concourse` 0.1 baseline. The migration will selectively
adapt the proven implementation from the local `codey/practical-ml-course`
branch without publishing that course's notebooks, datasets, generators, or
other course content.

The public `Concourse/main` snapshot remains the authority. The older local
branch is a source of tested behavior, not a tree to merge wholesale and not a
new source of truth.

## Context

The public 0.1 baseline validates and installs portable learning packs, retains
canonical installed-release bytes, and preserves a last known-good release.
It can render embedded and external learning resources, but it cannot yet let a
learner explicitly save a notebook, Python file, CSV file, Markdown document,
plain-text file, or YAML environment file stored inside an installed pack.

The local `codey/practical-ml-course` branch contains a complete pack-asset
capability implemented across seven commits:

1. `4a907a4` validates pack-asset resource declarations.
2. `99409c6` resolves canonical bytes from the active installed release.
3. `242cd17` adds browser delivery.
4. `faa814a` adds the explicit learner download flow.
5. `2512719` adds desktop destination selection.
6. `b3c4d89` adds bounded atomic native writes.
7. `307d4f1` completes product, security, and documentation coverage.

Those commits sit on pre-release history that no longer shares ancestry with
the orphan-root public 0.1 baseline. Blind cherry-picking or replacing the
public tree would risk losing release metadata, fictional-profile cleanup,
security copy, package versions, and other public hardening. The capability
will therefore be adapted in reviewable slices against current files and
interfaces.

## Goals

- Support a generic optional capability named
  `learning-resource.pack-asset@1`.
- Validate that every pack-asset resource points to one canonical manifest
  entry with role `asset`, a supported media type, and a safe basename.
- Resolve bytes only from the persisted active installed release immediately
  before delivery.
- Recheck pack identity, release identity, resource identity, canonical path,
  media type, byte count, stored SHA-256, and recalculated SHA-256.
- Deliver an immutable byte copy through a runtime-specific application port.
- Let browser learners explicitly download the verified file.
- Let desktop learners explicitly choose the destination before a bounded,
  atomic native write.
- Keep cancellation and delivery failures side-effect-free with respect to
  sessions, evidence, progress, engagement, active releases, and rollback
  releases.
- Preserve the current public baseline's product language, package versions,
  demo identity, privacy claims, and modular-monolith boundaries.
- Restore the existing focused contract, application, browser, product, desktop,
  and Rust test coverage.

## Non-Goals

- Publish or bundle the Practical Machine Learning course, notebooks, scripts,
  datasets, data cards, requirements files, or course generators.
- Execute, import, grade, preview as HTML, or automatically open any delivered
  asset.
- Add arbitrary file types, binaries, installers, office macros, JavaScript,
  HTML, shell scripts, or executable archives.
- Allow a pack to select an absolute path, directory, or final filesystem
  destination.
- Treat saving, cancelling, or failing to save an asset as learning evidence or
  resource engagement.
- Merge the old branch history into the orphan-root public history.
- Recover the separate dirty imported-route desktop work in this slice.
- Rename the `@learnt/*` compatibility packages, `.learntpack` format, or
  existing internal facade symbols.
- Repoint or delete the legacy `Learnt` remote.
- Expand the desktop packaging matrix beyond the current Windows target.

## Approaches Considered

### Selectively adapt the seven proven commits

Selected. This retains the already tested trust boundary and error cases while
letting every change be reconciled with the public 0.1 APIs and release polish.
It also allows the course-specific files to remain absent by construction.

### Reimplement from the accepted decision record

Rejected as the primary path. A clean-room implementation could produce tidy
history, but it would unnecessarily risk losing proven checks around corrupted
stored bytes, mismatched active releases, cancellation, immutable byte copies,
and atomic write failures. The decision record remains the architectural guide,
while the existing tests remain executable requirements.

### Transplant the Practical ML tree and delete course content afterward

Rejected. It would overwrite or regress current public files across contracts,
application code, UI copy, profile identity, package metadata, and release
documentation. Deleting the course directory would not reliably remove its
assumptions from the rest of the tree.

## Trust Boundary

Manifest validation plus resolution from the persisted active release is the
pack-asset trust boundary.

Install-time validation is necessary but insufficient because installed bytes
can later be missing, stale, or corrupted. The UI, browser adapter, desktop
adapter, and native writer must never decide which pack release is authoritative
or trust a resource declaration without re-resolution.

The application facade owns the command. It loads the installed runtime pack,
reads the persisted installed-pack snapshot, selects the active release, and
passes both to a pure resolution service. Only a fully verified immutable copy
may cross the `PackAssetDeliveryPort`.

```text
explicit learner save gesture
  -> Concourse application facade
  -> installed-pack state snapshot
  -> active canonical release
  -> resource and manifest reconciliation
  -> byte-count and SHA-256 verification
  -> immutable PackAssetSaveRequest
  -> browser or desktop delivery adapter
  -> saved or cancelled
```

No delivery adapter receives the installed pack, manifest, release record, or
storage authority. Adapters only receive a suggested basename, a closed media
type, and verified bytes.

## Contract Design

The contracts package will add `learning-resource.pack-asset` version `1` to
the supported capabilities list and expose these public types:

```ts
export type PackAssetMediaType =
  | 'application/x-ipynb+json'
  | 'text/x-python'
  | 'text/csv'
  | 'text/markdown'
  | 'text/plain'
  | 'application/yaml'

export interface PackAssetResourceSource {
  kind: 'pack-asset'
  assetId: string
  suggestedFileName: string
  mediaType: PackAssetMediaType
}
```

`PackAssetResourceSource` becomes one member of `LearningResourceSource`. Its
JSON schema is closed with `additionalProperties: false` and requires all four
fields.

Semantic validation accepts a pack-asset resource only when:

- the pack declares `learning-resource.pack-asset@1`;
- `assetId` resolves to exactly one manifest file entry;
- that manifest entry has role `asset`;
- the source media type exactly matches the manifest media type;
- the media type is in the version-1 allowlist above; and
- `suggestedFileName` is a safe basename without directory separators,
  traversal components, drive prefixes, control characters, or an unsupported
  extension.

The existing 10 MiB per-file learning-pack ceiling remains authoritative.
Pack-asset support does not expand archive, file-count, or uncompressed-size
limits.

The contract change is additive and optional. Existing packs without the
capability continue to validate and behave exactly as before. `SCHEMA_VERSION`
remains `0.1` because no existing required field or interpretation changes.

## Application Design

The application layer will expose:

```ts
export type DownloadLearningPackAssetInput = Readonly<{
  packId: string
  resourceId: string
}>

downloadLearningPackAsset(
  input: DownloadLearningPackAssetInput,
): Promise<'saved' | 'cancelled'>
```

The facade requires both an installed learning-pack store and a configured
`PackAssetDeliveryPort`. Missing runtime support produces
`pack-asset-delivery-unavailable` without reading or mutating learner state.

The resolver will:

1. Require the named installed pack and pack-asset resource.
2. Read the current installed-pack snapshot at command time.
3. Select the active installed release for the requested pack.
4. Require runtime pack version, active release version, manifest version, and
   pack IDs to agree.
5. Require the resource declaration in the active release to match the runtime
   resource's asset ID, media type, and suggested filename.
6. Resolve the manifest entry and canonical stored file by exact identifiers and
   path.
7. Require manifest byte count, stored byte count, stored SHA-256, and actual
   byte length to agree.
8. Recalculate SHA-256 over the stored bytes and require an exact match.
9. Return a new `Uint8Array` so downstream code cannot mutate canonical stored
   bytes.

Any mismatch after the runtime resource has been found produces
`pack-asset-integrity-failed` with pack, version, resource, and active-release
context suitable for normal UI error mapping. Integrity failures do not fall
back to another release and do not alter the active or rollback release.

The delivery boundary is:

```ts
export type PackAssetSaveRequest = Readonly<{
  suggestedFileName: string
  mediaType: PackAssetMediaType
  bytes: Uint8Array
}>

export type PackAssetSaveResult = 'saved' | 'cancelled'

export interface PackAssetDeliveryPort {
  save(request: PackAssetSaveRequest): Promise<PackAssetSaveResult>
}
```

## Browser Delivery

The browser composition root supplies `BrowserPackAssetDelivery`. It creates a
`Blob` from a defensive byte copy, creates an object URL, triggers one explicit
download using the validated suggested basename, and revokes the URL in a
`finally` block.

The browser adapter does not inspect manifests, write storage, mark completion,
or claim that the user retained the file after the browser accepted the
download gesture.

## Desktop Delivery

The desktop composition root supplies `TauriPackAssetDelivery`. It opens a save
dialog with the validated suggested basename and a media-type-specific extension
filter. Cancelling the dialog returns `cancelled` and does not invoke the native
writer.

When the learner chooses a destination, the adapter sends only that path and a
defensive byte copy to the `write_pack_asset` Tauri command. The native writer:

- rejects inputs larger than 10 MiB before writing;
- rejects directory destinations;
- accepts only `ipynb`, `py`, `csv`, `md`, `txt`, `yml`, and `yaml`,
  case-insensitively;
- writes through the existing atomic-file mechanism;
- preserves an existing destination if replacement fails; and
- cleans temporary siblings after failed writes.

The pack never supplies the destination path. The user-controlled save dialog
is the only source of destination authority.

## User Experience

The learning-resource screen recognizes `pack-asset` as a supported source and
shows an explicit download action. Notebook and Python assets include concise
copy telling learners that downloaded code should be inspected before local
execution, especially when it came from a third-party pack.

UI state distinguishes idle, saving, saved, cancelled, and failed outcomes.
Cancellation returns to a neutral state rather than displaying an error. A
failure uses the existing application-error mapping and leaves the action
retryable. The UI never renders the asset bytes or embeds code as HTML.

## Error and Recovery Behavior

- Unsupported or malformed declarations fail pack validation.
- A missing persisted active release fails before invoking delivery.
- Missing files, mismatched metadata, or changed bytes fail integrity checks.
- Browser object URLs are revoked even if triggering the download throws.
- Desktop cancellation is successful non-delivery, not an application error.
- Desktop write failure leaves no partial replacement and propagates a visible
  retryable error.
- No failure path records evidence, completion, engagement, or progress.
- No failure path changes installed release authority or deletes stored bytes.

## Migration Strategy

Implementation will start from `Concourse/main` on the isolated
`codey/concourse-pack-assets` branch. Each capability slice will use the old
commits and tests as reference while adapting code to the current baseline:

1. Contract types, schema, semantic validation, documentation, and tests.
2. Application resolver, port, facade command, errors, and tests.
3. Browser adapter, composition, UI action, copy, and product-flow tests.
4. Desktop dialog bridge, adapter, Tauri command, atomic writer, and Rust tests.
5. Cross-runtime security/product verification and public documentation.

The migration will not cherry-pick course commits, copy course directories, or
modify generated design exports. Each slice must leave the branch buildable and
must be committed separately after its focused and relevant broader gates pass.

## Verification Strategy

### Contract tests

- Accept all six allowed media types with matching manifest entries.
- Reject missing capability declarations, unknown assets, non-asset roles,
  media mismatches, unsafe basenames, traversal, unsupported extensions, and
  extra schema properties.
- Prove existing packs without pack assets still validate.

### Application tests

- Deliver byte-for-byte canonical bytes from the active release.
- Prove the returned and delivered arrays cannot mutate stored bytes.
- Reject missing active releases, pack/version mismatches, resource mismatches,
  manifest mismatches, stored-metadata mismatches, and recalculated hash
  mismatches.
- Prove saved, cancelled, and failed delivery do not change learner or release
  state.

### Browser and product tests

- Verify Blob media type, suggested filename, explicit click, and URL cleanup.
- Verify resource-screen copy and state for saved, cancelled, unavailable, and
  integrity-failed outcomes.
- Verify no asset bytes are rendered or executed.

### Desktop and Rust tests

- Verify every media type maps to the intended save-dialog filter.
- Verify cancellation skips the native command.
- Verify exact-byte writes, the 10 MiB boundary, extension enforcement,
  directory rejection, replacement-failure preservation, concurrent writes,
  and temporary-file cleanup.

### Repository gates

```text
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run build
cargo fmt --check --manifest-path src-tauri/Cargo.toml
cargo test --locked --manifest-path src-tauri/Cargo.toml
npm audit --omit=dev
```

The final review must also confirm that no files under
`content/practical-machine-learning/`, no Practical ML generated packs, no
datasets, and no course-specific scripts entered the branch.

## Acceptance Criteria

- A valid installed pack can declare one of the six supported downloadable
  asset types and expose it as a learning resource.
- Browser and desktop runtimes save only bytes freshly verified against the
  persisted active release.
- The learner explicitly initiates delivery and, on desktop, explicitly chooses
  the destination.
- Concourse never executes, previews, auto-opens, or auto-grades the file.
- Corruption, mismatched release state, unsupported types, unsafe names, and
  write failures are rejected without learner-state or release-state mutation.
- Existing packs and existing Concourse product flows remain compatible.
- All focused and repository verification gates pass.
- The branch contains no Practical ML course content or datasets.

## Follow-On Work

After this capability is reviewed and integrated, separate designs will cover:

1. recovery of the dirty imported-route desktop work;
2. the deliberate compatibility boundary between `Concourse` product naming
   and existing `Learnt` package/protocol names;
3. Windows, macOS, and Linux packaging plus install/sync/relaunch smoke tests;
4. final local remote repointing and archival treatment of `Conalh/Learnt`; and
5. licensing and repository-size review for the Practical ML course itself.
