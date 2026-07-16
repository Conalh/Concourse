# 0002: Schema-first contracts

Status: Accepted

Runtime schemas are the source of truth for domain objects. TypeScript types are
inferred from those schemas instead of duplicated by hand.

External and persisted inputs will enter the system as `unknown` and be parsed
before the rest of the application uses them.
