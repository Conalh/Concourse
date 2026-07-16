# 0014 Pack-Asset Delivery Boundary

## Status

Accepted

## Date

2026-07-11

## Context

Practical courses need downloadable notebooks, scripts, datasets, and
environment files. Learning packs are shareable and may come from third
parties, so a resource declaration alone must not become permission to execute
content, choose an arbitrary filesystem path, or bypass the installed release
integrity checks.

Install validation is not sufficient by itself. Persisted bytes could be
missing or altered after installation, and a runtime adapter should not need to
understand pack manifests or decide which release is authoritative.

## Decision

Manifest validation plus resolution from the persisted active release is the
pack-asset trust boundary.

The contract accepts `learning-resource.pack-asset@1` only when the resource:

- resolves to a manifest entry with role `asset`;
- uses the same media type as that entry;
- uses the closed version-1 extension/media-type allowlist; and
- proposes a safe basename rather than a path.

Immediately before delivery, the application facade selects the persisted
active release and rechecks pack identity, version, asset identity, canonical
path, media type, byte count, stored SHA-256, and the SHA-256 recalculated from
the stored bytes. It passes an immutable copy to a `PackAssetDeliveryPort` only
after those checks succeed.

Adapters are delivery mechanisms, not trust authorities. The browser adapter
may initiate an explicit download. The desktop adapter asks the learner for a
destination and invokes a bounded native atomic writer. Pack data never chooses
the destination. No layer executes or previews the asset.

Saving, cancelling, or failing a save is not learning evidence and must not
change sessions, progress, resource engagement, active release, or rollback
release.

## Alternatives Considered

### Deliver the resource declaration directly from the UI

Rejected because the UI would need storage and integrity knowledge and could
deliver stale or non-canonical bytes.

### Trust install-time validation permanently

Rejected because persisted files can be corrupted or tampered with after
installation.

### Let the pack provide an output path or open files automatically

Rejected because it would turn untrusted pack metadata into filesystem or code
execution authority.

### Render notebooks or execute scripts inside Concourse

Rejected. That requires a separately designed sandbox and threat model and is
outside the pack-asset capability.

## Consequences

Pack authors receive a narrow portable lab-file mechanism. Learners retain an
explicit save gesture and destination choice. Delivery failures remain
side-effect-free with respect to learner and release state.

Integrity checks do not establish that third-party code is benevolent. The UI
and authoring guidance must continue to tell learners to inspect downloaded
files before running them.
