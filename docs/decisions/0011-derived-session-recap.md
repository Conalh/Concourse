# 0011 Derived Session Recap

## Status

Accepted

## Context

The React UI can now create durable sessions, submit evidence, retry, advance,
and restore from local persistence. Learners need a way to review what happened
without reopening the whole session as an active task and without React
duplicating learning rules.

The existing boundary is that persisted state is the session aggregate and
authored subject package version. Derived read models belong in the application
layer.

## Decision

Session recap is a derived application read model.

`LearntApplication.getSessionRecap(sessionId)` loads the persisted record,
checks learner/profile compatibility, resolves the registered subject, verifies
the persisted subject version, derives a frozen `SessionRecap`, and returns it.

No recap aggregate is stored. No React code inspects subject evaluation
definitions. No engine command is run to build a recap.

The recap can include submitted evidence labels and evaluation summaries, but it
does not expose answer-key fields, accepted text answers, numeric tolerances, or
matched/missing criteria arrays. If a submitted choice option no longer resolves
against the registered subject version, the read fails closed as a subject
version mismatch.

The UI route is `#/sessions/<session-id>/recap`. It is parsed before the normal
workspace route. Prior attempts are hidden behind native details disclosure by
default, with retrieval-oriented copy before the attempt history.

## Consequences

Recap remains deterministic, reload-safe, and compatible with local persistence.
Refreshing a recap route reconstructs the same view from storage and the current
registered subject.

The persisted aggregate stays small and append-only. Future changes can add new
recap fields by deriving them from the record and subject, but they must keep
the answer-key and criteria boundary intact.

Completed and abandoned sessions can still be reviewed. Unavailable sessions
cannot show recap until the current app can safely resolve their subject and
learner compatibility.
