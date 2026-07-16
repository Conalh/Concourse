# Architecture

This project is a modular monolith for subject-agnostic learning.

## Proposed final directory structure

```text
src/
  app/
    App.tsx
    composition-root.ts
    subject-registry.ts
  core/
    contracts/
    engine/
    ports/
    errors/
  subject-sdk/
    define-subject.ts
    subject-adapter.ts
    extension-registry.ts
    index.ts
  profiles/
    demo-learner.profile.ts
  infrastructure/
    local-storage-learning-repository.ts
    static-teaching-agent.ts
  subjects/
    logic-basics/
      subject.ts
      index.ts
    movement-planes/
      subject.ts
      index.ts
    machine-learning-foundations/
      subject.ts
      index.ts
  ui/
    components/
    extensions/
    hooks/
  test/
    setup.ts
```

```text
docs/
  architecture.md
  session-recap.md
  vocabulary.md
  subject-authoring.md
  learning-paths/
    ai-ml-roadmap.md
  subjects/
    machine-learning-foundations.md
  concept-exploration.md
  decisions/
    0001-modular-monolith.md
    0002-schema-first-contracts.md
    0003-subject-adapter-boundary.md
    0011-derived-session-recap.md
    0012-thread-preserving-concept-exploration.md
```

## Dependency rules

The core owns the learning protocol and stays framework-agnostic.

Allowed dependency direction:

```text
subject packages -> subject SDK -> learning core
UI -> application layer -> learning core
infrastructure -> learning core ports
```

The learning core must not import React, browser APIs, localStorage,
infrastructure implementations, concrete subject packages, or UI components.

## Increment 1 scope

Increment 1 creates the Vite/React/TypeScript foundation, test runner,
formatting, linting, documentation shell, and an executable dependency-boundary
test. The actual domain schemas begin in Increment 2.

## Increment 2 scope

Increment 2 creates schema-first contracts in `src/core/contracts`. These files
may import Zod and other contract files, but they do not import React, browser
storage, infrastructure, UI code, or concrete subjects.

Contract files added in this increment:

```text
src/core/contracts/
  activity.schema.ts
  concept.schema.ts
  content-block.schema.ts
  evaluation.schema.ts
  evidence.schema.ts
  identifiers.schema.ts
  index.ts
  learner-profile.schema.ts
  module.schema.ts
  objective.schema.ts
  response.schema.ts
  session.schema.ts
  subject.schema.ts
  validation.ts
```

All distributed or persisted objects share `schemaVersion: "0.1"`:

- learner profiles
- subject packages
- evidence events
- learning sessions

Static nested definitions such as concepts, modules, objectives, activities,
content blocks, response definitions, and evaluation definitions do not each
carry their own schema version in v0.1.

## Contract validation boundary

The Zod schemas validate local object shape and local invariants: ID syntax,
required fields, discriminator compatibility, duplicate local arrays, timestamp
shape, and minimal lifecycle rules.

The schemas deliberately do not validate whole-subject referential integrity.
That belongs to Increment 3 in the subject SDK, where `defineSubject` will own:

- duplicate IDs across subject arrays
- missing references
- broken module, concept, objective, and activity references
- prerequisite graph cycles
- activity sequencing graph validation
- extension registration checks
- immutable subject-package return values

## Increment 3 subject SDK boundary

Increment 3 adds the subject SDK in `src/subject-sdk`.

Allowed dependency direction:

```text
subject SDK -> core contracts
```

The subject SDK must not import UI, infrastructure, concrete subjects, React, or
browser APIs. The learning core must not import the subject SDK.

The subject-definition lifecycle is:

```text
plain subject data
  -> defineSubject
  -> shape validation
  -> integrity validation
  -> immutable DefinedSubject
  -> SubjectAdapter
  -> SubjectRegistry
```

`defineSubject` owns complete-package integrity because isolated schemas cannot
know whether IDs in other arrays exist, whether an activity is listed by the
right module, or whether prerequisite and next-activity graphs contain cycles.

The registry accepts adapters rather than raw package literals. It preserves
registration order, rejects duplicate subject IDs, and does not replace existing
registrations.

## Increment 4 profile and presentation boundary

Increment 4 adds one fixed learner profile and a generic deterministic
presentation-policy resolver.

Allowed dependency direction:

```text
core/presentation -> core/contracts
core/presentation -> core/foundation
profiles -> core/contracts
profiles -> core/foundation
subject SDK -> core/foundation
```

Disallowed dependency direction:

```text
core/presentation -> profiles
core/presentation -> subject SDK
profiles -> subject SDK
core/foundation -> subject SDK
core/foundation -> profiles
core/foundation -> presentation
```

The resolver accepts the learner profile as input. It does not import the fixed
demo profile, inspect reported traits, access time, use randomness, mutate
input, persist policy, select activities, evaluate evidence, or render content.

Policy precedence:

```text
profile defaults
  -> interaction-mode overrides
  -> activity semantic constraints
  -> immutable presentation policy
```

The generic deep-readonly/deep-freeze helper now lives in `src/core/foundation`
because immutable subject definitions and immutable learner profiles both use
the same subject-agnostic mechanism.

## Increment 5 stateless learning engine

Increment 5 adds the framework-agnostic learning engine in `src/core/engine`
and provider-neutral ports in `src/core/ports`.

Allowed dependency direction:

```text
core/engine -> core/contracts
core/engine -> core/foundation
core/engine -> core/ports
core/ports -> core/contracts
```

Disallowed dependency direction:

```text
core/engine -> subject SDK
core/engine -> profiles
core/engine -> subjects
core/engine -> infrastructure
core/engine -> UI
core/engine -> React
core/engine -> browser APIs
```

The engine accepts a trusted immutable subject package that has already passed
`defineSubject`. It does not import `DefinedSubject` and does not repeat the
subject SDK integrity pipeline.

The engine is stateless. It does not own a session collection, persistence, a
system clock, or production ID generation. Time and learning IDs are injected
through `Clock` and `LearningIdGenerator` ports so later infrastructure can
compose real providers outside core.

Submission, evaluation, evidence creation, and session update are one logical
engine transaction:

```text
trusted subject
+ current session
+ submitted evidence
-> evaluation result
-> append-only evidence event
-> new immutable session state
```

Activity completion does not automatically advance the current activity.
Applications submit evidence, inspect feedback, then explicitly call
`advanceSession`. Authored `nextActivityIds` control post-start sequencing, and
branch choices require an explicit selected activity ID.

## Increment 6 durable local persistence

Increment 6 adds durable browser-local persistence without changing the engine.

Allowed dependency direction:

```text
application -> core/engine
application -> core/ports
application -> core/contracts
application -> core/foundation
infrastructure -> core/ports
infrastructure -> core/contracts
infrastructure -> core/foundation
```

Disallowed dependency direction:

```text
core -> application
core -> infrastructure
application -> infrastructure
application -> UI
application -> React
application -> browser APIs
infrastructure -> application
infrastructure -> UI
infrastructure -> React
```

The application service coordinates:

```text
load persisted record
  -> call learning engine
  -> save or commit through repository
  -> return committed record
```

The v0.1 infrastructure adapter stores one complete session aggregate per
storage key. Only infrastructure accesses localStorage, browser crypto, and
system time.

## Increment 7 product facade and composition root

Increment 7 assembles the first complete headless product:

```text
React UI - future
  -> LearntApplication
  -> PersistentLearningService
  -> LearningEngine + LearningRepository
  -> Infrastructure
```

Production subjects are registered explicitly:

```text
Production subjects
  -> SubjectRegistry
  -> LearntApplication
```

The registry stores trusted subject adapters. The application facade resolves
subjects by ID, checks persisted subject versions, verifies the configured
learner profile, and derives immutable read models.

The composition root supplies the fictional demo profile. The application layer
depends only on the generic learner-profile contract and remains unaware of the
demo identity specifically.

Presentation policy is derived during session-context construction and is not
persisted.

## Increment 8 React product interface

Increment 8 adds the first browser UI while preserving the headless product
boundary:

```text
main.tsx
  -> createBrowserLearntApplication()
  -> LearntApplicationProvider
  -> React UI
  -> LearntApplication
  -> PersistentLearningService
  -> LearningEngine + LearningRepository
  -> Infrastructure
```

Allowed dependency direction:

```text
ui -> application read models and facade
ui -> core contracts and public read-model types where needed
main.tsx -> app composition root
main.tsx -> ui
```

Disallowed dependency direction:

```text
ui -> infrastructure
ui -> concrete subjects
ui -> profiles
ui -> subject-sdk
ui -> repository or service construction
ui -> browser storage or browser crypto
ui -> subject-specific branching
```

The UI implements hash routes for the library, subject overview, and session
workspace. It renders generic content blocks and response controls from
contracts, submits evidence through the facade, waits for persisted command
results, and resumes active sessions after refresh through repository-backed
state rather than React memory.

Presentation policy is supplied by `LearningSessionContext`. React applies it
to layout and disclosure state, but it does not resolve or persist policy.

Unexpected rendering failures are handled by a React error boundary. Expected
application, engine, repository, availability, and revision-conflict errors are
mapped to normal UI states.

## Increment 9 derived session recap

Increment 9 adds a read-only recap model without changing the persistence
aggregate:

```text
React recap route
  -> LearntApplication.getSessionRecap(sessionId)
  -> persisted LearningSessionRecord
  -> registered subject package
  -> immutable SessionRecap
```

The application layer owns recap derivation. The UI renders the returned model
and does not inspect authored evaluation definitions, answer keys, subject
packages, repositories, or storage.

`SessionRecap` is not persisted. It is reconstructed on every read from the
saved session record and the compatible registered subject version.

## Increment 10 thread-preserving concept exploration

Increment 10 adds session-bound concept exploration without changing the active
learning thread:

```text
React concept route
  -> LearntApplication.getSessionConceptExploration(sessionId, conceptId)
  -> persisted LearningSessionRecord
  -> registered subject package
  -> immutable SessionConceptExploration
```

The current activity remains canonical session state. The concept being viewed
is route state. Only explicitly parked concept IDs are persisted in
`session.exploration.parkedConceptIds`.

Park and unpark are normal immutable engine transitions for active sessions.
They update `lastActiveAt`, use the repository `saveSession` revision path, and
do not create evidence events or evaluations.

Unsubmitted response drafts are React state scoped to the routed app tree. They
survive in-app route changes and do not survive full browser refresh.
