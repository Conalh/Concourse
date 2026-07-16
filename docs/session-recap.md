# Session Recap

Increment 9 adds a retrieval-first session recap for saved learning sessions.

## Contract

`LearntApplication.getSessionRecap(sessionId)` returns an immutable
`SessionRecap`.

The recap is derived on read from:

```text
persisted LearningSessionRecord
+ registered SubjectPackage
-> immutable SessionRecap
```

The recap is not persisted. Calling `getSessionRecap` must not change the
stored aggregate, repository revision, session timestamps, interaction mode, or
evidence history.

## Compatibility

The facade uses the same compatibility checks as `getSessionContext`:

- session must exist
- learner and profile must match the configured profile
- subject must be registered
- persisted subject version must match the registered subject version

If stored evidence references an authored choice option that cannot be resolved
against the registered subject version, the recap fails closed with a structured
subject-version mismatch.

## Shape

The recap includes:

- subject ID, version, title, and summary
- session status, interaction mode, started time, and last-active time
- progress counts
- evidence count and total hints used
- current thread for active sessions, or null for completed and abandoned
  sessions
- parked paths for active, completed, and abandoned sessions
- modules and activities in authored order
- activity status, concepts, objectives, attempt counts, and attempt history
- a timeline derived from persisted evidence order
- encountered concepts derived from evidence activity references

Attempt numbers start at 1 per activity and follow persisted evidence order.

## Safety

The recap may show what the learner submitted, including selected choice labels.
It does not expose answer-key definitions or criteria internals:

- no `correctOptionIds`
- no `acceptedAnswers`
- no numeric tolerances
- no matched or missing criteria arrays

Evaluation summaries expose only status, optional score, and optional feedback.
The recap is activity evidence, not a competence model.

Parked paths are explicit learner-selected concepts saved in session state.
They are not completed concepts, unresolved weaknesses, or evidence-based
encounters. A parked concept only appears in encountered concepts after
submitted evidence references an activity containing that concept.

## UI

The hash route is:

```text
#/sessions/<session-id>/recap
```

The recap screen keeps activity, objective, concept, status, and attempt counts
visible. It includes a "Parked paths" section with the supporting copy
"Concepts saved for later exploration." Previous attempts are collapsed behind
"Show previous attempts" and include the prompt:

```text
Try to reconstruct your reasoning before opening the attempt history.
```

Entry points exist from the active workspace, completed or abandoned terminal
views, ready session cards, and the most recent active session panel.
Unavailable sessions do not get a recap action because the facade cannot safely
resolve the registered subject.
