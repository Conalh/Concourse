# 0012 Thread-Preserving Concept Exploration

## Status

Accepted

## Context

Learners need to inspect concepts related to the current activity without losing
the active learning thread. The existing system already separates domain state,
route state, persistence, and React-local UI state.

The active activity must remain authoritative. Concept viewing must not become
an implicit activity jump or evidence signal.

## Decision

The current activity remains the canonical learning thread.

The active explored concept is represented by the route:

```text
#/sessions/<session-id>/concepts/<concept-id>
```

Concept exploration does not alter progression. It derives a read model from the
stored session record and compatible registered subject.

Only explicitly parked concept IDs are persisted. Parked paths live inside
session state at `session.exploration.parkedConceptIds`.

Park and unpark use normal immutable engine transitions and persist through
`saveSession`. They update `lastActiveAt`, increment repository revision through
the existing save path, and create no evidence.

Existing session records receive an empty exploration default through
backward-compatible parsing. The storage envelope version remains `0.1`.

Unsent response drafts remain temporary React state. Drafts are retained across
in-app route changes but not full browser refresh.

Direct arbitrary activity jumping remains unsupported. AI-generated concept
expansion is deferred.

## Consequences

Concept routes are reload-safe for committed state because they rebuild from the
session aggregate and subject package. They are not evidence of learning.

Parked paths survive completion and abandonment because they are session state,
not active-route state.

The UI can show a strong current-thread return anchor without calling the
engine. Returning to the activity is navigation only.

Future durable draft persistence, concept notes, recommendations, AI
explanations, or side-path trees need their own contracts and privacy decisions.
