# 0006: Fixed profile and presentation policy

Status: Accepted

v0.1 uses one fixed learner profile. The profile is validated with
`LearnerProfileSchema`, deeply immutable at runtime, and exported as a deeply
readonly value.

The generic presentation-policy resolver consumes a learner profile as input. It
does not import the fixed demo profile. The future application composition root
will connect the fixed profile to the resolver.

Temporary interaction modes override profile defaults without mutating the
profile. Activity semantics then refine the result to avoid incoherent
presentation, such as exposing a prediction answer before the learner can
respond.

Reported traits remain metadata. They do not drive hidden behavior and are not
used as executable policy switches.

Presentation policy is transient and deterministic. It is not persisted, does
not select activities, does not evaluate evidence, and does not infer mastery.

The generic immutability helper moved from `subject-sdk` to `core/foundation`
because both immutable subject definitions and immutable learner profiles depend
on the same subject-agnostic mechanism.
