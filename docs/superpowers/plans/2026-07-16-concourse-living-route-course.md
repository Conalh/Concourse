# Concourse Living Route Course Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the short `/demo/` interaction with a persistent, evidence-aware 15–20 minute microbiology sample course that demonstrates Concourse routes, retrieval, evidence, and pack authorship.

**Architecture:** Keep the public site framework-free and split the course into immutable content, pack projection, pure routing, pure model transitions, validated local persistence, reusable semantic activity renderers, DOM projection, and a thin mount layer. Preserve the current production demo until the new pure modules pass; switch the page and runtime together only after the new engine is independently green.

**Tech Stack:** Semantic HTML, modern CSS, native JavaScript ES modules, browser `localStorage`, Node test runner, JSDOM, Prettier, ESLint, Playwright CLI, Cloudflare Pages.

## Global Constraints

- Read `AGENTS.md`, `CODING_STANDARDS.md`, `README.md`, `MEMORY.md`, and `docs/superpowers/specs/2026-07-16-concourse-living-route-course-design.md` before implementation.
- Work only in the existing isolated `codey/guided-demo-redesign` worktree; never stage unrelated files.
- Keep `/` editorial and keep the complete interactive course on `/demo/`.
- Build 6 required chapters, exactly 13 required assessed activities, 5 support branches, 4 extension branches, and 1 integrated completion recap.
- Keep support and extension branches transparent, recommended, and skippable; keep the 6-chapter spine available.
- Classify evidence deterministically as `strong`, `developing`, or `support-indicated`; do not claim AI or opaque recommendations.
- Save course progress only under `concourse.demo.course.v1`; never add an account, backend, analytics, cookie, third-party script, remote learner state, or cross-origin runtime request.
- Preserve the approved scientific boundaries and include reputable open educational or primary references in the course data.
- Keep complete contract validation, manifest hashing, repacking, signing, installation, and export outside the browser demo.
- Keep total uncompressed guided-course JavaScript under 90 KB and total website CSS under 80 KB.
- Support keyboard-only completion, visible 3:1 focus indicators, 44-by-44 CSS pixel pointer controls, reduced motion, 320 CSS pixels, 200 percent zoom, and a complete no-JavaScript course summary.
- Use TDD for every behavior: add a failing test, observe the expected failure, implement the smallest production change, then run the focused and website suites.
- Deploy only after `npm run verify`, `npm audit --omit=dev`, exact-SHA GitHub CI, and canonical-domain browser verification succeed.

## File structure

- Create `website/demo-course.js`: immutable course metadata, 6 chapters, 13 required activities, 5 support activities, 4 extension activities, scientific references, lookups, and structural validation.
- Create `website/demo-pack.js`: source pack-shaped documents, excerpts, current-source projection, and atomic biofilm draft derivation.
- Create `website/demo-routing.js`: evidence classification, branch recommendation, delayed retrieval target selection, route projection, and route-decision explanations.
- Modify `website/demo-model.js`: new course state, validated events, attempts, evidence, branches, retrieval, recap, pack draft, and reset; retain old exports only until Task 5 migrates the DOM runtime.
- Create `website/demo-storage.js`: versioned serialization, restoration validation, reset, and session-only fallback.
- Create `website/demo-activities.js`: semantic activity markup and response reading for choice, multi-select, matching, and ordering patterns.
- Create `website/demo-render.js`: resume, workspace, route, activity, evidence, route decision, source tabs, save state, and recap projection.
- Modify `website/main.js`: event delegation, model dispatch, persistence coordination, focus, announcements, and teardown.
- Delete `website/demo-content.js` after `demo-course.js` and `demo-pack.js` own every migrated import.
- Modify `website/demo/index.html`: semantic course roots, static course summary, references, and truthful local/no-JavaScript boundaries.
- Modify `website/demo.css`: wide course workspace, route/evidence/source states, responsive stacking, motion, and completion recap.
- Modify `website/styles.css`: only shared focus and page-shell selectors required by the new course.
- Modify `scripts/website-demo.test.mjs`: course, pack, evidence, routing, model, retrieval, and recap tests.
- Create `scripts/website-storage.test.mjs`: local record validation, round trip, corruption, incompatibility, reset, and failure fallback.
- Create `scripts/website-activities.test.mjs`: renderer semantics, response reading, ordering controls, and validation tests.
- Modify `scripts/website-runtime.test.mjs`: entry, direct, support, extension, mixed, retrieval, resume, reset, pack, recap, focus, announcement, and teardown flows.
- Modify `scripts/website-document.test.mjs`: dedicated course shell, 6-chapter static content, local-save copy, references, and no-JavaScript boundaries.
- Modify `scripts/website-styles.test.mjs`: workspace widths, route states, intermediate stacking, narrow layout, focus, touch, and reduced-motion contracts.
- Modify `scripts/website-assets.test.mjs`: 90 KB JavaScript and 80 KB CSS limits.
- Modify `package.json`: include the two new test files in `test:website`.

---

### Task 1: Define the complete course graph and pack-shaped source

**Files:**

- Create: `website/demo-course.js`
- Create: `website/demo-pack.js`
- Modify: `scripts/website-demo.test.mjs`

**Interfaces:**

- Produces from `demo-course.js`: `COURSE_ID`, `COURSE_REVISION`, `CHAPTERS`, `COURSE_NODES`, `ACTIVITIES`, `SCIENTIFIC_REFERENCES`, `REQUIRED_ACTIVITY_IDS`, `SUPPORT_NODE_IDS`, `EXTENSION_NODE_IDS`, `getCourseNode(id)`, `getActivity(id)`, and `validateCourseDefinition()`.
- Produces from `demo-pack.js`: `PACK_FILES`, `createSourceDocuments()`, `deriveDraftDocuments(draft)`, `excerptForFile(documents, fileName)`, and `sourceForNode(nodeId)`.
- Every activity has `{ activityId, conceptId, kind, prompt, choices, correctResponse, confidenceRequired, feedback, minutes }`.
- Every node has `{ nodeId, chapterId, kind, title, activityId, conceptId, required, nextCoreNodeId }`.

- [ ] **Step 1: Add failing content and pack contracts**

Add tests that assert the exact structure:

```js
import {
  ACTIVITIES,
  CHAPTERS,
  COURSE_ID,
  COURSE_REVISION,
  EXTENSION_NODE_IDS,
  REQUIRED_ACTIVITY_IDS,
  SCIENTIFIC_REFERENCES,
  SUPPORT_NODE_IDS,
  getActivity,
  getCourseNode,
  validateCourseDefinition,
} from '../website/demo-course.js'
import {
  PACK_FILES,
  createSourceDocuments,
  deriveDraftDocuments,
  sourceForNode,
} from '../website/demo-pack.js'

test('defines the complete bacterial-survival course', () => {
  assert.equal(COURSE_ID, 'bacterial-survival')
  assert.equal(COURSE_REVISION, 1)
  assert.equal(CHAPTERS.length, 6)
  assert.equal(REQUIRED_ACTIVITY_IDS.length, 13)
  assert.equal(SUPPORT_NODE_IDS.length, 5)
  assert.equal(EXTENSION_NODE_IDS.length, 4)
  assert.equal(validateCourseDefinition(), true)
  assert.ok(REQUIRED_ACTIVITY_IDS.every((id) => getActivity(id)))
  assert.ok(SUPPORT_NODE_IDS.every((id) => getCourseNode(id)))
  assert.ok(EXTENSION_NODE_IDS.every((id) => getCourseNode(id)))
  assert.ok(SCIENTIFIC_REFERENCES.length >= 4)
  const coreMinutes = REQUIRED_ACTIVITY_IDS.reduce(
    (total, id) => total + getActivity(id).minutes,
    0,
  )
  assert.ok(coreMinutes >= 15 && coreMinutes <= 20)
})

test('projects the biofilm extension atomically', () => {
  assert.deepEqual(PACK_FILES, [
    'pack.json',
    'catalog.json',
    'courses.json',
    'items.json',
  ])
  const source = createSourceDocuments()
  const draft = deriveDraftDocuments({ biofilmExtensionEnabled: true })
  assert.doesNotMatch(JSON.stringify(source), /biofilm-survival/)
  assert.match(JSON.stringify(draft['catalog.json']), /biofilm-survival/)
  assert.match(JSON.stringify(draft['courses.json']), /biofilm-survival/)
  assert.equal(sourceForNode('transport-gradient').fileName, 'items.json')
})
```

- [ ] **Step 2: Run the course tests and observe RED**

Run: `node --test scripts/website-demo.test.mjs`

Expected: module-not-found failures for `demo-course.js` and `demo-pack.js`.

- [ ] **Step 3: Implement the immutable graph and documents**

Use these exact identifiers:

```js
export const REQUIRED_ACTIVITY_IDS = Object.freeze([
  'boundary-permeability',
  'boundary-structure',
  'transport-gradient',
  'transport-mechanism',
  'osmosis-water',
  'osmosis-response',
  'energy-classify',
  'energy-scarce-nutrient',
  'response-sequence',
  'response-transporter',
  'antibiotic-targets',
  'antibiotic-consequence',
  'antibiotic-retrieval',
])

export const SUPPORT_NODE_IDS = Object.freeze([
  'support-charge-size',
  'support-gradient',
  'support-tonicity',
  'support-active-passive',
  'support-central-dogma',
])

export const EXTENSION_NODE_IDS = Object.freeze([
  'extension-cell-envelopes',
  'extension-proton-gradient',
  'extension-anaerobic-energy',
  'extension-plasmids',
])
```

Define all activity prompts, correct responses, feedback, explanatory text, references, and duration values in the module. `validateCourseDefinition()` must reject duplicate identifiers, missing activities, missing next-node references, branch nodes not owned by a chapter, or a required-activity count other than 13.

Build `pack.json`, `catalog.json`, `courses.json`, and `items.json` from the same immutable definitions. Clone before draft mutation. The biofilm edit must change only `catalog.json` and `courses.json`.

- [ ] **Step 4: Run focused and website tests**

Run:

```powershell
node --test scripts/website-demo.test.mjs
npm run test:website
```

Expected: new content tests pass; existing demo tests remain green because the old runtime exports still exist.

- [ ] **Step 5: Commit the course source**

```powershell
git add website/demo-course.js website/demo-pack.js scripts/website-demo.test.mjs
git commit -m "feat: define the bacterial survival course"
```

### Task 2: Build deterministic evidence, routing, and course state

**Files:**

- Create: `website/demo-routing.js`
- Modify: `website/demo-model.js`
- Modify: `scripts/website-demo.test.mjs`

**Interfaces:**

- Produces from `demo-routing.js`: `classifyEvidence(record)`, `recommendRoute(state, record)`, `selectRetrievalConcept(evidence)`, `deriveCourseRoute(state)`, and `explainRouteDecision(decision)`.
- Produces from `demo-model.js`: `createCourseState(now)`, `isValidCourseState(state)`, `transitionCourse(state, event, now)`, and `projectRecap(state)`.
- Valid events: `start`, `resume`, `submit-response`, `take-branch`, `skip-branch`, `complete-branch`, `move-order-item`, `select-pack-file`, `toggle-biofilm-extension`, `go-back`, and `reset`.

- [ ] **Step 1: Add failing evidence and transition tests**

Use the exact classification matrix:

```js
test('classifies evidence from accuracy confidence and attempts', () => {
  assert.equal(
    classifyEvidence({
      correct: true,
      firstResponseCorrect: true,
      confidence: 'high',
      attempts: 1,
    }),
    'strong',
  )
  assert.equal(
    classifyEvidence({
      correct: true,
      firstResponseCorrect: true,
      confidence: 'low',
      attempts: 1,
    }),
    'developing',
  )
  assert.equal(
    classifyEvidence({
      correct: true,
      firstResponseCorrect: false,
      firstConfidence: 'low',
      confidence: 'low',
      attempts: 2,
    }),
    'developing',
  )
  assert.equal(
    classifyEvidence({
      correct: true,
      firstResponseCorrect: false,
      firstConfidence: 'high',
      confidence: 'high',
      attempts: 2,
    }),
    'support-indicated',
  )
  assert.equal(
    classifyEvidence({
      correct: false,
      firstResponseCorrect: false,
      firstConfidence: 'low',
      confidence: 'low',
      attempts: 2,
    }),
    'support-indicated',
  )
})
```

Add complete pure-model tests for:

- strong evidence unlocking the chapter extension;
- developing evidence scheduling delayed retrieval;
- support-indicated evidence recommending the support node and scheduling retrieval;
- taking and skipping branches;
- completing all 13 required activities while extensions remain enrichment;
- selecting the earliest non-strong concept for antibiotic retrieval;
- selecting `osmosis` when every earlier record is strong;
- invalid and out-of-order events returning the identical state object;
- recap counts and actual-route projection.

- [ ] **Step 2: Run the model tests and observe RED**

Run: `node --test scripts/website-demo.test.mjs`

Expected: missing routing exports and missing course-state exports.

- [ ] **Step 3: Implement the course state and routing rules**

Use this state boundary:

```js
{
  version: 1,
  courseId: 'bacterial-survival',
  courseRevision: 1,
  mode: 'entry',
  currentNodeId: 'boundary-permeability',
  completedNodeIds: [],
  skippedNodeIds: [],
  availableNodeIds: ['boundary-permeability'],
  activityProgress: {},
  evidence: [],
  branchDecisions: {},
  scheduledRetrievalConceptIds: [],
  routeHistory: [],
  draft: {
    biofilmExtensionEnabled: false,
    activeFile: 'courses.json',
  },
  startedAt: null,
  updatedAt: null,
}
```

Keep all arrays and nested objects immutable across transitions. Evaluate responses from `ACTIVITIES`; never accept client-supplied correctness. After one incorrect response, keep the activity open with feedback. After a second incorrect response, disclose the correct reasoning, record `support-indicated`, and allow the route to continue. Preserve the original evidence when a support branch is completed.

- [ ] **Step 4: Run focused and website tests**

Run:

```powershell
node --test scripts/website-demo.test.mjs
npm run test:website
```

Expected: all course and legacy runtime tests pass.

- [ ] **Step 5: Commit the engine**

```powershell
git add website/demo-routing.js website/demo-model.js scripts/website-demo.test.mjs
git commit -m "feat: add evidence-aware course routing"
```

### Task 3: Add validated local resume and session fallback

**Files:**

- Create: `website/demo-storage.js`
- Create: `scripts/website-storage.test.mjs`
- Modify: `package.json`

**Interfaces:**

- Produces: `STORAGE_KEY`, `toStoredCourseState(state)`, `validateStoredCourseState(candidate)`, `loadCourseState(storage)`, `saveCourseState(storage, state)`, and `clearCourseState(storage)`.
- Every storage function returns `{ ok: true, value? }` or `{ ok: false, reason }`; storage exceptions never escape.

- [ ] **Step 1: Register a failing storage suite**

Add `scripts/website-storage.test.mjs` to `test:website`, then cover:

```js
test('round trips only durable course state', () => {
  const storage = createMemoryStorage()
  const state = transitionCourse(createCourseState(NOW), { type: 'start' }, NOW)
  assert.deepEqual(saveCourseState(storage, state), { ok: true })
  const restored = loadCourseState(storage)
  assert.equal(restored.ok, true)
  assert.equal(restored.value.courseId, 'bacterial-survival')
  assert.equal('saveMode' in restored.value, false)
})

test('rejects corrupted and impossible records without partial restore', () => {
  const storage = createMemoryStorage()
  storage.setItem(STORAGE_KEY, '{bad json')
  assert.deepEqual(loadCourseState(storage), {
    ok: false,
    reason: 'corrupt',
  })
  storage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      ...toStoredCourseState(createCourseState(NOW)),
      currentNodeId: 'not-a-course-node',
    }),
  )
  assert.deepEqual(loadCourseState(storage), {
    ok: false,
    reason: 'invalid',
  })
})
```

Define the storage fixture in the same test file:

```js
const NOW = '2026-07-16T20:00:00.000Z'

function createMemoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial))
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  }
}
```

Also test incompatible version/revision, unknown fields, invalid evidence identifiers, throwing reads, throwing writes, clearing, and independent restoration of the biofilm draft.

- [ ] **Step 2: Run the storage suite and observe RED**

Run: `node --test scripts/website-storage.test.mjs`

Expected: module-not-found for `demo-storage.js`.

- [ ] **Step 3: Implement strict serialization and restoration**

Use `concourse.demo.course.v1` exactly. Serialize only the fields listed in the specification. Reconstruct through `validateStoredCourseState`; ignore unknown keys, but reject invalid required values. Return `empty`, `corrupt`, `incompatible`, `invalid`, `read-failed`, `write-failed`, or `clear-failed` reasons as applicable.

- [ ] **Step 4: Run storage and website suites**

Run:

```powershell
node --test scripts/website-storage.test.mjs
npm run test:website
```

Expected: all pass.

- [ ] **Step 5: Commit persistence**

```powershell
git add website/demo-storage.js scripts/website-storage.test.mjs package.json
git commit -m "feat: persist sample course progress locally"
```

### Task 4: Build reusable accessible activity renderers

**Files:**

- Create: `website/demo-activities.js`
- Create: `scripts/website-activities.test.mjs`
- Modify: `package.json`

**Interfaces:**

- Produces: `renderActivity(documentRoot, activity, progress)`, `readActivityResponse(activityRoot, activity)`, `validateActivityResponse(activity, response)`, and `moveOrderedItem(response, itemId, direction)`.
- Supported `kind` values: `choice`, `multi-select`, `matching`, and `ordering`.
- Returns native, labelled DOM with a single `form[data-course-activity]` root.

- [ ] **Step 1: Add failing renderer tests**

Assert:

- choice activities use fieldsets, legends, and radios;
- multi-select activities use checkboxes and textual selection requirements;
- matching activities use one labelled native `select` per prompt row;
- ordering activities use an ordered list plus **Move up** and **Move down** buttons for each item;
- every activity includes a labelled confidence fieldset when `confidenceRequired` is true;
- response readers return stable plain values independent of label text;
- incomplete responses return specific validation messages;
- `moveOrderedItem` never mutates its input and clamps at list boundaries.

- [ ] **Step 2: Run the renderer suite and observe RED**

Run: `node --test scripts/website-activities.test.mjs`

Expected: module-not-found for `demo-activities.js`.

- [ ] **Step 3: Implement semantic renderers**

Use data hooks only for behavior:

```html
<form data-course-activity="transport-mechanism">
  <fieldset data-response-group>
    <legend>Choose the transport mechanism</legend>
    <label>
      <input name="response" type="radio" value="carrier" />
      Carrier protein
    </label>
  </fieldset>
  <fieldset data-confidence-group>
    <legend>How sure are you?</legend>
    <label>
      <input name="confidence" type="radio" value="high" />
      I can explain it
    </label>
  </fieldset>
  <p data-activity-error role="status" tabindex="-1" hidden></p>
  <button type="submit">Check my reasoning</button>
</form>
```

Render text through `textContent`, never `innerHTML`. Ordering controls dispatch their item identifier and direction through data attributes; pointer dragging is not required.

- [ ] **Step 4: Run activity and website suites**

Run:

```powershell
node --test scripts/website-activities.test.mjs
npm run test:website
```

Expected: all pass.

- [ ] **Step 5: Commit activity primitives**

```powershell
git add website/demo-activities.js scripts/website-activities.test.mjs package.json
git commit -m "feat: add accessible course activities"
```

### Task 5: Replace the short demo DOM with the living course runtime

**Files:**

- Create: `website/demo-render.js`
- Modify: `website/demo/index.html`
- Modify: `website/main.js`
- Modify: `scripts/website-document.test.mjs`
- Modify: `scripts/website-runtime.test.mjs`

**Interfaces:**

- Produces from `demo-render.js`: `renderCourse(root, state, projection)`, `focusTargetForTransition(previous, next)`, and `announcementForTransition(previous, next)`.
- Produces from `main.js`: `mountCourse(documentRoot, windowRoot, options)` where `options.storage` defaults to `windowRoot.localStorage`.
- Required roots: `[data-course]`, `[data-course-entry]`, `[data-course-workspace]`, `[data-course-route]`, `[data-course-stage]`, `[data-course-context]`, and `[data-course-status]`.

- [ ] **Step 1: Replace document and runtime expectations with failing course tests**

Document tests must assert:

- one `[data-course]` root and no old six-panel guided-demo tree;
- semantic resume entry and workspace roots;
- all 6 chapter names in the no-JavaScript summary;
- local-save, session-only fallback, reset, and scientific-variation copy;
- a references section with at least 4 links or citations;
- no cross-origin runtime assets.

Runtime tests must cover:

```js
function advanceCourseTo(nodeId) {
  let state = transitionCourse(createCourseState(NOW), { type: 'start' }, NOW)
  while (state.currentNodeId !== nodeId) {
    const activity = getActivity(getCourseNode(state.currentNodeId).activityId)
    state = transitionCourse(
      state,
      {
        type: 'submit-response',
        activityId: activity.activityId,
        response: activity.correctResponse,
        confidence: 'high',
      },
      NOW,
    )
  }
  return state
}

function setupCourse({ seededState = null } = {}) {
  const storage = createMemoryStorage()
  if (seededState !== null) saveCourseState(storage, seededState)
  const dom = new JSDOM(html, { url: 'https://concourse.test/demo/' })
  const controller = mountCourse(dom.window.document, dom.window, { storage })
  return { document: dom.window.document, storage, controller }
}

test('starts a new course and persists the first node', () => {
  const { document, storage, controller } = setupCourse()
  click(document, '[data-course-action="start"]')
  assert.equal(controller.getState().mode, 'course')
  assert.equal(controller.getState().currentNodeId, 'boundary-permeability')
  assert.ok(storage.getItem(STORAGE_KEY))
})

test('restores an incomplete course through the resume entry', () => {
  const seededState = advanceCourseTo('transport-gradient')
  const { document, controller } = setupCourse({ seededState })
  assert.match(
    document.querySelector('[data-resume-copy]').textContent,
    /move matter/i,
  )
  click(document, '[data-course-action="resume"]')
  assert.equal(controller.getState().currentNodeId, 'transport-gradient')
})
```

Add accelerated helpers that complete a strong path, support path, extension path, and mixed path by reading the activity definitions instead of hard-coding visible answer text.

- [ ] **Step 2: Run document and runtime suites and observe RED**

Run:

```powershell
node --test scripts/website-document.test.mjs scripts/website-runtime.test.mjs
```

Expected: missing course roots and `mountCourse`.

- [ ] **Step 3: Build the semantic page shell**

Replace the old lab markup with:

```html
<section class="course-shell" data-course aria-labelledby="course-title">
  <header class="course-heading">
    <p>Guided course / Microbiology</p>
    <h1 id="course-title">How a bacterium survives</h1>
    <p>Follow a living route through one bacterium's changing environment.</p>
  </header>
  <section class="course-entry" data-course-entry></section>
  <div class="course-workspace" data-course-workspace hidden>
    <header class="course-topbar">
      <p data-course-progress>Chapter 1 of 6</p>
      <p data-save-status>Saved on this device</p>
      <button data-course-action="reset" type="button">Start over</button>
    </header>
    <nav data-course-route aria-label="Learning route"></nav>
    <section data-course-stage aria-label="Current activity"></section>
    <aside data-course-context aria-label="Course context"></aside>
  </div>
  <section class="static-course" aria-labelledby="static-course-title">
    <h2 id="static-course-title">Course summary</h2>
    <ol>
      <li>Hold the boundary</li>
      <li>Move matter</li>
      <li>Survive salt shock</li>
      <li>Pay for movement</li>
      <li>Build a response</li>
      <li>Face an antibiotic</li>
    </ol>
  </section>
  <p class="sr-only" data-course-status aria-live="polite"></p>
</section>
```

The static course must include all six concepts, representative disclosed answers, adaptation rules, pack document mapping, references, and the JavaScript boundary.

- [ ] **Step 4: Implement projection and mount behavior**

`mountCourse` must:

1. validate required roots and return a no-op controller if absent;
2. load storage and render new, resume, completed, corrupt-save, or session-only entry state;
3. delegate submit, click, and change events from the course root;
4. translate DOM values through `demo-activities.js`;
5. transition through `transitionCourse`;
6. save after durable transitions;
7. render projected route, activity, evidence, context, and save status;
8. move focus only after meaningful node or mode changes;
9. announce concise node, route-decision, save-mode, and completion messages;
10. remove every listener on `destroy()`.

- [ ] **Step 5: Remove legacy runtime exports after migration**

Delete `website/demo-content.js`, `createGuidedDemoState`, `transitionGuidedDemo`, `mountDemo`, old phase helpers, and old DOM hooks only after all migrated runtime tests pass and all imports resolve to `demo-course.js` or `demo-pack.js`.

- [ ] **Step 6: Run focused and website suites**

Run:

```powershell
node --test scripts/website-document.test.mjs scripts/website-runtime.test.mjs
npm run test:website
```

Expected: all pass.

- [ ] **Step 7: Commit the living runtime**

```powershell
git add website/demo/index.html website/demo-render.js website/demo-model.js website/main.js website/demo-content.js scripts/website-document.test.mjs scripts/website-runtime.test.mjs
git commit -m "feat: turn the demo into a living course"
```

### Task 6: Complete delayed retrieval, pack source, draft edit, and recap

**Files:**

- Modify: `website/demo-render.js`
- Modify: `website/main.js`
- Modify: `scripts/website-demo.test.mjs`
- Modify: `scripts/website-runtime.test.mjs`

**Interfaces:**

- Consumes: `selectRetrievalConcept`, `sourceForNode`, `deriveDraftDocuments`, `projectRecap`.
- Produces: live **Evidence**, **Why this route?**, and **Open the pack** context tabs; the final recap; and the biofilm draft mutation.

- [ ] **Step 1: Add failing integrated behavior tests**

Cover:

- developing and support evidence selecting the earliest non-strong concept for the antibiotic retrieval activity;
- all-strong evidence selecting osmosis;
- route-decision text naming the evidence and deterministic rule;
- context tab keyboard navigation with ArrowLeft, ArrowRight, Home, and End;
- current node highlighting `items.json` or `courses.json` as appropriate;
- biofilm toggle changing only catalog and course drafts and adding one visible route node;
- recap reporting 13 required activities independently from extension completion;
- **Try another path** resetting learner state only after confirmation;
- local pack edits not triggering repeated phase announcements.

- [ ] **Step 2: Run focused tests and observe RED**

Run:

```powershell
node --test scripts/website-demo.test.mjs scripts/website-runtime.test.mjs
```

Expected: missing integrated context, retrieval, recap, and biofilm behaviors.

- [ ] **Step 3: Implement context and recap projection**

Use three tabs with stable identifiers:

```js
const CONTEXT_TABS = Object.freeze([
  'evidence',
  'route-decision',
  'pack-source',
])
```

The recap must show counts for `strong`, `developing`, `support-indicated`, completed/skipped support, completed/skipped extensions, delayed retrieval results, the actual route history, and source document names. It must not calculate a mastery percentage or grade.

The biofilm edit dispatches `toggle-biofilm-extension`, updates the draft projection, persists it, marks `catalog.json` and `courses.json`, and adds `biofilm-survival` to the projected route without changing released source documents.

- [ ] **Step 4: Run focused and website suites**

Run:

```powershell
node --test scripts/website-demo.test.mjs scripts/website-runtime.test.mjs
npm run test:website
```

Expected: all pass.

- [ ] **Step 5: Commit integrated product behavior**

```powershell
git add website/demo-render.js website/main.js scripts/website-demo.test.mjs scripts/website-runtime.test.mjs
git commit -m "feat: reveal course evidence and pack authorship"
```

### Task 7: Redesign the course workspace responsively and accessibly

**Files:**

- Modify: `website/demo.css`
- Modify: `website/styles.css`
- Modify: `scripts/website-styles.test.mjs`
- Modify: `scripts/website-assets.test.mjs`

**Interfaces:**

- Consumes: course shell classes and data-state attributes from Task 5.
- Produces: full-width desktop workspace, intermediate context stacking, narrow chapter strip, accessible states, reduced motion, and enforced asset budgets.

- [ ] **Step 1: Replace old style contracts with failing course contracts**

Assert:

```js
test('gives the course a route stage and context without crushing the stage', () => {
  assert.match(
    ruleBody('.course-workspace'),
    /grid-template-columns:\s*minmax\(12rem,\s*0\.55fr\)\s+minmax\(28rem,\s*1\.65fr\)\s+minmax\(18rem,\s*0\.8fr\);/,
  )
  assert.match(
    demoStyles,
    /@media\s*\(max-width:\s*72rem\)[\s\S]*?\.course-workspace\s*\{[^}]*grid-template-columns:\s*minmax\(10rem,\s*0\.45fr\)\s+minmax\(0,\s*1fr\);/,
  )
  assert.match(
    demoStyles,
    /@media\s*\(max-width:\s*52rem\)[\s\S]*?\.course-workspace\s*\{[^}]*grid-template-columns:\s*1fr;/,
  )
})
```

Also assert 44px controls, visible non-color route state, internal code scrolling, no body width floor, `prefers-reduced-motion`, no `transition: all`, and 90 KB JS/80 KB CSS budgets. The JavaScript budget must sum `main.js`, `demo-course.js`, `demo-pack.js`, `demo-routing.js`, `demo-model.js`, `demo-storage.js`, `demo-activities.js`, and `demo-render.js`; the CSS budget must sum `styles.css` and `demo.css`.

- [ ] **Step 2: Run style and asset tests and observe RED**

Run:

```powershell
node --test scripts/website-styles.test.mjs scripts/website-assets.test.mjs
```

Expected: missing course rules and outdated budgets.

- [ ] **Step 3: Implement the desktop and intermediate layouts**

Use the tested three-column grid above at wide widths. At `72rem`, keep route and stage in two columns and place context across the full grid below them. Do not wait until the page is narrow before protecting the stage width.

Use explicit state selectors for `complete`, `current`, `recommended`, `available`, `skipped`, and `locked`; each state includes text or an accessible label and never relies on color alone.

- [ ] **Step 4: Implement narrow, zoom, motion, and focus behavior**

At `52rem`, make the activity first, use a horizontal chapter strip with an expandable full route, and stack context tabs below the stage. Keep code overflow internal. Preserve 3:1 focus indicators and 44px targets. Disable model transitions and panel entrance motion under reduced motion.

Remove obsolete `.learning-lab`, `.lab-*`, old molecule-demo, old six-panel, and unused route-map selectors only after no production HTML or JS references them.

- [ ] **Step 5: Run style, asset, and website suites**

Run:

```powershell
node --test scripts/website-styles.test.mjs scripts/website-assets.test.mjs
npm run test:website
```

Expected: all pass and both budgets remain below their ceilings.

- [ ] **Step 6: Commit the course UI**

```powershell
git add website/demo.css website/styles.css scripts/website-styles.test.mjs scripts/website-assets.test.mjs
git commit -m "feat: style the living course workspace"
```

### Task 8: Verify, publish, and prove the canonical experience

**Files:**

- Verify: every modified course and test file.
- Update only if verification reveals a defect: the smallest owning file and its regression test.

**Interfaces:**

- Consumes: completed static course artifact.
- Produces: clean repository, exact GitHub `main` SHA, green CI, exact-SHA Cloudflare Pages production deployment, and canonical browser evidence.

- [ ] **Step 1: Run the complete local gate**

Run:

```powershell
npm run verify
npm audit --omit=dev
git diff --check
```

Expected: formatting, lint, all package/application/website tests, and production build pass; audit reports zero vulnerabilities; diff check is empty.

- [ ] **Step 2: Run local real-browser verification**

Serve `website/` locally and use Playwright CLI to verify:

- a new course, incomplete resume, completed review, and confirmed reset;
- strong, support, extension, and mixed paths;
- delayed retrieval target selection;
- evidence and route-decision explanations;
- pack source tabs and biofilm draft mutation;
- keyboard-only activity and tab completion;
- 320, 390, 768, 1024, and 1440 pixel layouts;
- 200 percent zoom and reduced motion;
- zero horizontal page overflow and zero console errors.

- [ ] **Step 3: Commit any verification-only corrections**

If Step 2 reveals a defect, first add a failing automated regression test, then patch the smallest owning file, rerun the focused test and `npm run verify`, and commit with a specific `fix:` message. If no defect appears, create no empty commit.

- [ ] **Step 4: Push the exact verified branch and GitHub main**

Fetch `concourse/main`, confirm it is an ancestor of `HEAD`, then atomically push `HEAD` to `refs/heads/codey/guided-demo-redesign` and `refs/heads/main` without force.

- [ ] **Step 5: Wait for exact-SHA GitHub CI**

Use:

```powershell
$sha = git rev-parse HEAD
$runs = gh run list --repo Conalh/Concourse --commit $sha --json databaseId,headBranch,status,conclusion
$mainRunId = ($runs | ConvertFrom-Json | Where-Object { $_.headBranch -eq 'main' }).databaseId
gh run watch $mainRunId --repo Conalh/Concourse --exit-status
```

Require both `web-and-packages` and `desktop-core` to pass for `$sha`.

- [ ] **Step 6: Deploy the exact SHA to Cloudflare Pages**

After checking the current Wrangler help, deploy:

```powershell
$sha = git rev-parse HEAD
npx --yes wrangler@latest pages deploy website --project-name concourse --branch main --commit-hash $sha --commit-message "feat: expand the demo into a living course" --commit-dirty=false
```

Confirm the newest production deployment reports `Branch: main` and `Source` equal to the short form of `$sha`.

- [ ] **Step 7: Prove the canonical host**

Verify `https://concourse.conalhickey.com/` remains the no-runtime invitation and `https://concourse.conalhickey.com/demo/` serves the new course. In a real browser on the canonical domain, complete one full accelerated route, resume an incomplete route, enable the biofilm extension, confirm local-only network behavior, measure zero page overflow at desktop/mobile widths, and require zero console errors.

- [ ] **Step 8: Report exact closure evidence**

Report the commit SHA, GitHub CI URL, production deployment identifier, canonical URLs, test counts, audit result, browser paths completed, responsive measurements, and any intentionally deferred non-goals.
