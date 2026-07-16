# 0009 Product Facade And Composition Root

## Status

Accepted

## Context

After adding the stateless engine and durable persistence, future React code
needed one product-facing API instead of manually coordinating subject lookup,
profile identity, presentation policy, engine commands, persistence, and
version compatibility.

## Decision

React will depend on `LearntApplication`. UI code will not coordinate the engine,
repository, subject registry, learner profile, and presentation resolver
directly.

Application services accept a generic learner profile. The composition root
supplies the fixed demo profile.

Production subjects are registered explicitly through adapters. No runtime
filesystem or package discovery is used.

Subject and session read models are derived immutable state. Presentation policy
is derived on read and not persisted.

Session availability is distinct from session lifecycle status.

The app composition root is the only production layer joining concrete
infrastructure, production subjects, subject registry, the demo learner profile,
and the application facade.

Production subjects use generic renderable content for v0.1.

## Consequences

Future React screens can consume stable read models and command methods.

The application layer remains subject-agnostic and profile-generic.

Concrete subject IDs stay in subject packages, app composition, tests, and
documentation rather than core learning logic.
