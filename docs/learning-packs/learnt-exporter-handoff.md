# Learnt Learning Pack Exporter Handoff

## Scope

The exporter maps a validated Learnt `SubjectPackage` into the shared
`@learnt/learning-pack-contracts` unpacked document set:

- `pack.json`
- `catalog.json`
- `courses.json`
- `items.json`
- `sets.json`

The adapter is pure and lives at `src/learning-packs/learnt-exporter.ts`.
The development command is:

```bash
npm run export:learning-pack -- [subject-id] [output-dir] [--force]
```

The default production export is `movement-planes` into
`output/learning-packs/movement-planes`. The command validates the generated
pack with `validateLearningPackDocuments` before creating or writing files.

## Field Mappings

### Manifest

| Shared field            | Learnt source                                                                            |
| ----------------------- | ---------------------------------------------------------------------------------------- |
| `schemaVersion`         | Shared package `SCHEMA_VERSION`                                                          |
| `packId`                | `learnt.${subject.id}` unless explicitly supplied                                        |
| `version`               | `subject.version`                                                                        |
| `title`                 | `subject.title`                                                                          |
| `summary`               | `subject.summary`                                                                        |
| `language`              | Export option, default `en-US`                                                           |
| `license`               | Export option, default `proprietary-review-required`                                     |
| `authors[0].name`       | Export option, default `Learnt`                                                          |
| `releasedAt`            | Export option, default `2026-06-23T00:00:00.000Z`                                        |
| `keywords`              | `subject.tags`                                                                           |
| `capabilities.required` | `core.learning-pack@0.1`                                                                 |
| `capabilities.optional` | Recoverable Learnt-specific renderer, response, or rubric capabilities                   |
| `files`                 | Hash and byte metadata for `catalog.json`, `courses.json`, `items.json`, and `sets.json` |

### Catalog

| Shared field                        | Learnt source                    |
| ----------------------------------- | -------------------------------- |
| `subjects[0].subjectId`             | `subject.id`                     |
| `subjects[0].title`                 | `subject.title`                  |
| `subjects[0].summary`               | `subject.summary`                |
| `subjects[0].tags`                  | `subject.tags`                   |
| `subjects[0].conceptIds`            | `subject.concepts[].id`          |
| `subjects[0].objectiveIds`          | `subject.objectives[].id`        |
| `subjects[0].courseIds`             | Generated default course ID      |
| `concepts[].conceptId`              | `concept.id`                     |
| `concepts[].title`                  | `concept.title`                  |
| `concepts[].summary`                | `concept.summary`                |
| `concepts[].tags`                   | `concept.tags`                   |
| `concepts[].prerequisiteConceptIds` | `concept.prerequisiteConceptIds` |
| `concepts[].relatedConceptIds`      | `concept.relatedConceptIds`      |
| `objectives[].objectiveId`          | `objective.id`                   |
| `objectives[].statement`            | `objective.statement`            |
| `objectives[].successCriteria`      | `objective.successCriteria`      |
| `objectives[].conceptIds`           | `objective.conceptIds`           |

Learnt response and evaluation definitions do not currently have standalone IDs.
The exporter preserves activity IDs as `LearningItem.itemId`, choice option IDs
as `ChoiceOption.optionId`, and deterministic evaluator criteria in the shared
evaluation fields.

### Courses And Curriculum Nodes

The exporter creates one course per subject unless explicit course metadata is
passed to the adapter.

| Shared field                  | Learnt source                                                |
| ----------------------------- | ------------------------------------------------------------ |
| `courseId`                    | `${subject.id}-course` unless explicitly supplied            |
| `title`                       | `subject.title` unless explicitly supplied                   |
| `summary`                     | `subject.summary` unless explicitly supplied                 |
| `subjectIds`                  | `[subject.id]`                                               |
| `tags`                        | `subject.tags` unless explicitly supplied                    |
| `rootNodes[]`                 | `subject.modules`, sorted by `module.order` then `module.id` |
| `rootNodes[].nodeId`          | `module.id`                                                  |
| `rootNodes[].kind`            | `module`                                                     |
| `rootNodes[].title`           | `module.title`                                               |
| `rootNodes[].summary`         | `module.summary`                                             |
| `rootNodes[].itemIds`         | `module.activityIds`                                         |
| `rootNodes[].conceptIds`      | `module.conceptIds`                                          |
| `rootNodes[].objectiveIds`    | `module.objectiveIds`                                        |
| `rootNodes[].children`        | Empty array                                                  |
| `rootNodes[].customKindLabel` | `null`                                                       |

### Learning Items

| Shared field             | Learnt source                                                                 |
| ------------------------ | ----------------------------------------------------------------------------- |
| `itemId`                 | `activity.id`                                                                 |
| `learningRevision`       | `1`                                                                           |
| `title`                  | `activity.title`                                                              |
| `promptBlocks`           | Mapped `activity.blocks`                                                      |
| `response`               | Mapped `activity.response` or `none` for manual completion                    |
| `evaluation`             | Mapped deterministic evaluator, manual completion, or self-grade review       |
| `reviewedSolutionBlocks` | Generated only from safe deterministic answers or explicit reviewed solutions |
| `conceptIds`             | `activity.conceptIds`                                                         |
| `objectiveIds`           | `activity.objectiveIds`                                                       |
| `allowedPlayModes`       | Conservative mode list from the response/evaluation pair                      |

Content block mapping:

| Learnt block                                      | Shared block                                                         |
| ------------------------------------------------- | -------------------------------------------------------------------- |
| `text.body`                                       | `text.text`                                                          |
| `question.prompt` plus optional `supportingText`  | `question.text`                                                      |
| `code.source` plus optional `caption`             | `code.text`; `language` preserved                                    |
| `equation.expression` plus optional `description` | `equation.text`                                                      |
| `callout.title` plus `body`                       | `callout.text`; role mapped to note/tip/warning                      |
| `comparison.items`                                | Linearized `text` block, one `Label: body` line per item             |
| `extension`                                       | Omitted from prompt blocks; renderer declared as optional capability |

Response/evaluation mapping:

| Learnt response/evaluation                                   | Shared response/evaluation             | Allowed modes                                                   |
| ------------------------------------------------------------ | -------------------------------------- | --------------------------------------------------------------- |
| No response + `manual-completion` + manual completion policy | `none` + `manual-completion`           | `manual-read`                                                   |
| `single-choice` + `choice-selection` with one correct option | `single-choice` + `choice-selection`   | `single-choice-quiz`, plus `flashcard` when a solution exists   |
| `multiple-choice` + `choice-selection`                       | `multiple-choice` + `choice-selection` | `multiple-choice-quiz`, plus `flashcard` when a solution exists |
| `text` + `exact-text`                                        | `text` + `exact-text`                  | `text-recall`, plus `flashcard` when a solution exists          |
| `number` + `numerical-tolerance`                             | `number` + `numerical-tolerance`       | `number-recall`, plus `flashcard` when a solution exists        |
| `text` or `code` + `rubric-assisted-text`                    | `self-grade` + `self-grade`            | `self-grade-review` only                                        |

Generated deterministic solution text:

| Evaluator              | Solution source                        |
| ---------------------- | -------------------------------------- |
| `choice-selection`     | Correct option labels                  |
| `exact-text`           | Accepted answer strings                |
| `numerical-tolerance`  | Expected number and absolute tolerance |
| `rubric-assisted-text` | No generated solution                  |
| `manual-completion`    | No generated solution                  |

Rubric criteria are never converted into solution text.

### Sets

The exporter emits one practice set per subject:

| Shared field                   | Value                                               |
| ------------------------------ | --------------------------------------------------- |
| `setId`                        | `${subject.id}-study-set`                           |
| `kind`                         | `practice`                                          |
| `title`                        | `${subject.title} Practice`                         |
| `summary`                      | `All exported practice items for ${subject.title}.` |
| `selection.kind`               | `rule`                                              |
| `selection.include.subjectIds` | `[subject.id]`                                      |
| `selection.include.courseIds`  | `[courseId]`                                        |
| `playModes`                    | Union of exported item `allowedPlayModes`           |
| `ordering`                     | `authored`                                          |
| `timeLimitSeconds`             | `null`                                              |
| `attemptLimit`                 | `null`                                              |

## Excluded State

The exporter never reads or writes:

- learning sessions
- evidence events
- learner IDs
- learner profiles
- interaction modes
- presentation policy
- review events or progress records

## Known Unsupported Cases

- `confidence` responses fail clearly because the shared response contract has
  no confidence response.
- `extension` evaluators fail clearly because they are required grading logic
  and cannot be represented by the shared contract.
- `extension` content blocks are recoverable only as optional renderer
  capabilities; their payloads are not copied into pack JSON.
- `rubric-assisted-text` activities export as `self-grade-review` only. The
  rubric is declared through optional capabilities and is not used to generate a
  flashcard back.
- Non-rubric code responses fail clearly.
- The shared package requires IDs to be globally unique across subjects,
  concepts, objectives, courses, curriculum nodes, items, sets, themes, and
  assets. The exporter preserves Learnt IDs exactly, so subjects with
  cross-entity collisions fail shared validation rather than silently
  namespacing IDs. Current known production collisions:
  - `logic-basics`: objective and activity `predict-negation`
  - `machine-learning-foundations`: objective/activity collisions for
    `calculate-linear-prediction`, `calculate-residual`, `calculate-mse`, and
    `trace-computational-graph`
- The exporter does not emit `theme.json`, `migrations.json`, assets, CSS,
  React renderers, app presentation policy, or installed-pack migration state.
