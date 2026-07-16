# Learning Pack Contract Reference

Version 0.1 is implemented by the framework-independent TypeScript package:

```ts
import {
  validateLearningPackDocuments,
  validateResourceEngagementEvent,
  publicJsonSchemas,
  type LearningPackManifest,
  type LearningPackDocuments,
  type LearningResource
} from "@learnt/learning-pack-contracts";
```

Consumers should import public types from this package. Do not duplicate
contract interfaces in Learnt, Flashcards, or authoring tools.

## Public Types

The entry point exports these primary contract types:

- `LearningPackManifest`
- `Subject`
- `Concept`
- `Objective`
- `Course`
- `CurriculumNode`
- `CurriculumEntry`
- `LearningItem`
- `LearningResource`
- `ResourceSegment`
- `ResourceLink`
- `StudySet`
- `ThemeMetadata`
- `CapabilityDeclaration`
- `PackMigration`
- `ReviewEvent`
- `ResourceEngagementEvent`
- `LearningEvidenceEvent`
- `ReviewEventResponseSummary`
- `ReviewEventPrivacyMetadata`

It also exports supporting document types such as `CatalogDocument`,
`CoursesDocument`, `ItemsDocument`, `ResourcesDocument`, `SetsDocument`,
`MigrationsDocument`, and `LearningPackDocuments`.

## Canonical Schemas

Canonical JSON Schemas are exported as constants:

- `packManifestSchema`
- `catalogSchema`
- `coursesSchema`
- `itemsSchema`
- `setsSchema`
- `resourcesSchema`
- `themeSchema`
- `migrationsSchema`
- `reviewEventSchema`
- `resourceEngagementEventSchema`
- `publicJsonSchemas`

Each schema targets Learning Pack Contract `schemaVersion: "0.1"`.

## Validation APIs

Use `validateJsonFile(kind, value)` to validate one public JSON document:

```ts
const result = validateJsonFile("items", itemsJson);
```

Use `validateLearningPackDocuments(pack)` after archive extraction or file
loading has already happened in application code:

```ts
const result = validateLearningPackDocuments({
  manifest,
  catalog,
  courses,
  items,
  sets,
  resources,
  theme,
  migrations
});

if (!result.ok) {
  for (const diagnostic of result.diagnostics) {
    console.log(diagnostic.code, diagnostic.path, diagnostic.message);
  }
}
```

This package does not extract `.learntpack` archives. It validates the JSON
documents and semantic relationships supplied by the caller.

Use `validateReviewEvent(event, { pack })` for private learner evidence. The
`pack` option is optional, but when present it verifies pack identity,
item/revision identity, play mode, subject/course context, selected option IDs,
and confusion target IDs:

```ts
const result = validateReviewEvent(reviewEvent, { pack });
```

Use `validateResourceEngagementEvent(event, { pack })` for private resource
engagement evidence. When a pack is supplied, the validator verifies pack
identity, resource identity, `contentRevision`, and segment identity:

```ts
const result = validateResourceEngagementEvent(resourceEvent, { pack });
```

`ReviewEvent` is never part of a public pack archive. It is app-owned learner
data used to transport learning evidence; each consuming application derives
its own mastery and scheduling state.

`ResourceEngagementEvent` follows the same boundary: it is private learner
evidence outside `.learntpack` archives. It records resource reading/watching
or completion evidence only; it does not define a shared scheduler or analytics
model.

## Diagnostics

Validators return `LearningPackDiagnostic` objects:

```ts
{
  code: "MISSING_REFERENCE",
  severity: "error",
  path: "items.json.items[0].conceptIds[0]",
  message: "Missing concept reference: missing-concept."
}
```

The exported `LearningPackErrorCode` constants are stable app-facing codes for
UI copy, logs, and import reports.

## Helpers

The entry point exports helpers for common app adapter work:

- `isValidPackId`
- `isValidLocalEntityId`
- `makeGlobalEntityKey`
- `parseGlobalEntityKey`
- `makeVersionedItemKey`
- `createResourceGlobalKey`
- `checkCapabilities`
- `hasCapability`
- `compareLearningRevision`
- `compareResourceRevisions`
- `canPreserveMasteryAcrossRevision`
- `planPackUpdate`
- `planResourceUpdate`
- `isValidAssetPath`

Use `planResourceUpdate` when an app has stored resource completion or
engagement-derived state and a newer pack changes `contentRevision`.

## Resources

`resources.json` is optional. Practice-only packs remain valid without it. When
present, it contains `LearningResource` records for readings, external links,
video locators, audio locators, bibliographic references, and interactive
references.

Resource support is data-only:

- No CSS, HTML, JavaScript, React, native code, or executable plugins.
- External resources are HTTPS locators and are not fetched by validators.
- `ResourceSegment` IDs are scoped to their containing resource.
- `Concept`, `Objective`, and `LearningItem` can link to resources through
  `ResourceLink`.
- `CurriculumNode.entries` can order child nodes, resources, items, and
  StudySets in one sequence.
- Resource completion or engagement is stored as private
  `ResourceEngagementEvent` data outside public packs.

See [ADR-002](./adr/002-learning-resource-teaching-layer.md),
[Resource Authoring Guide](./resource-authoring-guide.md), and
[Resource Security Model](./resource-security-model.md).

## Fixtures

Code fixtures are exported from the package entry point:

- `createValidLearningPackFixture`
- `createInvalidDuplicateIdFixture`
- `createInvalidMissingReferenceFixture`
- `createInvalidCapabilityFixture`
- `validLearningPackFixture`

JSON fixtures are also available under `fixtures/`:

- `valid-basic-pack.json`
- `invalid-missing-reference-pack.json`
- `logic-foundations/`

`fixtures/logic-foundations/` is the comprehensive golden fixture. It contains
four releases, invalid packs, expected projection snapshots, update-plan
expectations, teaching resources, resource migration metadata, and the
mastery-reset migration example.

## Conformance Helper

Consuming applications can use the exported conformance runner:

```ts
import {
  runLearningPackConformanceChecks,
  createLogicFoundationsGoldenFixture
} from "@learnt/learning-pack-contracts";
```

The helper accepts an app adapter and verifies that the app accepts valid packs,
rejects invalid packs, preserves stable global entity keys, imports no learner
progress from pack content, and handles update plans correctly.
