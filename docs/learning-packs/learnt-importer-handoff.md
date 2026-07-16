# Learnt Learning Pack Importer Handoff

## Scope

Archive and unpacked-directory inputs are stateless sources. Both paths use
`@learnt/learning-pack-sdk` and return the same validated candidate containing
canonical files, canonical documents, and the SDK content hash.

Only `LearntApplication.installValidatedLearningPack(candidate)` changes
installed state. It applies the shared release lifecycle, rejects downgrades and
same-version content conflicts, retains at most one rollback release, writes the
configured store, and then updates runtime registration.

The importer does not write or rewrite source-controlled `SubjectPackage` files.
Canonical pack files and documents stay intact on the validated candidate and
runtime release.

Primary entry points:

- `loadLearningPackArchiveCandidate({ archiveFile })`
- `loadLearningPackDirectoryCandidate(directory)`
- `application.installValidatedLearningPack(candidate)`
- `installLearningPackDocuments(pack)`
- `registerInstalledLearningPack(registry, installedPack)`
- `createSubjectRegistry({ importedLearningPacks })`

## Validation And Storage

Source loading and installation are separate:

1. The SDK reads the archive or directory and validates structure, hashes,
   capabilities, and semantic integrity.
2. The source helper returns `{ contentHash, documents, files }` and performs no
   installed-state write.
3. `LearntApplication.installValidatedLearningPack` asks
   `planInstalledPackChange` for the only authoritative lifecycle decision.
4. Rejected and idempotent candidates do not write the store or replace runtime
   state.
5. Install and upgrade decisions are written through the configured browser or
   desktop store before runtime registration changes.

- Blocking diagnostics reject installation with `LearningPackInstallError`.
- `LearningPackInstallError.stage` identifies the source validation or runtime
  adaptation stage.
- `LearningPackInstallError.diagnostics` preserves the structured shared
  diagnostics array for user-facing error rendering.
- Unsupported required capabilities are blocking because the shared validator
  reports them as errors.
- Unsupported optional capabilities are preserved as warnings on
  `installedPack.warnings`.
- The canonical validated document set is cloned and deep-frozen at
  `installedPack.documents`.

The archive helper does not create legacy `releases`, `current`, or `rollback`
paths. Installed release records belong to the application store, and the
shared lifecycle keeps the previous active release in the record after a valid
upgrade.

The stored canonical content includes pack metadata, catalog, courses, items,
sets, resources, theme metadata, migrations, and file manifests exactly as
validated by the shared package. Learnt runtime adapters are derived views, not
the stored source of truth. The Learnt-side resource runtime is documented in
`docs/learning-packs/teaching-layer-integration.md`.

## Registration

`createSubjectRegistry()` still registers compiled production subjects first.
Callers validate the source, install through the application, and use the
application-composed registry:

```ts
const candidate = await loadLearningPackArchiveCandidate({ archiveFile })
const change = await application.installValidatedLearningPack(candidate)
```

An accepted change registers imported subject adapters beside production
adapters without modifying `src/subjects/index.ts` or the compiled production
catalog.

## ID Preservation

The importer preserves:

- `packId` as `installedPack.packId`
- `packVersion` as `installedPack.packVersion`
- subject IDs as runtime subject IDs
- course IDs on `installedPack.subjects[].courseIds`
- curriculum-node IDs as flattened runtime module IDs
- item IDs as runtime activity IDs

The canonical course and curriculum tree remains available on
`installedPack.documents.courses` and per subject at
`installedPack.subjects[].curriculumRootNodes`.

## Runtime Mapping

### Subjects

Each canonical `catalog.subjects[]` entry becomes one runtime `SubjectAdapter`.
The subject version is the pack manifest version. The runtime subject includes
the concepts, objectives, and items needed by that subject's courses.

Concept prerequisite and related-concept references are closed over so Learnt's
existing subject integrity checks can validate the in-memory subject.

### Courses And Curriculum

Learnt's current runtime model has modules, not generic courses, chapters,
lessons, and sections. For runtime presentation only:

- Each canonical curriculum node becomes one flattened Learnt module.
- `CurriculumNode.nodeId` becomes `ModuleDefinition.id`.
- Node title, summary, concept IDs, objective IDs, and item IDs are preserved on
  the runtime module where the current Learnt module contract can hold them.
- The canonical nested tree is not flattened in stored pack content.

Temporary UI lossiness:

- The existing UI initially sees a flat module list.
- Course grouping and parent-child nesting are not shown by the existing module
  navigator.
- Image and audio blocks are shown as text fallbacks in runtime activities.

The canonical installed pack remains non-lossy; these are presentation limits of
the current Learnt UI projection.

### Items To Activities

Each canonical `LearningItem` referenced by a subject course becomes a runtime
Learnt `ActivityDefinition`.

| Canonical field           | Runtime field                        |
| ------------------------- | ------------------------------------ |
| `itemId`                  | `activity.id`                        |
| owning curriculum node ID | `activity.moduleId`                  |
| `title`                   | `activity.title`                     |
| `promptBlocks`            | `activity.blocks` projection         |
| `conceptIds`              | `activity.conceptIds`                |
| `objectiveIds`            | `activity.objectiveIds`              |
| `allowedPlayModes`        | runtime activity kind/scaffold hints |

Runtime sequencing is derived from flattened authored curriculum order so
existing Learnt sessions can advance. The canonical pack does not gain
Learnt-specific `nextActivityIds`.

### Responses And Evaluations

Canonical response and evaluation definitions drive the runtime activity
contract:

| Canonical response/evaluation          | Runtime response/evaluation            |
| -------------------------------------- | -------------------------------------- |
| `none` + `manual-completion`           | no response + `manual-completion`      |
| `single-choice` + `choice-selection`   | `single-choice` + `choice-selection`   |
| `multiple-choice` + `choice-selection` | `multiple-choice` + `choice-selection` |
| `text` + `exact-text`                  | `text` + `exact-text`                  |
| `number` + `numerical-tolerance`       | `number` + `numerical-tolerance`       |
| `self-grade` + `self-grade`            | confidence self-grade response         |

Canonical self-grade content remains intact in `installedPack.documents.items`.
For native practice sessions, Learnt projects flashcard and self-grade-review
items into the existing confidence response control and records Again/Hard/Good/
Easy as private Learnt evidence. This keeps imported pack practice on the same
activity renderer, response controls, evaluator, recap, and persistence path as
native Learnt sessions instead of adding a second flat flashcard renderer.

## State Boundaries

Installed pack content never contains Learnt learner evidence or session state.
The importer does not read or write:

- learner IDs
- learner profiles
- sessions
- evidence events
- interaction modes
- presentation policy

Presentation policy continues to be derived by Learnt from the application-owned
profile and runtime activity semantics.

## Current Test Coverage

`src/learning-packs/learnt-importer.test.ts` uses the shared golden
`logic-foundations` pack and proves:

- stateless SDK archive and directory candidate loading
- canonical files, documents, and content identity on both source paths
- absence of legacy archive pointer authority
- shared lifecycle install, idempotent reinstall, upgrade, rollback retention,
  same-version conflict rejection, and downgrade rejection
- successful validation and canonical storage
- multiple subjects and courses in one pack
- nested curriculum preservation on the installed pack record
- production and imported subject registration side by side
- unsupported optional capability warnings
- unsupported required capability rejection
- runtime evaluation for flashcard/manual fallback, single-choice quiz,
  multiple-choice quiz, text recall, number recall, and manual reading
