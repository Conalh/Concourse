# Concourse Guided Demo Modes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the public microbiology demo into a focused, interruption-resilient workspace that demonstrates all six canonical Concourse Modes without changing course content, evaluation, evidence, or routing semantics.

**Architecture:** Keep the static website framework-free. Add a pure Mode registry and presentation resolver, add `interactionMode` and an explicit awaiting-advancement state to the existing course model, persist only durable inputs, and let the renderer derive layout and disclosure from presentation policy. The existing lifecycle field `mode` remains `entry | course | recap`; it must not be reused for Coach, Flow, Test, Rescue, Zoom, or Recap.

**Tech Stack:** Semantic HTML5, modern CSS, JavaScript ES modules, Node 22 built-in test runner, jsdom 29, Prettier 3, GitHub Actions, and Cloudflare Pages.

## Global Constraints

- Use exactly these canonical interaction modes in this order: `coach`, `flow`, `test`, `rescue`, `zoom`, `recap`.
- Label the control **Mode** and the palette **Change how this session is presented**.
- State that Modes change guidance, pacing, and workspace detail; they do not change grading or course order.
- Never describe Modes as diagnoses, accommodations, personality types, or fixed visual/auditory/kinesthetic learner types.
- `interactionMode` may change presentation and disclosure only. It must not change the current activity, response correctness, evidence, required or optional nodes, branch eligibility, or completion counts.
- Keep submission and advancement separate. A completed response remains current until the learner activates **Continue** or selects an explicit eligible branch.
- Preserve unsubmitted form input during an in-session Mode switch. Unsubmitted input does not need to survive a full refresh.
- Persist `interactionMode` and a completed submission awaiting advancement. Derive presentation policy on every render; never persist the policy object.
- Older valid `concourse.demo.course.v1` records without the new fields must restore safely with Coach as their Mode.
- Preserve the existing framework-free, local-first, no-account, no-analytics, no-remote-runtime boundary.
- Preserve semantic controls, visible focus, keyboard operation, reduced motion, and no page-level horizontal scrolling at 320 CSS pixels or 200% zoom.
- Keep guided-course JavaScript below 90 KiB and total website CSS below 80 KiB uncompressed.
- Do not add a runtime dependency, remote font, image, animation library, hosted service, or build step to the website.
- Keep every commit scoped to the files and behavior of its task.

---

## File Map

### New files

- `website/demo-modes.js` — canonical public-site Mode registry, normalization, and pure presentation-policy resolution.
- `scripts/website-modes.test.mjs` — registry order, copy, fallback, immutability, and policy-dimension tests.

### Existing files to modify

- `package.json` — include the new Mode test in `test:website`.
- `website/demo-model.js` — add `interactionMode`, awaiting advancement, explicit continuation, and Mode invariants.
- `website/demo-storage.js` — save and restore Mode and awaiting advancement while accepting preceding valid records.
- `website/demo-activities.js` — render completed responses inertly and restore an in-session response draft after rerender.
- `website/demo-render.js` — render the Mode palette, policy-aware teaching and secondary regions, completion feedback, explicit branch/Continue actions, truthful progress, and correct focus targets.
- `website/main.js` — coordinate palette state, transient drafts, disclosure state, explicit advancement, focus/scroll, resume notice, and storage fallback.
- `website/demo/index.html` — add stable Mode, disclosure, and resume-notice roots; preserve the semantic no-JavaScript walkthrough.
- `website/demo.css` — make the activity dominant, implement palette and policy layouts, replace the mobile route scroller, and improve route contrast and text size.
- `scripts/website-demo.test.mjs` — lock model transitions and Mode invariants.
- `scripts/website-storage.test.mjs` — lock backward-compatible storage and awaiting-feedback restoration.
- `scripts/website-activities.test.mjs` — lock completed controls and draft restoration.
- `scripts/website-runtime.test.mjs` — lock the full Mode, feedback, focus, branch, draft, resume, and session-only flows.
- `scripts/website-document.test.mjs` — lock the new semantic roots and no-JavaScript Mode explanation.
- `scripts/website-styles.test.mjs` — lock dominant-stage layout, vertical mobile route, palette, readable route text, and reduced motion.
- `scripts/website-assets.test.mjs` — include `demo-modes.js` in the JavaScript budget.

## Boundary Decisions

- `demo-modes.js` imports nothing from the DOM, storage, routing, evaluation, or pack modules.
- `demo-model.js` may import only Mode validation/defaults from `demo-modes.js`; it does not import resolved presentation policy.
- `demo-render.js` receives the resolved policy in its projection. It does not infer policy from Mode names.
- `main.js` owns transient interface state: palette visibility, open route/context disclosures, the active context tab, response draft preservation, and one-render resume notice.
- `demo-storage.js` saves `interactionMode` and `awaitingAdvance`, not transient interface state or derived policy.
- Route recommendation remains in `demo-routing.js`; no Mode-name condition may be added there.

---

### Task 1: Add the Canonical Demo Mode Registry

**Files:**

- Create: `website/demo-modes.js`
- Create: `scripts/website-modes.test.mjs`
- Modify: `package.json:27`
- Modify: `scripts/website-assets.test.mjs:61-71`

**Interfaces:**

- Consumes: no application or DOM state.
- Produces: `DEFAULT_INTERACTION_MODE`, `INTERACTION_MODES`, `isInteractionMode(value)`, `normalizeInteractionMode(value)`, `getInteractionModeDefinition(value)`, and `resolveDemoPresentation(value)`.
- `resolveDemoPresentation` returns a frozen object with `workspaceDensity`, `routeVisibility`, `contextVisibility`, `optionalContentVisibility`, `teachingVisibility`, `guidanceVisibility`, `hintAccess`, `feedbackDetail`, and `interruptionDensity`.

- [ ] **Step 1: Write the failing Mode contract tests**

Create `scripts/website-modes.test.mjs`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  DEFAULT_INTERACTION_MODE,
  INTERACTION_MODES,
  getInteractionModeDefinition,
  isInteractionMode,
  normalizeInteractionMode,
  resolveDemoPresentation,
} from '../website/demo-modes.js'

const IDS = ['coach', 'flow', 'test', 'rescue', 'zoom', 'recap']

test('defines the six canonical Concourse Modes in product order', () => {
  assert.equal(DEFAULT_INTERACTION_MODE, 'coach')
  assert.deepEqual(
    INTERACTION_MODES.map(({ id }) => id),
    IDS,
  )
  assert.deepEqual(
    INTERACTION_MODES.map(({ label }) => label),
    ['Coach', 'Flow', 'Test', 'Rescue', 'Zoom', 'Recap'],
  )
  assert.equal(
    new Set(INTERACTION_MODES.map(({ description }) => description)).size,
    6,
  )
  assert.ok(
    INTERACTION_MODES.every(({ description }) => description.length > 20),
  )
})

test('normalizes unknown presentation input to Coach', () => {
  assert.equal(isInteractionMode('zoom'), true)
  assert.equal(isInteractionMode('entry'), false)
  assert.equal(normalizeInteractionMode('rescue'), 'rescue')
  assert.equal(normalizeInteractionMode('unknown'), 'coach')
  assert.equal(normalizeInteractionMode(null), 'coach')
  assert.equal(getInteractionModeDefinition('unknown').id, 'coach')
})

test('resolves immutable policy without grading or routing dimensions', () => {
  const policies = Object.fromEntries(
    IDS.map((id) => [id, resolveDemoPresentation(id)]),
  )

  assert.equal(Object.isFrozen(policies.coach), true)
  assert.equal(policies.flow.workspaceDensity, 'focus')
  assert.equal(policies.flow.interruptionDensity, 'reduced')
  assert.equal(policies.test.teachingVisibility, 'available')
  assert.equal(policies.test.hintAccess, 'withheld-until-requested')
  assert.equal(policies.rescue.guidanceVisibility, 'expanded')
  assert.equal(policies.rescue.feedbackDetail, 'detailed')
  assert.equal(policies.zoom.routeVisibility, 'expanded')
  assert.equal(policies.zoom.contextVisibility, 'expanded')
  assert.equal(policies.recap.teachingVisibility, 'available')
  assert.equal(policies.recap.optionalContentVisibility, 'collapsed')

  for (const policy of Object.values(policies)) {
    assert.equal('correctResponse' in policy, false)
    assert.equal('nextNodeId' in policy, false)
    assert.equal('classification' in policy, false)
    assert.equal('score' in policy, false)
  }
})
```

- [ ] **Step 2: Run the focused test and verify the missing-module failure**

Run:

```powershell
node --test scripts/website-modes.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `website/demo-modes.js`.

- [ ] **Step 3: Implement the pure Mode registry and resolver**

Create `website/demo-modes.js`:

```js
export const DEFAULT_INTERACTION_MODE = 'coach'

const definitions = [
  {
    id: 'coach',
    label: 'Coach',
    description: 'Balanced explanation, activity, feedback, and route context.',
    announcement: 'Balanced guidance and checkpoints.',
    policy: {
      workspaceDensity: 'balanced',
      routeVisibility: 'compact',
      contextVisibility: 'compact',
      optionalContentVisibility: 'available',
      teachingVisibility: 'visible',
      guidanceVisibility: 'normal',
      hintAccess: 'available',
      feedbackDetail: 'brief',
      interruptionDensity: 'normal',
    },
  },
  {
    id: 'flow',
    label: 'Flow',
    description:
      'Keeps the activity dominant with fewer interruptions and less chrome.',
    announcement:
      'The activity is dominant and secondary context is collapsed.',
    policy: {
      workspaceDensity: 'focus',
      routeVisibility: 'collapsed',
      contextVisibility: 'collapsed',
      optionalContentVisibility: 'collapsed',
      teachingVisibility: 'visible',
      guidanceVisibility: 'normal',
      hintAccess: 'on-request',
      feedbackDetail: 'brief',
      interruptionDensity: 'reduced',
    },
  },
  {
    id: 'test',
    label: 'Test',
    description:
      'Prioritizes an independent response before supporting explanation.',
    announcement: 'Supporting explanation is available after independent work.',
    policy: {
      workspaceDensity: 'focus',
      routeVisibility: 'collapsed',
      contextVisibility: 'collapsed',
      optionalContentVisibility: 'collapsed',
      teachingVisibility: 'available',
      guidanceVisibility: 'reduced',
      hintAccess: 'withheld-until-requested',
      feedbackDetail: 'brief',
      interruptionDensity: 'only-when-blocked',
    },
  },
  {
    id: 'rescue',
    label: 'Rescue',
    description:
      'Expands guidance, support, and the explanation needed for the next step.',
    announcement: 'Guidance and support are expanded.',
    policy: {
      workspaceDensity: 'guided',
      routeVisibility: 'compact',
      contextVisibility: 'compact',
      optionalContentVisibility: 'available',
      teachingVisibility: 'expanded',
      guidanceVisibility: 'expanded',
      hintAccess: 'proactive',
      feedbackDetail: 'detailed',
      interruptionDensity: 'normal',
    },
  },
  {
    id: 'zoom',
    label: 'Zoom',
    description:
      'Expands the route, branch reasoning, evidence, and pack structure.',
    announcement:
      'Route and system context are expanded around the current activity.',
    policy: {
      workspaceDensity: 'contextual',
      routeVisibility: 'expanded',
      contextVisibility: 'expanded',
      optionalContentVisibility: 'expanded',
      teachingVisibility: 'visible',
      guidanceVisibility: 'expanded',
      hintAccess: 'available',
      feedbackDetail: 'brief',
      interruptionDensity: 'reduced',
    },
  },
  {
    id: 'recap',
    label: 'Recap',
    description:
      'Emphasizes retrieval, key vocabulary, and previously encountered ideas.',
    announcement: 'Retrieval and key vocabulary are emphasized.',
    policy: {
      workspaceDensity: 'focus',
      routeVisibility: 'compact',
      contextVisibility: 'compact',
      optionalContentVisibility: 'collapsed',
      teachingVisibility: 'available',
      guidanceVisibility: 'reduced',
      hintAccess: 'on-request',
      feedbackDetail: 'brief',
      interruptionDensity: 'normal',
    },
  },
]

export const INTERACTION_MODES = Object.freeze(
  definitions.map(({ policy, ...definition }) =>
    Object.freeze({ ...definition, policy: Object.freeze({ ...policy }) }),
  ),
)

const byId = new Map(
  INTERACTION_MODES.map((definition) => [definition.id, definition]),
)

export function isInteractionMode(value) {
  return typeof value === 'string' && byId.has(value)
}

export function normalizeInteractionMode(value) {
  return isInteractionMode(value) ? value : DEFAULT_INTERACTION_MODE
}

export function getInteractionModeDefinition(value) {
  return byId.get(normalizeInteractionMode(value))
}

export function resolveDemoPresentation(value) {
  return getInteractionModeDefinition(value).policy
}
```

- [ ] **Step 4: Add the new test and runtime module to the existing gates**

In `package.json`, put `scripts/website-modes.test.mjs` first in `test:website`:

```json
"test:website": "node --test scripts/website-modes.test.mjs scripts/website-demo.test.mjs scripts/website-storage.test.mjs scripts/website-activities.test.mjs scripts/website-document.test.mjs scripts/website-assets.test.mjs scripts/website-runtime.test.mjs scripts/website-styles.test.mjs"
```

In `scripts/website-assets.test.mjs`, add `'demo-modes.js'` to the guided runtime `paths` array.

- [ ] **Step 5: Run the Mode and budget tests**

Run:

```powershell
node --test scripts/website-modes.test.mjs scripts/website-assets.test.mjs
```

Expected: all Mode and asset tests PASS; guided JavaScript remains below 90 KiB.

- [ ] **Step 6: Format and commit the Mode boundary**

Run:

```powershell
npx prettier --write website/demo-modes.js scripts/website-modes.test.mjs scripts/website-assets.test.mjs package.json
git add website/demo-modes.js scripts/website-modes.test.mjs scripts/website-assets.test.mjs package.json
git commit -m "feat: define guided demo modes"
```

Expected: one commit containing only the registry, its tests, and gate registration.

---

### Task 2: Separate Submission from Advancement in the Course Model

**Files:**

- Modify: `website/demo-model.js:20-412`
- Modify: `scripts/website-demo.test.mjs:1-251`

**Interfaces:**

- Consumes: `DEFAULT_INTERACTION_MODE` and `isInteractionMode` from Task 1.
- Produces state fields `interactionMode: string` and `awaitingAdvance: null | { nodeId, nextCoreNodeId, completedAt }`.
- Produces transitions `{ type: 'change-interaction-mode', interactionMode }` and `{ type: 'advance-course', nextNodeId? }`.
- `submit-response` records evidence and completion but leaves `currentNodeId` unchanged.
- `advance-course` is the only transition that moves from a completed required activity to its core successor, an eligible optional branch, or lifecycle recap.

- [ ] **Step 1: Add failing state and invariant tests**

Add these tests to `scripts/website-demo.test.mjs` before updating its older immediate-advance expectations:

```js
test('changes only interaction presentation state', () => {
  const state = startCourse()
  const changed = transitionCourse(
    state,
    { type: 'change-interaction-mode', interactionMode: 'zoom' },
    NOW,
  )

  assert.equal(changed.interactionMode, 'zoom')
  for (const key of [
    'mode',
    'currentNodeId',
    'completedNodeIds',
    'skippedNodeIds',
    'availableNodeIds',
    'activityProgress',
    'evidence',
    'branchDecisions',
    'scheduledRetrievalConceptIds',
    'routeHistory',
    'awaitingAdvance',
  ]) {
    assert.deepEqual(changed[key], state[key], key)
  }
})

test('records a completed response without advancing', () => {
  const submitted = submitCorrect(startCourse(), 'boundary-permeability')

  assert.equal(submitted.currentNodeId, 'boundary-permeability')
  assert.equal(submitted.evidence.length, 1)
  assert.ok(submitted.completedNodeIds.includes('boundary-permeability'))
  assert.deepEqual(submitted.awaitingAdvance, {
    nodeId: 'boundary-permeability',
    nextCoreNodeId: 'boundary-structure',
    completedAt: NOW,
  })
})

test('requires an explicit choice when evidence opens a branch', () => {
  const submitted = submitCorrect(startCourse(), 'boundary-permeability')
  const unchanged = transitionCourse(submitted, { type: 'advance-course' }, NOW)
  const continued = transitionCourse(
    submitted,
    { type: 'advance-course', nextNodeId: 'boundary-structure' },
    NOW,
  )

  assert.equal(unchanged, submitted)
  assert.equal(continued.currentNodeId, 'boundary-structure')
  assert.equal(continued.awaitingAdvance, null)
  assert.equal(
    continued.branchDecisions['extension-cell-envelopes'].status,
    'skipped',
  )
})

test('enters and returns from an explicitly selected optional branch', () => {
  const submitted = submitCorrect(startCourse(), 'boundary-permeability')
  const branch = transitionCourse(
    submitted,
    { type: 'advance-course', nextNodeId: 'extension-cell-envelopes' },
    NOW,
  )
  const returned = transitionCourse(
    branch,
    { type: 'complete-branch', nodeId: 'extension-cell-envelopes' },
    NOW,
  )

  assert.equal(branch.currentNodeId, 'extension-cell-envelopes')
  assert.equal(
    branch.branchDecisions['extension-cell-envelopes'].returnNodeId,
    'boundary-structure',
  )
  assert.equal(returned.currentNodeId, 'boundary-structure')
})
```

- [ ] **Step 2: Run the model tests and verify the red state**

Run:

```powershell
node --test scripts/website-demo.test.mjs
```

Expected: FAIL because `interactionMode`, `awaitingAdvance`, and `advance-course` do not exist and successful submission still changes `currentNodeId`.

- [ ] **Step 3: Add the two independent state dimensions**

At the top of `website/demo-model.js`, import the Mode boundary:

```js
import { DEFAULT_INTERACTION_MODE, isInteractionMode } from './demo-modes.js'
```

Add these fields to `createCourseState()` without renaming lifecycle `mode`:

```js
interactionMode: DEFAULT_INTERACTION_MODE,
awaitingAdvance: null,
```

Add validation:

```js
function validAwaitingAdvance(state) {
  if (state.awaitingAdvance === null) return true
  const pending = state.awaitingAdvance
  const node = getCourseNode(pending?.nodeId)
  return (
    node?.required === true &&
    pending.nodeId === state.currentNodeId &&
    pending.nextCoreNodeId === node.nextCoreNodeId &&
    state.completedNodeIds.includes(pending.nodeId) &&
    typeof pending.completedAt === 'string'
  )
}
```

Require `isInteractionMode(state.interactionMode)` and `validAwaitingAdvance(state)` inside `isValidCourseState`.

- [ ] **Step 4: Keep successful submission on the completed activity**

In the successful path of `submitCourseResponse`, replace the immediate current-node change with:

```js
const nextNodeId = node.nextCoreNodeId
const completedNodeIds = appendUnique(state.completedNodeIds, event.nodeId)
const availableNodeIds = nextNodeId
  ? appendUnique(without(state.availableNodeIds, event.nodeId), nextNodeId)
  : without(state.availableNodeIds, event.nodeId)
let nextState = {
  ...state,
  currentNodeId: event.nodeId,
  awaitingAdvance: {
    nodeId: event.nodeId,
    nextCoreNodeId: nextNodeId,
    completedAt: now,
  },
  completedNodeIds,
  availableNodeIds,
  activityProgress: {
    ...state.activityProgress,
    [event.nodeId]: { ...progress, classification, completedAt: now },
  },
  evidence: [...state.evidence, record],
  scheduledRetrievalConceptIds:
    classification === 'strong'
      ? state.scheduledRetrievalConceptIds
      : appendUnique(state.scheduledRetrievalConceptIds, conceptId),
  routeHistory: [...state.routeHistory, event.nodeId],
  updatedAt: now,
}
```

Keep `recommendRoute(nextState, record)` immediately after this block. Remove the old `requiredRouteComplete` transition from submission; lifecycle recap now happens during advancement.

- [ ] **Step 5: Implement deterministic explicit advancement**

Add these helpers before `transitionCourse`:

```js
function recommendationsForPending(state) {
  if (state.awaitingAdvance === null) return []
  return Object.values(state.branchDecisions).filter(
    (decision) =>
      decision.status === 'recommended' &&
      decision.evidenceActivityId === state.awaitingAdvance.nodeId,
  )
}

function skipPendingRecommendations(state, decisions, now) {
  return decisions.reduce(
    (next, decision) => ({
      ...next,
      skippedNodeIds: appendUnique(next.skippedNodeIds, decision.nodeId),
      availableNodeIds: without(next.availableNodeIds, decision.nodeId),
      branchDecisions: {
        ...next.branchDecisions,
        [decision.nodeId]: {
          ...decision,
          status: 'skipped',
          skippedAt: now,
        },
      },
    }),
    state,
  )
}

function advanceCourse(state, event, now) {
  const pending = state.awaitingAdvance
  if (state.mode !== 'course' || pending === null) return state

  const decisions = recommendationsForPending(state)
  const hasExplicitSelection = Object.hasOwn(event, 'nextNodeId')
  if (decisions.length > 0 && !hasExplicitSelection) return state

  const selectedNodeId = hasExplicitSelection
    ? event.nextNodeId
    : pending.nextCoreNodeId
  const selectedDecision = decisions.find(
    ({ nodeId }) => nodeId === selectedNodeId,
  )

  if (selectedDecision !== undefined) {
    return {
      ...state,
      currentNodeId: selectedDecision.nodeId,
      awaitingAdvance: null,
      availableNodeIds: without(
        state.availableNodeIds,
        selectedDecision.nodeId,
      ),
      branchDecisions: {
        ...state.branchDecisions,
        [selectedDecision.nodeId]: {
          ...selectedDecision,
          status: 'taken',
          returnNodeId: pending.nextCoreNodeId,
        },
      },
      updatedAt: now,
    }
  }

  if (selectedNodeId !== pending.nextCoreNodeId) return state

  const continued = skipPendingRecommendations(state, decisions, now)
  if (pending.nextCoreNodeId === null) {
    return requiredRouteComplete(continued)
      ? {
          ...continued,
          mode: 'recap',
          awaitingAdvance: null,
          availableNodeIds: without(continued.availableNodeIds, pending.nodeId),
          updatedAt: now,
        }
      : state
  }

  return {
    ...continued,
    currentNodeId: pending.nextCoreNodeId,
    awaitingAdvance: null,
    updatedAt: now,
  }
}
```

Replace `completeBranch` with the following version so an optional branch after the final required activity can finish cleanly:

```js
function completeBranch(state, event, now) {
  const node = getCourseNode(event.nodeId)
  const decision = state.branchDecisions[event.nodeId]
  const canFinish =
    decision?.returnNodeId === null && requiredRouteComplete(state)
  if (
    state.mode !== 'course' ||
    state.currentNodeId !== event.nodeId ||
    node?.required !== false ||
    decision?.status !== 'taken' ||
    (!canFinish && getCourseNode(decision.returnNodeId) === null)
  ) {
    return state
  }

  const completedNodeIds = appendUnique(state.completedNodeIds, event.nodeId)
  const branchDecisions = {
    ...state.branchDecisions,
    [event.nodeId]: { ...decision, status: 'completed', completedAt: now },
  }
  if (canFinish) {
    return {
      ...state,
      mode: 'recap',
      awaitingAdvance: null,
      completedNodeIds,
      availableNodeIds: without(state.availableNodeIds, event.nodeId),
      branchDecisions,
      routeHistory: [...state.routeHistory, event.nodeId],
      updatedAt: now,
    }
  }

  return {
    ...state,
    currentNodeId: decision.returnNodeId,
    awaitingAdvance: null,
    completedNodeIds,
    availableNodeIds: appendUnique(
      state.availableNodeIds,
      decision.returnNodeId,
    ),
    branchDecisions,
    routeHistory: [...state.routeHistory, event.nodeId],
    updatedAt: now,
  }
}
```

Delete the old `takeBranch` and `skipBranch` helpers and their `transitionCourse` event cases. `advance-course` now owns the only transition from completed required work into an optional or core successor.

In `transitionCourse`, add:

```js
if (
  event.type === 'change-interaction-mode' &&
  isInteractionMode(event.interactionMode) &&
  event.interactionMode !== state.interactionMode
) {
  return { ...state, interactionMode: event.interactionMode, updatedAt: now }
}
if (event.type === 'advance-course') return advanceCourse(state, event, now)
```

- [ ] **Step 6: Update model helpers and existing route tests for explicit continuation**

Keep `submitCorrect` as submission-only. Add:

```js
function continueFrom(state, nextNodeId = undefined) {
  const event = { type: 'advance-course' }
  if (nextNodeId !== undefined) event.nextNodeId = nextNodeId
  return transitionCourse(state, event, NOW)
}

function submitAndContinueCorrect(state, nodeId, confidence = 'high') {
  const submitted = submitCorrect(state, nodeId, confidence)
  const nextCoreNodeId = getCourseNode(nodeId).nextCoreNodeId
  return continueFrom(submitted, nextCoreNodeId)
}
```

Use `submitAndContinueCorrect` in loops and tests whose subject is the next activity or final recap. Keep `submitCorrect` in tests that inspect evidence, awaiting feedback, or newly recommended branches. Replace old `take-branch` setup with `advance-course` and the selected optional node.

- [ ] **Step 7: Run the focused model test**

Run:

```powershell
node --test scripts/website-demo.test.mjs
```

Expected: all demo-model, course-data, routing, and pack projection tests PASS.

- [ ] **Step 8: Format and commit the explicit lifecycle**

Run:

```powershell
npx prettier --write website/demo-model.js scripts/website-demo.test.mjs
git add website/demo-model.js scripts/website-demo.test.mjs
git commit -m "feat: separate course feedback and advancement"
```

Expected: one commit containing the model transition and its direct tests.

---

### Task 3: Persist Mode and Awaiting Feedback Safely

**Files:**

- Modify: `website/demo-storage.js:1-198`
- Modify: `scripts/website-storage.test.mjs:1-174`

**Interfaces:**

- Consumes: `normalizeInteractionMode` and the Task 2 state fields.
- Produces stored optional fields `interactionMode` and `awaitingAdvance` within the existing `concourse.demo.course.v1` record.
- A missing or unknown stored `interactionMode` restores as Coach.
- A missing stored `awaitingAdvance` restores as `null`.
- A malformed non-null awaiting-advance value rejects the record as invalid.

- [ ] **Step 1: Write failing backward-compatibility and feedback-restore tests**

Replace the first storage test and add the next two:

Add this import beside the existing model import:

```js
import { getActivity } from '../website/demo-course.js'
```

```js
test('round trips durable Mode and awaiting feedback state', () => {
  const storage = createMemoryStorage()
  let state = transitionCourse(createCourseState(), { type: 'start' }, NOW)
  state = transitionCourse(
    state,
    { type: 'change-interaction-mode', interactionMode: 'rescue' },
    NOW,
  )
  state = transitionCourse(
    state,
    {
      type: 'submit-response',
      nodeId: 'boundary-permeability',
      response: getActivity('boundary-permeability').correctResponse,
      confidence: 'high',
    },
    NOW,
  )

  assert.deepEqual(saveCourseState(storage, state), { ok: true })
  const restored = loadCourseState(storage)

  assert.equal(restored.ok, true)
  assert.equal(restored.value.mode, 'entry')
  assert.equal(restored.value.interactionMode, 'rescue')
  assert.equal(restored.value.currentNodeId, 'boundary-permeability')
  assert.deepEqual(restored.value.awaitingAdvance, state.awaitingAdvance)
  assert.equal(
    'presentationPolicy' in JSON.parse(storage.peek(STORAGE_KEY)),
    false,
  )
})

test('migrates preceding valid records to Coach without losing progress', () => {
  const preceding = toStoredCourseState(createCourseState())
  delete preceding.interactionMode
  delete preceding.awaitingAdvance

  const result = validateStoredCourseState(preceding)

  assert.equal(result.ok, true)
  assert.equal(result.value.interactionMode, 'coach')
  assert.equal(result.value.awaitingAdvance, null)
})

test('falls back from an unknown stored Mode but rejects malformed pending state', () => {
  const stored = toStoredCourseState(createCourseState())
  assert.equal(
    validateStoredCourseState({ ...stored, interactionMode: 'unknown' }).value
      .interactionMode,
    'coach',
  )
  assert.deepEqual(
    validateStoredCourseState({
      ...stored,
      awaitingAdvance: { nodeId: 'missing' },
    }),
    { ok: false, reason: 'invalid' },
  )
})
```

- [ ] **Step 2: Run storage tests and verify the red state**

Run:

```powershell
node --test scripts/website-storage.test.mjs
```

Expected: FAIL because Mode and awaiting advancement are not serialized or restored.

- [ ] **Step 3: Extend only the durable storage boundary**

Import:

```js
import { normalizeInteractionMode } from './demo-modes.js'
```

Add to `toStoredCourseState`:

```js
interactionMode: state.interactionMode,
awaitingAdvance: state.awaitingAdvance,
```

Before constructing restored `value`, validate a supplied non-null pending value:

```js
const awaitingAdvance = candidate.awaitingAdvance ?? null
if (
  awaitingAdvance !== null &&
  (typeof awaitingAdvance !== 'object' ||
    Array.isArray(awaitingAdvance) ||
    getCourseNode(awaitingAdvance.nodeId)?.required !== true ||
    !validTimestamp(awaitingAdvance.completedAt) ||
    awaitingAdvance.completedAt === null)
) {
  return { ok: false, reason: 'invalid' }
}
```

Add to restored `value`:

```js
interactionMode: normalizeInteractionMode(candidate.interactionMode),
awaitingAdvance: clone(awaitingAdvance),
```

Let `isValidCourseState(value)` enforce that pending node, current node, completion evidence, and authored core successor agree. Do not change `STORAGE_KEY`; preceding valid version-1 records remain readable.

- [ ] **Step 4: Run storage and model tests**

Run:

```powershell
node --test scripts/website-storage.test.mjs scripts/website-demo.test.mjs
```

Expected: all storage migration, corruption, session-only, model, and route tests PASS.

- [ ] **Step 5: Format and commit persistence**

Run:

```powershell
npx prettier --write website/demo-storage.js scripts/website-storage.test.mjs
git add website/demo-storage.js scripts/website-storage.test.mjs
git commit -m "feat: restore demo mode and feedback state"
```

Expected: one commit limited to durable demo storage and its tests.

---

### Task 4: Render the Mode-Aware Workspace and Explicit Feedback

**Files:**

- Modify: `website/demo/index.html:45-106`
- Modify: `website/demo-activities.js:1-220`
- Modify: `website/demo-render.js:1-631`
- Modify: `scripts/website-activities.test.mjs:1-149`
- Modify: `scripts/website-runtime.test.mjs:1-635`
- Modify: `scripts/website-document.test.mjs:64-143`

**Interfaces:**

- Consumes: `INTERACTION_MODES`, `getInteractionModeDefinition`, and resolved `projection.presentation`.
- Produces stable DOM roots `[data-course-heading]`, `[data-mode-trigger]`, `[data-mode-palette]`, `[data-mode-option]`, `[data-resume-notice]`, `[data-course-route-disclosure]`, `[data-course-context-disclosure]`, `[data-key-idea-anchor]`, `[data-completion-feedback]`, and `[data-course-action="advance-course"]`.
- Produces `restoreActivityResponse(form, activity, submission)` for Task 5.
- `focusTargetForTransition(previous, next)` returns the Key idea anchor, validation/feedback region, or recap; it never returns the first answer input after an activity change.

- [ ] **Step 1: Add failing semantic-root and completed-response tests**

In `scripts/website-document.test.mjs`, extend the dedicated-page test:

```js
for (const selector of [
  '[data-course-heading]',
  '[data-mode-trigger]',
  '[data-mode-palette]',
  '[data-resume-notice]',
  '[data-course-route-disclosure]',
  '[data-course-context-disclosure]',
]) {
  assert.ok(course.querySelector(selector), `missing ${selector}`)
}
assert.match(
  demoDocument.querySelector('.static-course')?.textContent ?? '',
  /Coach.*Flow.*Test.*Rescue.*Zoom.*Recap/is,
)
```

In `scripts/website-activities.test.mjs`, add:

```js
test('renders a completed response as inert recorded evidence', () => {
  const { form } = render('transport-gradient', {
    attempts: 1,
    lastResponse: 'in',
    lastConfidence: 'high',
    status: 'correct',
    classification: 'strong',
    completedAt: '2026-07-17T12:00:00.000Z',
  })

  assert.equal(form.dataset.activityCompleted, 'true')
  assert.ok([...form.elements].every((control) => control.disabled))
  assert.equal(form.querySelector('button[type="submit"]').hidden, true)
})

test('restores a transient choice and confidence draft', () => {
  const { form, activity } = render('transport-gradient')
  restoreActivityResponse(form, activity, {
    response: 'out',
    confidence: 'low',
  })

  assert.equal(form.querySelector('input[value="out"]').checked, true)
  assert.equal(
    form.querySelector('input[name="confidence"][value="low"]').checked,
    true,
  )
})
```

Import `restoreActivityResponse` in that test file.

- [ ] **Step 2: Run document and activity tests and verify the red state**

Run:

```powershell
node --test scripts/website-document.test.mjs scripts/website-activities.test.mjs
```

Expected: FAIL for missing Mode/disclosure roots and `restoreActivityResponse`.

- [ ] **Step 3: Add stable semantic workspace roots**

In `website/demo/index.html`:

- add `data-course-heading` to the large `.course-heading` header;
- add a visually hidden, initially hidden `<p data-resume-notice role="status"></p>` immediately after `.course-topbar`;
- add this Mode control inside `.course-topbar` before **Start over**:

```html
<div class="course-mode-control">
  <button
    type="button"
    data-mode-trigger
    data-course-action="toggle-mode-palette"
    aria-haspopup="dialog"
    aria-expanded="false"
    aria-controls="course-mode-palette"
  >
    Mode: Coach
  </button>
  <section
    id="course-mode-palette"
    class="mode-palette"
    data-mode-palette
    role="dialog"
    aria-labelledby="course-mode-palette-title"
    hidden
  >
    <header>
      <h2 id="course-mode-palette-title">
        Change how this session is presented
      </h2>
      <button
        type="button"
        data-course-action="close-mode-palette"
        aria-label="Close Mode choices"
      >
        Close
      </button>
    </header>
    <p>
      Modes change guidance, pacing, and workspace detail. They do not change
      grading or course order.
    </p>
    <div data-mode-options></div>
  </section>
</div>
```

Wrap the route nav and context aside in native disclosures:

```html
<details class="course-route-disclosure" data-course-route-disclosure>
  <summary data-course-route-summary>Learning route</summary>
  <nav class="course-route" data-course-route aria-label="Learning route"></nav>
</details>

<details class="course-context-disclosure" data-course-context-disclosure>
  <summary>Evidence and course source</summary>
  <aside
    class="course-context"
    data-course-context
    aria-label="Evidence, route decision, and pack source"
  ></aside>
</details>
```

Update the no-JavaScript introduction with one sentence naming the six Modes and explaining that they change presentation rather than grading or order.

- [ ] **Step 4: Make completed forms inert and add draft restoration**

In `renderActivity`, after appending the controls:

```js
if (typeof progress.completedAt === 'string') {
  form.dataset.activityCompleted = 'true'
  for (const control of form.elements) control.disabled = true
  form.querySelector('button[type="submit"]').hidden = true
}
```

Export this function from `website/demo-activities.js`:

```js
export function restoreActivityResponse(activityRoot, activity, submission) {
  if (activityRoot === null || submission === null) return
  const kind = activity.kind === 'retrieval' ? 'single-choice' : activity.kind
  if (['single-choice', 'choice'].includes(kind)) {
    const input = activityRoot.querySelector(
      `input[name="response"][value="${submission.response}"]`,
    )
    if (input) input.checked = true
  } else if (kind === 'multi-select' && Array.isArray(submission.response)) {
    for (const input of activityRoot.querySelectorAll(
      'input[name="response"]',
    )) {
      input.checked = submission.response.includes(input.value)
    }
  } else if (kind === 'matching' && submission.response !== null) {
    for (const select of activityRoot.querySelectorAll('[data-match-prompt]')) {
      select.value = submission.response[select.dataset.matchPrompt] ?? ''
    }
  }
  if (['high', 'low'].includes(submission.confidence)) {
    const confidence = activityRoot.querySelector(
      `input[name="confidence"][value="${submission.confidence}"]`,
    )
    if (confidence) confidence.checked = true
  }
}
```

Ordering drafts remain in `activityProgress.draftOrder` through the existing model transition.

- [ ] **Step 5: Render the Mode palette and policy-aware teaching**

Import `INTERACTION_MODES` and `getInteractionModeDefinition` in `demo-render.js`.

Add `renderModePalette(root, state, projection)` that:

- sets trigger text to `Mode: ${definition.label}`;
- sets trigger `aria-expanded` from `projection.modePaletteOpen`;
- toggles `[data-mode-palette].hidden`;
- renders six `<button type="button" data-mode-option="..." aria-pressed="...">` controls;
- places each Mode label in `<strong>` and its description in `<span>`.

Use this option shape:

```js
const option = el(documentRoot, 'button', {
  type: 'button',
  'data-mode-option': definition.id,
  'aria-pressed': String(definition.id === state.interactionMode),
})
option.append(
  el(documentRoot, 'strong', {}, definition.label),
  el(documentRoot, 'span', {}, definition.description),
)
```

Change `renderTeachingBlock(documentRoot, teaching, presentation)` so Test and Recap wrap the existing semantic Key idea section in a `<details data-teaching-disclosure>` with a `<summary data-key-idea-anchor tabindex="-1">Review the key idea</summary>`. Coach, Flow, Rescue, and Zoom keep the visible section; put `data-key-idea-anchor` and `tabindex="-1"` on its `h3`.

When Rescue resolves `guidanceVisibility: 'expanded'`, append this non-answer-bearing guidance after the teaching block:

```text
Try this: name the structure or process in the Key idea, then compare each response with its role.
```

Do not expose `activity.correctResponse` or pre-evaluation feedback through policy rendering.

- [ ] **Step 6: Render feedback, branch explanation, and explicit continuation**

Add `renderCompletionFeedback(documentRoot, state, activity, presentation)` and call it after the completed inert form when `state.awaitingAdvance?.nodeId === state.currentNodeId`.

The region uses:

```js
const progress = state.activityProgress[state.currentNodeId] ?? {}
const section = el(documentRoot, 'section', {
  className: 'completion-feedback',
  'data-completion-feedback': '',
  'aria-labelledby': 'completion-feedback-title',
  tabindex: '-1',
})
section.append(
  el(
    documentRoot,
    'h3',
    { id: 'completion-feedback-title' },
    progress.lastResponseCorrect
      ? 'That fits the model.'
      : 'Let’s use support.',
  ),
  el(
    documentRoot,
    'p',
    {},
    progress.lastResponseCorrect
      ? activity.feedback.correct
      : activity.feedback.incorrect,
  ),
)
if (presentation.feedbackDetail === 'detailed') {
  section.append(
    el(
      documentRoot,
      'p',
      { className: 'feedback-detail' },
      progress.lastResponseCorrect
        ? 'What mattered: your response connected the prompt to the mechanism in the Key idea.'
        : 'What mattered: the mismatch identifies the mechanism to revisit before choosing the next route step.',
    ),
  )
}
```

Find recommended decisions whose `evidenceActivityId` equals the pending node. For each one, render its existing `explainRouteDecision` result inline. If recommendations exist, render one button per optional branch and one core-route button:

```html
<button data-course-action="advance-course" data-next-node-id="OPTIONAL_ID">
  Take support
</button>
<button data-course-action="advance-course" data-next-node-id="CORE_ID">
  Continue the required route
</button>
```

Use **Explore extension** for extension branches. When the core successor is `null`, label the core action **Finish the route** and render `data-next-node-id=""`. When no recommendation exists, render one **Continue** button without `data-next-node-id`; the model resolves the authored core successor.

Remove take/skip controls from the context panel after inline choices exist. Keep the context panel's explanation and final taken/skipped/completed status.

- [ ] **Step 7: Render truthful progress, active state, and focus targets**

In `renderCourse`:

- hide `[data-course-heading]` when lifecycle `mode !== 'entry'`;
- set `root.dataset.interactionMode = state.interactionMode`;
- set `root.dataset.courseActive = String(state.mode !== 'entry')`;
- call `renderModePalette` for active and recap workspaces;
- derive `availableDecisions` from branch decisions with status `recommended`, label one recommendation as either `1 support activity available` or `1 extension available`, and use `${availableDecisions.length} optional activities available` when more than one exists;
- set progress to `${completed} of 13 required activities` plus that opportunity label only when at least one recommendation is available;
- use `Route complete · 13 of 13 required activities` for lifecycle recap;
- set the route/context disclosure `open` properties from `projection.disclosures`.

Replace `focusTargetForTransition` with these priorities:

```js
export function focusTargetForTransition(previous, next) {
  if (previous.mode !== 'recap' && next.mode === 'recap') {
    return '[data-course-recap]'
  }
  if (
    previous.currentNodeId !== next.currentNodeId ||
    previous.mode !== next.mode
  ) {
    return '[data-key-idea-anchor], .activity-heading h2'
  }
  if (previous.awaitingAdvance === null && next.awaitingAdvance !== null) {
    return '[data-completion-feedback]'
  }
  const previousAttempts =
    previous.activityProgress[previous.currentNodeId]?.attempts ?? 0
  const nextAttempts = next.activityProgress[next.currentNodeId]?.attempts ?? 0
  return nextAttempts > previousAttempts ? '[data-attempt-feedback]' : null
}
```

Add a specific Mode announcement before the activity-transition cases:

```js
if (previous.interactionMode !== next.interactionMode) {
  const definition = getInteractionModeDefinition(next.interactionMode)
  return `${definition.label} Mode. ${definition.announcement}`
}
```

- [ ] **Step 8: Add renderer-level runtime assertions**

Add runtime tests that call `renderCourse` through `mountCourse` and assert:

```js
assert.equal(document.querySelector('[data-course-heading]').hidden, true)
assert.equal(
  document.querySelector('[data-mode-trigger]').textContent.trim(),
  'Mode: Coach',
)
assert.equal(document.querySelectorAll('[data-mode-option]').length, 6)
assert.equal(
  document.querySelector('[data-course-route-disclosure]').open,
  true,
)
assert.equal(
  document.querySelector('[data-course-context-disclosure]').open,
  false,
)
```

After a correct response, assert:

```js
assert.equal(controller.getState().currentNodeId, 'boundary-permeability')
assert.ok(document.querySelector('[data-completion-feedback]'))
assert.ok(document.querySelector('[data-course-action="advance-course"]'))
assert.equal(
  document.querySelector('[data-course-activity]').dataset.activityCompleted,
  'true',
)
```

After selecting the required route, assert that the next node and next Key idea render. Add a separate support-indicated test proving that the inline reason contains the existing high-confidence mismatch rule and offers both support and required-route choices.

- [ ] **Step 9: Run the focused rendering tests**

Run:

```powershell
node --test scripts/website-activities.test.mjs scripts/website-document.test.mjs scripts/website-runtime.test.mjs
```

Expected: all activity, semantic document, rendering, branch, and runtime tests PASS.

- [ ] **Step 10: Format and commit the workspace rendering**

Run:

```powershell
npx prettier --write website/demo/index.html website/demo-activities.js website/demo-render.js scripts/website-activities.test.mjs scripts/website-document.test.mjs scripts/website-runtime.test.mjs
git add website/demo/index.html website/demo-activities.js website/demo-render.js scripts/website-activities.test.mjs scripts/website-document.test.mjs scripts/website-runtime.test.mjs
git commit -m "feat: render switchable learning modes"
```

Expected: one commit containing semantic markup, rendering, and direct rendering tests.

---

### Task 5: Wire Draft Preservation, Palette Controls, Focus, and Recovery

**Files:**

- Modify: `website/main.js:1-323`
- Modify: `scripts/website-runtime.test.mjs:1-635`

**Interfaces:**

- Consumes: `readActivityResponse`, `restoreActivityResponse`, `resolveDemoPresentation`, the Task 2 transitions, and Task 4 DOM roots.
- Produces transient controller state `modePaletteOpen`, `disclosures`, `activeContextTab`, and `resumeNotice`.
- Every rerender captures and restores a valid unsubmitted draft for the current activity.
- Mode changes reset route/context disclosure defaults from policy but preserve response draft, evidence, and activity position.

- [ ] **Step 1: Add failing end-to-end interaction tests**

Add these tests to `scripts/website-runtime.test.mjs`:

```js
test('switches Mode without losing an unsubmitted response', () => {
  const { document, controller } = setupCourse()
  click(document, '[data-course-action="start"]')
  document.querySelector('input[name="response"][value="oxygen"]').checked =
    true
  document.querySelector('input[name="confidence"][value="low"]').checked = true

  click(document, '[data-course-action="toggle-mode-palette"]')
  click(document, '[data-mode-option="flow"]')

  assert.equal(controller.getState().interactionMode, 'flow')
  assert.equal(
    document.querySelector('[data-mode-trigger]').textContent.trim(),
    'Mode: Flow',
  )
  assert.equal(document.querySelector('input[value="oxygen"]').checked, true)
  assert.equal(
    document.querySelector('input[name="confidence"][value="low"]').checked,
    true,
  )
  assert.equal(
    document.querySelector('[data-course-route-disclosure]').open,
    false,
  )
  controller.destroy()
})

test('keeps feedback visible until Continue and then focuses the next Key idea', () => {
  const { document, controller } = setupCourse({ manageFocus: true })
  click(document, '[data-course-action="start"]')
  submitCurrentCorrect(document, controller)

  assert.equal(
    document.activeElement,
    document.querySelector('[data-completion-feedback]'),
  )
  assert.equal(controller.getState().currentNodeId, 'boundary-permeability')

  click(
    document,
    '[data-course-action="advance-course"][data-next-node-id="boundary-structure"]',
  )
  assert.equal(controller.getState().currentNodeId, 'boundary-structure')
  assert.equal(
    document.activeElement,
    document.querySelector('[data-key-idea-anchor]'),
  )
  controller.destroy()
})

test('closes the Mode palette with Escape and restores trigger focus', () => {
  const { document, window, controller } = setupCourse({ manageFocus: true })
  click(document, '[data-course-action="start"]')
  click(document, '[data-course-action="toggle-mode-palette"]')
  document.querySelector('[data-mode-option="coach"]').focus()
  document.activeElement.dispatchEvent(
    new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
  )

  assert.equal(document.querySelector('[data-mode-palette]').hidden, true)
  assert.equal(
    document.activeElement,
    document.querySelector('[data-mode-trigger]'),
  )
  controller.destroy()
})

test('resumes at the current Key idea with an interruption-recovery message', () => {
  const seededState = advanceCourseTo('transport-gradient')
  const { document, controller } = setupCourse({
    seededState,
    manageFocus: true,
  })
  click(document, '[data-course-action="resume"]')

  assert.match(
    document.querySelector('[data-resume-notice]').textContent,
    /Welcome back/i,
  )
  assert.equal(
    document.activeElement,
    document.querySelector('[data-key-idea-anchor]'),
  )
  controller.destroy()
})
```

Update existing full-course helpers to click the correct **Continue** or branch choice after each completed submission.

- [ ] **Step 2: Run runtime tests and verify the red state**

Run:

```powershell
node --test scripts/website-runtime.test.mjs
```

Expected: FAIL because palette events, draft restoration, explicit continuation, and new focus behavior are not wired.

- [ ] **Step 3: Add transient UI state and policy defaults**

Import `restoreActivityResponse` and `resolveDemoPresentation`. Extend the existing course and routing imports so delayed retrieval uses the same resolved activity everywhere:

```js
import {
  getActivity,
  getCourseNode,
  retrievalActivityForConcept,
} from './demo-course.js'
import { deriveCourseRoute, selectRetrievalConcept } from './demo-routing.js'
```

After existing mount state, initialize:

```js
let activeContextTab = 'evidence'
let modePaletteOpen = false
let disclosures = disclosureDefaults(state.interactionMode)
let resumeNotice = ''

function disclosureDefaults(interactionMode) {
  const presentation = resolveDemoPresentation(interactionMode)
  return {
    routeOpen: presentation.routeVisibility !== 'collapsed',
    contextOpen: presentation.contextVisibility === 'expanded',
  }
}
```

Extend `projection()` with:

```js
presentation: resolveDemoPresentation(state.interactionMode),
modePaletteOpen,
disclosures,
resumeNotice,
```

- [ ] **Step 4: Preserve transient response input across every rerender**

Add one current-activity resolver and replace the plain `render()` with:

```js
function currentActivity() {
  const node = getCourseNode(state.currentNodeId)
  if (node?.nodeId === 'antibiotic-retrieval') {
    return retrievalActivityForConcept(selectRetrievalConcept(state.evidence))
  }
  return getActivity(node?.activityId)
}

function captureResponseDraft() {
  if (state.awaitingAdvance !== null || state.mode !== 'course') return null
  const form = root.querySelector('[data-course-activity]')
  const activity = currentActivity()
  return form && activity ? readActivityResponse(form, activity) : null
}

function render(responseDraft = captureResponseDraft()) {
  renderCourse(root, state, projection())
  if (responseDraft === null || state.mode !== 'course') return
  const form = root.querySelector('[data-course-activity]')
  const activity = currentActivity()
  if (form && activity) restoreActivityResponse(form, activity, responseDraft)
}
```

Use `currentActivity()` in `handleSubmit` as well.

- [ ] **Step 5: Wire palette and disclosure events**

In `handleClick`:

```js
const modeOption = event.target.closest?.('[data-mode-option]')
if (modeOption && root.contains(modeOption)) {
  const responseDraft = captureResponseDraft()
  disclosures = disclosureDefaults(modeOption.dataset.modeOption)
  modePaletteOpen = false
  dispatch(
    {
      type: 'change-interaction-mode',
      interactionMode: modeOption.dataset.modeOption,
    },
    { responseDraft, focusSelector: '[data-mode-trigger]' },
  )
  return
}
```

Add this transient palette helper and call it for `toggle-mode-palette` and `close-mode-palette`:

```js
function setModePalette(open) {
  const responseDraft = captureResponseDraft()
  modePaletteOpen = open
  render(responseDraft)
  if (!manageFocus) return
  const selector = open
    ? `[data-mode-option="${state.interactionMode}"]`
    : '[data-mode-trigger]'
  root.querySelector(selector)?.focus()
}
```

Add a capture-phase listener because native `toggle` does not bubble:

```js
function handleDisclosureToggle(event) {
  if (event.target.matches?.('[data-course-route-disclosure]')) {
    disclosures = { ...disclosures, routeOpen: event.target.open }
  } else if (event.target.matches?.('[data-course-context-disclosure]')) {
    disclosures = { ...disclosures, contextOpen: event.target.open }
  }
}

root.addEventListener('toggle', handleDisclosureToggle, true)
```

Remove that listener with the same `true` capture argument in `destroy()`.

At the beginning of the delegated keydown handler, process Escape with:

```js
if (event.key === 'Escape' && event.target.closest?.('[data-mode-palette]')) {
  event.preventDefault()
  setModePalette(false)
  return
}
```

- [ ] **Step 6: Wire explicit continuation and inline branch choice**

Handle `data-course-action="advance-course"` before the remaining generic actions:

```js
if (action === 'advance-course') {
  const event = { type: 'advance-course' }
  if (control.hasAttribute('data-next-node-id')) {
    event.nextNodeId = control.dataset.nextNodeId || null
  }
  dispatch(event)
  return
}
```

Remove the old delegated `data-branch-action` take/skip branch path after no renderer emits those controls.

- [ ] **Step 7: Replace below-viewport focus with visible focus and scroll**

Change `afterTransition` and `dispatch` together so a draft captured from the old DOM is restored only after the committed state renders:

```js
function afterTransition(
  previous,
  next,
  { announce = true, responseDraft = null, focusSelector = null } = {},
) {
  state = next
  if (state.mode !== 'entry') {
    hasSavedProgress = true
    entryReason = null
    persist()
  }
  render(responseDraft)
  if (announce) {
    const message = announcementForTransition(previous, state)
    if (message)
      root.querySelector('[data-course-status]').textContent = message
  }
  focusAndReveal(focusSelector ?? focusTargetForTransition(previous, state))
}

function dispatch(event, options = {}) {
  if (destroyed) return
  const previous = state
  const next = transitionCourse(state, event, now())
  if (next === previous) return
  afterTransition(previous, next, options)
}
```

Add:

```js
function focusAndReveal(selector) {
  if (!manageFocus || selector === null) return
  const target = root.querySelector(selector)
  if (target === null) return
  const disclosure = target.closest?.('details:not([open])')
  if (disclosure) disclosure.open = true
  target.focus()
  target.scrollIntoView?.({ block: 'start', inline: 'nearest' })
}
```

Remove the preceding `afterTransition` implementation and every `focus({ preventScroll: true })` call from course transition, validation, and reset paths. Validation focuses the visible error normally.

- [ ] **Step 8: Add visible resume and storage-failure recovery**

In the generic action branch, set the notice before dispatching `resume`:

```js
if (action === 'start' || action === 'resume') {
  if (action === 'resume') {
    const node = getCourseNode(state.currentNodeId)
    resumeNotice = `Welcome back — continuing at ${node.title}.`
  }
  dispatch({ type: action })
  return
}
```

Pass it through projection and render it visibly in `[data-resume-notice]`. Clear it on the next response, advance, Mode change, or reset so it does not become stale.

Keep `persist()` before `render()` in transitions. If save fails, set `storageMode = 'session-only'`; the subsequent render must show `Session only · browser save unavailable` immediately while the in-memory course remains usable.

- [ ] **Step 9: Run runtime and storage tests**

Run:

```powershell
node --test scripts/website-runtime.test.mjs scripts/website-storage.test.mjs scripts/website-activities.test.mjs
```

Expected: all palette, draft, feedback, Continue, focus, resume, storage, and activity tests PASS.

- [ ] **Step 10: Format and commit controller behavior**

Run:

```powershell
npx prettier --write website/main.js scripts/website-runtime.test.mjs
git add website/main.js scripts/website-runtime.test.mjs
git commit -m "feat: preserve focus across demo modes"
```

Expected: one commit limited to controller behavior and its end-to-end jsdom tests.

---

### Task 6: Recompose the Workspace and Mobile Route

**Files:**

- Modify: `website/demo.css:27-919`
- Modify: `scripts/website-styles.test.mjs:1-185`

**Interfaces:**

- Consumes: Task 4 DOM roots and `data-interaction-mode` on `.course-shell`.
- Produces one dominant activity layout, an anchored desktop palette, an in-flow full-width mobile palette, bounded Zoom context, vertical route/context disclosures, readable route text, and reduced-motion-safe transitions.

- [ ] **Step 1: Replace crushed-layout tests with failing dominant-workspace tests**

Replace the current three-column and horizontal-route tests with:

```js
test('keeps the activity dominant and reserves three columns for expanded Zoom', () => {
  const workspace = ruleBody('.course-workspace')
  assert.match(workspace, /grid-template-columns:\s*minmax\(0,\s*1fr\);/)
  assert.match(
    demoStyles,
    /\[data-interaction-mode=['"]zoom['"]\][\s\S]*?\.course-workspace\s*\{[^}]*grid-template-columns:\s*minmax\(12rem,\s*0\.45fr\)\s+minmax\(28rem,\s*1\.65fr\)\s+minmax\(18rem,\s*0\.7fr\);/,
  )
})

test('uses vertical route disclosure on narrow screens', () => {
  assert.doesNotMatch(
    demoStyles,
    /@media\s*\(max-width:\s*52rem\)[\s\S]*?\.course-route\s*\{[^}]*overflow-x:\s*auto;/,
  )
  assert.match(
    demoStyles,
    /@media\s*\(max-width:\s*52rem\)[\s\S]*?\.course-route-list\s*\{[^}]*display:\s*block;/,
  )
})

test('styles a readable selected Mode palette', () => {
  assert.match(ruleBody('.mode-palette'), /position:\s*absolute;/)
  assert.match(
    ruleBody('[data-mode-option][aria-pressed="true"]'),
    /border-color:\s*var\(--lime\);/,
  )
  assert.match(
    demoStyles,
    /@media\s*\(max-width:\s*52rem\)[\s\S]*?\.mode-palette\s*\{[^}]*position:\s*static;/,
  )
})

test('keeps normal route text above WCAG AA contrast', () => {
  assert.ok(contrastRatio('#b6c0d1', '#0f1729') >= 4.5)
  assert.match(ruleBody('.route-node-title'), /font-size:\s*0\.8rem;/)
  assert.match(ruleBody('.route-node-title'), /color:\s*#b6c0d1;/)
})
```

Keep the existing hidden-state, touch-target, focus, reduced-motion, no-overflow, local-asset, and Key idea tests.

- [ ] **Step 2: Run style tests and verify the red state**

Run:

```powershell
node --test scripts/website-styles.test.mjs
```

Expected: FAIL because the current default is a three-column dashboard, mobile route is horizontal, and Mode palette styles do not exist.

- [ ] **Step 3: Establish the dominant default layout**

Replace the default workspace grid with:

```css
.course-workspace {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  grid-template-areas:
    'topbar'
    'notice'
    'stage'
    'route'
    'context';
  width: min(100%, 76rem);
  min-width: 0;
  margin-inline: auto;
  overflow: clip;
  border: 1px solid #39455f;
  background: var(--midnight);
}

[data-resume-notice] {
  grid-area: notice;
  margin: 0;
  padding: 0.75rem clamp(1.25rem, 4vw, 3rem);
  border-bottom: 1px solid #39455f;
  color: #d8dfeb;
}

.course-stage {
  grid-area: stage;
  width: min(100%, 52rem);
  min-width: 0;
  min-height: 34rem;
  margin-inline: auto;
  padding: clamp(1.5rem, 5vw, 4rem);
}
```

The topbar remains first and compact. Hide the large course heading through its semantic `hidden` attribute, not a viewport-specific CSS override.

- [ ] **Step 4: Style secondary disclosures and bounded Zoom**

Add:

```css
.course-route-disclosure {
  grid-area: route;
  border-top: 1px solid #39455f;
  background: #0f1729;
}

.course-context-disclosure {
  grid-area: context;
  border-top: 1px solid #39455f;
  background: #0f1729;
}

.course-route-disclosure > summary,
.course-context-disclosure > summary {
  padding: 0.85rem 1rem;
  color: #d8dfeb;
  font-weight: 700;
}

[data-interaction-mode='zoom'] .course-workspace {
  grid-template-columns: minmax(12rem, 0.45fr) minmax(28rem, 1.65fr) minmax(
      18rem,
      0.7fr
    );
  grid-template-areas:
    'topbar topbar topbar'
    'notice notice notice'
    'route stage context';
  width: 100%;
}

[data-interaction-mode='zoom'] .course-route-disclosure,
[data-interaction-mode='zoom'] .course-context-disclosure {
  max-height: 54rem;
  overflow: auto;
  border-top: 0;
}
```

At `max-width: 72rem`, force every Mode back to the one-column grid so Zoom cannot crush the activity.

- [ ] **Step 5: Style the Mode palette and completion feedback**

Add:

```css
.course-mode-control {
  position: relative;
}

.mode-palette {
  position: absolute;
  z-index: 10;
  top: calc(100% + 0.5rem);
  right: 0;
  width: min(34rem, calc(100vw - 2rem));
  padding: 1rem;
  border: 1px solid #586681;
  background: #11192b;
  box-shadow: 0 1.25rem 3rem rgb(0 0 0 / 35%);
}

.mode-palette header {
  display: flex;
  gap: 1rem;
  justify-content: space-between;
  align-items: start;
}

[data-mode-options] {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5rem;
  margin-top: 1rem;
}

[data-mode-option] {
  display: grid;
  gap: 0.25rem;
  min-width: 0;
  text-align: left;
}

[data-mode-option][aria-pressed='true'] {
  border-color: var(--lime);
  background: #1b2740;
}

[data-mode-option] span {
  color: #b6c0d1;
  font-size: 0.8rem;
  font-weight: 450;
}

.completion-feedback {
  max-width: 42rem;
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 3px solid var(--lime);
}

.completion-feedback h3 {
  margin: 0;
  font-size: clamp(1.4rem, 3vw, 2rem);
}
```

Use existing button and focus tokens. Do not animate height, width, padding, or layout position.

- [ ] **Step 6: Replace the mobile route scroller with one reading column**

At `max-width: 52rem`, remove the existing `width: max-content`, fixed chapter widths, flex route list, and horizontal overflow. Use:

```css
@media (max-width: 52rem) {
  .course-workspace,
  [data-interaction-mode='zoom'] .course-workspace {
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas:
      'topbar'
      'notice'
      'stage'
      'route'
      'context';
    overflow: visible;
  }

  .course-route-list {
    display: block;
    width: auto;
  }

  .route-chapter {
    width: auto;
    border-right: 0;
    border-bottom: 1px solid #2d3851;
  }

  .mode-palette {
    position: static;
    width: 100%;
    margin-top: 0.5rem;
    box-shadow: none;
  }

  [data-mode-options] {
    grid-template-columns: minmax(0, 1fr);
  }
}
```

Set `.route-node-title` to `font-size: 0.8rem` and `color: #b6c0d1`. Remove the old lower-contrast upcoming text color or raise it to a value that passes the existing `contrastRatio` helper at 4.5:1.

- [ ] **Step 7: Run style, document, and budget tests**

Run:

```powershell
node --test scripts/website-styles.test.mjs scripts/website-document.test.mjs scripts/website-assets.test.mjs
```

Expected: all layout, mobile, palette, contrast, reduced-motion, semantic document, and size-budget tests PASS.

- [ ] **Step 8: Format and commit the visual recomposition**

Run:

```powershell
npx prettier --write website/demo.css scripts/website-styles.test.mjs
git add website/demo.css scripts/website-styles.test.mjs
git commit -m "feat: focus the guided course workspace"
```

Expected: one commit containing only presentation CSS and its structural tests.

---

### Task 7: Complete Verification, Browser QA, Publication, and Live Proof

**Files:**

- Modify if a verified mismatch is found: files already listed in Tasks 1-6 and their direct tests.
- Do not add screenshots, recordings, generated reports, browser profiles, or temporary server files to Git.

**Interfaces:**

- Consumes: the complete Mode-aware static demo.
- Produces: formatted and verified source, green local suites, green GitHub Actions, a Cloudflare Pages deployment, and canonical live-browser proof.

- [ ] **Step 1: Run the complete website test suite**

Run:

```powershell
npm run test:website
```

Expected: all Mode, model, storage, activity, document, asset, runtime, and style tests PASS with zero failures.

- [ ] **Step 2: Run formatting and lint gates**

Run:

```powershell
npm run format:check
npm run lint
```

Expected: Prettier reports every file formatted and ESLint exits 0.

- [ ] **Step 3: Run the complete repository verification**

Run:

```powershell
npm run verify
npm audit --omit=dev
cargo test --locked --manifest-path src-tauri/Cargo.toml
```

Expected: package builds/tests, TypeScript tests, website tests, typecheck, production build, dependency audit, and Rust tests all PASS. The audit reports zero production vulnerabilities.

- [ ] **Step 4: Start the static QA server without stealing desktop focus**

Run from the repository root in a hidden background process:

```powershell
$server = Start-Process -FilePath node -ArgumentList @('-e', "const http=require('http'),fs=require('fs'),path=require('path');const root=path.resolve('website');http.createServer((req,res)=>{const pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);const requested=pathname.endsWith('/')?pathname+'index.html':pathname;const file=path.resolve(root,'.'+requested);if(!file.startsWith(root)){res.writeHead(403);return res.end('Forbidden')}fs.readFile(file,(error,data)=>{if(error){res.writeHead(404);return res.end('Not found')}const ext=path.extname(file);const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.woff2':'font/woff2'};res.writeHead(200,{'Content-Type':types[ext]||'application/octet-stream'});res.end(data)})}).listen(4173,'127.0.0.1')") -PassThru -WindowStyle Hidden
```

Expected: `$server.HasExited` is `False` and `http://127.0.0.1:4173/demo/` returns HTTP 200.

- [ ] **Step 5: Run real-browser desktop Mode and lifecycle QA**

Use the browser-testing skill against `http://127.0.0.1:4173/demo/` at 1440 by 1000. Verify in this order:

1. Start enters Coach and the large introduction is no longer above the workspace.
2. Start focus lands on the visible **Key idea**, not an answer control.
3. Open the Mode palette with keyboard only; all six names and explanations are visible.
4. Select Flow after checking one response and confidence option; the draft remains selected.
5. Select Test; **Review the key idea** is available without exposing the answer.
6. Select Rescue; guidance expands and no answer-bearing hint appears before evaluation.
7. Select Zoom; route/context expand while the activity remains at least 28rem wide.
8. Submit a correct response; the activity remains, feedback is visible, and focus lands on it.
9. Choose an explicit optional/core branch when offered; the inline reason explains the evidence rule.
10. Activate **Continue**; the next Key idea receives visible focus.
11. Refresh from a completed submission before Continue; feedback and the action restore.
12. Resume after leaving the course; the visible welcome-back message and Key idea appear.
13. Confirm route text and progress are readable and distinguish required completion from available support.
14. Confirm console has no errors and network has no failed first-party requests.

Expected: every check passes without manual DOM repair or a page reload for Mode switching.

- [ ] **Step 6: Run mobile, zoom, keyboard, and reduced-motion QA**

At 390 by 844 and then 320 CSS pixels:

1. Confirm the stage precedes route/context and there is no page-level horizontal scroll.
2. Confirm route chapters form one vertical disclosure rather than a horizontal scroller.
3. Confirm the Mode palette is an in-flow full-width sheet and every control has a usable target.
4. Complete start, Mode switch, response, feedback, Continue, and branch selection using keyboard controls.
5. At browser 200% zoom, repeat palette opening and one response/Continue cycle.
6. Emulate `prefers-reduced-motion: reduce`; confirm no smooth scrolling, scale press motion, or panel transition remains.

Expected: focus stays visible within the viewport, content remains readable, and no control or text is clipped.

- [ ] **Step 7: Stop the local server and inspect the final diff**

Run:

```powershell
Stop-Process -Id $server.Id
git status --short
git diff --check
git diff --stat concourse/main...HEAD
```

Expected: the server stops, `git diff --check` is silent, and the diff contains only the approved design/plan plus Mode-demo implementation and tests.

- [ ] **Step 8: Commit any browser-verified corrections**

If Steps 5-6 required code corrections, rerun the focused affected test plus `npm run test:website`, then commit only those corrections:

```powershell
git add website scripts package.json
git commit -m "fix: harden guided demo modes"
```

If no correction was needed, leave the already-clean task commits unchanged.

- [ ] **Step 9: Push the working branch and publish it as public main**

Run:

```powershell
git push concourse HEAD:codey/guided-demo-redesign
git push concourse HEAD:main
```

Expected: both pushes succeed and `git ls-remote --heads concourse main` reports the local `HEAD` commit.

- [ ] **Step 10: Prove GitHub Actions is green**

Run:

```powershell
$run = gh run list --repo Conalh/Concourse --workflow ci.yml --branch main --limit 1 --json databaseId,headSha,status,conclusion | ConvertFrom-Json
$run
gh run watch $run.databaseId --repo Conalh/Concourse --exit-status
```

Expected: `headSha` equals local `git rev-parse HEAD`; both `web-and-packages` and `desktop-core` finish with `success`.

- [ ] **Step 11: Deploy the committed website to Cloudflare Pages**

Use the Cloudflare skill, then capture Wrangler's output and returned preview URL from the clean repository root:

```powershell
$deployOutput = npx wrangler pages deploy website --project-name concourse --branch main
$deployOutput
$preview = [regex]::Match(
  ($deployOutput -join "`n"),
  'https://[a-z0-9.-]+\.pages\.dev'
).Value
if ([string]::IsNullOrWhiteSpace($preview)) {
  throw 'Wrangler did not return a Pages preview URL.'
}
```

Expected: Wrangler returns a successful production deployment and a unique `pages.dev` preview URL. Record the deployment ID and preview URL in the handoff.

- [ ] **Step 12: Verify canonical and preview bytes plus live behavior**

For each of `demo/index.html`, `main.js`, `demo-model.js`, `demo-modes.js`, `demo-render.js`, `demo-storage.js`, and `demo.css`, compare local SHA-256 with both deployed origins:

```powershell
$canonical = 'https://concourse.conalhickey.com'
$paths = @('demo/index.html','main.js','demo-model.js','demo-modes.js','demo-render.js','demo-storage.js','demo.css')
foreach ($path in $paths) {
  $local = (Get-FileHash -Algorithm SHA256 (Join-Path 'website' $path)).Hash
  $canonicalFile = Join-Path $env:TEMP ('canonical-' + ($path -replace '[\\/]', '-'))
  $previewFile = Join-Path $env:TEMP ('preview-' + ($path -replace '[\\/]', '-'))
  Invoke-WebRequest "$canonical/$path" -OutFile $canonicalFile
  Invoke-WebRequest "$preview/$path" -OutFile $previewFile
  [pscustomobject]@{
    Path = $path
    Local = $local
    Canonical = (Get-FileHash -Algorithm SHA256 $canonicalFile).Hash
    Preview = (Get-FileHash -Algorithm SHA256 $previewFile).Hash
  }
}
```

Expected: every row has identical Local, Canonical, and Preview hashes.

Open `https://concourse.conalhickey.com/demo/` in a real browser and repeat: Coach start, Flow draft preservation, correct feedback without auto-advance, explicit Continue, and mobile vertical route. Confirm canonical console and network remain clean.

- [ ] **Step 13: Record final repository truth**

Run:

```powershell
git status --short --branch
git rev-parse HEAD
git ls-remote --heads concourse main codey/guided-demo-redesign
```

Expected: the worktree is clean; local `HEAD`, public `main`, and public `codey/guided-demo-redesign` all identify the same final commit.

## Completion Report

Report:

- the six shipped Modes and their visible presentation differences;
- the explicit feedback/Continue and branch-choice behavior;
- draft, persistence, and interruption-recovery proof;
- website, repository, audit, and Rust test totals;
- desktop/mobile/reduced-motion browser checks;
- final commit hash and GitHub Actions run URL;
- Cloudflare deployment ID, preview URL, canonical URL, and byte-match result;
- any intentionally deferred capability, specifically authored hint content and profile editing.
