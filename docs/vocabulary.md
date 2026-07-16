# Vocabulary

These terms are canonical across code, tests, docs, and UI.

## Learner Profile

Stable instructions that describe how the system should present and sequence
learning for a learner. Profiles are distributed or persisted objects and carry
`schemaVersion: "0.1"`.

In v0.1, the learner profile is read-only operating configuration. It is not a
diagnosis engine, calibration system, competence model, or mutable session
state.

## Subject

A top-level learning domain distributed as a subject package. A subject contains
static authored data: modules, concepts, learning objectives, activities, and
optional extension manifests.

Current production subjects are Logic Basics, Movement Planes, and Machine
Learning Foundations. Production subjects are registered explicitly; they are
not discovered by filesystem scanning.

## Module

An ordered section within a subject. Modules group related concepts,
objectives, and activities through stable ID references.

## Concept

An atomic idea that can reference prerequisite and related concepts. Concepts do
not encode subject-specific categories in the core contract.

## Learning Objective

An observable capability associated with one or more concepts. Objectives should
describe learner behavior that can be demonstrated, not vague internal states.

Prefer:

```text
Classify a movement as primarily sagittal or frontal and explain the deciding feature.
```

Avoid:

```text
Understand movement planes.
```

## Activity

A learner-facing task intended to produce evidence. Activities contain content
blocks, a response definition when learner input is required, an evaluation
definition, and a completion policy.

## Content Block

A portable authored content unit rendered inside an activity. Standard block
kinds include text, code, equation, callout, comparison, question, and extension.

Question blocks display prompts only. They do not own learner response controls.

## Response Definition

The activity-level contract that determines the learner response control, such
as text, number, single choice, multiple choice, confidence, or code. An
activity has at most one response definition in v0.1.

## Evidence

An append-only learner submission record. Evidence payloads represent what the
learner submitted, such as selected options, text, code, a number, confidence,
or manual completion.

## Evidence Event

The engine-owned record created for one valid submission. An evidence event
stores the generated evidence ID, timestamp, learner/session/subject/activity
IDs, objective IDs, submitted payload, hints used, optional confidence metadata,
and the evaluation result. Retries create additional evidence events rather than
overwriting earlier evidence.

## Learning Session Record

A persisted aggregate containing one session, its ordered evidence events, the
persisted subject package version, and a repository revision. It is the storage
unit used for durable local persistence.

## Session Recap

An immutable read model derived from a compatible learning session record and
the registered subject package. It summarizes session metadata, progress,
current thread, activity attempts, timeline, and encountered concepts.

Session recap is not persisted and is not an answer-key view. It may show the
learner's submitted responses, but not authored answer-key definitions or
criteria internals.

## Current Thread

The session's active activity and intended return point. The current thread is
domain state stored on the learning session. It is not the same thing as the
browser route.

## Side Path

A concept being inspected without changing activity progression. In Increment
10, a side path is represented by the session concept route.

Side path != activity transition.

## Parked Path

A concept explicitly saved in the session for later exploration. Parked paths
are persisted concept IDs under session exploration state.

Parked path != evidence.

## Repository Revision

A nonnegative integer used for optimistic conflict detection. New session
records start at revision 0. Successful mutations increment the revision by one.
Stale writes are rejected rather than merged.

## Evaluation

A result produced by comparing evidence against activity criteria. Evaluation
definitions are static authored data. Evaluation results are mutable learner
data attached to evidence events.

In v0.1, evaluation measures one authored activity attempt. It does not establish
mastery, competence, retention, or profile calibration.

## Session

A bounded interaction with one active subject and one interaction mode.
Sessions are mutable learner data and carry current module/activity references,
activity progress, and evidence-event references.

Session lifecycle in v0.1 is:

```text
active -> completed
active -> abandoned
```

Completed and abandoned sessions do not accept further engine transitions.

## Activity Progress

The per-session status for each authored activity in the trusted subject.
Allowed progress paths are:

```text
unseen -> active -> attempted -> completed
unseen -> active -> completed
```

Failed or partial valid submissions move the current activity to attempted.
Successful submissions can move it to completed depending on completion policy.
The current activity remains selected until explicit advancement.

Concept view != attempt. Opening a concept route does not create activity
progress, evidence, evaluation, confidence metadata, or concept encounters.

## Interaction Mode

A deterministic policy label that influences future presentation behavior.
Supported modes are coach, flow, test, rescue, zoom, and recap.

Interaction mode is temporary session context. It can override presentation
behavior without modifying the stable learner profile.

## Presentation Policy

A transient derived configuration produced from a learner profile, interaction
mode, and activity definition. It tells future presentation code how to display
an authored activity without modifying the activity, selecting a next activity,
evaluating evidence, or persisting adaptive state.

## Subject Extension

A subject-specific renderer or evaluator registered behind a stable extension
key. The core validates the extension envelope, but future renderers or
evaluators validate their own payloads.

## Static Authored Data

Static subject data is authored once and should not contain learner progress:

- subjects
- modules
- concepts
- objectives
- activities
- content blocks
- response definitions
- evaluation definitions

## Mutable Learner Data

Mutable learner data records what happened during use:

- sessions
- activity progress
- evidence events
- evaluation results

Presentation policy is derived runtime state, not persisted learner data in
v0.1.

Storage envelopes use a separate `storageSchemaVersion`. Subject packages use
their own semantic `version`. Repository records use a mutable `revision`.
These are separate versioning concepts and should not be collapsed into the
domain `schemaVersion`.

## Learnt Application

The product-facing application facade for headless workflows. Future UI code
uses this API for learner summaries, subject summaries, session library entries,
session contexts, session recaps, and learning commands.

## Session Availability

Compatibility status for opening a persisted session with the current
application configuration. Availability is distinct from session lifecycle
status. A session can be `active` while unavailable because its subject is not
registered, its subject version differs, or it belongs to another learner
profile.

## Increment 2 Boundary

Subject schemas validate object shape only. Subject-package cross-reference
validation belongs to the subject SDK in Increment 3, including missing
references, duplicate IDs across subject arrays, prerequisite graph cycles, and
activity sequencing graph checks.
