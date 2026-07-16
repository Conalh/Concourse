# 0005: Subject definition boundary

Status: Accepted

Isolated Zod schemas validate object shape and local invariants. They do not
validate complete subject semantics because cross-references, module ownership,
extension declarations, and graph rules require the whole package.

`defineSubject` is the trusted subject-definition boundary. It accepts
`unknown`, validates the `SubjectPackage` shape, validates package integrity,
deeply freezes the accepted package, and returns a `DefinedSubject`.

Accepted subject packages are deeply immutable at runtime and exposed through a
deeply readonly type. The registry accepts `SubjectAdapter` values rather than
raw package literals so application composition registers trusted subjects.

The learning core remains independent from both concrete subject packages and
the subject SDK. The SDK depends on core contracts, not the other way around.

For v0.1, explicit `nextActivityIds` graphs are acyclic. Retries and nonlinear
revisits will be modeled by future session behavior, not by authored sequence
cycles.
