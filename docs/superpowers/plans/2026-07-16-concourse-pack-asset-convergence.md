# Concourse Pack-Asset Convergence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore safe browser and desktop delivery of verified files embedded in installed learning packs without publishing the Practical ML course or weakening the Concourse 0.1 trust boundary.

**Architecture:** Add one optional `learning-resource.pack-asset@1` contract, resolve every requested file from the persisted active installed release inside the application facade, and pass only verified immutable bytes to runtime-specific delivery adapters. Browser delivery uses an explicit object-URL download; desktop delivery uses a learner-controlled save dialog followed by a bounded atomic Rust write.

**Tech Stack:** TypeScript 6, React 19, Vitest 4, JSON Schema/Ajv, Tauri 2, Rust 2021, npm workspaces.

## Global Constraints

- Start from `Concourse/main` commit `027f784bd942c0882def334b8c1553695f4e4c60` on `codey/concourse-pack-assets`.
- Preserve the public `Concourse` 0.1 product language, fictional demo identity, package versions, privacy claims, and modular-monolith dependency boundaries.
- Keep `SCHEMA_VERSION` at `0.1`; `learning-resource.pack-asset@1` is optional and additive.
- Allowed media types are exactly `application/x-ipynb+json`, `text/x-python`, `text/csv`, `text/markdown`, `text/plain`, and `application/yaml`.
- Allowed desktop filename extensions are exactly `ipynb`, `py`, `csv`, `md`, `txt`, `yml`, and `yaml`, compared case-insensitively.
- Keep the authoritative per-file ceiling at 10 MiB.
- Never execute, preview as HTML, import, grade, or automatically open delivered assets.
- Never let pack metadata choose an absolute path, directory, or final filesystem destination.
- Saving, cancellation, and failure must not create evidence, engagement, progress, or installed-release mutations.
- Do not add files under `content/practical-machine-learning/`, Practical ML generated packs, datasets, notebooks, course requirements, or course build scripts.
- Do not modify generated files under `docs/design/`.
- Use the local `codey/practical-ml-course` commits `4a907a4` through `307d4f1` only as tested source references; do not merge or transplant that branch.
- Each task ends with a green focused gate and one atomic commit.

---

## File Responsibility Map

- `packages/learning-pack-contracts/src/{constants,schemas,types,semantic-validation,index}.ts`: public pack-asset contract and validation authority.
- `packages/learning-pack-contracts/test/learning-pack-contracts.test.ts`: structural and semantic contract proof.
- `src/application/pack-asset-runtime.ts`: active-release identity, metadata, byte-count, and SHA-256 verification.
- `src/learning-packs/pack-asset-delivery-port.ts`: runtime-neutral save request/result boundary.
- `src/application/learnt-application*.ts`: application command, dependencies, public input/result types, and error mapping.
- `src/infrastructure/learning-packs/browser-pack-asset-delivery.ts`: browser object-URL delivery mechanism.
- `src/ui/hooks/use-learning-resource.ts` and `src/ui/screens/LearningResourceScreen.tsx`: explicit learner action and visible command states.
- `src/infrastructure/desktop/tauri-pack-asset-delivery.ts`: desktop save-dialog and write orchestration.
- `src/infrastructure/desktop/tauri-runtime-bridge.ts`: media-type-specific Tauri dialog options.
- `src-tauri/src/atomic_file.rs`: reusable atomic byte replacement.
- `src-tauri/src/pack_asset.rs`: native size, extension, and destination validation.
- `docs/decisions/0014-pack-asset-delivery-boundary.md` and learning-pack guides: permanent trust-boundary and authoring guidance.

---

### Task 1: Add the optional pack-asset contract

**Files:**

- Modify: `packages/learning-pack-contracts/src/constants.ts:3-17`
- Modify: `packages/learning-pack-contracts/src/schemas.ts:711-797`
- Modify: `packages/learning-pack-contracts/src/types.ts:13-25,374-493`
- Modify: `packages/learning-pack-contracts/src/semantic-validation.ts:1373-1500`
- Modify: `packages/learning-pack-contracts/src/index.ts:1-190`
- Test: `packages/learning-pack-contracts/test/learning-pack-contracts.test.ts:376-465`

**Interfaces:**

- Consumes: existing `LearningPackManifest.files`, `LearningResourceSource`, resource schema, and semantic diagnostic helpers.
- Produces: `PackAssetMediaType`, `PackAssetResourceSource`, the `pack-asset` source discriminator, and support for `learning-resource.pack-asset@1`.

- [ ] **Step 1: Add failing contract tests**

Add a helper that augments `withTeachingResources()` with one manifest asset and one resource:

```ts
function withPackAssetResource() {
  const pack = withTeachingResources()
  pack.manifest.capabilities.required.push({
    capabilityId: 'learning-resource.pack-asset',
    version: '1',
  })
  pack.manifest.files.push({
    assetId: 'asset.lab-notebook',
    path: 'assets/lab.ipynb',
    role: 'asset',
    mediaType: 'application/x-ipynb+json',
    sha256: '0'.repeat(64),
    bytes: 2,
  })
  pack.resources!.resources.push({
    id: 'resource.lab-notebook',
    contentRevision: 1,
    title: 'Lab notebook',
    modality: 'interactive',
    roles: ['demonstration'],
    source: {
      kind: 'pack-asset',
      assetId: 'asset.lab-notebook',
      suggestedFileName: 'lab.ipynb',
      mediaType: 'application/x-ipynb+json',
    },
  })
  return pack
}
```

Add tests that accept the helper and each of the six allowed media types. Add separate tests that reject a missing capability declaration, missing asset, manifest role other than `asset`, media mismatch, `../lab.ipynb`, `folder/lab.ipynb`, `C:\\lab.ipynb`, `lab.html`, and an extra source property.

- [ ] **Step 2: Run the contract tests and verify RED**

Run:

```powershell
npm.cmd --workspace=@learnt/learning-pack-contracts test
```

Expected: FAIL because `pack-asset` is not accepted by the resource schema and the capability is unsupported.

- [ ] **Step 3: Add the contract types and schema**

Add exactly these public types and include `PackAssetResourceSource` in `LearningResourceSource`:

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

Add `{ capabilityId: 'learning-resource.pack-asset', version: '1' }` to `SUPPORTED_CAPABILITIES`. Add a closed JSON-schema branch requiring `kind`, `assetId`, `suggestedFileName`, and `mediaType`, with the six-value media enum.

- [ ] **Step 4: Add semantic pack-asset validation**

Define immutable allowlists and validate the source against the manifest index:

```ts
const packAssetMediaTypes = new Set<PackAssetMediaType>([
  'application/x-ipynb+json',
  'text/x-python',
  'text/csv',
  'text/markdown',
  'text/plain',
  'application/yaml',
])

const packAssetExtensions = new Map<PackAssetMediaType, readonly string[]>([
  ['application/x-ipynb+json', ['ipynb']],
  ['text/x-python', ['py']],
  ['text/csv', ['csv']],
  ['text/markdown', ['md']],
  ['text/plain', ['txt']],
  ['application/yaml', ['yml', 'yaml']],
])
```

Require a single manifest match, `role === 'asset'`, exact media equality, a basename equal to its normalized basename, no slash or backslash, and an extension permitted for the declared media type. Emit the existing diagnostic shape with precise paths under `resources.json`.

- [ ] **Step 5: Export the new contract and run GREEN**

Export `PackAssetMediaType` and `PackAssetResourceSource` from `src/index.ts`, then run:

```powershell
npm.cmd --workspace=@learnt/learning-pack-contracts run typecheck
npm.cmd --workspace=@learnt/learning-pack-contracts test
npm.cmd --workspace=@learnt/learning-pack-contracts run build
```

Expected: all contract tests pass, type checking succeeds, and package build exits 0.

- [ ] **Step 6: Commit the contract slice**

```powershell
git add packages/learning-pack-contracts/src packages/learning-pack-contracts/test/learning-pack-contracts.test.ts
git diff --staged --check
git commit -m "feat: validate learning pack assets"
```

---

### Task 2: Resolve canonical pack-asset bytes in the application

**Files:**

- Create: `src/learning-packs/pack-asset-delivery-port.ts`
- Create: `src/application/pack-asset-runtime.ts`
- Create: `src/application/pack-asset-runtime.test.ts`
- Create: `src/test/pack-asset-fixture.ts`
- Modify: `src/application/learning-application-error.ts:1-10`
- Modify: `src/application/learnt-application.types.ts:73-92,400-440`
- Modify: `src/application/learnt-application.ts:1-285`
- Modify: `src/application/index.ts:1-35`
- Modify: `src/application/learning-resource-runtime.ts:45-75`
- Test: `src/application/learnt-application.test.ts`
- Test: `src/application/learning-resource-runtime.test.ts`

**Interfaces:**

- Consumes: Task 1's `PackAssetMediaType`, `InstalledLearningPack`, `InstalledLearningPackRelease`, `activeInstalledLearningPackRelease()`, and `sha256Hex()` from the SDK browser entry.
- Produces: `resolvePackAssetDownload()`, `PackAssetDeliveryPort`, `PackAssetSaveRequest`, `PackAssetSaveResult`, `DownloadLearningPackAssetInput`, and `LearntApplication.downloadLearningPackAsset()`.

- [ ] **Step 1: Add failing resolver and facade tests**

Build a deterministic fixture with a canonical `Uint8Array` and matching SHA-256. Add a resolver test asserting exact bytes and defensive copying:

```ts
const download = await resolvePackAssetDownload({
  installedPack: fixture.installedPack,
  activeRelease: fixture.activeRelease,
  resourceId: fixture.resourceId,
})

expect(download).toMatchObject({
  suggestedFileName: 'lab.ipynb',
  mediaType: 'application/x-ipynb+json',
})
expect(download.bytes).toEqual(fixture.bytes)
download.bytes[0] = 255
expect(fixture.activeRelease.files[0]?.bytes[0]).not.toBe(255)
```

Add one test per integrity mismatch: absent active release, pack version, manifest pack ID, active resource declaration, manifest role/media, missing stored file, stored size, stored hash, and recalculated hash. Add facade tests proving `saved` and `cancelled` are returned unchanged and that the delivery port is never called on integrity failure.

- [ ] **Step 2: Run the application tests and verify RED**

Run:

```powershell
npx.cmd vitest run src/application/pack-asset-runtime.test.ts src/application/learnt-application.test.ts src/application/learning-resource-runtime.test.ts
```

Expected: FAIL because the new runtime, port, error codes, and facade command do not exist.

- [ ] **Step 3: Add the runtime-neutral delivery port**

Create:

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

Add optional `packAssetDelivery?: PackAssetDeliveryPort` to `LearntApplicationDependencies` and export the interface and result types through `src/application/index.ts`.

- [ ] **Step 4: Implement active-release resolution**

Implement `resolvePackAssetDownload()` in the order specified by the approved design. Every mismatch after locating the runtime resource must throw:

```ts
new LearningApplicationError('pack-asset-integrity-failed', message, {
  details: {
    packId: input.installedPack.packId,
    packVersion: input.installedPack.packVersion,
    resourceId: input.resourceId,
    activeReleaseId: input.activeRelease.releaseId,
  },
})
```

Return `bytes: new Uint8Array(file.bytes)` only after recalculated SHA-256 equals the manifest SHA-256.

- [ ] **Step 5: Add the facade command and error codes**

Add `pack-asset-delivery-unavailable` and `pack-asset-integrity-failed` to `LearningApplicationErrorCode`. Implement:

```ts
async downloadLearningPackAsset(
  input: DownloadLearningPackAssetInput,
): Promise<PackAssetSaveResult> {
  const delivery = this.dependencies.packAssetDelivery
  const store = this.dependencies.installedLearningPackStore
  if (delivery === undefined || store === undefined) {
    throw new LearningApplicationError(
      'pack-asset-delivery-unavailable',
      'Pack asset delivery is not configured for this runtime.',
      { details: { packId: input.packId, resourceId: input.resourceId } },
    )
  }

  const installedPack = requireInstalledPack(
    this.getInstalledLearningPacks(),
    input.packId,
  )
  const snapshot = await store.readSnapshot()
  const record = snapshot.records.find(
    (candidate) => candidate.packId === input.packId,
  )
  const activeRelease =
    record === undefined ? null : activeInstalledLearningPackRelease(record)
  if (activeRelease === null) {
    throw new LearningApplicationError(
      'pack-asset-integrity-failed',
      'The installed pack has no persisted active release for asset delivery.',
      { details: { packId: input.packId, resourceId: input.resourceId } },
    )
  }

  return delivery.save(
    await resolvePackAssetDownload({
      installedPack,
      activeRelease,
      resourceId: input.resourceId,
    }),
  )
}
```

Recognize `pack-asset` as a supported learning-resource source kind without recording save actions as engagement.

- [ ] **Step 6: Run GREEN and commit**

Run:

```powershell
npx.cmd vitest run src/application/pack-asset-runtime.test.ts src/application/learnt-application.test.ts src/application/learning-resource-runtime.test.ts
npm.cmd run typecheck
```

Expected: all focused tests pass and type checking exits 0.

Then commit:

```powershell
git add src/application src/learning-packs/pack-asset-delivery-port.ts src/test/pack-asset-fixture.ts
git diff --staged --check
git commit -m "feat: resolve verified pack asset bytes"
```

---

### Task 3: Deliver verified assets in the browser runtime

**Files:**

- Create: `src/infrastructure/learning-packs/browser-pack-asset-delivery.ts`
- Create: `src/infrastructure/learning-packs/browser-pack-asset-delivery.test.ts`
- Modify: `src/infrastructure/index.ts`
- Modify: `src/app/composition-root.ts:1-125`
- Test: `src/app/composition-root.test.ts`

**Interfaces:**

- Consumes: Task 2's `PackAssetDeliveryPort`, `PackAssetSaveRequest`, and browser composition root.
- Produces: `BrowserPackAssetDelivery` and a browser application configured with pack-asset delivery.

- [ ] **Step 1: Add a failing browser adapter test**

Use an injected host and assert the full observable sequence:

```ts
const calls: string[] = []
const delivery = new BrowserPackAssetDelivery({
  createObjectUrl(blob) {
    calls.push(`create:${blob.type}:${blob.size}`)
    return 'blob:verified-asset'
  },
  clickDownload(url, fileName) {
    calls.push(`click:${url}:${fileName}`)
  },
  revokeObjectUrl(url) {
    calls.push(`revoke:${url}`)
  },
})

await expect(
  delivery.save({
    suggestedFileName: 'lab.ipynb',
    mediaType: 'application/x-ipynb+json',
    bytes: new Uint8Array([1, 2, 3]),
  }),
).resolves.toBe('saved')
expect(calls).toEqual([
  'create:application/x-ipynb+json:3',
  'click:blob:verified-asset:lab.ipynb',
  'revoke:blob:verified-asset',
])
```

Add a second test where `clickDownload` throws and verify `revokeObjectUrl` still runs.

- [ ] **Step 2: Run the browser tests and verify RED**

Run:

```powershell
npx.cmd vitest run src/infrastructure/learning-packs/browser-pack-asset-delivery.test.ts src/app/composition-root.test.ts
```

Expected: FAIL because `BrowserPackAssetDelivery` is missing and the composition root does not configure the port.

- [ ] **Step 3: Implement browser delivery**

Create an injected `BrowserDownloadHost`, build a `Blob` from `new Uint8Array(request.bytes)`, call `URL.createObjectURL`, trigger one anchor download using `anchor.download`, and revoke the URL in `finally`. Return `'saved'` only after the click is triggered.

Export the adapter from `src/infrastructure/index.ts` and construct it as `packAssetDelivery` in `createBrowserLearntApplication()`.

- [ ] **Step 4: Run GREEN and commit**

Run:

```powershell
npx.cmd vitest run src/infrastructure/learning-packs/browser-pack-asset-delivery.test.ts src/app/composition-root.test.ts
npm.cmd run typecheck
```

Expected: focused tests and type checking pass.

Then commit:

```powershell
git add src/infrastructure src/app/composition-root.ts src/app/composition-root.test.ts
git diff --staged --check
git commit -m "feat: deliver pack assets in browsers"
```

---

### Task 4: Add the explicit learner download flow

**Files:**

- Modify: `src/ui/app/learnt-application-client.ts`
- Modify: `src/ui/app/LearntApplicationProvider.test.tsx`
- Modify: `src/ui/hooks/use-learning-resource.ts`
- Modify: `src/ui/screens/LearningResourceScreen.tsx`
- Modify: `src/ui/errors/map-application-error.ts`
- Create: `src/ui/screens/LearningResourcePackAsset.test.tsx`
- Create: `src/ui/app/PackAssetDelivery.product.test.tsx`

**Interfaces:**

- Consumes: Task 2's facade command and result types, existing `LearningResourceTeachingContext`, UI error mapping, and application context.
- Produces: `PackAssetDownloadState`, `downloadAsset()`, explicit save/cancel/error UI, and end-to-end product proof.

- [ ] **Step 1: Add failing hook and screen tests**

Test a pack-asset screen with a mocked application command:

```ts
const user = userEvent.setup()
renderPackAssetResource({
  downloadLearningPackAsset: vi.fn().mockResolvedValue('saved'),
})

expect(
  screen.getByRole('button', { name: /download lab\.ipynb/i }),
).toBeEnabled()
await user.click(screen.getByRole('button', { name: /download lab\.ipynb/i }))
expect(await screen.findByText(/saved/i)).toBeInTheDocument()
```

Add separate cases for `'cancelled'`, `pack-asset-delivery-unavailable`, `pack-asset-integrity-failed`, and a Python/notebook warning that tells the learner to inspect code before running it. Assert that no asset bytes or HTML preview are rendered.

- [ ] **Step 2: Run the UI tests and verify RED**

Run:

```powershell
npx.cmd vitest run src/ui/screens/LearningResourcePackAsset.test.tsx src/ui/app/PackAssetDelivery.product.test.tsx src/ui/app/LearntApplicationProvider.test.tsx
```

Expected: FAIL because the client, hook command state, pack-asset branch, and error mappings are missing.

- [ ] **Step 3: Add the hook state and application client method**

Add:

```ts
export type PackAssetDownloadState =
  | { status: 'idle' }
  | { status: 'pending' }
  | { status: 'saved' }
  | { status: 'cancelled' }
  | { status: 'error'; error: UiError }
```

Expose `downloadLearningPackAsset()` from the application client. Implement `downloadAsset()` in `useLearningResource()` so it sets `pending`, maps the returned result directly to `saved` or `cancelled`, maps thrown errors to `error`, and never calls `recordResourceEngagement()`.

- [ ] **Step 4: Render the explicit pack-asset action**

Add a `pack-asset` branch to `LearningResourceScreen` that renders:

- a “Downloadable learning-pack file” heading;
- the validated suggested filename and media type;
- one explicit download button disabled only while pending;
- neutral cancellation copy;
- success copy that does not claim the file exists after browser handling;
- mapped retryable error copy; and
- a code-inspection warning for notebook and Python media types.

Add stable labels for `pack-asset` to `sourceKindLabel()` and map both new application error codes in `map-application-error.ts`.

- [ ] **Step 5: Run GREEN and commit**

Run:

```powershell
npx.cmd vitest run src/ui/screens/LearningResourcePackAsset.test.tsx src/ui/app/PackAssetDelivery.product.test.tsx src/ui/app/LearntApplicationProvider.test.tsx
npm.cmd run typecheck
```

Expected: all focused tests pass and type checking exits 0.

Then commit:

```powershell
git add src/ui
git diff --staged --check
git commit -m "feat: expose verified pack asset downloads"
```

---

### Task 5: Add desktop destination selection and adapter wiring

**Files:**

- Create: `src/infrastructure/desktop/tauri-pack-asset-delivery.ts`
- Create: `src/infrastructure/desktop/tauri-pack-asset-delivery.test.ts`
- Modify: `src/infrastructure/desktop/tauri-desktop-bridge.ts`
- Modify: `src/infrastructure/desktop/tauri-desktop-bridge.test.ts`
- Modify: `src/infrastructure/desktop/tauri-runtime-bridge.ts`
- Modify: `src/infrastructure/desktop/tauri-runtime-bridge.test.ts`
- Modify: `src/app/desktop-composition-root.ts`
- Modify: `src/app/desktop-composition-root.test.ts`
- Modify: `src/app/tauri-desktop-application.ts`
- Modify: `src/app/tauri-desktop-application.test.ts`
- Modify: `src/main.tsx`
- Modify: `src-tauri/capabilities/default.json`

**Interfaces:**

- Consumes: Task 2's delivery port, existing `TauriDesktopBridge`, Tauri dialog plugin, and `invoke()` dependency.
- Produces: `TauriPackAssetDelivery`, media-specific save-dialog options, and desktop composition configured with the adapter.

- [ ] **Step 1: Add failing desktop adapter and dialog tests**

Test cancellation and exact write forwarding:

```ts
const bridge = {
  choosePackAssetDestination: vi.fn().mockResolvedValue('C:\\Labs\\lab.ipynb'),
  writePackAsset: vi.fn().mockResolvedValue(undefined),
}
const delivery = new TauriPackAssetDelivery(bridge)

await expect(
  delivery.save({
    suggestedFileName: 'lab.ipynb',
    mediaType: 'application/x-ipynb+json',
    bytes: new Uint8Array([1, 2, 3]),
  }),
).resolves.toBe('saved')
expect(bridge.writePackAsset).toHaveBeenCalledWith(
  'C:\\Labs\\lab.ipynb',
  new Uint8Array([1, 2, 3]),
)
```

For cancellation, return `null` and assert `writePackAsset` is not called. Add table-driven dialog tests for all six media types and their exact extension filters.

- [ ] **Step 2: Run desktop TypeScript tests and verify RED**

Run:

```powershell
npx.cmd vitest run src/infrastructure/desktop/tauri-pack-asset-delivery.test.ts src/infrastructure/desktop/tauri-runtime-bridge.test.ts src/infrastructure/desktop/tauri-desktop-bridge.test.ts src/app/desktop-composition-root.test.ts src/app/tauri-desktop-application.test.ts
```

Expected: FAIL because the desktop adapter methods and wiring do not exist.

- [ ] **Step 3: Implement the desktop adapter and bridge methods**

Define `TauriPackAssetDeliveryBridge` with:

```ts
choosePackAssetDestination(input: Readonly<{
  suggestedFileName: string
  mediaType: string
}>): Promise<string | null>

writePackAsset(destinationPath: string, bytes: Uint8Array): Promise<void>
```

Implement `TauriPackAssetDelivery.save()` so cancellation returns `'cancelled'`; otherwise forward a defensive byte copy and return `'saved'` only after the native command resolves.

Extend `TauriDesktopBridge` and `createTauriRuntimeBridge()` to forward `write_pack_asset` with `{ destinationPath, bytes: Array.from(bytes) }` and to create exact save-dialog filters:

```ts
new Map([
  [
    'application/x-ipynb+json',
    { name: 'Jupyter Notebook', extensions: ['ipynb'] },
  ],
  ['text/x-python', { name: 'Python source', extensions: ['py'] }],
  ['text/csv', { name: 'CSV data', extensions: ['csv'] }],
  ['text/markdown', { name: 'Markdown', extensions: ['md'] }],
  ['text/plain', { name: 'Text', extensions: ['txt'] }],
  ['application/yaml', { name: 'YAML', extensions: ['yml', 'yaml'] }],
])
```

- [ ] **Step 4: Wire desktop composition and capabilities**

Construct `TauriPackAssetDelivery` in the desktop composition root, pass the dialog dependency from `src/main.tsx`, and add the minimum Tauri permission required by the existing dialog plugin. Do not add broad filesystem permissions; native writing remains confined to the explicit `write_pack_asset` command.

- [ ] **Step 5: Run GREEN and commit**

Run:

```powershell
npx.cmd vitest run src/infrastructure/desktop/tauri-pack-asset-delivery.test.ts src/infrastructure/desktop/tauri-runtime-bridge.test.ts src/infrastructure/desktop/tauri-desktop-bridge.test.ts src/app/desktop-composition-root.test.ts src/app/tauri-desktop-application.test.ts
npm.cmd run typecheck
```

Expected: focused tests and type checking pass.

Then commit:

```powershell
git add src/infrastructure/desktop src/app src/main.tsx src-tauri/capabilities/default.json
git diff --staged --check
git commit -m "feat: request pack asset destinations on desktop"
```

---

### Task 6: Write pack assets atomically in Rust

**Files:**

- Create: `src-tauri/src/atomic_file.rs`
- Create: `src-tauri/src/pack_asset.rs`
- Modify: `src-tauri/src/atomic_json.rs`
- Modify: `src-tauri/src/lib.rs:1-80,600-660`

**Interfaces:**

- Consumes: Task 5's `write_pack_asset` invoke contract and the current atomic JSON replacement behavior.
- Produces: `atomic_file::write_file_atomically()`, `pack_asset::write_validated_pack_asset()`, and the registered Tauri `write_pack_asset` command.

- [ ] **Step 1: Add failing Rust tests before registering the command**

Create module tests that prove exact-byte writes, 10 MiB acceptance, 10 MiB plus one rejection without changing an existing destination, rejection of `unsafe.html`, `installer.exe`, and extensionless paths, case-insensitive acceptance of all seven extensions, and directory rejection.

Add atomic-file tests that preserve the previous destination on replacement failure, produce unique temporary sibling names under concurrent writes, and remove temporary files after failures.

- [ ] **Step 2: Run Rust tests and verify RED**

Run:

```powershell
cargo test --locked --manifest-path src-tauri/Cargo.toml pack_asset
```

Expected: FAIL because `pack_asset` and `atomic_file` modules do not exist.

- [ ] **Step 3: Extract reusable atomic byte writing**

Move the current atomic replacement mechanics from `atomic_json.rs` into:

```rust
pub(crate) fn write_file_atomically(destination: &Path, bytes: &[u8]) -> io::Result<()> {
    // create the parent directory, write a unique sibling, flush it,
    // replace the destination without deleting the known-good file first,
    // and remove the sibling on every failure path
}
```

Keep JSON serialization in `atomic_json::write_json_file()` and delegate only its final byte write to `write_file_atomically()`. Existing installed-record behavior and tests must remain unchanged.

- [ ] **Step 4: Implement bounded pack-asset writing**

Create:

```rust
pub const MAX_PACK_ASSET_BYTES: usize = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS: [&str; 7] =
    ["ipynb", "py", "csv", "md", "txt", "yml", "yaml"];

pub fn write_validated_pack_asset(destination: &Path, bytes: &[u8]) -> io::Result<()> {
    if bytes.len() > MAX_PACK_ASSET_BYTES {
        return Err(io::Error::other("pack asset exceeds 10 MiB"));
    }
    if destination.is_dir() {
        return Err(io::Error::other(
            "pack asset destination must be a regular file",
        ));
    }
    let extension = destination
        .extension()
        .and_then(|value| value.to_str())
        .map(str::to_ascii_lowercase)
        .filter(|value| ALLOWED_EXTENSIONS.contains(&value.as_str()))
        .ok_or_else(|| {
            io::Error::other("pack asset destination extension is not allowed")
        })?;
    debug_assert!(ALLOWED_EXTENSIONS.contains(&extension.as_str()));
    crate::atomic_file::write_file_atomically(destination, bytes)
}
```

Register `write_pack_asset(destination_path: String, bytes: Vec<u8>)` in `lib.rs` and map native I/O errors to strings without exposing unrelated paths or state.

- [ ] **Step 5: Run GREEN and commit**

Run:

```powershell
cargo fmt --check --manifest-path src-tauri/Cargo.toml
cargo test --locked --manifest-path src-tauri/Cargo.toml
```

Expected: all existing and new Rust tests pass.

Then commit:

```powershell
git add src-tauri/src
git diff --staged --check
git commit -m "feat: write pack assets atomically"
```

---

### Task 7: Document, audit, and verify the complete capability

**Files:**

- Create: `docs/decisions/0014-pack-asset-delivery-boundary.md`
- Modify: `docs/learning-packs/agent-course-authoring-guide.md`
- Modify: `packages/learning-pack-contracts/docs/resource-authoring-guide.md`
- Modify: `packages/learning-pack-contracts/docs/resource-security-model.md`
- Modify: `README.md`
- Modify: `CHANGELOG.md`

**Interfaces:**

- Consumes: the completed Tasks 1-6 behavior and approved design spec.
- Produces: durable architectural guidance, truthful public capability wording, and final verification evidence.

- [ ] **Step 1: Add the accepted decision record and author guidance**

Record that manifest validation plus active-release resolution is the trust boundary; adapters are delivery mechanisms rather than trust authorities; the pack cannot choose a destination; and no layer executes or previews delivered content.

Document this exact author-facing declaration:

```json
{
  "kind": "pack-asset",
  "assetId": "asset.lab-notebook",
  "suggestedFileName": "lab.ipynb",
  "mediaType": "application/x-ipynb+json"
}
```

List the six allowed media types, their filename extensions, the 10 MiB ceiling, explicit save behavior, and the warning that integrity does not establish that third-party code is benevolent.

- [ ] **Step 2: Update public release surfaces truthfully**

Replace `_Nothing yet._` under `CHANGELOG.md`'s Unreleased section with an Added bullet for explicit browser and desktop delivery of verified installed-pack assets. Add one README capability bullet that states files are verified against the active installed release before explicit learner download; do not mention or imply that Practical ML ships publicly.

- [ ] **Step 3: Run formatting and documentation checks**

Run:

```powershell
npx.cmd prettier --check docs/decisions/0014-pack-asset-delivery-boundary.md docs/learning-packs/agent-course-authoring-guide.md packages/learning-pack-contracts/docs/resource-authoring-guide.md packages/learning-pack-contracts/docs/resource-security-model.md README.md CHANGELOG.md
git diff --check
```

Expected: Prettier and diff checks pass.

- [ ] **Step 4: Run the full repository gate**

Run exactly once after the final code or documentation change:

```powershell
npm.cmd run verify
npm.cmd audit --omit=dev
cargo fmt --check --manifest-path src-tauri/Cargo.toml
cargo test --locked --manifest-path src-tauri/Cargo.toml
```

Expected: formatting, lint, package tests, application/UI tests, type checking, browser build, dependency audit, Rust formatting, and all Rust tests pass. Record the actual TypeScript and Rust test counts in the final handoff.

- [ ] **Step 5: Prove Practical ML content stayed out of the branch**

Run:

```powershell
git diff --name-only concourse/main...HEAD | rg "practical-machine-learning|build-practical-machine-learning|verify-practical-ml|\.ipynb$|penguins\.csv|wine-quality|bike-sharing"
```

Expected: no output and `rg` exit code 1. Also inspect `git diff --stat concourse/main...HEAD` and confirm every file belongs to the capability, tests, spec, plan, or public documentation.

- [ ] **Step 6: Commit the documentation slice**

```powershell
git add docs/decisions/0014-pack-asset-delivery-boundary.md docs/learning-packs/agent-course-authoring-guide.md packages/learning-pack-contracts/docs/resource-authoring-guide.md packages/learning-pack-contracts/docs/resource-security-model.md README.md CHANGELOG.md
git diff --staged --check
git commit -m "docs: document safe pack asset delivery"
```

- [ ] **Step 7: Inspect final branch state**

Run:

```powershell
git status --short --branch
git log --oneline --decorate concourse/main..HEAD
git diff --stat concourse/main...HEAD
```

Expected: clean worktree, a short sequence of scoped commits, and no unrelated files.
