# 0008 Session Aggregate Persistence

## Status

Accepted

## Context

The stateless learning engine produces immutable sessions and evidence events,
but reload-safe usage needs durable local storage and application workflow
coordination without moving persistence into core engine logic.

## Decision

The core engine remains persistence-agnostic. Persistence is accessed through a
core repository port, and a framework-independent application service
coordinates engine transitions with repository commits.

One session and its evidence events are stored as one aggregate. Evidence
submissions use one aggregate commit so the updated session and new append-only
event cannot be treated as separately committed results.

Repository revisions reject stale writes. The repository does not merge or retry
conflicting transitions.

The subject package version is stored outside the domain session. It protects
content-dependent transitions from silently running a persisted session against
an incompatible subject package.

Corrupt records are detected and reported but not automatically deleted,
rewritten, or repaired. Storage schema versioning is separate from domain schema
versioning.

localStorage is the v0.1 adapter, not the permanent architecture.

## Consequences

The application can return only committed persistent state. A valid incorrect
attempt is still durable evidence.

The localStorage adapter is reload-safe for one browser storage area, but it is
not a full cross-tab serialization mechanism.

Migrations, Web Locks, IndexedDB, cloud sync, export/recovery UI, and permanent
deletion are deferred.
