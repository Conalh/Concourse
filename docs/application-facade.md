# Application Facade

Future UI code should use `LearntApplication` rather than coordinating the
engine, repository, subject registry, learner profile, and presentation resolver
directly.

## Reads

The facade exposes read models for:

- learner summary
- subject list
- subject overview
- session library
- session context
- session recap
- session concept exploration

Learner summaries intentionally omit reported traits and diagnostic metadata.

## Commands

The facade exposes commands for:

- start session
- submit evidence
- advance session
- change interaction mode
- park concept
- unpark concept
- abandon session

Commands use subject and session IDs. Callers do not supply learner identity,
profile identity, subject versions, evidence IDs, timestamps, or evaluations.

The React UI calls one facade method for one product operation. It does not call
the engine, repository, subject registry, presentation resolver, or
infrastructure adapters directly.

## Context Assembly

Session context is derived from:

```text
persisted learner state
+ registered authored subject
+ fixed learner profile
+ interaction mode
-> immutable learning session context
```

The context includes current authored content, current progress, current
activity evidence, latest evaluation for that activity, progress counts,
next-activity options, and presentation policy.

Session context also includes parked paths resolved as concept references so
the workspace can list saved side paths without a separate read.

Presentation policy is derived on read. It is not persisted.

React applies the returned presentation policy to layout and disclosure
behavior. It does not recalculate policy or write policy back into the session.

## Recap Assembly

Session recap is also derived on read:

```text
persisted session record
+ registered compatible subject
-> immutable SessionRecap
```

The recap includes session metadata, progress, current thread, module and
activity trail, attempt history, timeline, and encountered concepts. It does
not persist a derived copy and does not expose answer-key or criteria internals.

Choice responses are reconstructed as submitted labels from authored response
options. If a submitted option ID cannot be resolved with the registered subject
version, the facade fails closed with a subject-version mismatch.

## Concept Exploration Assembly

Session concept exploration is derived on read:

```text
persisted session record
+ registered compatible subject
+ concept ID from route
-> immutable SessionConceptExploration
```

The model includes the explored concept, authored prerequisites, authored
dependent concepts, authored related concepts, observable objectives, activities
that reference the concept, current-thread return data, parked paths, and
whether the explored concept is parked.

Reads do not change timestamps, revision, evidence, activity progress, current
activity, interaction mode, or parked paths.

`parkConcept` and `unparkConcept` accept only `sessionId` and `conceptId`.
The facade verifies learner/profile compatibility, subject registration,
subject version, concept existence, and active session status before delegating
to persistence. The returned model is derived from the committed record.

## Compatibility

The facade distinguishes:

- missing sessions
- unregistered subjects
- subject-version mismatch
- learner-profile mismatch
- repository scan issues

Unavailable sessions remain valid persisted data and can still appear in the
session library. They are not treated as corrupt merely because the current app
configuration cannot open them.

Some command paths deliberately load a record once to resolve the subject and
learner compatibility, then delegate to `PersistentLearningService`, which loads
again for revision-safe mutation. That double read preserves the repository's
conflict behavior instead of bypassing it.

## React Client Surface

The UI provider exposes a structural `LearntApplicationClient` containing only
the product operations needed by React:

- `getLearner`
- `listSubjects`
- `getSubjectOverview`
- `listSessions`
- `getSessionContext`
- `getSessionRecap`
- `getSessionConceptExploration`
- `startSession`
- `submitEvidence`
- `advanceSession`
- `changeInteractionMode`
- `parkConcept`
- `unparkConcept`
- `abandonSession`

This keeps browser components testable without exposing internal services.
