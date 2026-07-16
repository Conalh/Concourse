# Persistence

Increment 6 adds durable local persistence around the stateless learning engine.

## Repository Aggregate

The repository stores one aggregate per session:

```text
session
+ ordered evidence events
+ subject version
+ repository revision
```

The storage key format is:

```text
learnt:learning-session:<session-id>
```

The storage envelope version is `0.1`.

`session.exploration.parkedConceptIds` is part of the session aggregate. It does
not introduce a second storage key.

## Logical Submission Transaction

An evidence submission follows one logical path:

```text
engine submission result
  -> repository commitSubmission
  -> one complete stored aggregate
```

The updated session and new evidence event are not written separately. The
repository validates the full next aggregate before calling `setItem`.

## Revision Behavior

New records start at revision 0. Successful `saveSession` and
`commitSubmission` calls increment the revision by one. Mutations require an
`expectedRevision`; stale writes fail with a revision conflict.

This is optimistic conflict detection, not complete cross-tab locking. The
repository does not automatically merge or retry stale transitions.

Parking and unparking concepts use `saveSession`, so each successful parked-path
change increments the revision once and preserves evidence history.

## Restoration

Loading a record validates and freezes the aggregate. Restoration does not
change `lastActiveAt`, revision, interaction mode, activity progress, or
evidence history. Active sessions remain resumable for a future UI.

Content-dependent transitions compare the persisted subject version with the
supplied subject package version before invoking the engine.

The product facade performs the same compatibility checks before delegating
content-dependent commands. It may perform one read for compatibility and let
the persistent service perform the mutation read for revision safety.

The React UI now uses this restoration path for browser refresh and deep-linked
session routes. It does not keep committed learning state in React memory,
localStorage, or another UI-side store.

UI commands wait for facade success before displaying committed transitions.
Revision conflicts are surfaced as reload-required states rather than retried
automatically.

Session recap uses the same restoration path. It reads the stored aggregate,
resolves the compatible registered subject version, and derives the recap
without writing a stored recap copy or changing the repository revision.

Session concept exploration uses the same restoration path. Reading a concept
does not rewrite the aggregate, change timestamps, or increment revision.

## Corruption

Malformed records are reported. Valid records remain listable alongside corrupt
records. Corrupt data is not deleted, repaired, rewritten, or treated as an
empty session list.

Future UI may offer export, discard, migration, or recovery workflows.

## Versioning

The project keeps these concepts separate:

- domain `schemaVersion`
- subject package `version`
- storage envelope `storageSchemaVersion`
- repository `revision`

Legacy session records that omit `exploration` are accepted as version `0.1`
records and parse with an empty parked-path list. Reads do not rewrite those raw
records. A later successful mutation may serialize the normalized exploration
field through the same envelope version.

## Limitations

The v0.1 adapter is local browser persistence only. It does not implement cloud
synchronization, migrations, permanent deletion, full cross-tab locking, storage
compaction, IndexedDB, service workers, or profile/subject persistence.

Durable unsent response drafts are also deferred. Increment 10 keeps unsent
drafts in React state only.

Only infrastructure accesses browser storage and secure browser ID generation.
If durable storage or secure ID generation is unavailable during bootstrap, the
browser UI renders a startup failure instead of falling back to transient
memory.
