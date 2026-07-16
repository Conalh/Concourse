# Teaching Layer Integration

## Status

Implemented first usable slice on 2026-06-23. Extended on 2026-06-23 with
the portable teaching-to-practice loop: resource and segment checkpoints now
launch StudySet-scoped Learnt sessions, native evidence stays in the existing
session engine, terminal screens carry return actions, and activity feedback can
send learners to authored remediation resources.

Extended again on 2026-06-23 with the unified Practice foundation. Learnt can
now resolve pack, course, concept, objective, StudySet, weak-item, recent-mistake,
and explicit-item practice scopes into PracticePlans, start native Learnt
practice sessions, project flashcards into reveal/self-grade evidence, and derive
private practice metrics. See
`docs/practice/unified-practice-foundation.md`.

Updated on 2026-07-01 so the library and Transfer pack hierarchy can launch
route, curriculum-section, and StudySet practice directly. These affordances use
the same `PracticePlan` path as `#/practice`; they do not add a separate
Flashiet-style progress store or duplicate response/evaluation logic.

## Files Changed

Primary runtime and application changes:

- `src/application/learning-resource-runtime.ts`
- `src/application/practice-runtime.ts`
- `src/application/study-set-runtime.ts`
- `src/application/learnt-application.ts`
- `src/application/learnt-application.types.ts`
- `src/application/learning-pack-library.ts`
- `src/application/session-concept-exploration.ts`
- `src/core/ports/resource-engagement-store.ts`
- `src/infrastructure/resource-engagement/`
- `src/app/composition-root.ts`

Primary UI changes:

- `src/ui/navigation/app-route.ts`
- `src/ui/hooks/use-learning-session.ts`
- `src/ui/hooks/use-learning-resource.ts`
- `src/ui/screens/LearningResourceScreen.tsx`
- `src/ui/screens/LearningWorkspaceScreen.tsx`
- `src/ui/screens/PracticeScreen.tsx`
- `src/ui/screens/SubjectLibraryScreen.tsx`
- `src/ui/screens/SessionConceptScreen.tsx`
- `src/ui/app/App.tsx`
- `src/ui/app/learnt-application-client.ts`

Focused tests:

- `src/application/learning-resource-runtime.test.ts`
- `src/application/practice-runtime.test.ts`
- `src/application/practice-session.test.ts`
- `src/application/learning-pack-library.test.ts`
- `src/ui/navigation/app-route.test.ts`
- `src/ui/app/LearningPackLibrary.product.test.tsx`
- existing application and provider tests updated for the new dependencies.

## Runtime Architecture

Learnt keeps `@learnt/learning-pack-contracts` and
`@learnt/learning-pack-sdk` as the source of truth for pack documents,
resources, resource links, curriculum entries, diagnostics, and resource
engagement validation. Learnt does not copy contract schemas or redefine pack
interfaces locally.

Installed pack content remains canonical and immutable from the application
point of view. Learnt builds app-specific read models from
`InstalledLearningPack.documents` for UI navigation, resource teaching views,
concept exploration, objective lookup, and item remediation lookup.

Resource engagement is separate learner state. It is stored behind
`ResourceEngagementStore` and validated with
`validateResourceEngagementEvent()` before persistence.

## Resource Lookup Flow

Global resource identity is `packId + resourceId`.

The application facade exposes:

- `getLearningResource({ packId, resourceId, segmentId })`
- `listResourcesForConcept({ packId, conceptId })`
- `listResourcesForObjective({ packId, objectiveId })`
- `listSupportResourcesForLearningItem({ packId, itemId })`
- `listCurriculumEntries({ packId, nodeId })`
- `recordResourceEngagement(...)`
- `resolveStudySet({ packId, studySetId, seed })`
- `startStudySetSession({ packId, studySetId, origin, seed })`
- `getEligibleSupportResources({ sessionId, activityId })`

`getLearningResource()` resolves:

- canonical resource metadata
- source kind and source payload
- content revision
- segment selection
- concept and objective labels
- checkpoint StudySets and their item IDs
- next authored curriculum entry
- derived progress state from engagement events

The resource object is not mutated by UI code.

## Ordered Curriculum Handling

`CurriculumNode.entries` is respected as the canonical sequence when present.
The library projection renders interleaved entries in authored order:

- `child-node`
- `resource`
- `item`
- `study-set`

Older packs without `entries` continue through the previous node, item, and
study-set projections. Unsupported or missing entries remain recoverable read
model states instead of reordering the course around them.

## Supported Source Kinds

The first slice presents every current contract source kind without executing
pack-provided code:

- `embedded-content`
- `external-link`
- `external-video`
- `external-audio`
- `bibliographic-reference`
- `interactive-reference`

Embedded content renders inside Learnt. External resources open through safe
links and can be self-reported as complete. Video and audio segment metadata is
preserved; no provider iframe adapter has been added yet.

## ContentBlock Rendering

`embedded-content` resources are adapted into the existing Learnt
`ContentBlockRenderer`. There is no second content block renderer for packs.

Pack content cannot inject HTML, JavaScript, CSS, iframe markup, event handlers,
or executable code. Unsupported optional block shapes should remain recoverable
fallbacks at the renderer boundary.

## Checkpoint Flow

Resources and segments resolve `checkpointStudySetIds` through canonical
`StudySet` and `LearningItem` documents. The resource view shows checkpoint
StudySet titles and item counts from the existing pack data.

Launching a checkpoint starts a normal Learnt session scoped to the resolved
StudySet items. The runtime uses the shared `resolveStudySetItemIds()` helper
from `@learnt/learning-pack-contracts`, validates that selected items exist in
one installed subject runtime, then derives a transient subject view with only
the StudySet activities wired in StudySet order.

```text
LearningResource
  -> StudySet
  -> LearningItems
  -> existing response/evaluation engine
  -> Learnt evidence
```

The persisted session stores `exploration.learningFlow.kind =
"study-set-checkpoint"` with pack ID, pack version, StudySet ID, seed, item IDs,
and an origin object. Origin metadata is intentionally portable:

- `learning-resource` origins carry `packId`, `resourceId`, optional
  `segmentId`, `returnRoute`, and optional `continuationRoute`.
- `active-session` origins carry the calling session and optional activity.
- resource hash routes can round-trip origin metadata through an `origin` query
  parameter.

No answer-key logic was duplicated in the teaching UI. Responses and
evaluations still use the existing Learnt activity renderer, evaluator, evidence
schema, recap, and persistence paths.

## Unified Practice Flow

The broader Practice foundation generalizes checkpoint launching beyond resource
segments. A `PracticeRequest` resolves a scope, mode, selection strategy, and
origin into a `PracticePlan`. The plan records selected canonical item IDs,
resolved mode per item, pack version, learning revisions, seed, coverage,
exclusions, warnings, and a display summary.

Library and Transfer launch buttons create these same requests from installed
pack routes, curriculum nodes, and StudySets. Course and curriculum launches
record a `course-curriculum` origin with a local return route; StudySet launches
record a library origin and default to flashcard-first authored order.

Persisted sessions store `exploration.learningFlow.kind = "practice-plan"`.
Reload and submission paths reconstruct the scoped subject from the installed
pack and the persisted plan state. If selected items span multiple installed
subjects, Learnt builds a synthetic pack-scoped source subject first, then
creates the practice-scoped subject from that source.

Implemented practice modes:

- `flashcard`
- `quiz`
- `recall`
- `mixed`

Implemented selection strategies:

- `authored-order`
- `random`
- `weakest-first`
- `recent-mistakes`
- `least-seen`
- `balanced-by-concept`
- `due-or-weak`

Flashcard practice is not deterministic correctness. The workspace shows the
front/prompt first, reveals reviewed solution blocks only after the learner asks,
then records Again/Hard/Good/Easy as Learnt confidence evidence. The activity
uses an extension evaluator key and `completionPolicy: "submission"`, so the
session can complete the item while keeping the evaluation ungraded.

Quiz and deterministic recall practice continue to use the existing Learnt
activity player, evaluator, evidence, and recap paths.

## Engagement Event Storage

`ResourceEngagementStore` persists `ResourceEngagementEvent` records outside
installed pack content. The browser implementation stores events in
`localStorage` under `learnt:resource-engagement-events`; tests and non-browser
composition can use the in-memory store.

Events are idempotent by `(sourceInstanceId, eventId)`. A replay with the same
identity and same payload is ignored; a replay with conflicting payload fails.

Learnt currently emits events for:

- `opened`
- `revisited`
- `abandoned`
- `marked-complete`

The runtime derives these UI progress states:

- `unseen`
- `opened`
- `in-progress`
- `completed`
- `completion-stale`
- `unavailable`

Resource completion does not create mastery evidence and does not directly
increase concept mastery.

## Resource Update Behavior

Learnt preserves historical engagement events by resource ID and content
revision. If a current resource has a higher `contentRevision` than a previous
completion event, the derived progress state becomes `completion-stale`.

Removed resources retain historical events but are not presented as currently
available. Archive update planning still comes from the shared SDK installer;
Learnt has not added a separate resource-specific migration engine.

## Remediation Behavior

The runtime can resolve `LearningItem.supportResourceLinks` and filter authored
support relationships by item, segment, role, priority, and recommended use.

The session hook asks the application for eligible support resources after
loading, submitting evidence, advancing, changing mode, or returning from
concept exploration. Eligibility is based on real session evidence:

- no attempts: no remediation links
- latest incorrect attempt: `after-incorrect`
- repeated latest incorrect attempts: `after-repeated-incorrect`
- latest correct attempt: no incorrect-remediation link

The workspace presents these links as `Learn the Why` actions. A remediation
link opens the authored resource or segment with an `active-session` origin, so
the resource header can return directly to the current practice session. If the
learner launches a checkpoint from that remediation resource, the checkpoint
keeps the active-session origin and returns to practice after completion.

## Security Boundaries

Learnt treats pack resources as data, not executable application code.

- No pack-provided HTML, JavaScript, CSS, iframe markup, or event handlers are
  executed.
- External resources use safe links with `target="_blank"` and `rel="noreferrer
noopener"`.
- Remote metadata is not fetched during install or tests.
- Learner engagement is never written into `.learntpack` content.
- Required teaching capability failures are blocked by shared validation.
- Optional unsupported capabilities stay warnings where the shared package
  reports them that way.

## Unsupported Features

The teaching layer still does not include:

- Objective-detail UI for objective resource links.
- Provider-specific video or audio player adapters.
- Observed percentage watched or observed audio progress.
- External-return events.
- User bookmarks or origin-context return state for every nonlinear entry path.
- Automatic question generation, teach-back grading, transcription, resource
  crawling, provider analytics, arbitrary embedded interactives, or a new
  mastery model.

## Flashiet And Portable App Notes

Flashiet and other practice apps should keep using the shared learning-pack
contracts for canonical StudySets, item IDs, support resource links, review
events, and resource engagement vocabulary. Learnt now provides the portable app
side of the loop for its own runtime, but it does not replace Flashiet-specific
session UX or spaced-review policy.

The new Practice foundation intentionally does not copy Flashiet's normalized
card store or aggregate progress fields. Learnt derives attempts, success rate,
self-grade distribution, recent mistakes, weak concepts, and least-seen items
from private Learnt evidence records.

Remaining portable-app work outside this slice:

- decide whether external apps should deep-link into Learnt resources or embed
  their own resource player against the same contracts
- add provider-owned video and audio players if observed progress is required
- define any cross-app return-route conventions beyond the local Learnt hash
  routes implemented here

## Extension Points

Future video and audio adapters should be application-owned components selected
by validated source kind, provider, canonical URL, and segment timing metadata.
They must not accept provider embed HTML from pack data.

Teach-back can attach to the resource view as Learnt-owned learner evidence or
reflection state. It should not mutate canonical resource documents and should
not be treated as mastery unless an explicit evaluated LearningItem or future
contract supports that behavior.

User-created resources should be authored into canonical pack documents or a
separate user-owned resource library that can export to the shared contracts.
Draft state, learner notes, and private engagement should remain outside
installed pack content.
