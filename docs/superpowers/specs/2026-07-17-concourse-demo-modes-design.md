# Concourse Guided Demo Modes Design

**Status:** Approved design, pending specification review

**Date:** 2026-07-17

## Decision and precedence

Turn the public guided demo into a Mode-aware learning workspace that exposes
all six canonical Concourse interaction modes: **Coach**, **Flow**, **Test**,
**Rescue**, **Zoom**, and **Recap**.

This specification extends the dedicated demo, living route, and activity
micro-lesson designs. It replaces presentation and transition behavior where
those earlier documents conflict, but it does not change the microbiology
course graph, authored answers, evidence classification, adaptive branch rules,
pack documents, or project-site narrative.

The design follows the existing Concourse product and architecture contracts:

- `README.md` and `MEMORY.md` define Modes as configurable learning and
  presentation settings.
- `docs/learner-profile.md` defines the six session modes and their intent.
- `docs/decisions/0006-fixed-profile-and-presentation-policy.md` requires
  presentation policy to remain deterministic and separate from activity
  selection, evidence evaluation, and mastery inference.
- `src/core/presentation/presentation-policy.ts` supplies the canonical mode
  semantics that the static website must project faithfully.

The website remains a framework-free demonstration rather than importing the
React application or TypeScript learning core.

## Problem

The guided course contains meaningful authored lessons, evidence-aware routing,
optional support, and inspectable pack data, but its current presentation shows
too much of that system at once. A large hero, long route, current activity,
evidence panel, and pack source compete for attention. On narrow screens, the
route becomes a long horizontal region before the learner reaches the lesson.

Activity transitions also move directly from a correct answer to the next
question. That makes feedback hard to absorb and makes the experience feel like
a quiz conveyor rather than a course that teaches, evaluates, and adapts.

Concourse already has a product-level answer: temporary Modes that change how a
session is presented without changing what the course means. The public demo
should make that capability immediately understandable while improving the
baseline workspace for learners who benefit from reduced distraction, stable
context, explicit transitions, and interruption recovery.

## Goals

- Demonstrate all six real Concourse Modes in the public course.
- Let a learner change Mode at any time without losing work or position.
- Make one activity and its **Key idea** the dominant workspace content.
- Separate submission from advancement so feedback remains available until an
  explicit **Continue** action.
- Make adaptive branch decisions visible and understandable.
- Provide truthful required-versus-optional progress.
- Improve attention support, legibility, focus management, mobile flow, and
  interruption recovery in every Mode.
- Preserve the static site's local-first, framework-free, lightweight boundary.

## Non-goals

- Defining fixed learner types or recommending a Mode from a diagnosis.
- Claiming that visual, auditory, or kinesthetic “learning styles” determine
  learning outcomes.
- Changing course order, answers, evaluation, evidence, or branch eligibility
  based on Mode.
- Adding learner accounts, profile editing, calibration, analytics, hosted
  state, or remote personalization.
- Importing the production React application into the website.
- Replacing the six canonical Mode names with accessibility-specific aliases.
- Reauthoring the microbiology lessons or extending the pack format.

## Product language

The public control is labeled **Mode**. Its trigger reads, for example,
**Mode: Coach**. The palette heading is **Change how this session is
presented**.

Supporting copy states:

> Modes change guidance, pacing, and workspace detail. They do not change
> grading or course order.

The interface does not call Modes diagnoses, accommodations, personality
types, or fixed learning styles. A learner may switch freely according to the
task and their current needs.

## Chosen interaction

Coach is the initial Mode for a new course record. The active Mode appears in
the compact workspace header beside progress. Activating it opens a palette
containing all six options, each with its canonical name and one concrete
description.

The palette is compact and anchored near the trigger on wide screens. On narrow
screens it becomes a full-width sheet in normal viewport flow. It does not
cover the response controls without an obvious close action.

Selecting a Mode:

1. commits the new Mode to demo state;
2. derives the corresponding presentation policy;
3. preserves the current activity, draft, evidence, and completion state;
4. updates only presentation and disclosure behavior;
5. announces the selected Mode and its principal effect;
6. closes the palette and returns focus to the trigger.

The learner can close the palette without changing Mode. `Escape` closes it and
returns focus to the trigger.

## Canonical Mode projection

The website projects the production semantics into the visible demo as follows.
No projection is allowed to discard authored content; content outside the
primary region moves into a labeled disclosure.

### Coach

- Balanced explanation, activity, feedback, and checkpoints.
- The **Key idea** and current response remain primary.
- Route summary and evidence context remain available in compact disclosures.
- Hints are available without being proactive.
- This is the default Mode.

### Flow

- The activity becomes the dominant visual region.
- Route detail, pack source, and optional content collapse.
- Hints appear on request.
- Extra confirmations and nonessential prompts are minimized.
- Correct feedback still requires explicit **Continue**; reduced interruption
  never means silent automatic advancement.

### Test

- The response is dominant and supporting guidance is reduced.
- Required authored instruction remains available but may begin collapsed
  behind **Review the key idea**.
- Hints and supporting explanations remain withheld until requested or until
  evaluation makes them relevant.
- The demo does not introduce new assessment items or change grading.

### Rescue

- The **Key idea**, relevant guidance, and available support expand.
- Hints become proactive.
- Retry actions remain close to feedback.
- Feedback briefly explains the important difference and provides a clear next
  action.
- Support use does not penalize evidence or change course order.

### Zoom

- The current activity remains the thread anchor.
- The authored route, branch decisions, evidence context, and pack structure
  expand around it.
- Optional content is expanded and system context is fully available.
- No primary-block limit truncates the current concept view.
- The expanded view must not return to the previous crushed three-column
  layout; secondary regions remain bounded and independently collapsible.

### Recap

- Retrieval prompts, key vocabulary, and previously encountered ideas become
  visually dominant.
- New explanatory material recedes into a labeled disclosure.
- Route context stays compact and checkpoints feel more frequent.
- Switching to Recap does not jump backward, create new evidence, or reorder
  activities.

## Universal workspace behavior

Mode is not a gate for basic usability. Every Mode receives the following
behavior.

### Dedicated active workspace

Before the course starts, the demo page may retain its short introduction and
start action. Once a course is active, the large introduction leaves the
primary viewport. The page becomes a dedicated workspace with:

1. a compact header containing course identity, progress, and Mode;
2. one dominant activity column;
3. route and system context in secondary disclosures or panels;
4. a concise local-storage status and reset action outside the activity flow.

Desktop may place opened secondary panels beside the activity when space
allows. Mobile uses one readable vertical column. It must not use the current
long horizontal route scroller.

### Progress

Progress distinguishes required completion from optional opportunities. The
primary label follows this pattern:

> 5 of 13 required activities · 1 support activity available

The completed count never includes merely available optional nodes. The label
updates after committed activity completion and remains visible in the compact
header.

### Submission and advancement

Submission and advancement are separate transitions:

```text
submit response
  -> validate and evaluate
  -> record evidence
  -> keep current activity visible
  -> show feedback and Continue
  -> learner activates Continue
  -> resolve authored next node or branch choice
  -> render the next Key idea
```

A passed or ungraded completion never automatically replaces the activity.
Retry feedback also remains attached to the response that produced it.

When an authored branch has multiple eligible next nodes, the learner receives
an explicit branch choice. When evidence activates or recommends support, the
reason appears inline in plain language before the branch controls. The pack or
evidence panel may expose deeper technical detail, but it is not the only place
where the branch decision is explained.

### Focus and scrolling

- Starting or resuming the course focuses and scrolls to the current **Key
  idea** heading.
- Submitting focuses the feedback heading after it is rendered.
- Activating **Continue** focuses and scrolls to the next **Key idea** heading.
- Opening the Mode palette moves focus into its labeled control group.
- Closing the palette restores focus to the Mode trigger.
- Focus is never deliberately placed below the viewport with
  `preventScroll: true`.
- Reduced-motion preference removes animated scrolling or panel movement; it
  does not suppress necessary focus placement.

### Interruption recovery

On a valid restored course, the workspace displays a brief message such as:

> Welcome back — continuing at Transport proteins.

It then lands on the current **Key idea**. The message is informational and
does not require dismissal.

If the learner refreshed after submitting but before selecting **Continue**,
the current activity and its feedback are restored. Course reset remains an
explicit action with bounded copy explaining what will be removed.

## State model

The demo separates durable course state from transient interface state.

### Durable course state

- schema version;
- current node ID;
- required and optional node progress;
- evidence records;
- adaptive branch state;
- active Mode;
- completed submission awaiting advancement, when present.

This state is validated before restoration. A record from the preceding demo
schema that lacks Mode defaults to Coach without losing valid progress. An
unknown Mode also falls back to Coach. Derived presentation policy is never
persisted.

### Transient interface state

- current unsubmitted response draft;
- Mode palette open state;
- open secondary disclosures;
- selected context tab or panel.

An in-session Mode switch preserves the transient response draft. Unsubmitted
drafts do not need to survive a full refresh. Submitted evidence and an
awaiting-advancement state do survive refresh.

### Operations

The pure demo model exposes distinct operations for:

- changing Mode;
- submitting an activity response;
- advancing from a completed activity;
- selecting an authored next branch;
- resetting the course.

`changeMode` may mutate only the active Mode and timestamps or metadata required
for storage. It must preserve all route, progress, evidence, branch, and
completion fields byte-for-byte.

`submitActivity` may evaluate and record evidence but may not change the
current node after a completed response.

`advanceActivity` is valid only when the current activity is complete. It uses
the existing authored and adaptive route rules and does not inspect Mode.

## Presentation module

Add a framework-free `website/demo-modes.js` module containing:

- the ordered six-Mode registry;
- user-facing labels and concise descriptions;
- a pure resolver from Mode and current activity state to demo presentation
  policy;
- safe parsing with Coach fallback;
- no DOM, storage, evaluation, or route dependencies.

The presentation policy uses explicit flags rather than Mode-name checks spread
through renderers. Expected policy dimensions include:

- primary activity density;
- route visibility;
- system-context visibility;
- optional-content visibility;
- teaching disclosure;
- guidance visibility;
- hint access;
- feedback detail;
- interruption density.

`demo-render.js` consumes the resolved policy. `demo-model.js` owns state
transitions. `main.js` coordinates DOM events, storage, announcements, draft
capture, and focus. Evaluation and routing remain outside `demo-modes.js`.

The website projection intentionally mirrors the existing core contract without
making the static site depend on the application build. Tests lock the six
names, ordering, descriptions, and allowed policy effects so drift becomes an
explicit change.

## Accessibility and attention support

- Mode options are semantic controls with visible selected state and complete
  text labels.
- The selected state is exposed programmatically and never relies on color.
- The palette has a programmatic name and an obvious close action.
- Status announcements are concise and polite; Mode descriptions are not
  repeatedly announced during unrelated activity changes.
- Route labels, progress text, and supporting copy meet WCAG 2.2 AA contrast
  for their rendered sizes.
- Body and route text do not fall below the site's readable minimum size.
- Controls retain at least 44 by 44 CSS pixel target areas where practical.
- Heading order and screen-reader reading order follow the visible activity
  sequence.
- No Mode introduces timers, autoplay, flashing, forced animation, surprise
  overlays, or hidden hover-only content.
- `prefers-reduced-motion: reduce` removes nonessential transition motion.
- 200% zoom and 320 CSS pixel width preserve one logical reading column without
  page-level horizontal scrolling.
- Key vocabulary remains semantic `<strong>` text rather than decorative
  badges.

## Storage failure and invalid state

If browser storage is unavailable or a write fails, the active in-memory course
continues in session-only mode. A concise status explains that progress will not
survive refresh. The learner is not blocked from changing Mode or completing
the course.

If saved data is corrupt beyond a safe migration, the demo offers a clearly
labeled fresh start and does not pretend to have restored progress. Reset
affects only the guided demo record.

## No-JavaScript experience

The existing semantic no-JavaScript course remains a concise Coach-like
walkthrough. It explains that the interactive version demonstrates switchable
Modes, evidence, and adaptive routing, but it does not imitate six static copies
of the course.

All essential project orientation and representative microbiology instruction
remain readable without JavaScript.

## Testing strategy

### Mode registry and policy

- exactly Coach, Flow, Test, Rescue, Zoom, and Recap are registered in canonical
  order;
- every Mode has a unique description and resolvable policy;
- the resolver is pure and returns safe immutable values;
- invalid or missing persisted Mode resolves to Coach;
- Mode changes preserve current node, progress, evidence, branches, and
  completion state;
- each Mode affects only permitted presentation dimensions.

### Submission lifecycle

- correct and ungraded submissions retain the current activity;
- feedback and **Continue** render after committed completion;
- refresh restores completed feedback awaiting advancement;
- **Continue** advances exactly once;
- retry does not expose stale passed feedback;
- branch choice remains explicit when multiple nodes are eligible;
- Mode never influences evaluation or next-node eligibility.

### Rendering and interaction

- the compact header reports active Mode and truthful required progress;
- the palette exposes all six descriptions and selected state;
- selecting and closing the palette restore focus correctly;
- switching Mode preserves an unsubmitted draft;
- branch reasoning is readable inline;
- route and context disclosures follow the active policy without discarding
  content;
- the active course does not retain the large introductory hero above it;
- mobile route context is vertical rather than a long horizontal scroller.

### Persistence and recovery

- preceding valid records migrate to Coach without losing course progress;
- unknown Mode values fall back safely;
- awaiting-advancement feedback survives restoration;
- storage failure leaves a usable session-only course;
- corrupt state produces an honest bounded recovery path.

### Browser verification

Exercise at least Coach, Flow, Rescue, and Zoom at 1440 by 1000 and 390 by 844.
Spot-check Test and Recap presentation behavior. Verify:

- keyboard-only start, Mode selection, response, feedback, Continue, and branch
  choice;
- focus remains visible and within the viewport;
- 200% zoom and 320 CSS pixel width;
- reduced-motion behavior;
- readable progress and route contrast;
- no page-level horizontal overflow;
- refresh from an awaiting-advancement state;
- clean console and network on the canonical production origin.

The complete website tests, repository verification, Rust tests, production
build, audit, deployment workflow, and canonical live-file checks must pass
before completion is claimed.

## Performance budget

The feature remains dependency-free and uses no remote font, image, animation,
or runtime service. The guided-course JavaScript and total website CSS must stay
within the existing project budgets unless a later approved design explicitly
changes them.

Mode switching must not reload the page or refetch course data.

## Success criteria

- A first-time visitor can identify that Concourse supports six switchable
  learning presentations.
- Switching visibly changes the workspace while leaving course meaning and
  progress unchanged.
- The active activity is dominant in every Mode, including expanded Zoom.
- Learners can read feedback before deliberately advancing.
- Required progress and optional support are distinguishable at a glance.
- Starting, resuming, submitting, and advancing place focus at the correct
  visible location.
- An in-progress answer survives Mode switching.
- An interrupted completed activity restores with its feedback and
  **Continue** action.
- Mobile no longer places a long horizontal route before the lesson.
- Automated verification, browser QA, CI, deployment, and canonical live checks
  pass before the work is considered complete.
