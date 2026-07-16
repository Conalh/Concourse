# Learnt Integration Inventory For Shared Learning Packs

## Scope

This is an inventory of the current Learnt codebase for a future shared
Learning Pack system used by Learnt and the Flashcards app. It is intentionally
not a local portable schema definition. The shared package should own the
LearningPack contract.

Source inputs reviewed:

- `C:\Projects\Learning\Flashiet\FLASHCARD_PACKS.md`
- `docs/flashcards-quizzes-and-packs.md`
- The requested `docs/learning-packs/source/FLASHCARD_PACKS.md` and
  `docs/learning-packs/source/flashcards-quizzes-and-packs.md` paths do not
  currently exist in this checkout.

Production behavior must not change for this task.

## Current Model Inventory

### SubjectPackage And DefinedSubject

Primary files and exported symbols:

- `src/core/contracts/subject.schema.ts`
  - `SubjectExtensionKindSchema`, `SubjectExtensionKind`
  - `SubjectExtensionManifestSchema`, `SubjectExtensionManifest`
  - `SubjectPackageSchema`, `SubjectPackage`
- `src/subject-sdk/defined-subjects.ts`
  - `DefinedSubject`
  - `markDefinedSubject`
  - `isDefinedSubject`
- `src/subject-sdk/define-subject.ts`
  - `defineSubject`
- `src/core/foundation/deep-readonly.ts`
  - `DeepReadonly`
- `src/core/foundation/deep-freeze.ts`
  - `cloneDeep`
  - `deepFreeze`
- `src/subject-sdk/index.ts`
  - Public SDK barrel for `defineSubject`, `DefinedSubject`, and related types.

`SubjectPackage` is the authored source of truth. It contains:

- `schemaVersion`
- `id`
- `version`
- `title`
- `summary`
- `tags`
- `modules`
- `concepts`
- `objectives`
- `activities`
- `extensions`

`DefinedSubject` is `DeepReadonly<SubjectPackage>`. Runtime trust is represented
by a `WeakSet` in `defined-subjects.ts`, so the trusted marker is not serialized.
Imported JSON must be passed through `defineSubject` again.

Existing tests:

- `src/core/contracts/contracts.test.ts`
- `src/subject-sdk/subject-sdk.test.ts`
- `src/subjects/production-subjects.test.ts`

### Modules, Concepts, Objectives, And Activities

Primary files and exported symbols:

- `src/core/contracts/module.schema.ts`
  - `ModuleDefinitionSchema`, `ModuleDefinition`
- `src/core/contracts/concept.schema.ts`
  - `ConceptDefinitionSchema`, `ConceptDefinition`
- `src/core/contracts/objective.schema.ts`
  - `LearningObjectiveSchema`, `LearningObjective`
- `src/core/contracts/activity.schema.ts`
  - `ActivityKindSchema`, `ActivityKind`
  - `ScaffoldLevelSchema`, `ScaffoldLevel`
  - `CompletionPolicySchema`, `CompletionPolicy`
  - `ActivityDefinitionSchema`, `ActivityDefinition`
- `src/subject-sdk/subject-integrity.ts`
  - `validateSubjectIntegrity`

Activity kinds in the contract:

- `orient`
- `explain`
- `predict`
- `worked-example`
- `complete`
- `build`
- `modify`
- `debug`
- `recall`
- `transfer`
- `reflect`

Scaffold levels:

- `worked`
- `completion`
- `guided`
- `independent`
- `transfer`

Production catalog totals, from the current subject literals:

- 3 subjects
- 10 modules
- 75 concepts
- 27 objectives
- 49 activities

Production activity kind counts:

- `orient`: 10
- `predict`: 15
- `recall`: 5
- `debug`: 9
- `complete`: 2
- `explain`: 2
- `transfer`: 6

The production catalog does not currently use `worked-example`, `build`,
`modify`, or `reflect`.

Existing tests:

- `src/core/contracts/contracts.test.ts`
- `src/subject-sdk/subject-sdk.test.ts`
- `src/subjects/production-subjects.test.ts`
- `src/subjects/machine-learning-foundations/subject.test.ts`

### Content Blocks

Primary file and exported symbols:

- `src/core/contracts/content-block.schema.ts`
  - `TextBlockSchema`, `TextBlock`
  - `CodeBlockSchema`, `CodeBlock`
  - `EquationBlockSchema`, `EquationBlock`
  - `CalloutPurposeSchema`, `CalloutPurpose`
  - `CalloutBlockSchema`, `CalloutBlock`
  - `ComparisonItemSchema`, `ComparisonItem`
  - `ComparisonBlockSchema`, `ComparisonBlock`
  - `QuestionBlockSchema`, `QuestionBlock`
  - `ExtensionBlockSchema`, `ExtensionBlock`
  - `ContentBlockSchema`, `ContentBlock`

Renderer:

- `src/ui/components/ContentBlockRenderer.tsx`
  - `ContentBlockRenderer`
  - Standard blocks are rendered generically.
  - `extension` blocks render an unsupported-extension fallback and hide payloads.

Production block kind counts:

- `question`: 39
- `callout`: 6
- `comparison`: 5
- `text`: 4
- `equation`: 4
- `code`: 2
- `extension`: 0

Existing tests:

- `src/core/contracts/contracts.test.ts`
- `src/ui/components/ContentBlockRenderer.test.tsx`

### Response Definitions

Primary file and exported symbols:

- `src/core/contracts/response.schema.ts`
  - `ChoiceOptionSchema`, `ChoiceOption`
  - `TextResponseDefinitionSchema`, `TextResponseDefinition`
  - `NumberResponseDefinitionSchema`, `NumberResponseDefinition`
  - `SingleChoiceResponseDefinitionSchema`, `SingleChoiceResponseDefinition`
  - `MultipleChoiceResponseDefinitionSchema`,
    `MultipleChoiceResponseDefinition`
  - `ConfidenceResponseDefinitionSchema`, `ConfidenceResponseDefinition`
  - `CodeResponseDefinitionSchema`, `CodeResponseDefinition`
  - `ResponseDefinitionSchema`, `ResponseDefinition`

Runtime response validation and UI construction:

- `src/core/engine/response-validation.ts`
  - `parseAndValidateEvidencePayload`
- `src/ui/responses/response-draft.ts`
  - `ResponseDraft`
  - `EvidenceBuildResult`
  - `createInitialResponseDraft`
  - `restoreDraftFromEvidence`
  - `buildEvidencePayload`
  - `toggleMultipleChoiceOption`
  - `codePayloadFromDraft`
- `src/ui/components/ActivityResponse.tsx`
  - `ActivityResponse`

Production response kind counts:

- no response/manual completion: 10
- `single-choice`: 20
- `multiple-choice`: 7
- `text`: 7
- `number`: 4
- `code`: 1
- `confidence`: 0

Existing tests:

- `src/core/contracts/contracts.test.ts`
- `src/core/engine/learning-engine.test.ts`
- `src/ui/responses/evidence-payload-builder.test.ts`
- `src/ui/components/ActivityResponse.test.tsx`

### Evaluation Definitions

Primary file and exported symbols:

- `src/core/contracts/evaluation.schema.ts`
  - `ManualCompletionEvaluationSchema`, `ManualCompletionEvaluation`
  - `ExactTextEvaluationSchema`, `ExactTextEvaluation`
  - `ChoiceSelectionEvaluationSchema`, `ChoiceSelectionEvaluation`
  - `NumericalToleranceEvaluationSchema`, `NumericalToleranceEvaluation`
  - `RubricCriterionSchema`, `RubricCriterion`
  - `RubricAssistedTextEvaluationSchema`, `RubricAssistedTextEvaluation`
  - `ExtensionEvaluationSchema`, `ExtensionEvaluation`
  - `EvaluationDefinitionSchema`, `EvaluationDefinition`
  - `EvaluationStatusSchema`, `EvaluationStatus`
  - `EvaluationResultSchema`, `EvaluationResult`

Runtime evaluator:

- `src/core/engine/evaluation-service.ts`
  - `evaluateActivityEvidence`
  - `isActivityCompletedByPolicy`

Production evaluation kind counts:

- `manual-completion`: 10
- `choice-selection`: 27
- `exact-text`: 1
- `numerical-tolerance`: 4
- `rubric-assisted-text`: 7
- `extension`: 0

Deterministic built-in evaluators:

- `manual-completion`
- `exact-text`
- `choice-selection`
- `numerical-tolerance`

`rubric-assisted-text` and `extension` currently return `ungraded` unless a
future evaluator is added.

Existing tests:

- `src/core/contracts/contracts.test.ts`
- `src/core/engine/learning-engine.test.ts`
- `src/ui/components/EvaluationFeedback.test.tsx`

### Completion Policies

Primary symbols:

- `src/core/contracts/activity.schema.ts`
  - `CompletionPolicySchema`
  - `CompletionPolicy`
- `src/core/engine/evaluation-service.ts`
  - `isActivityCompletedByPolicy`

Completion policy kinds:

- `submission`: completes after any valid response submission.
- `passing-evaluation`: completes only when evaluation status is `passed`.
- `manual`: completes only from `{ kind: 'manual', completed: true }`.

Production completion policy counts:

- `manual`: 10
- `passing-evaluation`: 32
- `submission`: 7

Existing tests:

- `src/core/contracts/contracts.test.ts`
- `src/core/engine/learning-engine.test.ts`
- `src/subjects/production-subjects.test.ts`

### Subject Validation And Package-Integrity Validation

Shape validation:

- `src/core/contracts/*.schema.ts`
- `src/core/contracts/validation.ts`
  - `NonemptyTrimmedStringSchema`
  - `IsoTimestampSchema`
  - `isIsoTimestamp`
  - `findDuplicateValues`
  - `addUniqueValuesIssue`
  - `addChronologicalTimestampIssue`

Package integrity:

- `src/subject-sdk/define-subject.ts`
  - `defineSubject`
- `src/subject-sdk/subject-integrity.ts`
  - `validateSubjectIntegrity`
- `src/subject-sdk/subject-sdk-error.ts`
  - `SubjectDefinitionIssueCode`
  - `SubjectDefinitionIssue`
  - `SubjectDefinitionError`
  - `SubjectRegistryError`

`validateSubjectIntegrity` checks:

- duplicate IDs within modules, concepts, objectives, and activities
- duplicate module `order`
- missing module, concept, objective, activity, and next-activity references
- module/activity ownership mismatches
- activity listed by multiple modules
- concept prerequisite graph cycles
- activity sequence graph cycles
- invalid choice answer references
- undeclared renderer extension keys
- undeclared evaluator extension keys

Existing tests:

- `src/core/contracts/contracts.test.ts`
- `src/subject-sdk/subject-sdk.test.ts`
- `src/subjects/production-subjects.test.ts`
- `src/subjects/machine-learning-foundations/subject.test.ts`

### SubjectAdapter And SubjectRegistry

Primary files and exported symbols:

- `src/subject-sdk/subject-adapter.ts`
  - `SubjectAdapter`
  - `createSubjectAdapter`
- `src/subject-sdk/subject-registry.ts`
  - `SubjectRegistry`
- `src/subject-sdk/index.ts`
  - Public SDK exports.
- `src/app/subject-registry.ts`
  - `createProductionSubjectRegistry`
- `src/subjects/index.ts`
  - `productionSubjectAdapters`
  - `logicBasicsSubject`, `logicBasicsSubjectAdapter`
  - `movementPlanesSubject`, `movementPlanesSubjectAdapter`
  - `machineLearningFoundationsSubject`,
    `machineLearningFoundationsSubjectAdapter`

`SubjectRegistry` stores adapters in registration order, rejects duplicate
subject IDs, and returns frozen list snapshots. It is an in-memory registry, not
a persisted installed-pack database.

Existing tests:

- `src/subject-sdk/subject-sdk.test.ts`
- `src/subjects/production-subjects.test.ts`
- `src/app/composition-root.test.ts`

### Session Generation And Evidence Generation

Primary files and exported symbols:

- `src/core/engine/learning-engine.ts`
  - `LearningSubject`
  - `DefinedLearningSession`
  - `DefinedEvidenceEvent`
  - `LearningEngineDependencies`
  - `StartSessionInput`
  - `SubmitEvidenceInput`
  - `SubmissionResult`
  - `GetNextActivityIdsInput`
  - `AdvanceSessionInput`
  - `ChangeInteractionModeInput`
  - `AbandonSessionInput`
  - `ParkConceptInput`
  - `UnparkConceptInput`
  - `LearningEngine`
- `src/core/engine/session-service.ts`
  - `CurrentActivityContext`
  - `readClockTimestamp`
  - `validateGeneratedSessionId`
  - `validateGeneratedEvidenceId`
  - `assertEvidenceIdIsNew`
  - `validateEvidenceMetadata`
  - `validateInteractionMode`
  - `parseSession`
  - `requireActiveSession`
  - `requireActiveCurrentActivity`
  - `defineSession`
  - `defineEvidenceEvent`
  - `freezeEngineOutput`
- `src/core/engine/activity-sequencer.ts`
  - `getCanonicalActivityOrder`
  - `findActivity`
  - `findModuleForActivity`
  - `findModuleByCurrentId`
- `src/core/ports/clock.ts`
  - `Clock`
- `src/core/ports/learning-id-generator.ts`
  - `LearningIdGenerator`
- `src/infrastructure/clock/system-clock.ts`
  - `SystemClock`
- `src/infrastructure/ids/crypto-learning-id-generator.ts`
  - `RandomUuidSource`
  - `CryptoLearningIdGenerator`
  - `createBrowserLearningIdGenerator`

The engine generates runtime sessions and evidence events. It does not generate
authored flashcards, quizzes, labels, themes, concepts, objectives, or answer
keys.

Existing tests:

- `src/core/engine/learning-engine.test.ts`
- `src/infrastructure/clock/system-clock.test.ts`
- `src/infrastructure/ids/crypto-learning-id-generator.test.ts`
- `src/subjects/production-subjects.test.ts`

### Current Persistence

Primary files and exported symbols:

- `src/core/ports/learning-repository.ts`
  - `StoredLearningSession`
  - `StoredEvidenceEvent`
  - `LearningSessionRecord`
  - `RepositoryScanIssueCode`
  - `RepositoryScanIssue`
  - `LearningRepositoryScanResult`
  - `CreateSessionRecordInput`
  - `SaveSessionRecordInput`
  - `CommitSubmissionInput`
  - `LearningRepository`
- `src/core/ports/learning-repository-error.ts`
  - `LearningRepositoryErrorCode`
  - `LearningRepositoryError`
- `src/infrastructure/persistence/stored-learning-record.schema.ts`
  - `STORAGE_SCHEMA_VERSION`
  - `StoredLearningRecordSchema`
  - `StoredLearningRecordEnvelope`
- `src/infrastructure/persistence/local-storage-learning-repository.ts`
  - `LocalStorageLearningRepository`
  - `createBrowserLearningRepository`
- `src/infrastructure/persistence/storage-like.ts`
  - `StorageLike`
- `src/application/persistent-learning-service.ts`
  - `PersistentLearningService`
  - `StartPersistentSessionInput`
  - `SubmitPersistentEvidenceInput`
  - `PersistedSubmissionResult`
  - `AdvancePersistentSessionInput`
  - `ChangePersistentModeInput`
  - `AbandonPersistentSessionInput`
  - `ParkPersistentConceptInput`
  - `UnparkPersistentConceptInput`

Current storage is browser `localStorage`, one complete aggregate per key:

```text
learnt:learning-session:<session-id>
```

The stored aggregate includes:

- `storageSchemaVersion`
- `revision`
- `subjectVersion`
- `session`
- `evidenceEvents`

Subject packages and pack manifests are not persisted today. Installed-pack
state, pack discovery, pack import/export, and pack migrations do not exist yet.

Existing tests:

- `src/infrastructure/persistence/local-storage-learning-repository.test.ts`
- `src/application/persistent-learning-service.test.ts`
- `src/application/learnt-application.test.ts`
- `src/ui/app/App.product-flow.test.tsx`

### Current Production Subject Registration

Primary files:

- `src/subjects/logic-basics/subject.ts`
  - `logicBasicsSubject`
  - `logicBasicsSubjectAdapter`
- `src/subjects/movement-planes/subject.ts`
  - `movementPlanesSubject`
  - `movementPlanesSubjectAdapter`
- `src/subjects/machine-learning-foundations/subject.ts`
  - `machineLearningFoundationsSubject`
  - `machineLearningFoundationsSubjectAdapter`
- `src/subjects/index.ts`
  - `productionSubjectAdapters`
- `src/app/subject-registry.ts`
  - `createProductionSubjectRegistry`
- `src/app/composition-root.ts`
  - `composeLearntApplication`
  - `createBrowserLearntApplication`

Production registration order:

1. `logic-basics`
2. `movement-planes`
3. `machine-learning-foundations`

There is no runtime filesystem scanning or downloaded subject discovery.

Existing tests:

- `src/subjects/production-subjects.test.ts`
- `src/app/composition-root.test.ts`
- `src/ui/app/App.product-flow.test.tsx`

### Presentation-Policy Behavior

Primary files and exported symbols:

- `src/core/presentation/presentation-policy.types.ts`
  - `PresentationPolicy`
  - `ResolvePresentationPolicyInput`
  - `MutablePresentationPolicy`
  - policy helper union types
- `src/core/presentation/presentation-policy.ts`
  - `resolvePresentationPolicy`
- `src/application/learning-session-context.ts`
  - `buildSessionContext`

Presentation policy is derived at runtime from:

- learner profile
- session interaction mode
- current activity semantics

It is not authored subject content, not a theme, not persisted learner state, and
not part of the pack contract. It affects behavior such as reveal timing,
hint access, optional content visibility, and checkpoint behavior.

Existing tests:

- `src/core/presentation/presentation-policy.test.ts`
- `src/application/learnt-application.test.ts`
- `src/ui/app/App.product-flow.test.tsx`

### Existing Extension Or Capability Mechanisms

Extension declarations:

- `src/core/contracts/subject.schema.ts`
  - subject-level `extensions`
  - extension kinds: `renderer`, `evaluator`
- `src/core/contracts/content-block.schema.ts`
  - `ExtensionBlockSchema`
  - fields: `rendererKey`, `payload`
- `src/core/contracts/evaluation.schema.ts`
  - `ExtensionEvaluationSchema`
  - fields: `evaluatorKey`, `payload`
- `src/subject-sdk/subject-integrity.ts`
  - verifies referenced extension keys are declared with the correct kind.

Current capability status:

- The core validates extension envelopes only.
- There is no production extension registry or renderer/evaluator implementation.
- The UI hides extension payloads and renders a recoverable unsupported state.
- All current production subjects use `extensions: []`.

Existing tests:

- `src/subject-sdk/subject-sdk.test.ts`
- `src/core/contracts/contracts.test.ts`
- `src/ui/components/ContentBlockRenderer.test.tsx`
- `src/subjects/production-subjects.test.ts`

### Fields That Are Not JSON-Safe

JSON-safe today:

- Branded ID types are strings at runtime.
- Validated dates in sessions/evidence are ISO strings.
- Standard content, response, evaluation, session, and evidence contracts are
  JSON data after validation.

Not JSON-safe or not portable as data:

- `ExtensionBlockSchema.payload` in `src/core/contracts/content-block.schema.ts`
  is `z.unknown()`. It can contain functions, symbols, bigint values, class
  instances, cyclic objects, `undefined`, or other non-JSON data.
- `ExtensionEvaluationSchema.payload` in
  `src/core/contracts/evaluation.schema.ts` is also `z.unknown()`.
- `DefinedSubject` trust is tracked by a `WeakSet` in
  `src/subject-sdk/defined-subjects.ts`. That marker is lost across JSON.
- `SubjectAdapter` and `SubjectRegistry` are runtime wrappers. Export subject
  data, not adapters or registries.
- `Clock.now(): Date` and `SystemClock` use `Date` objects at runtime, but the
  stored contract uses ISO strings.
- `LearningIdGenerator`, `RandomUuidSource`, browser `crypto`, and
  `localStorage` are runtime services, not pack data.
- `Map`, `Set`, `WeakMap`, and `WeakSet` appear in runtime validators,
  registries, and read-model builders. They should not cross the pack boundary.
- Frozen objects serialize as plain JSON and lose immutability guarantees.
- Error classes and error causes are not pack data.
- React response drafts in `src/ui/responses/ResponseDraftProvider.tsx` are
  transient UI state and are not durable pack or review data.

## Projection Inventory

Projection is determined by response and evaluation compatibility first.
`activity.kind` is semantic metadata; by itself it does not define the play mode
or answer key.

Legend:

- `Yes`: safe projection from current Learnt data.
- `Conditional`: safe only when paired with the compatible response/evaluation
  listed in the notes.
- `No`: not safe from the current Learnt data.

### Activity Kind Projection

| Activity kind    | Flashcard   | Single-choice quiz | Multiple-choice quiz | Text recall | Number recall | Manual reading | Notes                                                                                       |
| ---------------- | ----------- | ------------------ | -------------------- | ----------- | ------------- | -------------- | ------------------------------------------------------------------------------------------- |
| `orient`         | Conditional | Conditional        | Conditional          | Conditional | Conditional   | Yes            | Production use is manual reading. Other projections require compatible response/evaluation. |
| `explain`        | Conditional | Conditional        | Conditional          | Conditional | Conditional   | Conditional    | Production use is rubric-assisted open work, not deterministic.                             |
| `predict`        | Conditional | Conditional        | Conditional          | Conditional | Conditional   | Conditional    | Production use is mostly deterministic choice and number work.                              |
| `worked-example` | Conditional | Conditional        | Conditional          | Conditional | Conditional   | Yes            | Not used in production; immediate presentation policy.                                      |
| `complete`       | Conditional | Conditional        | Conditional          | Conditional | Conditional   | Conditional    | Production use is numeric checkpoints.                                                      |
| `build`          | Conditional | Conditional        | Conditional          | Conditional | Conditional   | Conditional    | Not used in production.                                                                     |
| `modify`         | Conditional | Conditional        | Conditional          | Conditional | Conditional   | Conditional    | Not used in production.                                                                     |
| `debug`          | Conditional | Conditional        | Conditional          | Conditional | Conditional   | Conditional    | Production use is deterministic choice checks.                                              |
| `recall`         | Conditional | Conditional        | Conditional          | Conditional | Conditional   | Conditional    | Production use is multiple-choice and number recall.                                        |
| `transfer`       | Conditional | Conditional        | Conditional          | Conditional | Conditional   | Conditional    | Production use includes one exact-text item and several rubric-assisted unsupported items.  |
| `reflect`        | Conditional | Conditional        | Conditional          | Conditional | Conditional   | Conditional    | Not used in production.                                                                     |

### Response Kind Projection

| Response kind     | Flashcard | Single-choice quiz | Multiple-choice quiz | Text recall | Number recall | Manual reading | Notes                                                                                                         |
| ----------------- | --------- | ------------------ | -------------------- | ----------- | ------------- | -------------- | ------------------------------------------------------------------------------------------------------------- |
| no response       | No        | No                 | No                   | No          | No            | Yes            | Safe when paired with `manual-completion` and `completionPolicy: manual`.                                     |
| `text`            | Yes       | No                 | No                   | Yes         | No            | No             | Safe only with `exact-text`; back is `acceptedAnswers`. Rubric text is not safe.                              |
| `number`          | Yes       | No                 | No                   | No          | Yes           | No             | Safe only with `numerical-tolerance`; back is expected value and tolerance.                                   |
| `single-choice`   | Yes       | Yes                | No                   | No          | No            | No             | Safe only with `choice-selection` and exactly one correct option.                                             |
| `multiple-choice` | Yes       | No                 | Yes                  | No          | No            | No             | Safe only with `choice-selection`; preserve option IDs and correct option IDs.                                |
| `confidence`      | No        | No                 | No                   | No          | No            | No             | This is self-rating evidence, not an answer-bearing item.                                                     |
| `code`            | No        | No                 | No                   | No          | No            | No             | Current code responses are rubric-assisted/ungraded; require an explicit reviewed solution before projection. |

### Evaluation Kind Projection

| Evaluation kind        | Flashcard | Single-choice quiz | Multiple-choice quiz | Text recall | Number recall | Manual reading | Notes                                                                           |
| ---------------------- | --------- | ------------------ | -------------------- | ----------- | ------------- | -------------- | ------------------------------------------------------------------------------- |
| `manual-completion`    | No        | No                 | No                   | No          | No            | Yes            | Records completion, not an answer.                                              |
| `exact-text`           | Yes       | No                 | No                   | Yes         | No            | No             | Requires `response.kind: text`; use `acceptedAnswers`.                          |
| `choice-selection`     | Yes       | Conditional        | Conditional          | No          | No            | No             | Single or multiple quiz depends on response kind.                               |
| `numerical-tolerance`  | Yes       | No                 | No                   | No          | Yes           | No             | Requires `response.kind: number`; use `expected` and `absoluteTolerance`.       |
| `rubric-assisted-text` | No        | No                 | No                   | No          | No            | No             | Currently ungraded. Do not infer a back from criteria text.                     |
| `extension`            | No        | No                 | No                   | No          | No            | No             | Unsafe unless the shared package defines and validates that extension contract. |

### Current Production Projection Summary

Safe deterministic projections:

- 20 single-choice quiz items
- 7 multiple-choice quiz items
- 1 text recall item
- 4 number recall items
- 10 manual reading items
- 32 deterministic flashcard backs, overlapping with the deterministic quiz and
  recall items

Unsupported current production activities without an explicit reviewed solution:

- `src/subjects/movement-planes/subject.ts`
  - `transfer-lunge-with-rotation`
- `src/subjects/machine-learning-foundations/subject.ts`
  - `transfer-build-risk-frame`
  - `transfer-jump-linear-model`
  - `explain-bce-penalty`
  - `transfer-evaluation-plan`
  - `explain-autograd-training-code`
  - `transfer-loop-to-transformer`

## Reviewed Solution And Flashcard Back Representation

The current Learnt contract has no explicit `front`, `back`,
`reviewedSolution`, `answerExplanation`, or `selfGrade` field.

Safe current backs:

- `choice-selection`: map `correctOptionIds` to labels in
  `response.options`. Keep option IDs for identity. Use labels as the visible
  back.
- `exact-text`: use `acceptedAnswers`; preserve `caseSensitive` and
  `trimWhitespace` as answer semantics.
- `numerical-tolerance`: use `expected` and `absoluteTolerance`.

Unsafe backs:

- `rubric-assisted-text.criteria.description` is not a deterministic answer.
  It is a grading aid and must not be projected as the flashcard back.
- `extension.payload` is opaque and currently unvalidated for portability.
- `code` responses have no deterministic solution in the current contract.
- manual completion has no answer.

Until the shared package owns a reviewed-solution or flashcard-back contract,
Learnt can only export deterministic backs from the built-in deterministic
evaluations above. A future reviewed solution should be represented by the
shared package, or by a shared-package-defined safe extension that Learnt
recognizes and validates. Learnt should not invent a local portable schema.

## Mapping Current Learnt Model To Shared Terms

| Shared term      | Current Learnt source                                                                            | Mapping notes                                                                                                                                                                                                                                                                                          |
| ---------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `LearningPack`   | None today                                                                                       | Wrap a validated `SubjectPackage` plus shared-package-owned manifest, play projections, theme metadata, and assets. Learnt currently has no pack manifest or installer.                                                                                                                                |
| `Subject`        | `SubjectPackage` in `src/core/contracts/subject.schema.ts`                                       | Map `id`, `version`, `title`, `summary`, `tags`, and the full authored arrays.                                                                                                                                                                                                                         |
| `Course`         | `SubjectPackage` or ordered `modules`                                                            | A Learnt subject can project as one course; modules sorted by `module.order` become course sections.                                                                                                                                                                                                   |
| `CurriculumNode` | `ModuleDefinition`, `ActivityDefinition`, concept prerequisite edges, activity `nextActivityIds` | Use modules for ordered sections, activities for sequence nodes, concept references for knowledge graph edges.                                                                                                                                                                                         |
| `Concept`        | `ConceptDefinition`                                                                              | Map `id`, `title`, `summary`, `tags`, `prerequisiteConceptIds`, `relatedConceptIds`.                                                                                                                                                                                                                   |
| `Objective`      | `LearningObjective`                                                                              | Map `id`, `statement`, `successCriteria`, `conceptIds`.                                                                                                                                                                                                                                                |
| `LearningItem`   | `ActivityDefinition`                                                                             | Map `id`, `moduleId`, `conceptIds`, `objectiveIds`, `title`, `kind`, `scaffoldLevel`, `blocks`, `response`, `evaluation`, `completionPolicy`, `nextActivityIds`.                                                                                                                                       |
| `StudySet`       | Derived from activities                                                                          | Build from safe projected play items. Labels come from subject tags, module ID/title, concept IDs, objective IDs, activity kind, and scaffold level.                                                                                                                                                   |
| `ThemeMetadata`  | None in subject data                                                                             | Learnt theme is app-owned CSS and runtime presentation policy. Export empty/default theme metadata unless the shared package provides app-safe fields.                                                                                                                                                 |
| `ReviewEvent`    | `EvidenceEvent` plus `LearningSessionRecord` context                                             | Map `evidenceEvent.id`, `timestamp`, learner/profile/session/subject/module/activity/objective IDs, `activityKind`, `response`, optional `confidence`, `hintsUsed`, and `evaluation`. Add `subjectVersion` and `revision` from the session record if the shared contract needs compatibility metadata. |

## Recommended Adapter Boundaries

Keep these boundaries separate:

1. Pack schema and validators live in the shared package.
2. Learnt export adapter reads a trusted `SubjectPackage` or `DefinedSubject`
   and calls shared package builders/validators.
3. Learnt import adapter accepts only shared-package-validated pack data, then
   passes canonical subject data through `defineSubject`.
4. Subject registration remains a runtime composition concern through
   `createSubjectAdapter` and `SubjectRegistry`.
5. Review-event export reads `LearningSessionRecord` and `EvidenceEvent`
   without exposing authored answer-key internals beyond what the shared review
   contract explicitly allows.
6. Presentation policy and CSS theme stay outside portable authored content.
7. Extension payloads fail closed unless the shared package declares them
   supported and JSON-safe.

## Smallest Safe SubjectPackage-To-LearningPack Exporter

The smallest safe exporter should:

1. Accept a `DefinedSubject` or unknown subject input.
2. Revalidate unknown input with `defineSubject`; for already trusted subjects,
   still serialize only the plain `SubjectPackage` data.
3. Build the shared package manifest from subject `id`, `version`, `title`,
   `summary`, and `tags`.
4. Include canonical subject content as the shared package's subject payload.
5. Derive play items only for safe cases:
   - no response plus `manual-completion` plus `manual` completion policy to
     manual reading
   - `single-choice` plus `choice-selection` to single-choice quiz and optional
     flashcard
   - `multiple-choice` plus `choice-selection` to multiple-choice quiz and
     optional flashcard
   - `text` plus `exact-text` to text recall and optional flashcard
   - `number` plus `numerical-tolerance` to number recall and optional
     flashcard
6. Mark or omit unsupported activities rather than guessing.
7. Reject or omit non-JSON-safe extension payloads unless the shared package
   has a validator for them.
8. Emit theme metadata only from shared-package-supported defaults or explicit
   app-safe inputs. Do not export CSS, React, presentation policy, or learner
   profile data as pack theme.

## Smallest Safe LearningPack-To-Learnt Importer

The smallest safe importer should:

1. Accept a value already validated by the shared package.
2. Require canonical subject content. Do not build a Learnt subject from
   `play-items` alone in the first importer.
3. Pass the canonical subject payload through `defineSubject`.
4. Wrap the result with `createSubjectAdapter`.
5. Register it with a caller-owned `SubjectRegistry`.
6. Reject duplicate subject IDs through existing `SubjectRegistry` behavior.
7. Reject unsupported required extensions before registration, or require the
   shared package validator to prove they are optional and recoverable.
8. Do not persist installed packs in current production storage until an
   installed-pack store and migration policy exist.

## Unsupported Activity Types And Cases

Unsupported for automatic flashcard/quiz/recall projection:

- `rubric-assisted-text` evaluations
- `extension` evaluations
- `extension` content blocks unless supported by the shared package
- `code` responses without an explicit reviewed solution
- `confidence` responses
- manual completion as an answer-bearing item
- text responses without `exact-text`
- number responses without `numerical-tolerance`
- choice responses without `choice-selection`
- activities without a `question` block for quiz/recall prompts, unless the
  shared package defines a deterministic prompt extraction rule
- any non-JSON-safe extension payload

Activity kinds not currently covered by production fixtures:

- `worked-example`
- `build`
- `modify`
- `reflect`

These kinds can still project safely if their response/evaluation pair is safe,
but new fixtures should be added before relying on them.

## Expected Migration Risks

- `DefinedSubject` trust does not survive JSON; every imported subject must go
  through `defineSubject`.
- Current persistence keys reference only `subjectId` and `subjectVersion`, not
  `packId` or `packVersion`.
- `SubjectRegistry` supports only one version per subject ID.
- There is no installed-pack persistence, discovery, migration, or deletion
  workflow.
- Rubric criteria look like answer hints but are not deterministic reviewed
  backs.
- Extension payloads are opaque and may not serialize.
- Recaps reconstruct labels against the currently registered compatible subject
  version; subject edits can break stored evidence reconstruction.
- Presentation policy is profile/session derived and should not be mistaken for
  pack theme.
- Flashcards app Markdown packs are term/definition-oriented, while Learnt
  activities can contain multi-block content and one response definition.
- Exact-text accepted answers are answer keys, not necessarily good explanatory
  backs.
- Numerical tolerance needs careful display so a flashcard back does not
  overstate exactness.
- Branching `nextActivityIds` are acyclic in Learnt v0.1; a shared package must
  preserve or explicitly transform this sequencing.

## Exact Tests To Add When Implementing Adapters

Add focused tests with these responsibilities:

- `src/learning-packs/subject-package-to-learning-pack.test.ts`
  - exports a production `DefinedSubject` without mutating or unfreezing it
  - includes canonical subject payload validated by the shared package
  - derives manual-read, single-choice, multiple-choice, text-recall, and
    number-recall items from the current production subjects
  - omits or reports the seven current rubric-assisted production activities
  - does not include learner profile, presentation policy, localStorage data,
    React component names, or CSS tokens
- `src/learning-packs/projection-answer-back.test.ts`
  - maps `choice-selection` correct IDs to option labels
  - maps `exact-text.acceptedAnswers` to text-recall backs
  - maps `numerical-tolerance.expected` and `absoluteTolerance` to number backs
  - proves rubric criteria are not used as flashcard backs
- `src/learning-packs/json-safety.test.ts`
  - rejects extension payloads containing functions, symbols, bigint values,
    cyclic objects, or `undefined` where the shared package requires JSON
  - accepts current extension-free production subjects
- `src/learning-packs/learning-pack-to-learnt.test.ts`
  - imports shared-package-validated canonical subject content through
    `defineSubject`
  - wraps imported subjects with `createSubjectAdapter`
  - registers imported adapters in a fresh `SubjectRegistry`
  - rejects duplicate subject IDs through existing registry behavior
  - rejects packs without canonical subject content in the first importer
  - rejects unsupported required extensions
- `src/learning-packs/review-event-export.test.ts`
  - maps persisted `EvidenceEvent` values to shared review events
  - includes subject/session/version compatibility metadata as required by the
    shared package
  - does not leak authored answer-key fields from subject definitions into
    review events unless the shared review contract explicitly includes them
- Extend `src/subjects/production-subjects.test.ts`
  - asserts every production activity has an explicit projection classification:
    safe deterministic, manual-read, or unsupported-with-reason
  - keeps the unsupported activity ID list deliberate when subjects change
