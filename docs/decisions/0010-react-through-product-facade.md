# 0010 React Through Product Facade

## Status

Accepted

## Context

The headless product facade made Learnt usable from code, but the browser still
needed a concrete product interface. The UI had to preserve the prior
boundaries: learning rules stay in the engine, persistence stays behind the
repository and application service, subject packages stay declarative, and the
fixed learner profile remains composition-root configuration.

## Decision

React depends on `LearntApplication`.

UI code does not coordinate the engine, persistent learning service, repository,
subject registry, learner profile, infrastructure adapters, or presentation
resolver. `main.tsx` is the browser composition bridge: it finds the root
element, calls `createBrowserLearntApplication()`, and renders the provider and
app.

Hash routing provides reload-safe local deep links without adding a routing
dependency. The supported routes are library, subject overview, and session.

Temporary response drafts remain React state. Committed sessions, evidence,
evaluation, and progression remain application and domain state. React waits for
the persisted facade result before displaying committed transitions.

Activity completion does not auto-advance. One-edge advancement is explicit and
multi-edge advancement requires an explicit branch choice.

Generic contract renderers support registered production subjects. Unsupported
extensions render recoverable states and keep extension payloads hidden.

Presentation policy is applied in React but not recalculated, persisted, or
mutated there.

Expected domain and application errors remain normal UI states. Unexpected
rendering failures are handled by a React error boundary.

Subject-specific UI branching is prohibited. Production subject IDs may appear
in subject packages, tests, route fixtures, and documentation examples, but not
in production UI behavior.

## Consequences

The first browser app can start sessions, submit evidence, retry, advance,
change mode, refresh, and resume without duplicating learning or persistence
rules in React.

UI tests can use structural doubles for provider behavior and composed
deterministic applications for product-flow coverage.

Future features such as hints, side paths, recap, AI support, and specialized
extensions can add contracts behind the facade before React renders them.
