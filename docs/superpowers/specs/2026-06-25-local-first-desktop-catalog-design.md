# Local-First Desktop Catalog Design

## Status

Draft approved for planning.

## Date

2026-06-25

## Objective

Create a cross-platform desktop direction for Concourse that keeps learning
local-first while letting users discover and download official course packs from
a static catalog.

The first milestone is not a marketplace. It is an executable app with a local
Courses folder, a Sync action, and an optional official catalog feed.

## Product Picture

A learner installs Concourse Desktop, chooses a local Courses folder, downloads
or copies course packs into that folder, and presses Sync. Valid packs appear in
Transfer, Route, Today, Loop, and Progress. Invalid packs are reported with
actionable diagnostics.

The in-app catalog is a convenience layer over the same folder:

1. App fetches a static catalog index.
2. User chooses a pack.
3. App downloads the pack archive into the Courses folder.
4. App verifies hash and validates the pack.
5. App installs/registers the pack through the same sync path.

Once a pack is installed, learning works offline.

## Non-Goals

- User accounts
- Hosted learner progress
- Ratings, reviews, or comments
- Paid pack purchases
- Creator dashboards
- Community submission workflows
- Full cloud sync
- Replacing the existing pack contracts

These can be designed later without forcing them into the local-first MVP.

## Architecture

The desktop shell must compose the existing application facade. It must not fork
core learning behavior.

```text
Desktop shell
  -> desktop composition root
  -> LearntApplication
  -> learning-pack sync/catalog ports
  -> filesystem/catalog infrastructure adapters
  -> core contracts and engine
```

New platform behavior should enter through ports:

- `CourseFolderStore`: remembers the configured Courses folder.
- `CourseFolderScanner`: scans local course folders and archives.
- `PackCatalogClient`: reads the official static catalog.
- `PackDownloader`: downloads pack archives and verifies checksums.
- `PackSyncService`: coordinates scan, validation, install, and report output.

The browser runtime can keep using browser-safe adapters. The desktop runtime
gets filesystem-capable adapters.

## Courses Folder

The Courses folder is the user-visible local content library.

Recommended first shape:

```text
Courses/
  downloaded/
    logic-foundations-1.0.0.learntpack
  unpacked/
    local-experiment/
      pack.json
      catalog.json
      courses.json
      items.json
      sets.json
  installed/
    releases/
    current/
    rollback/
```

The exact internal layout can change during implementation, but user-owned
downloaded and unpacked content should remain understandable and portable.

## Static Catalog

The official catalog is a versioned JSON document published from a repository or
static host.

Minimum catalog entry:

```json
{
  "packId": "logic-foundations",
  "title": "Logic Foundations",
  "summary": "A first route through propositions, inference, and proof habits.",
  "version": "1.0.0",
  "publisher": "Concourse",
  "license": "CC-BY-4.0",
  "tags": ["logic", "reasoning"],
  "compatibility": {
    "minAppVersion": "0.1.0",
    "packSchemaVersion": "0.1"
  },
  "download": {
    "url": "https://example.com/packs/logic-foundations-1.0.0.learntpack",
    "sha256": "..."
  }
}
```

The catalog should be append-friendly and cacheable. Catalog failure should not
block local learning.

## User Flows

### First Run

1. App asks for or creates a Courses folder.
2. App explains that packs and progress are local.
3. App offers to open Transfer/Catalog.

### Sync Local Courses

1. User clicks Sync.
2. App scans configured Courses folder.
3. App validates candidate packs.
4. App installs new or updated valid packs.
5. App reports installed, unchanged, updated, warning, and failed outcomes.

### Download From Catalog

1. User opens Catalog.
2. App fetches catalog index.
3. User filters or searches packs.
4. User downloads one pack.
5. App verifies checksum and installs through the same sync path.
6. App shows installed status and a Route/Loop entry point.

## Error Handling

- Missing Courses folder: prompt to choose a new folder.
- Catalog unavailable: show cached catalog if available; local learning remains
  usable.
- Download failure: keep partial downloads out of the installed set.
- Checksum mismatch: reject the archive and show a trust warning.
- Validation failure: preserve diagnostics and leave existing installed release
  untouched.
- Unsupported required capability: reject install.
- Unsupported optional capability: install with warnings if validator permits it.

## Testing Strategy

- Unit tests for catalog schema parsing and compatibility filtering.
- Unit tests for course-folder scan classification.
- Integration tests for archive download, checksum verification, and install
  handoff.
- Product-flow tests for Sync and Catalog UI states.
- Desktop smoke test: launch executable, configure folder, sync pack, start
  route, quit, relaunch, confirm course remains available.

## Implementation Slices

1. Spec and repo guidance.
2. Catalog contract and static fixture.
3. Course folder port and local sync service.
4. Transfer UI sync/report refinements.
5. Catalog UI using static fixture.
6. Desktop shell spike.
7. Filesystem-backed desktop adapters.
8. Desktop packaging and smoke verification.

## Approval Criteria

- The web app remains functional.
- The desktop shell does not fork learning logic.
- A local Courses folder can be synced repeatedly without duplicate installs.
- Invalid packs do not break valid installed packs.
- A static catalog entry can download and install a pack.
- Downloaded packs work offline after installation.
