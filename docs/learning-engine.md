# Learning Engine

The learning engine is the framework-agnostic core for session transitions,
deterministic evaluation, and append-only evidence creation.

## Trusted Input

The engine consumes a complete immutable `SubjectPackage` already accepted by
`defineSubject`. It trusts that subject-authoring integrity has been checked by
the subject SDK and does not repeat that pipeline. The public engine type is:

```text
LearningSubject = DeepReadonly<SubjectPackage>
```

The application layer will later obtain a trusted subject from the registry and
pass it into the engine.

## State Transitions

Activity progress supports:

```text
unseen -> active -> attempted -> completed
unseen -> active -> completed
```

Session lifecycle supports:

```text
active -> completed
active -> abandoned
```

The engine returns a new frozen session for each successful state transition.
Inputs are not mutated.

Session exploration state supports:

```text
parkConcept(active session, concept ID)
unparkConcept(active session, concept ID)
```

These transitions only update `lastActiveAt` and
`exploration.parkedConceptIds`. They preserve current module, current activity,
activity progress, evidence IDs, interaction mode, profile, and lifecycle
status.

## Evidence

Every valid submission creates one evidence event. Evidence is append-only:
retries create new events, old event IDs remain in the session, and old events
are never modified by the engine.

Concept viewing, parking, and unparking do not create evidence events and do
not evaluate activity responses.

The evidence event is populated from engine-owned state: generated evidence ID,
clock timestamp, learner/profile/session/subject/module/activity IDs, authored
objective IDs, activity kind, response payload, hints used, optional confidence
metadata, and evaluation result.

## Evaluation

Evaluation measures one activity attempt. It does not establish mastery.

Deterministic v0.1 evaluators are:

- manual completion
- exact text
- choice selection
- numerical tolerance

Rubric-assisted and extension evaluations return `ungraded` with no missing
criteria, because external or assisted evaluators are deferred.

## Completion And Advancement

Submission, evaluation, activity completion, and advancement are separate.

```text
submit evidence
-> inspect evaluation
-> advance session
```

This lets the application show feedback while the completed activity remains
current. The next activity becomes active only after `advanceSession`.

## Branches

After session start, the authored graph is authoritative:

```text
activity.nextActivityIds
```

The engine preserves authored order. When one next activity exists, advancement
can choose it automatically. When multiple next activities exist, the
application must supply `nextActivityId`; the engine never silently chooses a
branch.

## Ports

Core does not use global time, randomness, browser storage, browser crypto, or
infrastructure implementations.

Time and IDs enter through ports:

```text
Clock.now(): Date
LearningIdGenerator.createSessionId(): string
LearningIdGenerator.createEvidenceId(): string
```

The engine validates returned dates and IDs with existing core contracts.
Infrastructure providers are deferred to a later increment.

## Persistence Boundary

Durable persistence is outside the engine. The application workflow persists
engine results through the repository port. A submission result is committed as
one aggregate update containing both the updated session and the new evidence
event.

The engine still does not know about localStorage, repository revisions, stored
subject versions, corruption scans, or reload behavior.

The product facade also stays outside the engine. It resolves subjects, learner
profile compatibility, presentation policy, and session read models without
adding persistence or product knowledge to core engine transitions.
