# User Interface

Increment 8 adds the first usable React product interface for Learnt.

## Boundary

React consumes the product through `LearntApplication` via
`LearntApplicationProvider`.

```text
main.tsx
  -> createBrowserLearntApplication()
  -> LearntApplicationProvider
  -> React screens and hooks
  -> LearntApplication
```

UI code may import application read models and core contract types when needed
for rendering, but it does not coordinate `LearningEngine`,
`PersistentLearningService`, repositories, subject registry construction,
profile selection, infrastructure adapters, storage, browser crypto, or
presentation-policy resolution.

The provider accepts a structural `LearntApplicationClient` so tests can supply
focused doubles or composed deterministic applications.

## Navigation

The app uses a small hash router instead of a routing dependency.

Supported routes:

- `#/` shows the Subject Library.
- `#/subjects/<subject-id>` shows a Subject Overview.
- `#/sessions/<session-id>` shows the Learning Workspace, a terminal session
  view, or an unavailable-session view.
- `#/sessions/<session-id>/concepts/<concept-id>` shows session-bound concept
  exploration.
- `#/sessions/<session-id>/recap` shows the derived Session Recap.

Route parsing validates IDs through the existing branded schemas. Invalid or
unknown hash values become a not-found route instead of throwing. Links use
semantic anchors so browser back, forward, refresh, and direct deep links work.

## Screens

Subject Library loads `getLearner`, `listSubjects`, and `listSessions`. It
shows product orientation, the most recent ready active session, subject cards,
session history, unavailable sessions, and repository scan warnings without
repairing or deleting records.

Subject Overview loads `getSubjectOverview` and `listSessions`. It shows the
subject summary, tags, ordered modules, objectives, concepts, prerequisite and
related relationships, a primary Continue action for a compatible active
session, and a Begin Session command that starts in `coach` mode.

Learning Workspace loads `getSessionContext`. It presents one dominant current
activity, the ordered module navigator, progress summary, content blocks,
response controls, evaluation feedback, explicit advancement, branch selection,
mode changes, parked paths, and an explicit abandon-session confirmation.

Current activity concepts link to session-bound concept exploration as
secondary navigation. Those links do not submit evidence, advance the session,
change mode, or park concepts automatically.

Concept Explorer loads `getSessionConceptExploration`. It shows the explored
concept, current-thread anchor, park control, authored prerequisites, authored
dependent concepts, related concepts, observable objectives, activities
involving the concept, and the session's parked paths. Active sessions can park
or unpark the viewed concept after persistence succeeds. Completed and
abandoned sessions render the same route read-only.

Session Recap loads `getSessionRecap`. It shows subject metadata, session
status, progress, current thread, activity trail, encountered concepts, and a
timeline derived from persisted evidence. It also shows parked paths as
concepts saved for later exploration. Prior attempts are collapsed by default
behind "Show previous attempts" and choice responses render submitted labels
rather than option IDs.

Completed and abandoned sessions render terminal views. Direct links to
unavailable sessions show the availability reason, persisted subject ID,
persisted subject version, registered version when available, and a return to
the library.

## Activity Rendering

`ContentBlockRenderer` renders standard content contracts as text:

- text
- code
- equation
- callout
- comparison
- question
- extension fallback

The renderer does not render authored HTML, execute authored code, interpolate
subject content into CSS, expose extension payloads, or accept caller-provided
React components from subject data. Unsupported extensions render a recoverable
status with the payload hidden.

`ActivityResponse` renders standard response contracts:

- text
- number
- single-choice
- multiple-choice
- confidence
- code
- manual completion

Question blocks remain content blocks and do not create response controls by
themselves.

## Submission Lifecycle

Temporary response drafts live in React state until submission.

```text
React draft
  -> buildEvidencePayload
  -> application.submitEvidence
  -> LearningEngine validation and evaluation
  -> repository commit
  -> returned LearningSessionContext
  -> React renders Retry, Passed, or ungraded feedback
```

React does not inspect answer keys or duplicate evaluation rules. Completion
does not auto-advance. After a completed activity, React shows the explicit
advance command. Multi-edge activities require an explicit branch selection.

Mode changes call `changeInteractionMode` and display the committed context
returned by the facade. The UI does not show an uncommitted mode as saved.

Unsubmitted drafts are kept in an app-level React provider keyed by
`sessionId:activityId`. They survive in-app navigation to concept exploration,
related concepts, recap, and back to the current thread. They are cleared only
after committed activity completion, committed advancement away from the
activity, or committed abandonment.

Drafts do not survive full browser refresh. After refresh, attempted or
completed activity state may restore from committed evidence; never-submitted
input is intentionally not restored.

## Presentation Policy

`LearningSessionContext` supplies presentation policy. React applies it to:

- primary versus supporting content using `maximumPrimaryBlocks`
- concept and system-context disclosure state
- density-sensitive supporting chrome
- optional confidence metadata when meaningful learner action is requested

The UI does not resolve, recalculate, persist, or mutate presentation policy.
No authored content is discarded. Content that does not fit the primary region
is moved into supporting disclosure.

## Errors

Expected application, engine, and repository failures map into `UiError`.

Revision conflicts tell the learner to reload the latest saved state before
continuing. Storage failures do not claim durable progress is available.
Concept parking conflicts tell the learner to reload the latest concept state
before changing parked paths.
Subject version mismatch, learner profile mismatch, and unregistered subjects
become unavailable-session states. Repository scan issues remain warnings that
do not hide valid sessions.

Unexpected render failures are handled by `AppErrorBoundary`. Bootstrap
construction failures render a dedicated failure screen with reload action and
without a raw stack trace.

## Accessibility

The interface includes:

- skip link to the main region
- semantic header and main landmarks
- one primary heading per screen
- route focus on the screen heading
- current-thread anchor on concept exploration
- accessible screen-change announcement
- visible focus rings
- native anchors, buttons, fieldsets, legends, labels, and details elements
- aria-live evaluation feedback
- role="alert" for blocking form and confirmation errors
- text labels for unavailable states
- keyboard-operable controls
- horizontally scrollable code blocks
- reduced-motion-aware transitions

Concept relationships are available as readable lists, not only visual node
motifs.

## Responsive Behavior

Wide desktop uses a restrained shell with a subordinate orientation rail,
primary activity stage, and context panel. Tablet widths collapse or narrow
supporting regions while preserving the activity width. Mobile uses one primary
column, disclosure-based orientation and concept context, full-width response
controls, stacked branch choices, and scrollable code. Concept exploration uses
one readable column on mobile in this order: concept heading, current thread,
park control, concept summary, relationships, objectives, activities, and parked
paths.

The visual direction follows the design reference as a dark graphite cognitive
workbench with warm text, restrained borders, compact technical labels, one
active accent, and a separate warning or retry accent. Remote fonts and
decorative assets are not added.

## Deferred

Deferred features include arbitrary activity jumps, side-path trees, subject
level concept routes, expanded Zoom concept map, authored hints, specialized
extension renderers, AI teaching or grading, mastery modeling, durable unsent
drafts, profile editing, calibration, cloud sync, analytics, React Router, and a
global state-management framework.
