# Learning Pack Integration Guide

This package owns the public v0.1 contract. Consuming applications should adapt
their local models to these exported types instead of copying or redefining the
contract.

## Install

```sh
npm install @learnt/learning-pack-contracts
```

For local workspace development, depend on this package by workspace path or
package manager workspace configuration.

## Validation Flow

Applications remain responsible for archive handling. After a `.learntpack`
archive has been safely extracted by application code, pass parsed JSON
documents to the contract package:

```ts
import {
  validateLearningPackDocuments,
  type LearningPackDocuments
} from "@learnt/learning-pack-contracts";

const pack: LearningPackDocuments = {
  manifest,
  catalog,
  courses,
  items,
  sets,
  resources,
  theme,
  migrations
};

const result = validateLearningPackDocuments(pack);

if (!result.ok) {
  showImportErrors(result.diagnostics);
  return;
}

installValidatedPack(result.value);
```

Treat diagnostics with `severity: "error"` as blocking. Diagnostics with
`severity: "warning"` may be shown to the user while continuing, for example
unknown optional capabilities.

## Capability Negotiation

Use `checkCapabilities` directly when an app wants to preview support before a
full semantic validation pass:

```ts
import { checkCapabilities } from "@learnt/learning-pack-contracts";

const capabilityResult = checkCapabilities(
  manifest.capabilities.required,
  manifest.capabilities.optional,
  { supportedCapabilities: appSupportedCapabilities }
);
```

Unknown required capabilities must block installation. Unknown optional
capabilities may be ignored with warnings.

Resource-related capabilities are optional in v0.1. Apps that do not support
resources may still install practice-only packs. Apps that install packs with
`resources.json` may ignore unsupported resource features with warnings unless
the pack declares those capabilities as required.

## Resource Import Boundary

Teaching resources are optional data-only content. A consuming app should:

1. Validate `resources.json` through `validateLearningPackDocuments`.
2. Store resource identity as `(packId, resourceId)`.
3. Store segment identity as `(packId, resourceId, segmentId)`.
4. Render embedded content with app-owned safe content-block rendering.
5. Open external resources only as explicit HTTPS locators.
6. Keep resource completion and engagement outside the pack as
   `ResourceEngagementEvent` data.

Do not copy resource records into app-specific HTML, CSS, JavaScript, React, or
plugin execution surfaces. If an app cannot support a source kind, it should
hide or warn for that resource while still importing supported playable items
when capability negotiation allows it.

## Learnt Adapter Boundary

Learnt should:

1. Validate incoming pack documents with `validateLearningPackDocuments`.
2. Map validated `catalog`, `courses`, and `items` into Learnt import code.
3. Revalidate any produced Learnt subject data with Learnt's own subject
   validators.
4. Store learner evidence separately as `ReviewEvent`-compatible data.

Learnt should not import CSS, React components, executable evaluators, or
learner progress from a public pack.

Learnt may map `LearningResource` records into subject readings, references,
or pre-activity teaching surfaces, but the pack remains the source of public
resource identity. Learnt-specific rendering, activity session state, and
resource completion state stay app-private.

## Flashcards Adapter Boundary

The Flashcards app should:

1. Keep Markdown pack import as a legacy adapter.
2. Convert Markdown into v0.1 JSON before treating it as portable content.
3. Use `LearningItem` as the canonical playable unit.
4. Use `packId` plus `itemId` for content identity and progress keys.
5. Store card statistics and progress outside public packs.

The current local card shape can remain app-private.

Flashcards may map resources into deck introductions, card explanations,
remediation links, or quiz prefaces. Existing Markdown packs remain a legacy
authoring adapter; canonical interchange should be v0.1 JSON with optional
`resources.json`.

## Update Planning

Use `planPackUpdate` to apply immutable release behavior before changing
installed state:

```ts
import { planPackUpdate } from "@learnt/learning-pack-contracts";

const plan = planPackUpdate(installedPacks, nextManifest);

if (plan.action === "reject-version-conflict") {
  showConflict(plan.conflictingFiles);
}
```

The helper does not write storage. It only classifies the update based on
installed records and the next manifest.

Use `planResourceUpdate` when an app has app-private resource completion state:

```ts
import { planResourceUpdate } from "@learnt/learning-pack-contracts";

const resourcePlan = planResourceUpdate(
  { packId, resourceId: "resource-negation-video", contentRevision: 1 },
  { id: "resource-negation-video", contentRevision: 2 },
  packId
);
```

When `contentRevision` changes, keep historical `ResourceEngagementEvent`
records but treat derived completion as stale unless the migration
`engagementPolicy` says the app can preserve it.

## SDK Archive Tooling

Use `@learnt/learning-pack-sdk` when an application needs archive or filesystem
operations:

```sh
learntpack validate ./logic-pack
learntpack pack ./logic-pack --out logic.learntpack
learntpack inspect logic.learntpack
learntpack diff old.learntpack new.learntpack
```

The SDK validates before packing and after unpacking, rejects path traversal
and symlinks, verifies manifest hashes, enforces file limits, uses
deterministic ordering, and reserves publisher signatures as a future extension
point.

## Conformance Tests

Use the golden fixture helper to prove an application honors the public
contract:

```ts
import {
  runLearningPackConformanceChecks,
  type LearningPackConformanceAdapter
} from "@learnt/learning-pack-contracts";

const adapter: LearningPackConformanceAdapter = {
  async acceptPack(pack) {
    const install = await appInstallPack(pack);
    return {
      accepted: install.ok,
      globalEntityKeys: install.globalEntityKeys,
      importedLearnerProgressCount: install.importedLearnerProgressCount
    };
  },
  async rejectPack(pack) {
    const install = await appTryInstallPack(pack);
    return { rejected: !install.ok };
  },
  async planUpdate(installed, nextManifest) {
    return appPlanPackUpdate(installed, nextManifest);
  }
};

const report = await runLearningPackConformanceChecks(adapter);
```

The runner uses `fixtures/logic-foundations/` and checks valid-pack acceptance,
invalid-pack rejection, stable identity, no imported learner progress, and
update-plan behavior.

## Progress And Review Events

Do not embed learner progress in pack archives. Store progress as app-owned
events that reference pack content.

Review evidence uses `ReviewEvent`:

```ts
import type { ReviewEvent } from "@learnt/learning-pack-contracts";

const event: ReviewEvent = {
  schemaVersion: "0.1",
  eventId: "event-1",
  packId: "learnt.logic-basics-core",
  packVersion: "0.1.0",
  itemId: "predict-negation-item",
  learningRevision: 1,
  subjectId: "logic-basics",
  courseId: "logic-basics-core",
  playMode: "single-choice-quiz",
  responseSummary: {
    kind: "choice",
    selectedOptionIds: ["option-false"],
    enteredText: null,
    enteredNumber: null,
    selfGrade: null,
    customSummary: null
  },
  result: "correct",
  normalizedScore: 1,
  responseTimeMs: 1200,
  occurredAt: new Date().toISOString(),
  sourceInstanceId: "flashcards-device-1",
  confusionTargetIds: [],
  privacy: {
    learnerId: null,
    sessionId: "session-1",
    sourceAppId: "flashcards",
    sourceAppVersion: "1.0.0"
  },
  extensions: null
};
```

When `learningRevision` changes, old review events remain historical. Current
mastery should be recalculated according to migration metadata and app policy.
Do not embed ReviewEvents in pack archives, and do not treat the shared
contract as a spaced-repetition scheduler.

Resource evidence uses `ResourceEngagementEvent`:

```ts
import type { ResourceEngagementEvent } from "@learnt/learning-pack-contracts";

const event: ResourceEngagementEvent = {
  schemaVersion: "0.1",
  eventType: "resource-engagement",
  eventId: "event-resource-1",
  packId: "learnt.logic-basics-core",
  packVersion: "0.1.0",
  resourceId: "resource-negation-video",
  contentRevision: 1,
  segmentId: "segment-negation-example",
  action: "completed",
  progressRatio: 1,
  positionSeconds: 180,
  measurement: "player-observed",
  occurredAt: new Date().toISOString(),
  sourceInstanceId: "flashcards-device-1",
  metadata: null
};
```

Resource engagement events are ordered by `occurredAt`, then
`sourceInstanceId`, then `eventId`. Deduplicate by `(sourceInstanceId,
eventId)`. Conflicting duplicates should be quarantined, rejected, or
app-locally versioned instead of silently merged.
