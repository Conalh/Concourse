# 0007 Stateless Learning Engine And Evidence Transactions

## Status

Accepted

## Context

Learnt needs a subject-agnostic core that can start sessions, accept learner
evidence, evaluate deterministic activities, create evidence events, and return
new session state without coupling core to UI, persistence, profile resolution,
or infrastructure providers.

## Decision

The learning engine is stateless. It receives a trusted immutable subject, a
current immutable session when needed, and explicit operation inputs. It returns
new frozen objects and does not own persistence or a session collection.

Time and ID generation use ports:

- `Clock`
- `LearningIdGenerator`

Valid submissions produce a session plus evidence event as one logical result.
Evidence events are append-only. Retries create new evidence and never overwrite
or erase previous event references.

Evaluation does not imply mastery. It reports only the result of one authored
activity attempt. Activity completion and session advancement are separate:
completed activities remain current until `advanceSession` is called.

Post-start sequencing is controlled by explicit authored activity edges through
`nextActivityIds`. Branches are not silently selected; multiple candidates
require an explicit selected activity ID.

AI-assisted rubric evaluation and extension evaluator execution are deferred.
Rubric-assisted and extension definitions return `ungraded` in v0.1.

## Consequences

Applications can persist the returned session and evidence event together using
future infrastructure without changing core semantics.

The engine can be tested deterministically with fake clocks and fake ID
generators.

The current activity remains stable after completion, so the application can
display evaluation feedback before moving the learner.

Mastery, adaptive selection, spaced repetition, semantic grading, and evaluator
provider registries remain outside Increment 5.
