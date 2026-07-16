# Machine Learning Foundations Course Experience Design

## Status

Approved for implementation planning.

## Date

2026-07-10

## Objective

Turn Machine Learning Foundations into Concourse's first complete learner-facing
course. Learners must be able to start, resume, understand, practice, and finish
the existing six-module, 33-activity course without encountering authoring
metadata or diagnostic panels in the primary flow.

The course must teach with concise in-app explanations and worked examples,
preserve the existing assessment sequence, and identify the source and license of
all adapted material.

## Product Outcome

A learner opens Machine Learning Foundations and sees one next action. They can
open every module card to understand its goal and lesson sequence. The current
module resumes at its next activity; future modules explain the prerequisite that
keeps the sequence coherent. Each lesson presents a clear explanation before its
existing check and persists learner progress through the existing native session
engine.

```text
Course home
  -> current module and lesson
  -> Understand: explanation + worked example + source
  -> Try it: existing activity response
  -> Feedback: existing evaluation and solution
  -> Next authored activity
  -> saved session and updated course progress
```

## Scope

- The existing `machine-learning-foundations` subject.
- All six modules and their 33 authored activities.
- Learner-facing course home, module preview, session lesson layout, and source
  attribution.
- Derived progress for the active course session.
- Browser and packaged-desktop verification of the course flow.

## Non-Goals

- Replacing the subject/session engine or the authored activity graph.
- Allowing learners to bypass an unfinished prerequisite module.
- Adding accounts, hosted progress, cloud sync, payments, ratings, marketplace,
  or social features.
- Copying material from sources that are free to read but lack a reuse license.
- Turning Concourse into an embedded external-book reader.
- Adding module-scoped review practice before a native, built-in-subject scope is
  available through the practice engine.

## Learner Experience

### Course Home

The subject overview becomes a course home with one primary action:

- `Start course` when no active session exists.
- `Continue: <next lesson>` when an active session exists.
- `Start a new course session` after a completed session.

The hero keeps the course title, short promise, and tags. It removes route
statistics, package provenance, capability status, scaffold labels, activity
kinds, and other implementation-facing language.

Each module card is a semantic button that opens a learner-facing module preview.
It shows the module goal, number of lessons, lesson titles, and one status:

- `Start here`: first module before the course begins.
- `Continue`: the module containing the saved next activity.
- `Up next`: a later module; its preview names the prerequisite module and
  presents no bypass action.
- `Complete`: a module whose activities are complete in the active or most
  recently completed course session; its preview shows the completed lesson
  sequence and outcome.

The current module's action navigates to the existing session route. A learner
can inspect every module, but only the current module can launch an unfinished
lesson. This makes cards useful without corrupting the authored prerequisite
graph.

### Lesson Screen

The main lesson path is always:

1. `Understand`: a core idea in plain language.
2. `See it`: a compact worked example using the course's recurring game-telemetry
   or build-risk contexts.
3. `Try it`: the existing response control and evaluation policy.
4. `See why`: existing feedback and reviewed solution, where the activity has
   one.
5. `Continue`: the existing authored next activity.

`Concept context` is removed from the primary reading order. A collapsed `Key
ideas` disclosure may show only the current lesson's concept definitions and
objective statements. It must not show prerequisites, identifiers, session
metadata, pack metadata, or implementation state.

`Sources and further learning` appears after lesson content. It gives the source
title, a human-readable attribution, license, and external link. It does not
interrupt the activity or require a network connection to complete the lesson.

## Content and Source Policy

Existing activity `blocks` remain the canonical in-app teaching content. Each of
the 33 activities gains a clear explanatory block sequence before its activity
prompt. New explanations are concise, course-specific, and use the activity's
existing concepts, objective, and response shape.

Each activity may declare source references using this contract:

```ts
type ActivitySourceReference = Readonly<{
  title: string
  url: `https://${string}`
  attribution: string
  license: 'CC-BY-4.0' | 'CC-BY-SA-4.0'
  use: 'adapted' | 'further-reading'
}>

type ActivitySourceReferenceOwner = Readonly<{
  sourceReferences?: readonly ActivitySourceReference[]
}>
```

`ActivityDefinition` adds the optional
`sourceReferences?: readonly ActivitySourceReference[]` field. It keeps course
content, source metadata, and the learner screen together while leaving existing
subjects and imported pack adapters valid. Every Machine Learning Foundations
activity must declare at least one `adapted` Google ML Crash Course reference.

The first course source map is:

| Module                                  | Adapted source                                                       | Further reading                                 |
| --------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------- |
| The Learning System                     | Google ML Crash Course: Introduction to ML and Production ML Systems | Dive into Deep Learning: Introduction           |
| Linear Models as Functions              | Google ML Crash Course: Linear Regression                            | Dive into Deep Learning: Linear Regression      |
| Loss, Gradients, and Optimization       | Google ML Crash Course: Linear Regression Loss and Gradient Descent  | Dive into Deep Learning: Optimization           |
| Classification, Scores, and Probability | Google ML Crash Course: Logistic Regression and Classification       | Dive into Deep Learning: Classification         |
| Generalization and Evaluation           | Google ML Crash Course: Datasets, Generalization, and Overfitting    | Dive into Deep Learning: Generalization         |
| Bridge to Deep Learning                 | Google ML Crash Course: Neural Networks                              | Dive into Deep Learning: Multilayer Perceptrons |

Google ML Crash Course material used in the lesson content is adapted under
CC-BY-4.0 and carries attribution plus a source link. Dive into Deep Learning is
CC-BY-SA-4.0; this first slice links to it as further reading rather than adapting
its text. Any later adaptation of Dive into Deep Learning must ship in a
separately identified CC-BY-SA-compatible learning pack. Material from the
Deep Learning textbook by Goodfellow, Bengio, and Courville remains an external
reference only because free online availability does not authorize reproduction.

## Application Architecture

The existing session engine remains the only writer of learner progress. Course
home state is derived from saved session records; no course-progress store or
parallel completion state is added.

The application facade gains a read-only course-progress projection:

```ts
type CourseModuleStatus = 'start' | 'current' | 'up-next' | 'complete'

type CourseModuleProgress = Readonly<{
  moduleId: ModuleId
  status: CourseModuleStatus
  completedActivityCount: number
  activityCount: number
  prerequisiteModuleTitle: string | null
}>

type CourseProgress = Readonly<{
  subjectId: SubjectId
  sessionId: SessionId | null
  nextActivityId: ActivityId | null
  modules: readonly CourseModuleProgress[]
}>

getCourseProgress(input: { subjectId: SubjectId }): Promise<CourseProgress>
```

The projection selects the ready active session for the subject. When there is no
active session, it selects the latest ready completed session only to show module
completion; it never resumes a completed session. The existing `startSession`,
`submitEvidence`, and advancement interfaces retain ownership of all mutations.

The UI uses `CourseProgress` for labels and destinations. It must not calculate
module status from display order or colors alone. Existing imported-pack learning
resource interfaces are unchanged in this slice.

## Accessibility and Responsive Behavior

- Course and module actions are native buttons or links with visible text labels.
- Module previews have a stable heading and receive focus when opened.
- Status is always conveyed by text as well as visual styling.
- The lesson has one `h1`; supporting sections use ordered `h2` headings.
- `Key ideas` and `Sources and further learning` use native disclosure controls.
- The course home works at 320 px, 768 px, 1024 px, and 1440 px without
  horizontal scrolling or hidden primary actions.

## Error and Offline Behavior

- A failed course-progress read shows the existing recoverable error with a retry
  action and does not hide the course title.
- A failed session start leaves the learner on course home with the existing
  actionable error.
- An external source link is optional enrichment; the course remains teachable
  and completable offline.
- Missing source metadata renders no source section. The app never invents an
  attribution or license.

## Acceptance Criteria

1. Machine Learning Foundations presents a learner-facing course home with a
   start or continue action and no author/debug terminology in the primary path.
2. Every module card opens a preview. The current module resumes its existing
   next activity; a future module identifies its prerequisite without allowing a
   bypass.
3. All 33 activities include a core explanation and a worked example before the
   existing interactive task.
4. Each activity with adapted material renders an accurate attribution, license,
   and source link; further-reading links are labeled as such.
5. Completing an activity uses the existing evidence/advancement path and
   persists after reload.
6. Course home progress reflects saved session data rather than static UI state.
7. The course path is keyboard usable and renders without browser or packaged
   desktop console errors.

## Test Strategy

- Contract tests prove that source-reference validation accepts valid CC source
  metadata and keeps activities without references valid.
- Subject tests prove the six-module course has 33 activities and each activity
  contains the required teaching content plus an adapted Google ML Crash Course
  source reference.
- Application tests prove `getCourseProgress` selects active and completed
  sessions correctly without writing new state.
- Product-flow tests prove start, current-module resume, locked-module preview,
  evidence submission, advancement, reload, and attribution rendering.
- Browser and packaged-desktop smoke tests inspect the learner path, console,
  keyboard tab order, and screenshots at the required breakpoints.

## Delivery Boundaries

The implementation is one course-experience slice, not a redesign of every
Concourse subject. New generic contracts remain optional and are adopted first by
Machine Learning Foundations. No generated design document is modified.
