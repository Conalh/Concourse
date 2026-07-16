# Flashcards, Quizzes, And Portable Learning Packs

## Status

Draft.

## Date

2026-06-23

## Purpose

This document records how Learnt currently represents flashcard-like and
quiz-like learning material, and the target shape for a shared pack system that
can be used by both Learnt and a phone flashcards app.

The important boundary is:

```text
Author once as structured learning content.
Validate once as a pack.
Project into app-specific play modes.
```

Learnt should not maintain a separate quiz format, flashcard format, and subject
format that drift from each other.

## Current Method

### Source Of Truth

Learnt currently uses `SubjectPackage` as the authored content source of truth.
Production subjects live under `src/subjects/<subject-id>/subject.ts`.

Each subject is plain TypeScript data passed through:

```text
plain subject data
  -> defineSubject
  -> shape validation
  -> package-integrity validation
  -> immutable DefinedSubject
  -> SubjectAdapter
  -> SubjectRegistry
```

The current production catalog is registered explicitly in
`src/subjects/index.ts`. There is no runtime subject discovery, import/export
workflow, or downloadable pack installer yet.

### Generation

Learnt does not currently generate flashcards or quizzes at runtime.

Current learning content is manually authored as subject data. The engine
generates session IDs and evidence IDs, but it does not generate card prompts,
answers, labels, themes, or quiz items.

So, at the moment, "generation" means authoring a valid subject package and
letting the SDK validate it. A future generation pipeline should produce the
same package shape rather than bypassing it.

### Labeling

Current labels and classification come from structured fields on the subject
package:

- `subject.id`, `subject.title`, `subject.summary`, `subject.tags`
- `module.id`, `module.title`, `module.order`
- `concept.id`, `concept.title`, `concept.tags`, prerequisite concepts, and
  related concepts
- `objective.id`, `objective.statement`, and `objective.successCriteria`
- `activity.id`, `activity.title`, `activity.kind`, `activity.scaffoldLevel`
- `activity.moduleId`, `activity.conceptIds`, and `activity.objectiveIds`
- `response.kind` and choice `option.id` / `option.label`
- `evaluation.kind` and deterministic answer criteria
- `nextActivityIds` for authored sequence and branches

IDs are stable kebab-case machine identifiers. Display labels are separate
human-facing strings. This distinction is important for packs: IDs should remain
stable across apps, while display labels can be shown differently by each app.

### Quiz Representation

Quizzes are already represented well by activities.

A quiz-like activity usually has:

- a `question` content block for the prompt
- a response definition such as `single-choice`, `multiple-choice`, `text`, or
  `number`
- an evaluation definition such as `choice-selection`, `exact-text`, or
  `numerical-tolerance`
- a completion policy, usually `passing-evaluation`

The current deterministic evaluators are:

- manual completion
- exact text
- choice selection
- numerical tolerance

Rubric-assisted text and extension evaluators currently produce ungraded
results unless a real evaluator is added later.

### Flashcard Representation

There is no dedicated flashcard contract today.

The closest current representation is a `recall` activity with a `question`
block and a response/evaluation pair. That works for recall prompts, but it does
not fully model a classic front/back flashcard because there is no explicit
`front`, `back`, `answerExplanation`, or self-grade field in the core contract.

For now, flashcards should be treated as a projection of activities:

- Front: activity title plus the primary `question` block.
- Back: correct choice labels, accepted exact-text answers, or a reviewed
  explanation attached by the pack projection.
- Review result: either existing deterministic evidence or a future self-grade
  response.

Do not add arbitrary React, CSS, or app-specific rendering code to subject data
to make flashcards work. If a specialized card renderer is needed later, use a
declared extension with a safe payload and keep unsupported extensions
recoverable.

### Theming

The current app theme is application-owned.

Visual styling lives in CSS tokens under `src/ui/styles/`. Subject packages do
not contain visual themes, color palettes, icons, CSS, React components, or
mobile layout instructions.

Learnt also has a runtime presentation policy derived from:

```text
learner profile
  -> interaction mode
  -> activity semantics
  -> presentation policy
```

That policy affects presentation behavior such as density, hint access,
checkpoint behavior, and solution reveal timing. It is not a downloadable pack
theme and is not persisted as authored content.

## Target Unified Pack Model

The shared unit should be a portable `LearningPack`. A pack is an installable
folder or archive containing a canonical subject package plus app-safe metadata
for distribution, projection, and theme hints.

Recommended layout:

```text
my-pack/
  pack.json
  subject.json
  play-items.json
  theme.json
  assets/
    icon.svg
    cover.png
```

`subject.json` should be the canonical content. `play-items.json` should be a
derived projection for apps that want a simpler flashcard/quiz player. If both
exist, `subject.json` wins and `play-items.json` can be regenerated.

### Pack Manifest

`pack.json` should identify the distributable pack, not learner progress.

Example:

```json
{
  "schemaVersion": "0.1",
  "packId": "logic-basics-core",
  "version": "0.1.0",
  "title": "Logic Basics Core",
  "summary": "Boolean values, operators, and compound decision rules.",
  "author": "Learnt",
  "license": "proprietary-review-required",
  "language": "en-US",
  "subjectId": "logic-basics",
  "subjectVersion": "0.1.0",
  "themeId": "learnt-dark-green",
  "assetManifest": [
    {
      "path": "assets/icon.svg",
      "kind": "icon",
      "sha256": "<hash>"
    }
  ]
}
```

### Subject Content

`subject.json` should be the JSON form of the current `SubjectPackage` contract:

- modules
- concepts
- objectives
- activities
- content blocks
- responses
- evaluations
- extension manifests

Learnt can import this directly through the same validation pipeline used by
`defineSubject`, then wrap it in a subject adapter.

### Play Item Projection

`play-items.json` should be a phone-friendly projection of the canonical
activities. It should be useful to the Flashcards app without requiring the full
Learnt session engine.

Example:

```json
{
  "schemaVersion": "0.1",
  "sourceSubjectId": "logic-basics",
  "sourceSubjectVersion": "0.1.0",
  "items": [
    {
      "id": "logic-basics.predict-negation",
      "sourceActivityId": "predict-negation",
      "playKind": "single-choice-quiz",
      "title": "Predict NOT true",
      "prompt": "What is NOT true?",
      "choices": [
        { "id": "option-true", "label": "true" },
        { "id": "option-false", "label": "false" }
      ],
      "correctChoiceIds": ["option-false"],
      "labels": {
        "subjectTags": ["logic", "reasoning", "foundations"],
        "conceptIds": ["boolean-values", "logical-negation"],
        "objectiveIds": ["predict-negation"],
        "activityKind": "predict",
        "scaffoldLevel": "guided"
      },
      "themeSlot": "default"
    }
  ]
}
```

Supported `playKind` values should start small:

- `flashcard`
- `single-choice-quiz`
- `multiple-choice-quiz`
- `text-recall`
- `number-recall`
- `manual-read`

The projection should never be the only place an answer key exists if the pack
also includes `subject.json`. It is a distribution convenience, not a second
source of truth.

### Theme Metadata

`theme.json` should be a constrained metadata file, not arbitrary CSS.

Example:

```json
{
  "schemaVersion": "0.1",
  "themeId": "learnt-dark-green",
  "displayName": "Learnt Dark Green",
  "accentColor": "#33c27e",
  "backgroundRole": "dark",
  "iconPath": "assets/icon.svg",
  "coverPath": "assets/cover.png"
}
```

Allowed theme data should be limited to semantic hints:

- accent color
- light/dark preference
- icon asset
- cover asset
- optional sound or haptic profile keys later

Packs should not ship CSS, JavaScript, React components, HTML, or executable
theme code. Each app maps the same theme metadata into its own native visual
system.

## Flashcard And Quiz Mapping Rules

### Activity To Quiz

Use this mapping for quiz projections:

| Learnt activity field            | Pack play item field             |
| -------------------------------- | -------------------------------- |
| `activity.id`                    | `sourceActivityId`               |
| `activity.title`                 | `title`                          |
| first `question.prompt`          | `prompt`                         |
| `response.kind: single-choice`   | `playKind: single-choice-quiz`   |
| `response.kind: multiple-choice` | `playKind: multiple-choice-quiz` |
| `response.options`               | `choices`                        |
| `evaluation.correctOptionIds`    | `correctChoiceIds`               |
| `activity.conceptIds`            | `labels.conceptIds`              |
| `activity.objectiveIds`          | `labels.objectiveIds`            |
| `activity.kind`                  | `labels.activityKind`            |

### Activity To Flashcard

Use this mapping for flashcard projections:

| Learnt activity field                         | Pack play item field   |
| --------------------------------------------- | ---------------------- |
| `activity.id`                                 | `sourceActivityId`     |
| `activity.title`                              | `title`                |
| first `question.prompt`                       | `front`                |
| choice answer labels or accepted text answers | `back`                 |
| optional reviewed explanation                 | `explanation`          |
| `activity.conceptIds`                         | `labels.conceptIds`    |
| `activity.objectiveIds`                       | `labels.objectiveIds`  |
| `activity.scaffoldLevel`                      | `labels.scaffoldLevel` |

Activities without deterministic answers can still become flashcards, but the
back must be explicitly reviewed author content, not guessed from rubric text.

## Generation Pipeline

A future generator should use this flow:

```text
source material or topic
  -> draft modules, concepts, objectives, activities
  -> normalize IDs and labels
  -> validate SubjectPackage shape
  -> validate whole-package integrity
  -> generate play-items projection
  -> validate pack manifest, theme, assets, and hashes
  -> human review
  -> publish pack archive
```

Generation rules:

- Generate stable kebab-case IDs from the semantic meaning, not from array
  position.
- Keep display labels short enough for phone UI.
- Prefer one prompt and one response per play item.
- Put answer keys in evaluation definitions, not UI strings.
- Use concepts and objectives as durable labels for search, filtering, and
  spaced repetition.
- Keep learner progress out of packs.
- Treat generated content as draft until reviewed.

## Distribution Rules

A distributable pack should be immutable by `(packId, version)`.

Installers should reject or warn on:

- invalid schema versions
- duplicate IDs
- missing references
- subject-version mismatch
- unsupported executable content
- missing asset hashes
- unsupported required extensions

Learner progress should reference:

```text
packId
packVersion
subjectId
subjectVersion
activityId or playItemId
```

This lets a phone app and Learnt share content identity without sharing the same
local persistence format.

## Implementation Slices

1. Add JSON import/export for `SubjectPackage`.
2. Add a `LearningPack` manifest schema and validator.
3. Add an activity-to-play-item projection function.
4. Add a basic pack archive layout under `packs/<pack-id>/`.
5. Let Learnt register imported packs beside compiled production subjects.
6. Let the Flashcards app consume `play-items.json` first, then optionally learn
   to import full `subject.json`.
7. Add a reviewed flashcard-back authoring field or safe extension only if the
   projection from deterministic activities is not enough.

## Decision For Now

Use `SubjectPackage` as the canonical content model and introduce
`LearningPack` as the portable distribution wrapper.

Flashcards and quizzes should be play projections of the same authored
activities. The phone app can play the projected `play-items.json`; Learnt can
use the richer `subject.json` for sessions, evidence, recaps, concept maps, and
future adaptive presentation.
