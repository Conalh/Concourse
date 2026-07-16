# Learner Profile

The learner profile is stable user-provided operating configuration.

In v0.1, one fictional fixed profile drives the demo runtime. It is validated
through `LearnerProfileSchema`, deeply frozen at runtime, and exposed as a
deeply readonly value. It does not represent a real person's learner data.

The profile is not:

- a diagnosis engine
- a profile editor
- an automatic calibration system
- a competence model
- mutable session state
- evidence history

Reported traits are metadata. They provide context for humans, but presentation
policy does not inspect strings such as diagnostic labels or trait descriptions.
Only explicit operational fields drive behavior.

## Session Mode

Session mode is temporary presentation context. It applies to the current
session decision and does not alter the stable learner profile.

Supported modes are:

- coach
- flow
- test
- rescue
- zoom
- recap

The React UI changes session mode only through
`LearntApplication.changeInteractionMode`. A committed mode change returns a new
session context and may change presentation policy. Failed mode changes keep the
previous committed mode visible.

## Presentation Policy

Presentation policy is transient derived configuration:

```text
learner profile
  + interaction mode
  + activity definition
  -> presentation policy
```

It is subject-agnostic, deterministic, and not persisted in v0.1.

The resolver does not:

- modify content
- reorder content blocks
- generate explanations
- add response controls
- select activities
- evaluate evidence
- infer mastery
- mutate the learner profile

## Resolution Sequence

Policy resolution applies rules in this order:

```text
profile defaults
  -> mode overrides
  -> activity semantic constraints
  -> immutable presentation policy
```

Profile defaults come from explicit profile fields such as explanation density,
chunk size, checkpoint preferences, feedback style, and retry preference.

Interaction modes temporarily adjust presentation behavior. For example, Flow
mode reduces interruptions, Test mode delays solution reveal until evaluation,
and Zoom mode preserves the current thread while expanding context.

Activity semantics prevent incoherent presentation. Predict activities require a
learner prediction before reveal. Worked examples keep their authored solution
immediately visible, even when Test mode reduces other support.

## Current Limitation

The application has one fixed learner profile in v0.1. Multiple profiles,
profile selection, editing, calibration, persistence, and adaptive learner
modeling are deferred.

The React UI does not expose profile selection, profile editing, reported
traits, diagnostic metadata, calibration, mastery estimates, or competence
claims.
