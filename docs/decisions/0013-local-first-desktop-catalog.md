# 0013 Local-First Desktop Catalog

## Status

Accepted

## Date

2026-06-25

## Context

Concourse is moving toward a cross-platform runtime model. The same learning
contracts and pack system should work in browser, desktop, and possible future
cloud shells.

The near-term product need is an executable app that lets learners use
downloaded course packs locally. The desired workflow is a local Courses folder:
users download or copy course packs into that folder, press Sync, and valid
courses appear in the app.

A full marketplace would require hosted state, accounts, moderation, payments,
ratings, and operational workflows. That is not the current product goal.

## Decision

Build the first desktop/catalog track as local-first.

The first approved direction is:

- configured local Courses folder
- Sync action that scans, validates, imports, and reports packs
- official static catalog for discovery and downloads
- downloaded pack archives stored locally
- learner progress and sessions stored locally
- no accounts or marketplace behavior in the MVP

The catalog is a static index plus downloadable pack archives. It is not learner
state and must not be required to use already-downloaded packs.

Desktop-specific filesystem and download behavior must enter through adapters
and ports. The desktop shell must compose the existing application facade rather
than forking learning logic.

## Alternatives Considered

### Manual Local Folder Only

This is the lowest-risk path and remains part of the MVP. It does not provide
the in-app discovery experience the product needs.

### Full Marketplace

This would support creator accounts, publishing, ratings, payments, and
moderation. It is rejected for the current phase because it adds hosted product
operations before the local pack workflow has proven itself.

### Cloud Sync First

This would make desktop depend on account and hosted-progress design. It is
rejected for the current phase because the user direction is local-first packs
only.

## Consequences

The product can ship a useful desktop executable without a backend.

The pack metadata must be rich enough for future registry or marketplace work:
pack ID, version, publisher, license, source notes, compatibility, download URL,
and checksum.

The app needs clear adapter seams for filesystem scanning, catalog fetching,
downloads, and install roots.

Future marketplace work can build on the same catalog metadata, but it will
require a separate decision record and spec.
