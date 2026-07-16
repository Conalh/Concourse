# Unified Practice Foundation

## Status

Implemented first foundation slice on 2026-06-23. Learnt can now resolve
portable Practice requests from installed learning packs, create deterministic
PracticePlans, start native Learnt sessions, project flashcards into self-grade
activities, keep quiz/recall items on the existing activity player, and derive
private practice metrics from evidence.

This is not the final visual redesign and does not copy Flashiet's local storage
model. Flashiet remains a reference for desired deck/quiz behavior; Learnt's
implementation uses canonical `LearningItem`, `StudySet`, curriculum, and
Learnt evidence records.

## Pipeline

```text
LearningPack
  -> scope resolution
  -> PracticeRequest
  -> canonical LearningItem candidates
  -> PracticePlan
  -> scoped Learnt subject
  -> existing session engine and evidence
  -> private practice metrics and recommendations
```

Canonical pack content stays immutable. Learner attempts, self-grades, recent
mistakes, and weak concepts are derived from saved Learnt sessions.

## New Runtime APIs

Application facade methods:

- `getAvailablePracticeScopes()`
- `getSupportedPracticeModes({ packId, itemId })`
- `createPracticeRequest(input)`
- `createPracticePreset(input)`
- `resolvePracticeCandidates({ scope })`
- `createPracticePlan(request)`
- `startPracticeSession(request)`
- `getPracticeSummary({ packId, subjectId })`
- `getWeakConcepts({ packId, subjectId, limit })`
- `getRecentMistakes({ packId, subjectId, limit })`

Pure runtime helpers live in `src/application/practice-runtime.ts`.

## Modes

Public Practice modes:

- `flashcard`
- `quiz`
- `recall`
- `mixed`

Resolved per-item modes:

- `flashcard`: requires authored `flashcard` play mode and usable reviewed
  solution blocks.
- `quiz`: supports authored `single-choice-quiz` and `multiple-choice-quiz`
  with deterministic choice evaluation.
- `recall`: supports authored `text-recall`, `number-recall`, and
  `self-grade-review` when the item has the matching response/evaluation shape.
- `mixed`: chooses quiz first, then recall, then flashcard.

Unsupported items are excluded from a plan with a reason rather than forced into
an incompatible activity shape.

## Scopes

Implemented scope kinds:

- pack
- subject
- course
- curriculum node
- concepts
- objectives
- StudySet
- explicit items
- weak items
- recent mistakes

Pack and course scopes may span multiple installed subjects. When that happens,
Learnt builds a synthetic practice source subject from installed pack adapters,
then creates a scoped practice session from the selected canonical item IDs.

## Selection

Implemented selection strategies:

- `authored-order`
- `random` with stable seed hashing
- `weakest-first`
- `recent-mistakes`
- `least-seen`
- `balanced-by-concept`
- `due-or-weak`

`due-or-weak` currently uses weak and least-seen ordering because no portable due
scheduler exists yet. The plan records a warning when it falls back.

## PracticePlan

`PracticePlan` records:

- plan ID
- original request
- pack ID and pack version
- selected item IDs
- resolved mode and play mode per item
- learning revision per item
- strategy and seed
- coverage
- exclusions and warnings
- origin
- created timestamp
- display summary

Persisted sessions store compact `exploration.learningFlow.kind =
"practice-plan"` state so reload and submission paths can reconstruct the
practice subject without writing learner data into pack content.

## Flashcard Evidence

Flashcard practice projects the item prompt/front into the activity blocks and
keeps reviewed solution/back blocks in `context.practice.currentItem.backBlocks`.

The UI requires a reveal before self-grade. Self-grade buttons submit Learnt
confidence evidence:

- Again -> `{ kind: "confidence", value: 1 }`
- Hard -> `{ kind: "confidence", value: 2 }`
- Good -> `{ kind: "confidence", value: 4 }`
- Easy -> `{ kind: "confidence", value: 5 }`

Flashcards use an extension evaluation
`learnt.practice-flashcard-self-grade` with `completionPolicy: "submission"`.
The result is intentionally `ungraded`; self-grades do not become deterministic
correctness.

Quiz and deterministic recall items stay on the existing activity response,
evaluation, evidence, recap, and persistence paths.

## Metrics

Practice summary derives:

- attempts per item
- success rate for deterministic responses
- self-grade distribution
- last practiced timestamp
- recent unsuccessful items
- weak concepts
- least-seen items
- mode availability
- exclusions

Confusion relationships are not inferred yet. The current extension point is a
typed empty `confusionRelationships` array plus a warning explaining that Learnt
needs authored or evaluator-produced confusion evidence before it can derive
portable confusion links.

## Preferences Boundary

The runtime exposes `PracticePreferences` defaults for count, weak/recent
inclusion, and flashcard scale. It does not add a full profile setup flow in this
slice.

## Temporary UI

`#/practice` is a temporary launcher, not the final Claude visual design. It can
load available scopes, choose mode, strategy, and item count, then start a native
practice session. The workspace has a flashcard-specific reveal/self-grade UI
and terminal practice summary counts.

The library and Transfer surfaces can also launch native practice directly from
installed pack routes, curriculum sections, and StudySets. These buttons build
normal `PracticePlan` sessions with course, curriculum-node, or StudySet scopes
and preserve local return-route metadata in the learning-flow origin.

## Pack Update Behavior

Practice sessions persist pack ID, pack version, item ID, play mode, and item
learning revision. Reload fails closed if the installed pack version no longer
matches the persisted practice plan version. Historical evidence stays private
and remains outside installed pack content.

## Remaining Practice Work

- spaced-review scheduling policy
- mature deck queue UX
- mature quiz setup UX and distractor design beyond canonical choices
- richer progress visualizations
- import/export decisions for Flashiet decks into canonical learning packs
- final Claude visual redesign
- optional cross-app deep-link conventions
