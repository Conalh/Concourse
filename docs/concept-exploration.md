# Concept Exploration

Increment 10 adds thread-preserving concept exploration.

## Current Thread

The current thread is the session's active activity and intended return point.
It is domain state stored as `LearningSession.currentActivityId` and
`currentModuleId`.

Opening a concept does not change the current activity, activity progress,
interaction mode, evidence, or evaluation state.

## Side Path

A side path is the concept currently being inspected through the route:

```text
#/sessions/<session-id>/concepts/<concept-id>
```

The route is presentation state. Browser back, forward, refresh, and
concept-to-concept links can change the viewed concept without changing session
progress.

## Parked Path

A parked path is a learner-selected concept ID saved in session state:

```text
session.exploration.parkedConceptIds
```

Parked paths persist through the normal session aggregate and repository
revision system. They preserve learner-selected order. Parking and unparking are
normal immutable engine transitions and do not create evidence.

## Draft Preservation

Unsubmitted activity drafts are React state retained across in-app hash-route
changes. The draft store is scoped to the app tree and keyed by
`sessionId:activityId`.

Drafts survive:

- opening concept exploration
- following related concept links
- returning to the current thread
- mode changes
- opening recap and returning during the same app lifetime

Drafts do not survive a full browser refresh. After refresh, attempted or
completed activity drafts may restore from committed evidence, but
never-submitted text or selections are not restored.

## Evidence Boundary

Viewing, reading, linking to, parking, or unparking a concept does not create:

- evidence events
- evaluations
- activity attempts
- hint counts
- confidence metadata
- completion status
- concept encounters

Concept encounters remain evidence-based. A concept view is not evidence of
learning.

## Compatibility

Legacy session records without `exploration` parse with an empty parked-path
list. Reads do not rewrite legacy records. The next real session mutation may
serialize the normalized exploration field through the existing storage
envelope version.

## Limitations

Increment 10 intentionally does not add:

- arbitrary activity jumps
- side-path trees
- durable unsent drafts
- automatic recommendations
- AI explanations
- concept notes
- parked-path reordering
- subject-level concept routes
