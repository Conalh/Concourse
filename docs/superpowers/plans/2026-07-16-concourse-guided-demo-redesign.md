# Concourse Guided Demo Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the landing page's linear four-panel quiz with a compact guided microbiology workspace that demonstrates evidence-aware routing and an authentic editable pack draft.

**Architecture:** Keep the project site static and dependency-free. `demo-content.js` owns immutable pack-shaped content and derived draft documents, `demo-model.js` owns the pure interaction state machine, `main.js` translates DOM events and renders state, and a new `demo.css` isolates the richer workspace styling from the editorial site. The existing Node/JSDOM website tests remain the fast contract gate, followed by real-browser visual, keyboard, motion, and responsive verification.

**Tech Stack:** Semantic HTML, modern CSS, native JavaScript ES modules, Node test runner, JSDOM, Prettier, ESLint, Playwright CLI for browser verification, Cloudflare Pages for production hosting.

## Global Constraints

- Read `AGENTS.md`, `CODING_STANDARDS.md`, `README.md`, `MEMORY.md`, and `docs/superpowers/specs/2026-07-16-concourse-guided-demo-redesign-design.md` before implementation.
- Use the `emil-design-eng` and `frontend-ui-engineering` skills during implementation, `review-animations` before final verification, and `playwright` for real-browser QA.
- Create an isolated `codey/` branch or worktree before changing production files; never stage unrelated work.
- Do not add a frontend framework, animation library, account, backend, analytics, cookie, persistence, or remote runtime request.
- Do not claim automatic or AI-generated recommendations; weak evidence offers a bridge that the learner explicitly accepts or skips.
- Do not parse or install a binary `.learntpack`; identify edited documents as an **Unpacked local draft**.
- Keep the combined `website/main.js`, `website/demo-model.js`, and `website/demo-content.js` under 30 KB uncompressed.
- Keep all new visual assets local, vector, or CSS-based; use only the locked site palette.
- Preserve the approved introductory scientific boundary: oxygen diffuses directly, sodium requires a membrane protein, and glucose uses a transport protein.
- Support keyboard-only completion, polite announcements, visible 3:1 focus indicators, 44 by 44 CSS pixel controls, reduced motion, disabled JavaScript, 320 CSS pixels, and 200 percent zoom.
- Do not change the site sections outside `#demo` except for the additional local demo stylesheet link and copy required to keep the demo description truthful.
- Deploy only after local verification and GitHub CI succeed; verify the canonical host separately from the Pages preview URL.

## File Structure

- Create `website/demo-content.js`: immutable microbiology choices, pack-shaped source documents, DNA draft derivation, document excerpts, and route projection.
- Modify `website/demo-model.js`: guided-demo state, event validation, deterministic transitions, and route/evidence projections. Retain legacy exports only until Task 2 migrates the runtime.
- Modify `website/index.html`: semantic learning workspace, persistent membrane figure, six phase panels, route nodes, evidence context, pack inspector, and static no-JavaScript walkthrough.
- Modify `website/main.js`: form and button event translation, rendering, focus movement, live announcements, route state, membrane result state, and pack inspector updates.
- Create `website/demo.css`: isolated desktop, mobile, narrow, interaction, motion, and reduced-motion styling for `.learning-lab` descendants.
- Modify `website/styles.css`: only remove obsolete demo selectors after `demo.css` is verified; retain shared tokens and project-site layout.
- Modify `scripts/website-demo.test.mjs`: pure model, routing, evidence, invalid action, and draft mutation tests.
- Modify `scripts/website-document.test.mjs`: semantic structure, copy, no-JavaScript, and inspector hook tests.
- Modify `scripts/website-runtime.test.mjs`: direct path, bridge path, application retry, focus, announcements, inspector tabs, and DNA toggle tests.
- Modify `scripts/website-styles.test.mjs`: load both stylesheets and assert layout, target, motion, and reduced-motion contracts.
- Modify `scripts/website-assets.test.mjs`: enforce the 30 KB JavaScript boundary and continue enforcing local/self-contained assets.

---

### Task 1: Add the guided-demo content and pure state model

**Files:**

- Create: `website/demo-content.js`
- Modify: `website/demo-model.js`
- Modify: `scripts/website-demo.test.mjs`

**Interfaces:**

- Produces: `PREDICTION_OPTIONS`, `APPLICATION_OPTIONS`, `PACK_FILES`, `derivePackDocuments(dnaSideRouteEnabled)`, `excerptForFile(documents, fileName)`, and `deriveRouteNodes(state)` from `website/demo-content.js`.
- Produces: `createGuidedDemoState()` and `transitionGuidedDemo(state, event)` from `website/demo-model.js`.
- State shape:

```js
{
  phase: 'predict',
  prediction: { choice: null, confidence: null, status: 'unanswered' },
  bridge: { offered: false, accepted: false, completed: false },
  application: { choice: null, status: 'unanswered' },
  dnaSideRouteEnabled: false,
  activePackFile: 'catalog.json',
}
```

- Valid events: `submit-prediction`, `continue-result`, `accept-bridge`, `skip-bridge`, `complete-bridge`, `answer-application`, `select-pack-file`, `toggle-dna-route`, `back`, and `reset`.

- [ ] **Step 1: Replace the old model expectations with failing guided-model tests while temporarily retaining the old runtime tests**

Add imports and tests with these exact behavioral assertions:

```js
import {
  APPLICATION_OPTIONS,
  PACK_FILES,
  PREDICTION_OPTIONS,
  derivePackDocuments,
  deriveRouteNodes,
  excerptForFile,
} from '../website/demo-content.js'
import {
  createGuidedDemoState,
  transitionGuidedDemo,
} from '../website/demo-model.js'

test('starts inside the membrane prediction', () => {
  assert.deepEqual(createGuidedDemoState(), {
    phase: 'predict',
    prediction: { choice: null, confidence: null, status: 'unanswered' },
    bridge: { offered: false, accepted: false, completed: false },
    application: { choice: null, status: 'unanswered' },
    dnaSideRouteEnabled: false,
    activePackFile: 'catalog.json',
  })
  assert.equal(
    PREDICTION_OPTIONS.find(({ id }) => id === 'oxygen').correct,
    true,
  )
  assert.equal(
    APPLICATION_OPTIONS.find(({ id }) => id === 'transport-protein').correct,
    true,
  )
  assert.deepEqual(PACK_FILES, [
    'pack.json',
    'catalog.json',
    'courses.json',
    'items.json',
  ])
})

test('takes the direct path only for correct high-confidence evidence', () => {
  const result = transitionGuidedDemo(createGuidedDemoState(), {
    type: 'submit-prediction',
    choice: 'oxygen',
    confidence: 'high',
  })
  assert.equal(result.phase, 'result')
  assert.equal(result.prediction.status, 'correct')
  assert.equal(result.bridge.offered, false)
  assert.equal(
    transitionGuidedDemo(result, { type: 'continue-result' }).phase,
    'apply',
  )
})

test('offers and completes a learner-controlled bridge for weak evidence', () => {
  const result = transitionGuidedDemo(createGuidedDemoState(), {
    type: 'submit-prediction',
    choice: 'sodium',
    confidence: 'high',
  })
  const offer = transitionGuidedDemo(result, { type: 'continue-result' })
  const bridge = transitionGuidedDemo(offer, { type: 'accept-bridge' })
  const apply = transitionGuidedDemo(bridge, { type: 'complete-bridge' })

  assert.equal(offer.phase, 'bridge-offer')
  assert.deepEqual(bridge.bridge, {
    offered: true,
    accepted: true,
    completed: false,
  })
  assert.equal(apply.phase, 'apply')
  assert.equal(apply.bridge.completed, true)
  assert.deepEqual(
    deriveRouteNodes(apply).map(({ id }) => id),
    ['membrane-permeability', 'charge-and-size', 'transport-proteins'],
  )
})

test('derives an atomic DNA side-route draft', () => {
  const before = derivePackDocuments(false)
  const after = derivePackDocuments(true)
  const beforeConcepts = before.catalog.concepts.map(
    ({ conceptId }) => conceptId,
  )
  const afterConcepts = after.catalog.concepts.map(({ conceptId }) => conceptId)
  const afterNodes = after.courses.courses[0].rootNodes.map(
    ({ nodeId }) => nodeId,
  )

  assert.equal(beforeConcepts.includes('dna-storage'), false)
  assert.equal(afterConcepts.includes('dna-storage'), true)
  assert.equal(afterNodes.includes('node-dna-storage'), true)
  assert.match(excerptForFile(after, 'catalog.json'), /dna-storage/)
  assert.match(excerptForFile(after, 'courses.json'), /node-dna-storage/)
  assert.doesNotMatch(excerptForFile(after, 'pack.json'), /sha256/)
})
```

Also add tests for low-confidence correct evidence, bridge skip, application retry/correction, back navigation, reset, invalid states, impossible events, and pack-file selection.

- [ ] **Step 2: Run the model tests and verify the new contract fails**

Run:

```powershell
node --test scripts/website-demo.test.mjs
```

Expected: FAIL because `demo-content.js`, `createGuidedDemoState`, and `transitionGuidedDemo` do not exist.

- [ ] **Step 3: Create immutable pack-shaped demo content**

Create `website/demo-content.js` with the following public constants and document shape:

```js
export const PREDICTION_OPTIONS = Object.freeze([
  Object.freeze({
    id: 'oxygen',
    label: 'Oxygen',
    formula: 'Oâ‚‚',
    correct: true,
  }),
  Object.freeze({
    id: 'glucose',
    label: 'Glucose',
    formula: 'Câ‚†Hâ‚â‚‚Oâ‚†',
    correct: false,
  }),
  Object.freeze({
    id: 'sodium',
    label: 'Sodium ion',
    formula: 'Naâº',
    correct: false,
  }),
])

export const APPLICATION_OPTIONS = Object.freeze([
  Object.freeze({
    id: 'transport-protein',
    label: 'A transport protein',
    correct: true,
  }),
  Object.freeze({ id: 'ribosome', label: 'A ribosome', correct: false }),
  Object.freeze({ id: 'dna', label: 'DNA', correct: false }),
])

export const PACK_FILES = Object.freeze([
  'pack.json',
  'catalog.json',
  'courses.json',
  'items.json',
])

const BASE_DOCUMENTS = Object.freeze({
  pack: {
    schemaVersion: '0.1',
    packId: 'concourse.bacterial-cell-basics',
    version: '0.1.0',
    title: 'Bacterial Cell Basics',
    summary: 'A short route through membrane permeability and transport.',
    language: 'en-US',
    license: 'CC-BY-4.0',
    authors: [{ name: 'Concourse' }],
    capabilities: {
      required: [{ capabilityId: 'core.learning-pack', version: '0.1' }],
      optional: [],
    },
  },
  catalog: {
    schemaVersion: '0.1',
    subjects: [
      {
        subjectId: 'bacterial-cell-basics',
        title: 'Bacterial Cell Basics',
        summary: 'How a bacterial membrane controls exchange.',
        tags: ['microbiology'],
        conceptIds: [
          'membrane-permeability',
          'charge-and-size',
          'transport-proteins',
        ],
        objectiveIds: ['predict-membrane-crossing', 'choose-glucose-transport'],
        courseIds: ['bacterial-cell-route'],
      },
    ],
    concepts: [
      {
        conceptId: 'membrane-permeability',
        title: 'Membrane permeability',
        summary: 'Size, polarity, and charge affect membrane crossing.',
        tags: ['microbiology', 'membrane'],
        prerequisiteConceptIds: [],
        relatedConceptIds: ['charge-and-size', 'transport-proteins'],
      },
      {
        conceptId: 'charge-and-size',
        title: 'Charge and size',
        summary: 'Charged and larger polar substances need membrane proteins.',
        tags: ['microbiology', 'bridge'],
        prerequisiteConceptIds: ['membrane-permeability'],
        relatedConceptIds: ['transport-proteins'],
      },
      {
        conceptId: 'transport-proteins',
        title: 'Transport proteins',
        summary: 'Channels and carriers help selected substances cross.',
        tags: ['microbiology', 'membrane'],
        prerequisiteConceptIds: ['membrane-permeability'],
        relatedConceptIds: ['charge-and-size'],
      },
    ],
    objectives: [
      {
        objectiveId: 'predict-membrane-crossing',
        statement:
          'Predict which substance crosses a lipid membrane most easily.',
        successCriteria: [
          'Select oxygen and explain the role of polarity and charge.',
        ],
        conceptIds: ['membrane-permeability'],
      },
      {
        objectiveId: 'choose-glucose-transport',
        statement: 'Choose a mechanism that helps glucose cross a membrane.',
        successCriteria: ['Select a transport protein.'],
        conceptIds: ['transport-proteins'],
      },
    ],
  },
  courses: {
    schemaVersion: '0.1',
    courses: [
      {
        courseId: 'bacterial-cell-route',
        title: 'Inside a bacterial cell',
        summary: 'A guided route through membrane exchange.',
        subjectIds: ['bacterial-cell-basics'],
        tags: ['microbiology'],
        rootNodes: [
          {
            nodeId: 'node-membrane-permeability',
            kind: 'lesson',
            title: 'Membrane permeability',
            summary: 'Predict what crosses directly.',
            itemIds: ['item-membrane-prediction'],
            conceptIds: ['membrane-permeability'],
            objectiveIds: ['predict-membrane-crossing'],
            children: [],
            customKindLabel: null,
          },
          {
            nodeId: 'node-transport-proteins',
            kind: 'lesson',
            title: 'Transport proteins',
            summary: 'Apply the idea to glucose transport.',
            itemIds: ['item-glucose-application'],
            conceptIds: ['transport-proteins'],
            objectiveIds: ['choose-glucose-transport'],
            children: [],
            customKindLabel: null,
          },
        ],
      },
    ],
  },
  items: {
    schemaVersion: '0.1',
    items: [
      {
        itemId: 'item-membrane-prediction',
        learningRevision: 1,
        title: 'Predict membrane crossing',
        promptBlocks: [
          {
            kind: 'question',
            text: 'Which substance crosses the lipid membrane most easily without a transport protein?',
            language: null,
            calloutRole: null,
            assetId: null,
            altText: null,
          },
        ],
        response: {
          kind: 'single-choice',
          options: PREDICTION_OPTIONS.map(({ id, label }) => ({
            optionId: id,
            label,
            contentBlocks: [],
          })),
          textInput: null,
          numberInput: null,
        },
        evaluation: {
          kind: 'choice-selection',
          correctOptionIds: ['oxygen'],
          acceptedAnswers: [],
          caseSensitive: false,
          trimWhitespace: true,
          expectedNumber: null,
          absoluteTolerance: null,
          passingSelfGrades: [],
        },
        reviewedSolutionBlocks: [
          {
            kind: 'text',
            text: 'Small nonpolar oxygen molecules diffuse through the lipid bilayer more easily than glucose or sodium ions.',
            language: null,
            calloutRole: null,
            assetId: null,
            altText: null,
          },
        ],
        conceptIds: ['membrane-permeability'],
        objectiveIds: ['predict-membrane-crossing'],
        allowedPlayModes: ['single-choice-quiz'],
      },
      {
        itemId: 'item-glucose-application',
        learningRevision: 1,
        title: 'Choose glucose transport',
        promptBlocks: [
          {
            kind: 'question',
            text: 'A bacterial cell needs glucose. What helps it cross its membrane?',
            language: null,
            calloutRole: null,
            assetId: null,
            altText: null,
          },
        ],
        response: {
          kind: 'single-choice',
          options: APPLICATION_OPTIONS.map(({ id, label }) => ({
            optionId: id,
            label,
            contentBlocks: [],
          })),
          textInput: null,
          numberInput: null,
        },
        evaluation: {
          kind: 'choice-selection',
          correctOptionIds: ['transport-protein'],
          acceptedAnswers: [],
          caseSensitive: false,
          trimWhitespace: true,
          expectedNumber: null,
          absoluteTolerance: null,
          passingSelfGrades: [],
        },
        reviewedSolutionBlocks: [
          {
            kind: 'text',
            text: 'Glucose crosses the membrane with help from a transport protein.',
            language: null,
            calloutRole: null,
            assetId: null,
            altText: null,
          },
        ],
        conceptIds: ['transport-proteins'],
        objectiveIds: ['choose-glucose-transport'],
        allowedPlayModes: ['single-choice-quiz'],
      },
    ],
  },
})
```

Complete the module with these derivations:

```js
function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

export function derivePackDocuments(dnaSideRouteEnabled) {
  const documents = clone(BASE_DOCUMENTS)
  if (!dnaSideRouteEnabled) return documents

  documents.catalog.subjects[0].conceptIds.push('dna-storage')
  documents.catalog.concepts.push({
    conceptId: 'dna-storage',
    title: 'DNA storage',
    summary: 'Bacterial DNA stores genetic instructions.',
    tags: ['microbiology', 'dna'],
    prerequisiteConceptIds: ['membrane-permeability'],
    relatedConceptIds: ['transport-proteins'],
  })
  documents.courses.courses[0].rootNodes.push({
    nodeId: 'node-dna-storage',
    kind: 'lesson',
    title: 'DNA storage',
    summary: 'Follow an optional side route into bacterial DNA.',
    itemIds: [],
    conceptIds: ['dna-storage'],
    objectiveIds: [],
    children: [],
    customKindLabel: null,
  })
  return documents
}

export function excerptForFile(documents, fileName) {
  const selected = PACK_FILES.includes(fileName) ? fileName : 'catalog.json'
  if (selected === 'pack.json') return JSON.stringify(documents.pack, null, 2)
  if (selected === 'catalog.json') {
    return JSON.stringify(
      {
        schemaVersion: documents.catalog.schemaVersion,
        subject: documents.catalog.subjects[0],
        concepts: documents.catalog.concepts.map(
          ({
            conceptId,
            title,
            prerequisiteConceptIds,
            relatedConceptIds,
          }) => ({
            conceptId,
            title,
            prerequisiteConceptIds,
            relatedConceptIds,
          }),
        ),
      },
      null,
      2,
    )
  }
  if (selected === 'courses.json') {
    const course = documents.courses.courses[0]
    return JSON.stringify(
      {
        schemaVersion: documents.courses.schemaVersion,
        courseId: course.courseId,
        rootNodes: course.rootNodes.map(
          ({ nodeId, title, conceptIds, itemIds }) => ({
            nodeId,
            title,
            conceptIds,
            itemIds,
          }),
        ),
      },
      null,
      2,
    )
  }
  return JSON.stringify(documents.items, null, 2)
}

export function deriveRouteNodes(state) {
  const afterPrediction = state.phase !== 'predict'
  const transportComplete = state.phase === 'pack'
  const nodes = [
    {
      id: 'membrane-permeability',
      label: 'Membrane permeability',
      state: afterPrediction ? 'complete' : 'active',
    },
  ]
  if (state.bridge.accepted || state.bridge.completed) {
    nodes.push({
      id: 'charge-and-size',
      label: 'Charge and size',
      state: state.bridge.completed ? 'complete' : 'bridge',
    })
  }
  nodes.push({
    id: 'transport-proteins',
    label: 'Transport proteins',
    state: transportComplete
      ? 'complete'
      : ['apply', 'pack'].includes(state.phase)
        ? 'active'
        : 'upcoming',
  })
  if (state.dnaSideRouteEnabled) {
    nodes.push({ id: 'dna-storage', label: 'DNA side route', state: 'draft' })
  }
  return nodes
}
```

- [ ] **Step 4: Add the guided state machine without removing legacy exports yet**

Add `createGuidedDemoState` and `transitionGuidedDemo` to `website/demo-model.js`. Use immutable object replacement, exact option allowlists, and these routing rules:

```js
export function createGuidedDemoState() {
  return {
    phase: 'predict',
    prediction: { choice: null, confidence: null, status: 'unanswered' },
    bridge: { offered: false, accepted: false, completed: false },
    application: { choice: null, status: 'unanswered' },
    dnaSideRouteEnabled: false,
    activePackFile: 'catalog.json',
  }
}

function submitPrediction(state, event) {
  const option = PREDICTION_OPTIONS.find(({ id }) => id === event.choice)
  if (option === undefined || !['high', 'low'].includes(event.confidence))
    return state
  const status = option.correct ? 'correct' : 'incorrect'
  return {
    ...state,
    phase: 'result',
    prediction: { choice: option.id, confidence: event.confidence, status },
    bridge: {
      offered: status === 'incorrect' || event.confidence === 'low',
      accepted: false,
      completed: false,
    },
  }
}
```

Import `APPLICATION_OPTIONS`, `PACK_FILES`, and `PREDICTION_OPTIONS` from `demo-content.js`, then complete the transition function as follows:

```js
const PHASES = new Set([
  'predict',
  'result',
  'bridge-offer',
  'bridge',
  'apply',
  'pack',
])
const STATUSES = new Set(['unanswered', 'correct', 'incorrect'])

function isValidGuidedState(state) {
  return (
    state !== null &&
    typeof state === 'object' &&
    PHASES.has(state.phase) &&
    STATUSES.has(state.prediction?.status) &&
    STATUSES.has(state.application?.status) &&
    typeof state.bridge?.offered === 'boolean' &&
    typeof state.bridge?.accepted === 'boolean' &&
    typeof state.bridge?.completed === 'boolean' &&
    typeof state.dnaSideRouteEnabled === 'boolean' &&
    PACK_FILES.includes(state.activePackFile)
  )
}

export function transitionGuidedDemo(state, event) {
  if (!isValidGuidedState(state)) return createGuidedDemoState()
  if (event === null || typeof event !== 'object') return { ...state }
  if (event.type === 'reset') return createGuidedDemoState()

  if (state.phase === 'predict' && event.type === 'submit-prediction') {
    return submitPrediction(state, event)
  }
  if (state.phase === 'result' && event.type === 'continue-result') {
    return { ...state, phase: state.bridge.offered ? 'bridge-offer' : 'apply' }
  }
  if (state.phase === 'bridge-offer' && event.type === 'accept-bridge') {
    return {
      ...state,
      phase: 'bridge',
      bridge: { ...state.bridge, accepted: true, completed: false },
    }
  }
  if (state.phase === 'bridge-offer' && event.type === 'skip-bridge') {
    return {
      ...state,
      phase: 'apply',
      bridge: { ...state.bridge, accepted: false, completed: false },
    }
  }
  if (state.phase === 'bridge' && event.type === 'complete-bridge') {
    return {
      ...state,
      phase: 'apply',
      bridge: { ...state.bridge, completed: true },
    }
  }
  if (state.phase === 'apply' && event.type === 'answer-application') {
    const option = APPLICATION_OPTIONS.find(({ id }) => id === event.choice)
    if (option === undefined) return { ...state }
    return {
      ...state,
      phase: option.correct ? 'pack' : 'apply',
      application: {
        choice: option.id,
        status: option.correct ? 'correct' : 'incorrect',
      },
    }
  }
  if (state.phase === 'pack' && event.type === 'select-pack-file') {
    return PACK_FILES.includes(event.fileName)
      ? { ...state, activePackFile: event.fileName }
      : { ...state }
  }
  if (
    state.phase === 'pack' &&
    event.type === 'toggle-dna-route' &&
    typeof event.enabled === 'boolean'
  ) {
    return { ...state, dnaSideRouteEnabled: event.enabled }
  }
  if (event.type === 'back') {
    if (state.phase === 'pack') return { ...state, phase: 'apply' }
    if (state.phase === 'apply') {
      return {
        ...state,
        phase: state.bridge.completed ? 'bridge' : 'result',
        application: { choice: null, status: 'unanswered' },
        bridge: state.bridge.completed
          ? { ...state.bridge, completed: false }
          : state.bridge,
      }
    }
    if (state.phase === 'bridge') {
      return {
        ...state,
        phase: 'bridge-offer',
        bridge: { ...state.bridge, accepted: false, completed: false },
      }
    }
    if (state.phase === 'bridge-offer') return { ...state, phase: 'result' }
    if (state.phase === 'result') {
      return {
        ...createGuidedDemoState(),
        prediction: {
          choice: state.prediction.choice,
          confidence: state.prediction.confidence,
          status: 'unanswered',
        },
      }
    }
  }
  return { ...state }
}
```

- [ ] **Step 5: Run model and existing website tests**

Run:

```powershell
node --test scripts/website-demo.test.mjs
npm run test:website
```

Expected: all new model tests PASS and all existing website tests remain green because legacy runtime exports are still present.

- [ ] **Step 6: Commit the model slice**

```powershell
git add -- website/demo-content.js website/demo-model.js scripts/website-demo.test.mjs
git commit -m "feat: model the guided learning demo"
```

---

### Task 2: Replace the slideshow with the semantic learning workspace

**Files:**

- Modify: `website/index.html:75-220`
- Modify: `website/main.js`
- Modify: `website/demo-model.js`
- Modify: `scripts/website-document.test.mjs`
- Modify: `scripts/website-runtime.test.mjs`
- Modify: `scripts/website-demo.test.mjs`

**Interfaces:**

- Consumes: `createGuidedDemoState`, `transitionGuidedDemo`, `deriveRouteNodes`, `PREDICTION_OPTIONS`, and `APPLICATION_OPTIONS` from Task 1.
- Produces: `mountDemo(documentRoot, options)` with `getState()`, `dispatch(event)`, and `destroy()`.
- DOM phases: `predict`, `result`, `bridge-offer`, `bridge`, `apply`, and `pack`.
- Focus contract: move to the active phase heading only on phase changes; keep focus on an incorrect application answer; reset focuses the first prediction radio.

- [ ] **Step 1: Rewrite document and runtime tests for the approved workspace**

Replace old counts and actions with exact structure checks:

```js
test('provides the complete guided learning workspace', () => {
  const demo = document.querySelector('[data-demo]')
  assert.ok(demo)
  assert.equal(demo.querySelectorAll('[data-demo-panel]').length, 6)
  assert.equal(demo.querySelectorAll('[data-route-node]').length, 4)
  assert.ok(demo.querySelector('[data-demo-form="prediction"]'))
  assert.equal(demo.querySelectorAll('[name="molecule"]').length, 3)
  assert.equal(demo.querySelectorAll('[name="confidence"]').length, 2)
  assert.ok(demo.querySelector('[data-membrane-figure]'))
  assert.ok(demo.querySelector('[data-evidence-context]'))
  assert.ok(demo.querySelector('[data-pack-inspector]'))
  assert.ok(demo.querySelector('[data-demo-status][aria-live="polite"]'))
  assert.ok(demo.querySelector('[data-demo-progress]'))
})
```

Add runtime tests for:

```js
function submitPrediction(document, choice, confidence) {
  document.querySelector(`[name="molecule"][value="${choice}"]`).click()
  document.querySelector(`[name="confidence"][value="${confidence}"]`).click()
  document.querySelector('[data-demo-form="prediction"]').requestSubmit()
}

test('completes the direct evidence path', () => {
  const { document, controller } = setup()
  submitPrediction(document, 'oxygen', 'high')
  assert.equal(controller.getState().phase, 'result')
  assert.equal(
    document.querySelector('[data-membrane-figure]').dataset.result,
    'oxygen',
  )
  click(document, '[data-demo-action="continue-result"]')
  assert.equal(controller.getState().phase, 'apply')
  click(
    document,
    '[data-demo-action="answer-application"][data-choice="transport-protein"]',
  )
  assert.equal(controller.getState().phase, 'pack')
  controller.destroy()
})

test('offers, accepts, and returns from the bridge', () => {
  const { document, controller } = setup()
  submitPrediction(document, 'glucose', 'high')
  click(document, '[data-demo-action="continue-result"]')
  assert.equal(controller.getState().phase, 'bridge-offer')
  click(document, '[data-demo-action="accept-bridge"]')
  assert.equal(
    document.querySelector('[data-route-node="charge-and-size"]').hidden,
    false,
  )
  click(document, '[data-demo-action="complete-bridge"]')
  assert.equal(controller.getState().phase, 'apply')
  controller.destroy()
})
```

Also test bridge skip, incorrect application feedback, retry by selecting the correct answer, route text progress, phase announcements, back, reset, independent remounting, focus enabled/disabled, and final page rerun behavior.

- [ ] **Step 2: Run the focused tests and verify they fail**

Run:

```powershell
node --test scripts/website-document.test.mjs scripts/website-runtime.test.mjs
```

Expected: FAIL because the existing HTML still has four panels and the old runtime action contract.

- [ ] **Step 3: Replace `#demo` with the semantic workspace**

Keep the existing section heading and replace the old route map and `.demo-stage` with this structure:

```html
<div class="learning-lab" data-phase="predict">
  <header class="lab-topbar">
    <div>
      <span>Local lesson</span><code>bacterial-cell-basics.learntpack</code>
    </div>
    <p data-demo-progress>Prediction ready · 0 of 2 activities</p>
    <button class="enhanced-control" data-demo-action="reset" type="button">
      Reset
    </button>
  </header>
  <ol class="lab-route" aria-label="Learning route" data-route-map>
    <li data-route-node="membrane-permeability">
      <span>01</span>Membrane permeability
    </li>
    <li data-route-node="charge-and-size" hidden>
      <span>+</span>Charge and size
    </li>
    <li data-route-node="transport-proteins">
      <span>02</span>Transport proteins
    </li>
    <li data-route-node="dna-storage" hidden><span>+</span>DNA side route</li>
  </ol>
  <div class="lab-workspace">
    <figure class="membrane-figure" data-membrane-figure data-result="idle">
      <div class="membrane-scene" aria-hidden="true">
        <span class="molecule molecule-oxygen">Oâ‚‚</span>
        <span class="molecule molecule-glucose">Câ‚†Hâ‚â‚‚Oâ‚†</span>
        <span class="molecule molecule-sodium">Naâº</span>
        <span class="membrane-layer"></span>
        <span class="transport-channel"></span>
      </div>
      <figcaption>
        Oxygen can diffuse through the lipid bilayer. Glucose and sodium need
        membrane proteins.
      </figcaption>
    </figure>
    <div class="lab-activity">
      <section
        data-demo-panel="predict"
        tabindex="-1"
        aria-labelledby="predict-title"
      >
        <p class="demo-step">Predict</p>
        <h3 id="predict-title">
          Which crosses most easily without a transport protein?
        </h3>
        <form data-demo-form="prediction">
          <fieldset class="choice-set molecule-choices">
            <legend>Choose a substance</legend>
            <label
              ><input name="molecule" type="radio" value="oxygen" /><span
                >Oxygen <small>Oâ‚‚</small></span
              ></label
            >
            <label
              ><input name="molecule" type="radio" value="glucose" /><span
                >Glucose <small>Câ‚†Hâ‚â‚‚Oâ‚†</small></span
              ></label
            >
            <label
              ><input name="molecule" type="radio" value="sodium" /><span
                >Sodium ion <small>Naâº</small></span
              ></label
            >
          </fieldset>
          <fieldset class="choice-set confidence-choices">
            <legend>How sure are you?</legend>
            <label
              ><input name="confidence" type="radio" value="high" /><span
                >I knew it</span
              ></label
            >
            <label
              ><input name="confidence" type="radio" value="low" /><span
                >I was guessing</span
              ></label
            >
          </fieldset>
          <button class="button button-demo" type="submit">
            Run the membrane test
          </button>
        </form>
      </section>
      <section
        data-demo-panel="result"
        tabindex="-1"
        aria-labelledby="result-title"
        hidden
      >
        <p class="demo-step">Observe</p>
        <h3 id="result-title">The membrane is selective.</h3>
        <p data-result-copy></p>
        <div class="demo-actions">
          <button data-demo-action="back" type="button">Back</button
          ><button
            class="button button-demo"
            data-demo-action="continue-result"
            type="button"
          >
            See the route respond
          </button>
        </div>
      </section>
      <section
        data-demo-panel="bridge-offer"
        tabindex="-1"
        aria-labelledby="bridge-offer-title"
        hidden
      >
        <p class="demo-step">Suggested bridge</p>
        <h3 id="bridge-offer-title">Charge and size would help here.</h3>
        <p>
          Your answer or confidence suggests one short foundation before
          transport proteins.
        </p>
        <div class="demo-actions">
          <button data-demo-action="skip-bridge" type="button">
            Stay on the route</button
          ><button
            class="button button-demo"
            data-demo-action="accept-bridge"
            type="button"
          >
            Take the short bridge
          </button>
        </div>
      </section>
      <section
        data-demo-panel="bridge"
        tabindex="-1"
        aria-labelledby="bridge-title"
        hidden
      >
        <p class="demo-step">Bridge · Charge and size</p>
        <h3 id="bridge-title">The lipid core resists charged particles.</h3>
        <p>
          Sodium carries charge. Glucose is larger and polar. Both use membrane
          proteins instead of crossing the lipid core freely.
        </p>
        <button
          class="button button-demo"
          data-demo-action="complete-bridge"
          type="button"
        >
          Return to transport proteins
        </button>
      </section>
      <section
        data-demo-panel="apply"
        tabindex="-1"
        aria-labelledby="apply-title"
        hidden
      >
        <p class="demo-step">Apply</p>
        <h3 id="apply-title">
          A bacterial cell needs glucose. What helps it cross?
        </h3>
        <div class="answer-grid" role="group" aria-label="Application answers">
          <button
            data-demo-action="answer-application"
            data-choice="transport-protein"
            type="button"
          >
            A transport protein
          </button>
          <button
            data-demo-action="answer-application"
            data-choice="ribosome"
            type="button"
          >
            A ribosome
          </button>
          <button
            data-demo-action="answer-application"
            data-choice="dna"
            type="button"
          >
            DNA
          </button>
        </div>
        <div class="feedback" data-application-feedback hidden>
          <strong>Not quite.</strong> Glucose crosses with help from a membrane
          transport protein.
        </div>
      </section>
      <section
        data-demo-panel="pack"
        tabindex="-1"
        aria-labelledby="pack-title"
        hidden
      >
        <p class="demo-step">Open the route</p>
        <h3 id="pack-title">Your learning route is authored data.</h3>
        <p>
          One activity completed, one evidence result recorded, and the pack
          draft is ready to inspect.
        </p>
        <button data-demo-action="back" type="button">
          Back to the activity
        </button>
      </section>
    </div>
    <aside class="lab-context" aria-labelledby="context-title">
      <p class="context-label" id="context-title">Evidence</p>
      <div data-evidence-context>
        <p>No evidence yet. Make a prediction to begin.</p>
      </div>
      <section data-pack-inspector hidden aria-labelledby="inspector-title">
        <p class="context-label">Unpacked local draft</p>
        <h3 id="inspector-title">Four readable documents</h3>
        <div class="pack-tabs" role="tablist" aria-label="Pack documents"></div>
        <pre tabindex="0"><code data-pack-code></code></pre>
        <label class="draft-toggle"
          ><input data-demo-action="toggle-dna-route" type="checkbox" /><span
            >Add a DNA side route</span
          ></label
        >
        <p data-draft-status>No local changes.</p>
      </section>
    </aside>
  </div>
</div>
<details class="static-demo">
  <summary>Read the complete demo without JavaScript</summary>
  <p>
    Oxygen crosses the lipid bilayer more easily than glucose or sodium. Weak
    evidence can add a short charge-and-size bridge before the route returns to
    transport proteins.
  </p>
  <p>
    Glucose uses a transport protein. Concourse packs describe concepts, routes,
    activities, and evaluation in pack.json, catalog.json, courses.json, and
    items.json.
  </p>
  <p>
    Adding a DNA side route changes the unpacked catalog and course draft before
    validation and export.
  </p>
</details>
```

Keep the existing polite status node after this markup. Task 4 adds the new stylesheet after creating it; do not add a reference to a missing file in this task.

- [ ] **Step 4: Rewrite `main.js` around the guided model**

Implement these event boundaries:

```js
function predictionEvent(form) {
  const FormDataConstructor = form.ownerDocument.defaultView.FormData
  const data = new FormDataConstructor(form)
  return {
    type: 'submit-prediction',
    choice: data.get('molecule'),
    confidence: data.get('confidence'),
  }
}

function eventFromControl(control) {
  const type = control.dataset.demoAction
  if (type === 'answer-application')
    return { type, choice: control.dataset.choice }
  if (type === 'select-pack-file')
    return { type, fileName: control.dataset.packFile }
  if (type === 'toggle-dna-route') return { type, enabled: control.checked }
  return { type }
}
```

Use these pure presentation helpers so progress, evidence, and announcements do not drift:

```js
function progressCopy(state) {
  if (state.phase === 'predict') return 'Prediction ready · 0 of 2 activities'
  if (state.phase === 'pack') return 'Route in progress · 2 of 2 activities'
  return 'Evidence recorded · 1 of 2 activities'
}

function evidenceCopy(state) {
  if (state.phase === 'predict')
    return 'No evidence yet. Make a prediction to begin.'
  const confidence =
    state.prediction.confidence === 'high'
      ? 'high confidence'
      : 'low confidence'
  const result =
    state.prediction.status === 'correct'
      ? 'correct prediction'
      : 'incorrect prediction'
  if (state.phase === 'result' || state.phase === 'bridge-offer') {
    return `${result} · ${confidence}`
  }
  if (state.phase === 'bridge') return `${result} · bridge opened by learner`
  if (state.phase === 'apply') {
    return state.bridge.completed
      ? `${result} · bridge completed · application ready`
      : `${result} · application ready`
  }
  return `${result} · application correct · 2 evidence records`
}

function announcementFor(state) {
  if (state.phase === 'result') {
    return state.prediction.status === 'correct'
      ? 'Correct. Oxygen crosses the lipid membrane most easily.'
      : 'Not quite. Oxygen crosses the lipid membrane most easily.'
  }
  if (state.phase === 'bridge-offer')
    return 'A short charge and size bridge is available.'
  if (state.phase === 'bridge') return 'Charge and size bridge opened.'
  if (state.phase === 'apply') {
    return state.application.status === 'incorrect'
      ? 'Not quite. Glucose crosses with help from a transport protein.'
      : 'Transport proteins application opened.'
  }
  if (state.phase === 'pack')
    return 'Correct. Two activities complete. Pack draft opened.'
  return 'Prediction ready.'
}
```

`mountDemo` must cache panels, route nodes, figure, progress, evidence, application feedback, inspector, pack code, draft status, and live status. `render` must:

1. show only `state.phase`;
2. set `root.dataset.phase` and `figure.dataset.result`;
3. call `deriveRouteNodes(state)` and update each route node's `hidden` and `data-state`;
4. show application feedback only for `incorrect`, and set `data-state="correct"` or `data-state="incorrect"` only on the submitted application button;
5. hide evidence context and show the pack inspector only in `pack`;
6. update progress text to `Prediction ready · 0 of 2 activities`, `Evidence recorded · 1 of 2 activities`, or `Route in progress · 2 of 2 activities`;
7. announce the result, bridge offer, bridge return, application feedback, and draft change with concise text;
8. move focus only when the phase changes or reset is invoked.

Use this render/dispatch shape; Task 3 fills the pack excerpt lines without changing the state authority:

```js
let state = createGuidedDemoState()

function render(announce = false, moveFocus = false, resetForm = false) {
  root.dataset.phase = state.phase
  for (const panel of panels)
    panel.hidden = panel.dataset.demoPanel !== state.phase
  figure.dataset.result = state.phase === 'predict' ? 'idle' : 'oxygen'

  const projectedNodes = new Map(
    deriveRouteNodes(state).map((node) => [node.id, node]),
  )
  for (const node of routeNodes) {
    const projection = projectedNodes.get(node.dataset.routeNode)
    node.hidden = projection === undefined
    if (projection === undefined) delete node.dataset.state
    else node.dataset.state = projection.state
  }

  progress.textContent = progressCopy(state)
  evidence.textContent = evidenceCopy(state)
  applicationFeedback.hidden = state.application.status !== 'incorrect'
  for (const button of applicationButtons) {
    const submitted = button.dataset.choice === state.application.choice
    if (!submitted || state.application.status === 'unanswered') {
      delete button.dataset.state
    } else {
      button.dataset.state = state.application.status
    }
  }
  inspector.hidden = state.phase !== 'pack'

  if (resetForm) predictionForm.reset()
  if (announce) status.textContent = announcementFor(state)
  if (manageFocus && moveFocus) {
    const target =
      state.phase === 'predict'
        ? predictionForm.querySelector('[name="molecule"]')
        : panels.find((panel) => panel.dataset.demoPanel === state.phase)
    target?.focus({ preventScroll: true })
  }
}

function dispatch(event) {
  const previousPhase = state.phase
  state = transitionGuidedDemo(state, event)
  render(
    true,
    state.phase !== previousPhase || event.type === 'reset',
    event.type === 'reset',
  )
}

function handleSubmit(event) {
  if (event.target !== predictionForm) return
  event.preventDefault()
  dispatch(predictionEvent(predictionForm))
}

function handleClick(event) {
  const control = event.target.closest?.('[data-demo-action]')
  if (control === null || control === undefined || !root.contains(control))
    return
  if (control.matches('input[type="checkbox"]')) return
  dispatch(eventFromControl(control))
}

function handleChange(event) {
  const control = event.target.closest?.(
    '[data-demo-action="toggle-dna-route"]',
  )
  if (control === null || control === undefined || !root.contains(control))
    return
  dispatch(eventFromControl(control))
}

root.addEventListener('submit', handleSubmit)
root.addEventListener('click', handleClick)
root.addEventListener('change', handleChange)
documentRoot.documentElement?.classList.add('js')
render(false)
```

Return `getState`, `dispatch`, and `destroy`; `destroy` removes all three listeners.

Attach one `submit`, one delegated `click`, and one delegated `change` listener to the demo root. `destroy` removes all three listeners. Preserve `mountPage`; the final invitation reset must focus `[name="molecule"]` instead of the deleted start button.

- [ ] **Step 5: Remove the legacy model surface and stale tests**

Delete `INITIAL_STATE`, `VALID_STEPS`, `DEMO_ANSWERS`, `createDemoState`, and the old `transitionDemo` branches after `main.js` no longer imports them. Remove tests referring to `route`, `lesson`, `recall`, `start`, `continue`, and `retry`. Keep the new guided names to make the migration explicit.

- [ ] **Step 6: Run focused and full website tests**

Run:

```powershell
node --test scripts/website-demo.test.mjs scripts/website-document.test.mjs scripts/website-runtime.test.mjs
npm run test:website
```

Expected: all tests PASS. The site may be visually unpolished until Task 4, but the semantic direct and bridge workflows must work.

- [ ] **Step 7: Commit the workspace and runtime**

```powershell
git add -- website/index.html website/main.js website/demo-model.js scripts/website-demo.test.mjs scripts/website-document.test.mjs scripts/website-runtime.test.mjs
git commit -m "feat: replace the site demo with a guided workspace"
```

---

### Task 3: Make the pack inspector and DNA draft mutation fully interactive

**Files:**

- Modify: `website/main.js`
- Modify: `website/index.html`
- Modify: `scripts/website-runtime.test.mjs`
- Modify: `scripts/website-document.test.mjs`

**Interfaces:**

- Consumes: `PACK_FILES`, `derivePackDocuments`, and `excerptForFile` from Task 1.
- Produces: four accessible pack tabs, a code excerpt derived from active documents, atomic DNA route toggling, and changed-file status.

- [ ] **Step 1: Add failing inspector rendering and mutation tests**

```js
test('renders authentic pack tabs and switches document excerpts', () => {
  const { document, controller } = setup()
  controller.dispatch({
    type: 'submit-prediction',
    choice: 'oxygen',
    confidence: 'high',
  })
  controller.dispatch({ type: 'continue-result' })
  controller.dispatch({
    type: 'answer-application',
    choice: 'transport-protein',
  })

  assert.equal(document.querySelector('[data-pack-inspector]').hidden, false)
  assert.equal(document.querySelectorAll('[role="tab"]').length, 4)
  click(document, '[data-pack-file="courses.json"]')
  assert.match(
    document.querySelector('[data-pack-code]').textContent,
    /bacterial-cell-route/,
  )
  assert.equal(
    document
      .querySelector('[data-pack-file="courses.json"]')
      .getAttribute('aria-selected'),
    'true',
  )
  controller.destroy()
})

test('toggles the DNA draft across documents and route projection', () => {
  const { document, controller } = setup()
  controller.dispatch({
    type: 'submit-prediction',
    choice: 'oxygen',
    confidence: 'high',
  })
  controller.dispatch({ type: 'continue-result' })
  controller.dispatch({
    type: 'answer-application',
    choice: 'transport-protein',
  })
  click(document, '[data-demo-action="toggle-dna-route"]')

  assert.equal(controller.getState().dnaSideRouteEnabled, true)
  assert.equal(
    document.querySelector('[data-route-node="dna-storage"]').hidden,
    false,
  )
  assert.match(
    document.querySelector('[data-draft-status]').textContent,
    /2 files changed/i,
  )
  click(document, '[data-pack-file="catalog.json"]')
  assert.match(
    document.querySelector('[data-pack-code]').textContent,
    /dna-storage/,
  )
  click(document, '[data-pack-file="courses.json"]')
  assert.match(
    document.querySelector('[data-pack-code]').textContent,
    /node-dna-storage/,
  )
  controller.destroy()
})
```

- [ ] **Step 2: Run the inspector tests and verify failure**

Run:

```powershell
node --test scripts/website-runtime.test.mjs
```

Expected: FAIL because tabs are not populated and code/draft status do not render from derived documents.

- [ ] **Step 3: Render tabs and derived excerpts from model state**

During mount, populate `.pack-tabs` from `PACK_FILES` with buttons using `role="tab"`, `data-demo-action="select-pack-file"`, `data-pack-file`, `aria-controls="pack-document"`, and a single `aria-selected="true"`. Give the `<pre>` the matching `id="pack-document"` and `role="tabpanel"`.

In `render`:

```js
const documents = derivePackDocuments(state.dnaSideRouteEnabled)
packCode.textContent = excerptForFile(documents, state.activePackFile)
for (const tab of packTabs) {
  const selected = tab.dataset.packFile === state.activePackFile
  tab.setAttribute('aria-selected', String(selected))
  tab.tabIndex = selected ? 0 : -1
}
dnaToggle.checked = state.dnaSideRouteEnabled
draftStatus.textContent = state.dnaSideRouteEnabled
  ? '2 files changed · catalog.json · courses.json'
  : 'No local changes.'
```

Add Left Arrow, Right Arrow, Home, and End keyboard navigation within the tablist. Keyboard navigation moves focus; activation dispatches `select-pack-file` so the model remains authoritative.

- [ ] **Step 4: Run inspector, model, and document tests**

Run:

```powershell
node --test scripts/website-demo.test.mjs scripts/website-document.test.mjs scripts/website-runtime.test.mjs
```

Expected: PASS, including tab selection, DNA on/off, changed-file copy, route visibility, and derived excerpts.

- [ ] **Step 5: Commit the inspector slice**

```powershell
git add -- website/main.js website/index.html scripts/website-runtime.test.mjs scripts/website-document.test.mjs
git commit -m "feat: reveal the editable pack draft"
```

---

### Task 4: Build the responsive visual system and purposeful motion

**Files:**

- Create: `website/demo.css`
- Modify: `website/index.html:27-29`
- Modify: `website/styles.css`
- Modify: `scripts/website-styles.test.mjs`

**Interfaces:**

- Consumes: `.learning-lab`, `.lab-topbar`, `.lab-route`, `.lab-workspace`, `.membrane-figure`, `.lab-activity`, `.lab-context`, `.pack-tabs`, and runtime `data-phase`, `data-result`, and `data-state` attributes.
- Produces: three-column desktop workspace, horizontal narrow route, transform-only scientific motion, 44-pixel controls, and reduced-motion fallbacks.

- [ ] **Step 1: Write failing style-contract tests**

Read both stylesheets:

```js
const baseStyles = await readFile(
  new URL('../website/styles.css', import.meta.url),
  'utf8',
)
const demoStyles = await readFile(
  new URL('../website/demo.css', import.meta.url),
  'utf8',
)
const styles = `${baseStyles}\n${demoStyles}`
```

Add assertions for:

```js
test('lays out the learning lab as route, activity, and context', () => {
  assert.match(
    ruleBody('.lab-workspace'),
    /grid-template-columns:\s*minmax\(9rem,\s*0\.55fr\)\s+minmax\(18rem,\s*1\.45fr\)\s+minmax\(15rem,\s*0\.8fr\);/,
  )
  assert.match(ruleBody('.lab-route'), /display:\s*grid;/)
  assert.match(ruleBody('.lab-context'), /min-width:\s*0;/)
})

test('keeps lab controls touch-safe and press motion pointer-only', () => {
  assert.match(
    demoStyles,
    /\.learning-lab button[^{]*\{[^}]*min-height:\s*2\.75rem;/s,
  )
  assert.match(
    demoStyles,
    /@media\s*\(hover:\s*hover\)\s*and\s*\(pointer:\s*fine\)[\s\S]*?transform:\s*scale\(0\.97\);/,
  )
})

test('stacks the lab without horizontal overflow and honors reduced motion', () => {
  assert.match(
    demoStyles,
    /@media\s*\(max-width:\s*52rem\)[\s\S]*?\.lab-workspace\s*\{[^}]*grid-template-columns:\s*1fr;/,
  )
  assert.match(
    demoStyles,
    /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.molecule\s*\{[^}]*transition:\s*none;/,
  )
  assert.doesNotMatch(demoStyles, /transition:\s*all/)
})
```

- [ ] **Step 2: Run style tests and verify failure**

Run:

```powershell
node --test scripts/website-styles.test.mjs
```

Expected: FAIL because `demo.css` does not exist.

- [ ] **Step 3: Create the isolated workspace stylesheet**

Create `website/demo.css` with these layout foundations and complete matching rules for every listed class:

```css
.learning-lab {
  --lab-line: #41495f;
  margin-top: 2rem;
  overflow: clip;
  border: 1px solid var(--slate);
  border-radius: var(--radius-medium);
  background: #101522;
  box-shadow: 0 1.5rem 4rem rgb(0 0 0 / 22%);
}

.lab-topbar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 1rem;
  min-height: 4.5rem;
  padding: 0.85rem 1rem;
  border-bottom: 1px solid var(--slate);
}

.lab-topbar > div {
  min-width: 0;
}
.lab-topbar span,
.context-label {
  color: var(--rule);
  font-family: var(--font-mono);
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.lab-topbar code {
  display: block;
  margin-top: 0.2rem;
  color: var(--lime);
  overflow-wrap: anywhere;
}
.lab-topbar p {
  margin: 0;
  color: var(--rule);
  font-size: 0.85rem;
}

.lab-route {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0;
  margin: 0;
  padding: 1rem;
  border-bottom: 1px solid var(--slate);
  list-style: none;
}

.lab-route li {
  position: relative;
  display: grid;
  grid-template-columns: 2rem minmax(0, 1fr);
  align-items: center;
  gap: 0.55rem;
  color: var(--rule);
  font-size: 0.78rem;
}
.lab-route li::after {
  position: absolute;
  z-index: 0;
  top: 50%;
  right: 0;
  left: 2rem;
  height: 1px;
  background: var(--lab-line);
  content: '';
}
.lab-route li:last-child::after {
  content: none;
}
.lab-route span {
  position: relative;
  z-index: 1;
  display: grid;
  place-items: center;
  width: 2rem;
  height: 2rem;
  border: 1px solid var(--lab-line);
  border-radius: 50%;
  background: #101522;
  font-family: var(--font-mono);
}
.lab-route [data-state='active'] {
  color: var(--lime);
}
.lab-route [data-state='active'] span {
  border-color: var(--lime);
  box-shadow: 0 0 0 3px rgb(199 243 74 / 16%);
}
.lab-route [data-state='complete'] {
  color: var(--paper);
}
.lab-route [data-state='complete'] span {
  border-color: var(--lime);
  background: var(--lime);
  color: var(--ink);
}
.lab-route [data-state='bridge'] span,
.lab-route [data-state='draft'] span {
  border-color: var(--coral);
  color: var(--coral);
}

.lab-workspace {
  display: grid;
  grid-template-columns: minmax(9rem, 0.55fr) minmax(18rem, 1.45fr) minmax(
      15rem,
      0.8fr
    );
  min-height: 34rem;
}

.membrane-figure,
.lab-activity,
.lab-context {
  min-width: 0;
  margin: 0;
  padding: clamp(1.25rem, 2.4vw, 2rem);
}
.membrane-figure {
  border-right: 1px solid var(--slate);
}
.lab-context {
  border-left: 1px solid var(--slate);
  background: rgb(0 0 0 / 12%);
}
.lab-activity {
  display: grid;
  align-items: center;
}
.lab-activity > section {
  grid-area: 1 / 1;
}

.membrane-scene {
  position: relative;
  min-height: 22rem;
  overflow: hidden;
  border: 1px solid var(--slate);
  border-radius: 8rem;
  background:
    radial-gradient(circle at 65% 40%, rgb(36 87 255 / 28%), transparent 42%),
    #141b2d;
}
.membrane-layer {
  position: absolute;
  inset: 42% -5% auto;
  height: 4.5rem;
  border-block: 0.85rem dotted var(--lime);
  background: repeating-linear-gradient(
    90deg,
    transparent 0 0.7rem,
    rgb(199 243 74 / 18%) 0.7rem 1rem
  );
}
.transport-channel {
  position: absolute;
  z-index: 2;
  top: 38%;
  left: 58%;
  width: 2.5rem;
  height: 6rem;
  border: 0.55rem solid var(--cobalt);
  border-block-width: 0.85rem;
  border-radius: 1rem;
}
.molecule {
  position: absolute;
  z-index: 3;
  display: grid;
  place-items: center;
  min-width: 3rem;
  min-height: 3rem;
  padding: 0.35rem;
  border: 1px solid currentColor;
  border-radius: 50%;
  background: var(--midnight);
  font-family: var(--font-mono);
  font-size: 0.78rem;
  transition:
    transform 240ms var(--ease-out),
    opacity 160ms ease;
}
.molecule-oxygen {
  top: 16%;
  left: 14%;
  color: var(--lime);
}
.molecule-glucose {
  top: 17%;
  left: 43%;
  color: var(--coral);
}
.molecule-sodium {
  top: 17%;
  right: 10%;
  color: var(--paper);
}
[data-result='oxygen'] .molecule-oxygen {
  transform: translateY(13rem);
}
[data-result='oxygen'] .molecule-glucose {
  transform: translateY(5.5rem);
}
[data-result='oxygen'] .molecule-sodium {
  transform: translateY(5.5rem);
}
.membrane-figure figcaption {
  margin-top: 1rem;
  color: var(--rule);
  font-size: 0.82rem;
  line-height: 1.5;
}

.lab-activity h3,
.lab-context h3 {
  margin: 0;
  color: var(--paper);
}
.lab-activity h3 {
  max-width: 18ch;
  font-size: clamp(1.8rem, 2.7vw, 2.6rem);
  line-height: 1.03;
}
.lab-activity p {
  color: var(--rule);
  line-height: 1.55;
}
.choice-set {
  display: grid;
  gap: 0.65rem;
  margin: 1.4rem 0 0;
  padding: 0;
  border: 0;
}
.choice-set legend {
  margin-bottom: 0.6rem;
  color: var(--rule);
  font-size: 0.82rem;
}
.molecule-choices {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}
.confidence-choices {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.choice-set label {
  position: relative;
  display: grid;
  min-width: 0;
}
.choice-set input {
  position: absolute;
  opacity: 0;
}
.choice-set span {
  display: flex;
  min-height: 3.5rem;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.75rem;
  border: 1px solid var(--slate);
  border-radius: var(--radius-small);
  color: var(--paper);
  cursor: pointer;
}
.choice-set small {
  color: var(--rule);
  font-family: var(--font-mono);
}
.choice-set input:checked + span {
  border-color: var(--lime);
  background: rgb(199 243 74 / 10%);
  color: var(--lime);
}
.choice-set input:focus-visible + span {
  outline: 3px solid var(--focus-dark);
  outline-offset: 3px;
}

.pack-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-top: 1rem;
}
.pack-tabs button {
  padding: 0.55rem 0.65rem;
  border: 1px solid var(--slate);
  background: transparent;
  color: var(--rule);
  font-family: var(--font-mono);
  font-size: 0.72rem;
}
.pack-tabs button[aria-selected='true'] {
  border-color: var(--lime);
  color: var(--lime);
}
.lab-context pre {
  max-height: 18rem;
  margin: 0.75rem 0 0;
  padding: 1rem;
  overflow: auto;
  border: 1px solid var(--slate);
  background: var(--ink);
  color: var(--paper);
  font-size: 0.72rem;
  line-height: 1.55;
  white-space: pre-wrap;
}
.draft-toggle {
  display: flex;
  min-height: 3.25rem;
  align-items: center;
  gap: 0.75rem;
  margin-top: 1rem;
  padding: 0.75rem;
  border: 1px solid var(--slate);
  cursor: pointer;
}
.draft-toggle input {
  width: 1.25rem;
  height: 1.25rem;
  accent-color: var(--lime);
}

.learning-lab button {
  min-height: 2.75rem;
  border: 1px solid var(--slate);
  border-radius: var(--radius-small);
  background: transparent;
  color: var(--paper);
  font: inherit;
  cursor: pointer;
  transition:
    transform 120ms var(--ease-out),
    background-color 160ms ease,
    border-color 160ms ease,
    color 160ms ease;
}
.learning-lab button:hover,
.learning-lab button:focus-visible {
  border-color: var(--lime);
  color: var(--lime);
}
.learning-lab button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}
.answer-grid button[data-state='correct'] {
  border-color: var(--lime);
  background: rgb(199 243 74 / 12%);
  color: var(--lime);
}
.answer-grid button[data-state='incorrect'] {
  border-color: var(--coral);
  background: rgb(255 107 87 / 10%);
  color: var(--paper);
}
.lab-context [data-evidence-context] {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--slate);
}
.lab-context [data-evidence-context] p,
[data-draft-status] {
  margin: 0.65rem 0 0;
  color: var(--rule);
  font-size: 0.82rem;
  line-height: 1.5;
}
[data-application-feedback] {
  margin-top: 1rem;
  padding: 1rem;
  border-left: 3px solid var(--coral);
  background: var(--ink);
  color: var(--paper);
}
[data-phase='pack'] .lab-context {
  background: rgb(36 87 255 / 8%);
}

@media (hover: hover) and (pointer: fine) {
  .learning-lab button:active:not(:focus-visible),
  .choice-set label:active span {
    transform: scale(0.97);
    transition-duration: 160ms;
  }
}

@media (max-width: 64rem) {
  .lab-workspace {
    grid-template-columns: minmax(8rem, 0.5fr) minmax(17rem, 1.5fr);
  }
  .lab-context {
    grid-column: 1 / -1;
    border-top: 1px solid var(--slate);
    border-left: 0;
  }
}

@media (max-width: 52rem) {
  .lab-topbar {
    grid-template-columns: 1fr auto;
  }
  .lab-topbar p {
    grid-column: 1 / -1;
  }
  .lab-route {
    grid-template-columns: repeat(4, minmax(8rem, 1fr));
    overflow-x: auto;
  }
  .lab-workspace {
    grid-template-columns: 1fr;
  }
  .membrane-figure,
  .lab-context {
    border: 0;
    border-bottom: 1px solid var(--slate);
  }
  .membrane-scene {
    min-height: 18rem;
  }
  .lab-activity {
    min-height: 27rem;
  }
}

@media (max-width: 30rem) {
  .learning-lab {
    margin-inline: -0.75rem;
  }
  .lab-topbar,
  .lab-route,
  .membrane-figure,
  .lab-activity,
  .lab-context {
    padding-inline: 1rem;
  }
  .molecule-choices,
  .confidence-choices,
  .answer-grid {
    grid-template-columns: 1fr;
  }
}

@media (prefers-reduced-motion: reduce) {
  .molecule,
  .learning-lab button,
  .choice-set span {
    transition: none;
  }
  [data-result='oxygen'] .molecule-oxygen {
    transform: none;
    top: 72%;
  }
  [data-result='oxygen'] .molecule-glucose,
  [data-result='oxygen'] .molecule-sodium {
    transform: none;
    top: 39%;
  }
}
```

Do not add `transition: all`, keyframe UI transitions, blur, layout-property animation, or ungated hover transforms beyond this explicit block. Any fidelity adjustment must update a named property and retain the tested motion constraints.

- [ ] **Step 4: Load `demo.css` and neutralize obsolete demo rules**

Add `<link rel="stylesheet" href="./demo.css" />` immediately after the existing `styles.css` link. Remove old rules that target `.route-map`, `.demo-stage`, `.pack-file`, and their breakpoint variants once no HTML uses those classes. Keep `.demo-section`, `.demo-heading`, shared `.demo-step`, `.demo-actions`, `.answer-grid`, `.feedback`, `.button-demo`, focus, hidden, and progressive-enhancement rules only when the new workspace still consumes them.

- [ ] **Step 5: Format and run style plus website tests**

Run:

```powershell
npx prettier --write website/demo.css website/styles.css website/index.html scripts/website-styles.test.mjs
node --test scripts/website-styles.test.mjs
npm run test:website
```

Expected: PASS with no obsolete-selector assertion and no formatting drift.

- [ ] **Step 6: Commit the visual system**

```powershell
git add -- website/demo.css website/styles.css website/index.html scripts/website-styles.test.mjs
git commit -m "feat: style the guided learning workspace"
```

---

### Task 5: Harden accessibility, progressive enhancement, and performance

**Files:**

- Modify: `website/index.html`
- Modify: `website/main.js`
- Modify: `website/demo.css`
- Modify: `website/styles.css`
- Modify: `scripts/website-document.test.mjs`
- Modify: `scripts/website-runtime.test.mjs`
- Modify: `scripts/website-styles.test.mjs`
- Modify: `scripts/website-assets.test.mjs`

**Interfaces:**

- Consumes: the complete guided workspace.
- Produces: no-JavaScript walkthrough, exact focus and announcement behavior, runtime size gate, and browser-ready accessibility.

- [ ] **Step 1: Add failing hardening tests**

Add tests that assert:

```js
test('provides the complete no-JavaScript explanation', () => {
  const staticDemo = document.querySelector('.static-demo')
  assert.ok(staticDemo)
  assert.match(staticDemo.textContent, /oxygen/i)
  assert.match(staticDemo.textContent, /charge and size/i)
  assert.match(staticDemo.textContent, /transport protein/i)
  assert.match(staticDemo.textContent, /catalog\.json/i)
  assert.match(staticDemo.textContent, /unpacked/i)
})
```

```js
test('keeps the guided runtime within its uncompressed JavaScript budget', async () => {
  const paths = [
    '../website/main.js',
    '../website/demo-model.js',
    '../website/demo-content.js',
  ]
  const total = (
    await Promise.all(paths.map((path) => stat(new URL(path, import.meta.url))))
  ).reduce((sum, entry) => sum + entry.size, 0)
  assert.ok(total < 30_000, `demo JavaScript total ${total} exceeds 30 KB`)
})
```

Add runtime assertions for reset focus, no focus movement on incorrect answers, live-region text for each phase, checkbox synchronization after back/forward model actions, and listener cleanup after `destroy`.

- [ ] **Step 2: Run focused hardening tests and verify failures**

Run:

```powershell
node --test scripts/website-document.test.mjs scripts/website-runtime.test.mjs scripts/website-styles.test.mjs scripts/website-assets.test.mjs
```

Expected: at least one new hardening assertion fails before final adjustments.

- [ ] **Step 3: Implement the exact accessibility and no-JavaScript behavior**

Ensure:

- `html:not(.js) .learning-lab { display: none; }` and `html.js .static-demo { display: none; }`.
- The static `<details>` remains visible and readable without JavaScript.
- Runtime-only controls carry `enhanced-control` where the existing pre-mount inert rule requires it.
- Every phase heading has `tabindex="-1"` through its section and focus moves only when `phase` changes.
- A prediction form validation message uses text and focus rather than color alone if either field is missing.
- Application error feedback is `role="status"`; the main live region remains polite and does not repeat the same message twice.
- Route nodes include visually hidden state text or the adjacent `data-demo-progress` communicates equivalent completion.
- Tab keyboard behavior follows WAI-ARIA manual activation or automatic activation consistently; use automatic activation because excerpts are local and instantaneous.
- Reset clears native form controls, model state, figure state, inspector tab, checkbox, feedback, and route nodes.

- [ ] **Step 4: Run the complete local verification gate**

Run:

```powershell
npm run verify
npm audit --omit=dev
git diff --check
```

Expected: formatting, lint, package tests, application tests, website tests, TypeScript build, Vite production build, and audit all succeed. The existing Vite chunk-size warning may remain if unchanged; no new warning is acceptable.

- [ ] **Step 5: Commit the hardening slice**

```powershell
git add -- website/index.html website/main.js website/demo.css website/styles.css scripts/website-document.test.mjs scripts/website-runtime.test.mjs scripts/website-styles.test.mjs scripts/website-assets.test.mjs
git commit -m "fix: harden the guided demo experience"
```

---

### Task 6: Perform visual, motion, browser, and production verification

**Files:**

- Modify only if QA exposes a defect: `website/index.html`, `website/main.js`, `website/demo-model.js`, `website/demo-content.js`, `website/demo.css`, `website/styles.css`, or matching tests.
- Remove after QA: temporary browser screenshots, Playwright session files, and local server logs.

**Interfaces:**

- Consumes: the complete locally verified site.
- Produces: agency-level browser proof, motion approval, GitHub CI success, Cloudflare production deployment, and canonical-host verification.

- [ ] **Step 1: Serve the static website and exercise both branches**

Start a hidden local server from `website` on an unused loopback port. Use the `playwright` skill and Playwright CLI because this workflow requires repeatable viewport, keyboard, reduced-motion, and JavaScript-disabled checks.

Direct path:

1. Choose oxygen and **I knew it**.
2. Submit and confirm oxygen crosses while glucose and sodium stop at the membrane.
3. Continue directly to transport proteins.
4. Choose the wrong application answer and verify focus stays on the answer.
5. Choose **A transport protein** and verify pack reveal.
6. Switch all four document tabs.
7. Enable and disable the DNA side route; verify both document excerpts and the route graph.

Bridge path:

1. Reset.
2. Choose glucose or sodium, or choose oxygen with **I was guessing**.
3. Verify the bridge is offered, not inserted.
4. Accept it, verify the node appears, complete it, and verify return to the main thread.
5. Repeat with **Stay on the route** and verify no bridge node remains.

- [ ] **Step 2: Complete responsive and accessibility browser checks**

Verify at desktop, 768 CSS pixels, 320 CSS pixels, and browser 200 percent zoom:

- no horizontal page overflow;
- route remains legible and scrolls only inside its own narrow container when necessary;
- membrane figure precedes the activity on narrow screens;
- controls are at least 44 by 44 CSS pixels;
- focus ring remains visible on midnight, cobalt, lime, and code surfaces;
- all workflows complete with Tab, Shift+Tab, Space, Enter, arrow keys in pack tabs, and no pointer;
- live-region messages are concise and ordered;
- no console errors or warnings.

Emulate `prefers-reduced-motion: reduce` and verify molecules move by immediate placement rather than animation. Disable JavaScript and verify the complete static walkthrough while runtime controls remain absent.

- [ ] **Step 3: Capture and directly inspect final renders**

Capture desktop direct-path, desktop pack-inspector, mobile prediction, and mobile pack-inspector screenshots. Use `view_image` on each screenshot. Compare against the approved specification for hierarchy, route continuity, scientific clarity, typography, spacing, density, focus, and inspector readability. Fix every issue that would trigger design-review feedback, then recapture.

- [ ] **Step 4: Run the Emil motion review**

Use `review-animations` and report:

1. a findings table with Before, After, and Why;
2. an approve/reject verdict.

Reject and fix any ungated hover, `transition: all`, functional motion above 300 milliseconds, layout-property animation, same-speed press/release issue, keyboard-delaying animation, missing reduced-motion behavior, or route/molecule transition that obscures state.

- [ ] **Step 5: Run final repository verification after QA fixes**

```powershell
npm run verify
npm audit --omit=dev
git diff --check
git status --short
```

If QA required changes, commit only the relevant files:

```powershell
git add -- website scripts/website-*.test.mjs
git commit -m "fix: polish the guided demo"
```

- [ ] **Step 6: Push the feature branch and integrate to `main`**

Use the repository's established integration path. The current user has authorized publishing this website work. Confirm the commit range contains only the approved spec, plan, and demo changes, then push. If implementation occurs directly on the tracked integration branch, push `concourse-main:main`; otherwise open or merge the approved feature branch without rewriting existing remote history.

- [ ] **Step 7: Wait for GitHub CI**

```powershell
gh run list --repo Conalh/Concourse --branch main --limit 5 --json databaseId,headSha,status,conclusion,name,url
gh run watch <run-id> --repo Conalh/Concourse --exit-status
```

Expected: `web-and-packages` and `desktop-core` both succeed for the integrated commit.

- [ ] **Step 8: Deploy the exact commit to Cloudflare Pages**

```powershell
$sha = git rev-parse HEAD
npx --yes wrangler@latest pages deploy website --project-name concourse --branch main --commit-hash $sha --commit-message "feat: upgrade the guided learning demo" --commit-dirty=false
```

Expected: a successful production deployment whose source is the exact integrated commit.

- [ ] **Step 9: Verify the canonical public site**

Check `https://concourse.conalhickey.com/`, not only the preview URL:

- HTML and both stylesheets return HTTP 200;
- HTML contains `.learning-lab`, `data-demo-form="prediction"`, and `data-pack-inspector`;
- `demo.css` contains the workspace and reduced-motion rules;
- live direct and bridge paths work in a real browser;
- DNA toggling updates the live route and excerpts;
- no old “Start this route” control remains;
- Cloudflare deployment list shows the integrated source commit.

Only after these checks may the implementation be reported complete.
