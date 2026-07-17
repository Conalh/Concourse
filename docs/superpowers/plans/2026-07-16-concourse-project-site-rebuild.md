# Concourse Project Site Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the condemned Concourse project website with a clean-slate, contributor-focused interactive manifesto that demonstrates a guided microbiology learning route in under a minute.

**Architecture:** Keep the deployable site framework-free under `website/`. A pure JavaScript state model drives a progressively enhanced four-step demo; semantic HTML contains the complete no-JavaScript story; CSS and small local SVG/font assets provide the approved editorial visual system. Website-specific Node tests join the existing repository verification gate.

**Tech Stack:** Semantic HTML5, modern CSS, ES modules, Node 22 built-in test runner, jsdom 29, local SVG, self-hosted Instrument Sans WOFF2, Browser/IAB visual verification.

## Global Constraints

- Change the static project website only; do not modify the React/Tauri application, learning engine, pack runtime, course content, or unrelated `docs/design` work.
- Delete every tracked file currently under `website/` before creating the replacement; do not inspect, reuse, or adapt condemned site code or assets.
- Primary audience: open-source developers, designers, technical writers, and learning-route authors.
- Primary message: “Learning should have a route.”
- Primary action: “Explore the demo.” Secondary action: “View on GitHub.”
- Demo topic: “Inside a bacterial cell,” with the sequence cell membrane → DNA → ribosomes.
- Demo states: `route`, `lesson`, `recall`, and `pack`; no autoplay and no persisted visitor state.
- No framework, API, backend, analytics, telemetry, cookie, local storage, session storage, account flow, third-party runtime request, or application embed.
- Use only repository-verified v0.1 claims; do not claim cloud sync, marketplace behavior, hosted learner state, or unfinished catalog functionality.
- Canvas `#F6F7F2`; ink `#10131A`; slate `#5F6672`; rules `#D7DAD1`; cobalt `#2457FF`; lime `#C7F34A`; coral `#FF6B57`; midnight `#141B2D`.
- Use a self-hosted Instrument Sans variable WOFF2 and `ui-monospace`; make no third-party font request.
- JavaScript must remain under 20 KB uncompressed. Initial compressed transfer, including font and essential SVG assets, must remain under 250 KB.
- Support keyboard completion, polite live feedback, visible focus, reduced motion, 200% zoom, and layouts down to 320 CSS pixels.
- Verify 1440×1000, 1024×768, 768×1024, 390×844, and 320×700 viewports.
- Work only in `C:\Projects\Learning\Learnt\.worktrees\concourse-project-site` on `codey/concourse-project-site`.

## File Map

### Delete before replacement

- `website/assets/concourse-icon.svg`
- `website/index.html`
- `website/main.js`
- `website/social-preview.svg`
- `website/styles.css`

### Create

- `website/index.html` — semantic content, metadata, no-JavaScript walkthrough, and stable DOM hooks.
- `website/styles.css` — tokens, grid, typography, components, responsive states, focus, no-JavaScript fallback, and reduced motion.
- `website/demo-model.js` — pure demo state, transition validation, answer evaluation, and recovery.
- `website/main.js` — DOM mounting, rendering, focus management, live announcements, and navigation enhancement.
- `website/assets/concourse-mark.svg` — new junction/node identity mark.
- `website/assets/bacterial-cell.svg` — new focused bacterial cell lesson illustration.
- `website/assets/instrument-sans.woff2` — local weight-variable Latin Instrument Sans.
- `website/assets/OFL.txt` — Instrument Sans license copied from Fontsource package 5.2.8.
- `website/assets/social-preview.svg` — new clean-slate social preview.
- `scripts/website-demo.test.mjs` — pure state-model tests.
- `scripts/website-document.test.mjs` — semantic content, metadata, copy, and link contract tests.
- `scripts/website-assets.test.mjs` — local-resource and performance-budget tests.
- `scripts/website-runtime.test.mjs` — jsdom interaction and DOM-state tests.

### Modify

- `package.json` — add `test:website` and include it in `test`.

## Pre-Implementation Visual Gate

Before Task 1, use `build-web-apps:frontend-app-builder` and `imagegen` to create coordinated clean-slate concept images. Do not open the existing website.

Create these references in `C:\Users\conno\.codex\visualizations\2026\07\16\019f6c45-2edb-7a81-9619-c507aed6f775`:

1. `concourse-hero-demo-desktop.png` at 1440×1000, covering header, hero, and visible first demo state.
2. `concourse-system-contribute-desktop.png` at 1440×1100, covering the system diagram and four contribution paths.
3. `concourse-status-footer-desktop.png` at 1440×900, covering project truth, final invitation, and footer.
4. `concourse-mobile.png` at 390×844, showing the mobile header, hero, and first demo state.

The prompt must repeat the approved copy, exact palette, editorial 12-column layout, abstract route motif, no hero eyebrow, restrained radii, and no card-grid treatment. Present all four images to the user and obtain explicit approval. Extract the final spacing, type scale, borders, radii, and icon treatment into implementation notes before proceeding.

### Task 1: Remove the Condemned Site and Build the Demo State Model

**Files:**

- Delete: `website/assets/concourse-icon.svg`
- Delete: `website/index.html`
- Delete: `website/main.js`
- Delete: `website/social-preview.svg`
- Delete: `website/styles.css`
- Create: `scripts/website-demo.test.mjs`
- Create: `website/demo-model.js`
- Modify: `package.json`

**Interfaces:**

- Produces: `createDemoState(): { step: 'route'|'lesson'|'recall'|'pack', answerStatus: 'unanswered'|'incorrect'|'correct' }`
- Produces: `transitionDemo(state, event): DemoState`
- Produces: `DEMO_ANSWERS`, a frozen array with `membrane`, `dna`, and `ribosomes` choices.
- Consumed by: `website/main.js` and `scripts/website-runtime.test.mjs` in Task 4.

- [ ] **Step 1: Verify the deletion target, then remove only tracked website files**

Run:

```powershell
$root = (Resolve-Path '.').Path
$target = (Resolve-Path 'website').Path
if (-not $target.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "website target escaped the worktree"
}
git ls-files website
git rm -r -- website
```

Expected: exactly the five condemned tracked paths listed in the File Map are removed. No path outside `website/` is deleted.

- [ ] **Step 2: Add the failing state-model test**

Create `scripts/website-demo.test.mjs` with:

```js
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  DEMO_ANSWERS,
  createDemoState,
  transitionDemo,
} from '../website/demo-model.js'

test('starts at the route with no answer', () => {
  assert.deepEqual(createDemoState(), {
    step: 'route',
    answerStatus: 'unanswered',
  })
})

test('publishes the three approved answer choices', () => {
  assert.deepEqual(
    DEMO_ANSWERS.map(({ id, correct }) => ({ id, correct })),
    [
      { id: 'membrane', correct: true },
      { id: 'dna', correct: false },
      { id: 'ribosomes', correct: false },
    ],
  )
})

test('follows the approved forward path', () => {
  const lesson = transitionDemo(createDemoState(), { type: 'start' })
  const recall = transitionDemo(lesson, { type: 'continue' })
  const pack = transitionDemo(recall, {
    type: 'answer',
    choice: 'membrane',
  })

  assert.equal(lesson.step, 'lesson')
  assert.equal(recall.step, 'recall')
  assert.deepEqual(pack, { step: 'pack', answerStatus: 'correct' })
})

test('explains an incorrect answer and permits retry', () => {
  const recall = { step: 'recall', answerStatus: 'unanswered' }
  const incorrect = transitionDemo(recall, {
    type: 'answer',
    choice: 'dna',
  })

  assert.deepEqual(incorrect, {
    step: 'recall',
    answerStatus: 'incorrect',
  })
  assert.deepEqual(transitionDemo(incorrect, { type: 'retry' }), recall)
})

test('supports back and reset without retaining stale answers', () => {
  assert.deepEqual(
    transitionDemo({ step: 'pack', answerStatus: 'correct' }, { type: 'back' }),
    { step: 'recall', answerStatus: 'correct' },
  )
  assert.deepEqual(
    transitionDemo(
      { step: 'recall', answerStatus: 'incorrect' },
      { type: 'back' },
    ),
    { step: 'lesson', answerStatus: 'unanswered' },
  )
  assert.deepEqual(
    transitionDemo(
      { step: 'lesson', answerStatus: 'unanswered' },
      { type: 'back' },
    ),
    createDemoState(),
  )
  assert.deepEqual(
    transitionDemo(
      { step: 'pack', answerStatus: 'correct' },
      { type: 'reset' },
    ),
    createDemoState(),
  )
})

test('recovers invalid state and ignores impossible transitions', () => {
  assert.deepEqual(
    transitionDemo(
      { step: 'missing', answerStatus: 'incorrect' },
      { type: 'back' },
    ),
    createDemoState(),
  )
  assert.deepEqual(
    transitionDemo(createDemoState(), { type: 'continue' }),
    createDemoState(),
  )
})
```

Modify `package.json` scripts to include:

```json
"test": "npm run test:packages && vitest run src content && npm run test:website",
"test:website": "node --test scripts/website-demo.test.mjs"
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm run test:website`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `website/demo-model.js`.

- [ ] **Step 4: Implement the pure state model**

Create `website/demo-model.js` with:

```js
const INITIAL_STATE = Object.freeze({
  step: 'route',
  answerStatus: 'unanswered',
})

const VALID_STEPS = new Set(['route', 'lesson', 'recall', 'pack'])
const VALID_ANSWER_STATUSES = new Set(['unanswered', 'incorrect', 'correct'])

export const DEMO_ANSWERS = Object.freeze([
  Object.freeze({ id: 'membrane', label: 'Cell membrane', correct: true }),
  Object.freeze({ id: 'dna', label: 'DNA', correct: false }),
  Object.freeze({ id: 'ribosomes', label: 'Ribosomes', correct: false }),
])

export function createDemoState() {
  return { ...INITIAL_STATE }
}

function isValidState(state) {
  return (
    state !== null &&
    typeof state === 'object' &&
    VALID_STEPS.has(state.step) &&
    VALID_ANSWER_STATUSES.has(state.answerStatus)
  )
}

export function transitionDemo(state, event) {
  if (!isValidState(state) || event === null || typeof event !== 'object') {
    return createDemoState()
  }

  if (event.type === 'reset') {
    return createDemoState()
  }

  if (state.step === 'route' && event.type === 'start') {
    return { step: 'lesson', answerStatus: 'unanswered' }
  }

  if (state.step === 'lesson') {
    if (event.type === 'back') return createDemoState()
    if (event.type === 'continue') {
      return { step: 'recall', answerStatus: 'unanswered' }
    }
  }

  if (state.step === 'recall') {
    if (event.type === 'back') {
      return { step: 'lesson', answerStatus: 'unanswered' }
    }
    if (event.type === 'retry') {
      return { step: 'recall', answerStatus: 'unanswered' }
    }
    if (event.type === 'answer') {
      const choice = DEMO_ANSWERS.find(({ id }) => id === event.choice)
      if (choice?.correct === true) {
        return { step: 'pack', answerStatus: 'correct' }
      }
      if (choice !== undefined) {
        return { step: 'recall', answerStatus: 'incorrect' }
      }
    }
  }

  if (state.step === 'pack' && event.type === 'back') {
    return { step: 'recall', answerStatus: 'correct' }
  }

  return { ...state }
}
```

- [ ] **Step 5: Run the focused test and the original test suite**

Run:

```powershell
npm run test:website
npm test
```

Expected: 6 website tests pass and the existing 406 TypeScript tests continue to pass.

- [ ] **Step 6: Commit the replacement boundary and model**

```powershell
git add package.json scripts/website-demo.test.mjs website
git diff --staged --check
git commit -m "feat: establish project site demo model"
```

### Task 2: Build and Test the Semantic Project Narrative

**Files:**

- Create: `scripts/website-document.test.mjs`
- Create: `website/index.html`
- Modify: `package.json`

**Interfaces:**

- Produces: stable section IDs `demo`, `system`, `contribute`, and `status`.
- Produces: demo root `[data-demo]`, panels `[data-demo-panel]`, controls `[data-demo-action]`, route nodes `[data-route-node]`, live region `[data-demo-status]`, and progress `[data-demo-progress]`.
- Consumed by: `website/main.js`, `website/styles.css`, and Task 4 runtime tests.

- [ ] **Step 1: Add the failing semantic document test**

Create `scripts/website-document.test.mjs`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { JSDOM } from 'jsdom'

const html = await readFile(
  new URL('../website/index.html', import.meta.url),
  'utf8',
)
const { document } = new JSDOM(html).window

test('declares the approved metadata without remote runtime assets', () => {
  assert.equal(document.title, 'Concourse — Learning should have a route')
  assert.equal(
    document.querySelector('link[rel="canonical"]')?.getAttribute('href'),
    'https://concourse.conalhickey.com/',
  )
  assert.equal(
    document.querySelector('meta[name="description"]')?.getAttribute('content'),
    'Concourse is an open-source, local-first system for guided learning routes, active recall, and portable course packs.',
  )

  for (const element of document.querySelectorAll(
    'script[src], link[rel="stylesheet"][href], link[rel="icon"][href], img[src]',
  )) {
    const source =
      element.getAttribute('src') ?? element.getAttribute('href') ?? ''
    assert.equal(
      /^https?:\/\//.test(source),
      false,
      `remote runtime asset: ${source}`,
    )
  }
})

test('contains the approved hero and contributor-first actions', () => {
  assert.equal(
    document.querySelector('h1')?.textContent?.trim(),
    'Learning should have a route.',
  )
  assert.equal(
    document.querySelector('[data-primary-cta]')?.textContent?.trim(),
    'Explore the demo',
  )
  assert.equal(
    document.querySelector('[data-primary-cta]')?.getAttribute('href'),
    '#demo',
  )
  assert.equal(
    document.querySelector('[data-github-cta]')?.getAttribute('href'),
    'https://github.com/Conalh/Concourse',
  )
})

test('provides every required section and demo hook', () => {
  for (const id of ['demo', 'system', 'contribute', 'status']) {
    assert.ok(document.getElementById(id), `missing #${id}`)
  }
  assert.ok(document.querySelector('[data-demo]'))
  assert.equal(document.querySelectorAll('[data-demo-panel]').length, 4)
  assert.equal(document.querySelectorAll('[data-route-node]').length, 3)
  assert.ok(document.querySelector('[data-demo-status][aria-live="polite"]'))
  assert.ok(document.querySelector('[data-demo-progress]'))
})

test('uses verified contribution destinations', () => {
  const hrefs = [...document.querySelectorAll('#contribute a')].map(
    (link) => link.href,
  )
  for (const expected of [
    'https://github.com/Conalh/Concourse/tree/main/src/ui',
    'https://github.com/Conalh/Concourse/tree/main/src/core',
    'https://github.com/Conalh/Concourse/tree/main/packages',
    'https://github.com/Conalh/Concourse/tree/main/docs/learning-packs',
  ]) {
    assert.ok(hrefs.includes(expected), `missing ${expected}`)
  }
})

test('does not introduce commercial or hosted-service claims', () => {
  const text = document.body.textContent ?? ''
  for (const forbidden of [
    'pricing',
    'sign up',
    'cloud sync',
    'marketplace',
    'newsletter',
  ]) {
    assert.equal(
      text.toLowerCase().includes(forbidden),
      false,
      `forbidden copy: ${forbidden}`,
    )
  }
})
```

Expand `test:website` in `package.json`:

```json
"test:website": "node --test scripts/website-demo.test.mjs scripts/website-document.test.mjs"
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:website`

Expected: document tests fail because `website/index.html` does not exist.

- [ ] **Step 3: Create the complete semantic document**

Create `website/index.html` with this exact document contract and visible copy:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#f6f7f2" />
    <meta
      name="description"
      content="Concourse is an open-source, local-first system for guided learning routes, active recall, and portable course packs."
    />
    <meta
      property="og:title"
      content="Concourse — Learning should have a route"
    />
    <meta
      property="og:description"
      content="Follow a guided route, practice recall, and see how portable learning packs work."
    />
    <meta
      property="og:image"
      content="https://concourse.conalhickey.com/assets/social-preview.svg"
    />
    <meta property="og:url" content="https://concourse.conalhickey.com/" />
    <meta property="og:type" content="website" />
    <link rel="canonical" href="https://concourse.conalhickey.com/" />
    <link rel="icon" href="./assets/concourse-mark.svg" type="image/svg+xml" />
    <link rel="stylesheet" href="./styles.css" />
    <title>Concourse — Learning should have a route</title>
    <script type="module" src="./main.js"></script>
  </head>
  <body>
    <a class="skip-link" href="#main">Skip to content</a>
    <header class="site-header">
      <a class="brand" href="#top" aria-label="Concourse home">
        <img src="./assets/concourse-mark.svg" alt="" width="36" height="36" />
        <span>Concourse</span>
      </a>
      <nav aria-label="Primary navigation">
        <a href="#demo">Demo</a><a href="#system">System</a
        ><a href="#contribute">Contribute</a>
      </nav>
      <a class="github-link" href="https://github.com/Conalh/Concourse"
        >GitHub <span aria-hidden="true">↗</span></a
      >
    </header>

    <main id="main">
      <section class="hero" id="top" aria-labelledby="hero-title">
        <div class="hero-copy">
          <h1 id="hero-title">Learning should have a route.</h1>
          <p>
            Concourse is an open-source, local-first system for building guided
            learning routes, practicing recall, and sharing portable course
            packs.
          </p>
          <div class="hero-actions">
            <a
              class="button button-primary"
              data-primary-cta
              data-focus-demo
              href="#demo"
              >Explore the demo</a
            >
            <a
              class="button button-secondary"
              data-github-cta
              href="https://github.com/Conalh/Concourse"
              >View on GitHub</a
            >
          </div>
        </div>
        <div class="hero-route" aria-hidden="true">
          <span></span><span></span><span></span>
        </div>
      </section>

      <section
        class="demo-section"
        id="demo"
        tabindex="-1"
        aria-labelledby="demo-title"
        data-demo
      >
        <header class="section-heading demo-heading">
          <p class="section-index">01 / Try the idea</p>
          <h2 id="demo-title">Inside a bacterial cell</h2>
          <p>
            One small route. Four deliberate steps. No account and nothing
            leaves your browser.
          </p>
        </header>
        <ol class="route-map" aria-label="Learning route progress">
          <li data-route-node="membrane"><span>01</span>Cell membrane</li>
          <li data-route-node="dna"><span>02</span>DNA</li>
          <li data-route-node="ribosomes"><span>03</span>Ribosomes</li>
        </ol>
        <div class="demo-stage">
          <article data-demo-panel="route" tabindex="-1">
            <p class="demo-step">Step 1 · Choose the route</p>
            <h3>Start with the boundary.</h3>
            <p>
              Follow a short path through three structures that keep a bacterial
              cell working.
            </p>
            <button
              class="button button-demo enhanced-control"
              data-demo-action="start"
              type="button"
            >
              Start this route
            </button>
          </article>
          <article data-demo-panel="lesson" tabindex="-1">
            <p class="demo-step">Step 2 · Learn one idea</p>
            <h3>The membrane is a selective boundary.</h3>
            <img
              src="./assets/bacterial-cell.svg"
              alt="Simplified bacterial cell with the cell membrane emphasized around its outer edge"
              width="720"
              height="480"
            />
            <p>
              A bacterial cell’s membrane regulates what moves into and out of
              the cell, helping it maintain the conditions it needs to function.
            </p>
            <div class="demo-actions enhanced-control">
              <button data-demo-action="back" type="button">Back</button
              ><button
                class="button button-demo"
                data-demo-action="continue"
                type="button"
              >
                Continue to recall
              </button>
            </div>
          </article>
          <article data-demo-panel="recall" tabindex="-1">
            <p class="demo-step">Step 3 · Recall it</p>
            <h3>Which structure controls movement into and out of the cell?</h3>
            <div
              class="answer-grid enhanced-control"
              role="group"
              aria-label="Answer choices"
            >
              <button
                data-demo-action="answer"
                data-choice="membrane"
                type="button"
              >
                Cell membrane
              </button>
              <button data-demo-action="answer" data-choice="dna" type="button">
                DNA
              </button>
              <button
                data-demo-action="answer"
                data-choice="ribosomes"
                type="button"
              >
                Ribosomes
              </button>
            </div>
            <div class="feedback enhanced-control" data-feedback hidden>
              <strong>Not quite.</strong> DNA stores genetic instructions. The
              cell membrane regulates movement across the cell boundary.
              <button data-demo-action="retry" type="button">Try again</button>
            </div>
            <details class="static-answer">
              <summary>Reveal the answer</summary>
              <p>
                <strong>Cell membrane.</strong> It regulates movement into and
                out of the cell.
              </p>
            </details>
            <button
              class="enhanced-control"
              data-demo-action="back"
              type="button"
            >
              Back
            </button>
          </article>
          <article data-demo-panel="pack" tabindex="-1">
            <p class="demo-step">Step 4 · See what moved</p>
            <h3>One concept learned. The route remembers where you are.</h3>
            <p class="success-copy">
              Correct—the cell membrane is the selective boundary.
            </p>
            <div class="pack-file">
              <code>bacterial-cell-basics.learntpack</code>
              <dl>
                <div>
                  <dt>Progress</dt>
                  <dd>1 of 3 concepts</dd>
                </div>
                <div>
                  <dt>Storage</dt>
                  <dd>Local</dd>
                </div>
                <div>
                  <dt>Format</dt>
                  <dd>Portable · Versioned · Editable</dd>
                </div>
              </dl>
            </div>
            <div class="demo-actions enhanced-control">
              <button data-demo-action="back" type="button">Back</button
              ><button data-demo-action="reset" type="button">
                Reset demo
              </button>
            </div>
          </article>
        </div>
        <p class="demo-progress" data-demo-progress>
          Route ready · 0 of 3 concepts
        </p>
        <p class="sr-only" data-demo-status aria-live="polite"></p>
      </section>

      <section
        class="system-section"
        id="system"
        aria-labelledby="system-title"
      >
        <header class="section-heading">
          <p class="section-index">02 / Open by design</p>
          <h2 id="system-title">One project. Two open surfaces.</h2>
          <p>
            The application makes learning usable. The pack system makes routes
            portable, inspectable, and extensible.
          </p>
        </header>
        <div class="system-map">
          <article>
            <p class="system-label">Learning experience</p>
            <h3>Follow the route.</h3>
            <p>Routes · recall · progress · browser and desktop UI</p>
          </article>
          <div class="system-connector" aria-hidden="true"><span></span></div>
          <article>
            <p class="system-label">Open pack system</p>
            <h3>Build what travels.</h3>
            <p>
              Contracts · validation · archives · local installation · authored
              content
            </p>
          </article>
        </div>
        <dl class="product-language">
          <div>
            <dt>Route</dt>
            <dd>Course creation and course learning.</dd>
          </div>
          <div>
            <dt>Loop</dt>
            <dd>Flashcards, retrieval practice, and review.</dd>
          </div>
          <div>
            <dt>Transfer</dt>
            <dd>Portable course and pack exchange.</dd>
          </div>
          <div>
            <dt>Concourse</dt>
            <dd>The open application tying the experience together.</dd>
          </div>
        </dl>
      </section>

      <section
        class="contribute-section"
        id="contribute"
        aria-labelledby="contribute-title"
      >
        <header class="section-heading">
          <p class="section-index">03 / Contribute</p>
          <h2 id="contribute-title">Find your way in.</h2>
          <p>
            Concourse has a working foundation and useful edges in every
            direction.
          </p>
        </header>
        <div class="contribution-list">
          <a href="https://github.com/Conalh/Concourse/tree/main/src/ui"
            ><span>01</span>
            <h3>Shape the experience</h3>
            <p>
              React UI, accessibility, learning flows, visualization, and
              interaction design.
            </p>
            <span aria-hidden="true">↗</span></a
          >
          <a href="https://github.com/Conalh/Concourse/tree/main/src/core"
            ><span>02</span>
            <h3>Build the learning engine</h3>
            <p>
              Sequencing, evidence, recall, progress, and the
              framework-independent core.
            </p>
            <span aria-hidden="true">↗</span></a
          >
          <a href="https://github.com/Conalh/Concourse/tree/main/packages"
            ><span>03</span>
            <h3>Extend portable packs</h3>
            <p>
              Contracts, validation, SDK tooling, security boundaries, and
              import/export.
            </p>
            <span aria-hidden="true">↗</span></a
          >
          <a
            href="https://github.com/Conalh/Concourse/tree/main/docs/learning-packs"
            ><span>04</span>
            <h3>Create learning routes</h3>
            <p>
              Example packs, authoring guidance, templates, documentation, and
              open course material.
            </p>
            <span aria-hidden="true">↗</span></a
          >
        </div>
        <div class="first-contribution">
          <p>First contribution</p>
          <code
            >Clone <span>→</span> npm ci <span>→</span> npm run dev
            <span>→</span> npm run verify</code
          ><a
            href="https://github.com/Conalh/Concourse/blob/main/CONTRIBUTING.md"
            >Read the contributor guide</a
          >
        </div>
      </section>

      <section
        class="status-section"
        id="status"
        aria-labelledby="status-title"
      >
        <header class="section-heading">
          <p class="section-index">04 / Project truth</p>
          <h2 id="status-title">Built enough to use. Early enough to shape.</h2>
        </header>
        <div class="status-grid">
          <div>
            <h3>Delivered in v0.1</h3>
            <ul>
              <li>Browser and Tauri desktop learning surfaces</li>
              <li>Deterministic sessions, evidence, feedback, and recaps</li>
              <li>
                Portable pack contracts, validation, archives, and SDK tooling
              </li>
              <li>Local persistence and defensive pack installation</li>
              <li>An openly licensed Logic Foundations example pack</li>
            </ul>
          </div>
          <div class="local-boundary">
            <h3>The local-first boundary</h3>
            <ul>
              <li>No accounts</li>
              <li>No hosted learner state</li>
              <li>No analytics</li>
              <li>No application backend</li>
              <li>Progress and installed packs stay local</li>
            </ul>
            <a href="https://github.com/Conalh/Concourse/blob/main/ROADMAP.md"
              >See what comes next <span aria-hidden="true">↗</span></a
            >
          </div>
        </div>
      </section>

      <section class="final-invitation" aria-labelledby="final-title">
        <h2 id="final-title">Help build better routes through knowledge.</h2>
        <div>
          <a
            class="button button-primary"
            href="https://github.com/Conalh/Concourse"
            >Explore the repository</a
          ><a
            href="https://github.com/Conalh/Concourse/blob/main/CONTRIBUTING.md"
            >Contributing</a
          ><a href="https://github.com/Conalh/Concourse/blob/main/ROADMAP.md"
            >Roadmap</a
          ><a href="#demo" data-focus-demo>Run the demo again</a>
        </div>
      </section>
    </main>

    <footer>
      <a class="brand" href="#top"
        ><img
          src="./assets/concourse-mark.svg"
          alt=""
          width="30"
          height="30"
        /><span>Concourse</span></a
      >
      <p>
        Open-source learning infrastructure. Your routes and progress stay
        local.
      </p>
      <nav aria-label="Project links">
        <a href="https://github.com/Conalh/Concourse/blob/main/LICENSE"
          >MIT License</a
        ><a href="https://github.com/Conalh/Concourse/blob/main/SECURITY.md"
          >Security</a
        ><a href="https://github.com/Conalh/Concourse">GitHub</a>
      </nav>
    </footer>
  </body>
</html>
```

- [ ] **Step 4: Run the document and demo tests**

Run: `npm run test:website`

Expected: all document and state-model tests pass.

- [ ] **Step 5: Verify linked repository destinations exist locally**

Run:

```powershell
@('src/ui','src/core','packages','docs/learning-packs','CONTRIBUTING.md','ROADMAP.md','LICENSE','SECURITY.md') | ForEach-Object {
  if (-not (Test-Path -LiteralPath $_)) { throw "Missing website destination: $_" }
}
```

Expected: no output and exit code 0.

- [ ] **Step 6: Commit the semantic narrative**

```powershell
git add package.json scripts/website-document.test.mjs website/index.html
git diff --staged --check
git commit -m "feat: add contributor-focused site narrative"
```

### Task 3: Create New Local Assets and Enforce the Performance Budget

**Files:**

- Create: `scripts/website-assets.test.mjs`
- Create: `website/assets/concourse-mark.svg`
- Create: `website/assets/bacterial-cell.svg`
- Create: `website/assets/instrument-sans.woff2`
- Create: `website/assets/OFL.txt`
- Create: `website/assets/social-preview.svg`
- Modify: `package.json`

**Interfaces:**

- Produces: local assets at the exact paths referenced by `website/index.html` and `website/styles.css`.
- Consumes: accepted ImageGen concept proportions, line weight, cell treatment, and junction motif.

- [ ] **Step 1: Add the failing asset and budget test**

Create `scripts/website-assets.test.mjs`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, stat } from 'node:fs/promises'

const root = new URL('../website/', import.meta.url)
const assetPaths = [
  'assets/concourse-mark.svg',
  'assets/bacterial-cell.svg',
  'assets/instrument-sans.woff2',
  'assets/OFL.txt',
  'assets/social-preview.svg',
]

test('ships every approved asset locally', async () => {
  for (const path of assetPaths) {
    assert.ok((await stat(new URL(path, root))).size > 0, `${path} is empty`)
  }
})

test('keeps SVG assets vector-only and self-contained', async () => {
  for (const path of assetPaths.filter((path) => path.endsWith('.svg'))) {
    const svg = await readFile(new URL(path, root), 'utf8')
    assert.equal(/<image\b/i.test(svg), false, `${path} embeds raster content`)
    assert.equal(
      /https?:\/\//i.test(svg),
      false,
      `${path} loads remote content`,
    )
    assert.match(svg, /viewBox=/)
  }
})

test('stays within the uncompressed pre-CSS asset allowance', async () => {
  const sizes = await Promise.all(
    assetPaths.map((path) => stat(new URL(path, root))),
  )
  const total = sizes.reduce((sum, entry) => sum + entry.size, 0)
  assert.ok(total < 180_000, `asset total ${total} exceeds 180 KB`)
})
```

Expand `test:website` to:

```json
"test:website": "node --test scripts/website-demo.test.mjs scripts/website-document.test.mjs scripts/website-assets.test.mjs"
```

- [ ] **Step 2: Run the asset test to verify it fails**

Run: `npm run test:website`

Expected: asset test fails with missing files under `website/assets/`.

- [ ] **Step 3: Create the new SVG identity and illustration assets**

Implement the accepted concept as optimized SVG. The mark uses a `64 64` viewBox, three cobalt nodes, a near-black junction line, and no text. The cell uses a `720 480` viewBox, an emphasized cobalt membrane, restrained lime/coral internal structures, labels for membrane, DNA, and ribosomes, and no external resources. The social preview uses a `1200 630` viewBox with the new mark, the exact hero heading, the one-sentence project description, and the abstract route line.

Before saving, verify each SVG with:

```powershell
Select-String -Path website/assets/*.svg -Pattern '<image|https?://' -CaseSensitive:$false
```

Expected: no output.

- [ ] **Step 4: Add the exact self-hosted font and license**

Use Fontsource's published OFL-licensed package at the verified version and integrity:

```powershell
$fontTemp = Join-Path $env:TEMP 'concourse-instrument-sans-5.2.8'
New-Item -ItemType Directory -Force -Path $fontTemp | Out-Null
npm pack '@fontsource-variable/instrument-sans@5.2.8' --pack-destination $fontTemp
tar -xzf (Join-Path $fontTemp 'fontsource-variable-instrument-sans-5.2.8.tgz') -C $fontTemp
Copy-Item -LiteralPath (Join-Path $fontTemp 'package/files/instrument-sans-latin-wght-normal.woff2') -Destination 'website/assets/instrument-sans.woff2'
Copy-Item -LiteralPath (Join-Path $fontTemp 'package/LICENSE') -Destination 'website/assets/OFL.txt'
```

Expected font size: 30,092 bytes. Package license: `OFL-1.1`. Package integrity recorded by npm: `sha512-mTCaukbdIjjoipj2E3Q5XoZM3ZxJWdzyHevf/LG/0PHlfF9Q85pxOM7B7A9MerFyxmRzz5kVlumgIvgDSG4CPg==`.

- [ ] **Step 5: Run asset and document tests**

Run: `npm run test:website`

Expected: all state, document, and asset tests pass; asset total remains below 180 KB.

- [ ] **Step 6: Commit the clean-slate assets**

```powershell
git add package.json scripts/website-assets.test.mjs website/assets
git diff --staged --check
git commit -m "feat: add project site identity and lesson assets"
```

### Task 4: Bind the Tested Demo Model to Accessible DOM Behavior

**Files:**

- Create: `scripts/website-runtime.test.mjs`
- Create: `website/main.js`
- Modify: `package.json`

**Interfaces:**

- Consumes: `createDemoState`, `transitionDemo`, and `DEMO_ANSWERS` from `website/demo-model.js`.
- Consumes: stable DOM hooks from `website/index.html`.
- Produces: `mountDemo(documentRoot, options?): { getState, dispatch, destroy }` for browser startup and tests.

- [ ] **Step 1: Add the failing runtime test**

Create `scripts/website-runtime.test.mjs`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { JSDOM } from 'jsdom'
import { mountDemo } from '../website/main.js'

const html = await readFile(
  new URL('../website/index.html', import.meta.url),
  'utf8',
)

function setup() {
  const dom = new JSDOM(html, { url: 'https://concourse.test/' })
  dom.window.HTMLElement.prototype.scrollIntoView = () => {}
  const controller = mountDemo(dom.window.document, { manageFocus: false })
  return { document: dom.window.document, controller }
}

function click(document, selector) {
  const button = document.querySelector(selector)
  assert.ok(button, `missing ${selector}`)
  button.click()
}

test('mounts only the route panel and advances through lesson', () => {
  const { document, controller } = setup()
  assert.equal(
    document.querySelector('[data-demo-panel="route"]')?.hidden,
    false,
  )
  assert.equal(
    document.querySelector('[data-demo-panel="lesson"]')?.hidden,
    true,
  )
  click(document, '[data-demo-action="start"]')
  assert.equal(controller.getState().step, 'lesson')
  assert.equal(
    document.querySelector('[data-demo-panel="lesson"]')?.hidden,
    false,
  )
  controller.destroy()
})

test('announces incorrect feedback, retries, and completes the concept', () => {
  const { document, controller } = setup()
  click(document, '[data-demo-action="start"]')
  click(document, '[data-demo-action="continue"]')
  click(document, '[data-choice="dna"]')
  assert.equal(document.querySelector('[data-feedback]')?.hidden, false)
  assert.match(
    document.querySelector('[data-demo-status]')?.textContent ?? '',
    /not quite/i,
  )
  click(document, '[data-demo-action="retry"]')
  assert.equal(document.querySelector('[data-feedback]')?.hidden, true)
  click(document, '[data-choice="membrane"]')
  assert.equal(controller.getState().step, 'pack')
  assert.match(
    document.querySelector('[data-demo-progress]')?.textContent ?? '',
    /1 of 3/,
  )
  controller.destroy()
})

test('supports back, reset, and independent remounting', () => {
  const { document, controller } = setup()
  controller.dispatch({ type: 'start' })
  controller.dispatch({ type: 'continue' })
  controller.dispatch({ type: 'answer', choice: 'membrane' })
  click(document, '[data-demo-panel="pack"] [data-demo-action="back"]')
  assert.equal(controller.getState().step, 'recall')
  controller.dispatch({ type: 'reset' })
  assert.deepEqual(controller.getState(), {
    step: 'route',
    answerStatus: 'unanswered',
  })
  controller.destroy()
})
```

Expand `test:website` to:

```json
"test:website": "node --test scripts/website-demo.test.mjs scripts/website-document.test.mjs scripts/website-assets.test.mjs scripts/website-runtime.test.mjs"
```

- [ ] **Step 2: Run the runtime test to verify it fails**

Run: `npm run test:website`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `website/main.js`.

- [ ] **Step 3: Implement DOM mounting and rendering**

Create `website/main.js` with these exact behaviors:

```js
import { createDemoState, transitionDemo } from './demo-model.js'

const STEP_MESSAGES = Object.freeze({
  route: 'Route ready. Zero of three concepts complete.',
  lesson: 'Lesson opened. Cell membrane is the active concept.',
  recall: 'Recall question opened.',
  pack: 'Correct. Route advanced to one of three concepts.',
})

function eventFromControl(control) {
  const type = control.dataset.demoAction
  if (type === 'answer') return { type, choice: control.dataset.choice }
  return { type }
}

export function mountDemo(documentRoot = document, options = {}) {
  const root = documentRoot.querySelector('[data-demo]')
  if (root === null) {
    return { getState: createDemoState, dispatch: () => {}, destroy: () => {} }
  }

  const manageFocus = options.manageFocus ?? true
  const panels = [...root.querySelectorAll('[data-demo-panel]')]
  const nodes = [...root.querySelectorAll('[data-route-node]')]
  const feedback = root.querySelector('[data-feedback]')
  const progress = root.querySelector('[data-demo-progress]')
  const status = root.querySelector('[data-demo-status]')
  let state = createDemoState()

  documentRoot.documentElement?.classList.add('js')

  function render(announce = false) {
    for (const panel of panels)
      panel.hidden = panel.dataset.demoPanel !== state.step
    for (const node of nodes) {
      const active = node.dataset.routeNode === 'membrane'
      node.dataset.state =
        state.step === 'route' ? 'upcoming' : active ? 'active' : 'upcoming'
      if (state.step === 'pack' && active) node.dataset.state = 'complete'
    }
    if (feedback !== null) feedback.hidden = state.answerStatus !== 'incorrect'
    if (progress !== null) {
      progress.textContent =
        state.step === 'pack'
          ? 'Route in progress · 1 of 3 concepts'
          : 'Route ready · 0 of 3 concepts'
    }
    if (announce && status !== null)
      status.textContent =
        state.answerStatus === 'incorrect'
          ? 'Not quite. DNA stores genetic instructions. The cell membrane regulates movement across the cell boundary.'
          : STEP_MESSAGES[state.step]
    if (manageFocus && announce) {
      const activePanel = panels.find(
        (panel) => panel.dataset.demoPanel === state.step,
      )
      activePanel?.focus({ preventScroll: true })
    }
  }

  function dispatch(event) {
    state = transitionDemo(state, event)
    render(true)
  }

  function handleClick(event) {
    const control = event.target.closest?.('[data-demo-action]')
    if (control === null || control === undefined || !root.contains(control))
      return
    dispatch(eventFromControl(control))
  }

  root.addEventListener('click', handleClick)
  render(false)

  return {
    getState: () => ({ ...state }),
    dispatch,
    destroy: () => root.removeEventListener('click', handleClick),
  }
}

function mountPage() {
  const controller = mountDemo(document)
  for (const link of document.querySelectorAll('[data-focus-demo]')) {
    link.addEventListener('click', () => {
      window.requestAnimationFrame(() =>
        document.querySelector('#demo')?.focus({ preventScroll: true }),
      )
    })
  }
  return controller
}

if (typeof document !== 'undefined') mountPage()
```

If the test reveals that jsdom does not expose `documentElement` on the passed document type as expected, fix the implementation by using `documentRoot.documentElement` directly; do not weaken the assertions.

- [ ] **Step 4: Run runtime, state, document, and asset tests**

Run: `npm run test:website`

Expected: all website tests pass.

- [ ] **Step 5: Check the JavaScript budget**

Run:

```powershell
$jsBytes = (Get-Item website/main.js).Length + (Get-Item website/demo-model.js).Length
"JavaScript bytes: $jsBytes"
if ($jsBytes -ge 20000) { throw 'JavaScript budget exceeded' }
```

Expected: fewer than 20,000 uncompressed bytes.

- [ ] **Step 6: Commit the interactive demo**

```powershell
git add package.json scripts/website-runtime.test.mjs website/main.js
git diff --staged --check
git commit -m "feat: add accessible guided learning demo"
```

### Task 5: Implement the Approved Visual System and Responsive Layout

**Files:**

- Create: `website/styles.css`
- Modify: `website/index.html` only if accepted concept fidelity requires a non-semantic decorative wrapper; visible copy and DOM hooks remain unchanged.

**Interfaces:**

- Consumes: the four approved concept images and extracted design tokens.
- Consumes: all classes and data-state attributes defined in Tasks 2 and 4.
- Produces: agency-signoff desktop/mobile presentation, no-JavaScript walkthrough, focus states, and reduced-motion behavior.

- [ ] **Step 1: Add the font and global token layer**

Start `website/styles.css` with:

```css
@font-face {
  font-family: 'Instrument Sans';
  src: url('./assets/instrument-sans.woff2') format('woff2-variations');
  font-style: normal;
  font-weight: 400 700;
  font-display: swap;
}

:root {
  --canvas: #f6f7f2;
  --ink: #10131a;
  --slate: #5f6672;
  --rule: #d7dad1;
  --cobalt: #2457ff;
  --lime: #c7f34a;
  --coral: #ff6b57;
  --midnight: #141b2d;
  --paper: #ffffff;
  --font-sans: 'Instrument Sans', 'Segoe UI Variable', 'Segoe UI', sans-serif;
  --font-mono:
    ui-monospace, 'Cascadia Code', 'SFMono-Regular', Consolas, monospace;
  --page-gutter: clamp(1rem, 4vw, 4.5rem);
  --section-space: clamp(5rem, 10vw, 10rem);
  --content-width: 90rem;
  --radius-small: 0.45rem;
  --radius-medium: 0.9rem;
  color: var(--ink);
  background: var(--canvas);
  font-family: var(--font-sans);
  font-synthesis: none;
}

*,
*::before,
*::after {
  box-sizing: border-box;
}
html {
  scroll-behavior: smooth;
}
body {
  margin: 0;
  min-width: 20rem;
  background: var(--canvas);
  color: var(--ink);
}
img {
  display: block;
  max-width: 100%;
  height: auto;
}
button,
a {
  font: inherit;
}
a {
  color: inherit;
  text-underline-offset: 0.2em;
}
:focus-visible {
  outline: 3px solid var(--coral);
  outline-offset: 4px;
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
.skip-link {
  position: fixed;
  z-index: 100;
  top: 1rem;
  left: 1rem;
  transform: translateY(-200%);
  background: var(--ink);
  color: white;
  padding: 0.75rem 1rem;
}
.skip-link:focus {
  transform: translateY(0);
}
.enhanced-control {
  display: none;
}
.js .enhanced-control {
  display: flex;
}
.js .static-answer {
  display: none;
}
```

- [ ] **Step 2: Implement the accepted layout and component layers**

Implement the remaining CSS in this order so each layer can be compared against its concept:

1. Site header and two-row mobile navigation.
2. Twelve-column hero with large editorial heading and abstract route line.
3. Dark demo stage, route map, lesson illustration, answer controls, feedback, and pack metadata.
4. System layer diagram and product-language definition list.
5. Ruled contribution rows with responsive column alignment, not floating cards.
6. Status split, local-first boundary, final invitation, and footer.

Required layout contracts:

```css
.site-header,
main > section,
footer {
  width: min(100%, var(--content-width));
  margin-inline: auto;
  padding-inline: var(--page-gutter);
}
.hero {
  min-height: calc(100svh - 5rem);
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  align-items: center;
  border-bottom: 1px solid var(--rule);
}
.hero-copy {
  grid-column: 1 / span 7;
}
.hero h1 {
  max-width: 9ch;
  margin: 0;
  font-size: clamp(4rem, 8vw, 8.5rem);
  font-weight: 620;
  letter-spacing: -0.065em;
  line-height: 0.88;
}
.demo-section {
  padding-block: var(--section-space);
}
.demo-stage {
  min-height: 34rem;
  border-radius: var(--radius-medium);
  background: var(--midnight);
  color: white;
  overflow: clip;
}
.route-map {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  list-style: none;
  margin: 0 0 1.25rem;
  padding: 0;
}
.contribution-list > a {
  display: grid;
  grid-template-columns: 4rem minmax(12rem, 0.8fr) minmax(18rem, 1.2fr) auto;
  gap: 1.5rem;
  align-items: center;
  padding-block: 1.75rem;
  border-top: 1px solid var(--rule);
  text-decoration: none;
}
.status-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  border: 1px solid var(--rule);
}
```

Interactive state contracts:

```css
[data-route-node] {
  color: color-mix(in srgb, var(--ink) 50%, transparent);
}
[data-route-node][data-state='active'] {
  color: var(--cobalt);
}
[data-route-node][data-state='complete'] {
  color: var(--ink);
}
[data-route-node][data-state='complete'] span {
  background: var(--lime);
  border-color: var(--lime);
}
[data-demo-panel][hidden],
[data-feedback][hidden] {
  display: none;
}
.answer-grid button:hover,
.answer-grid button:focus-visible {
  border-color: var(--lime);
  color: var(--lime);
}
.feedback {
  border-left: 4px solid var(--coral);
}
```

- [ ] **Step 3: Add exact responsive and reduced-motion behavior**

```css
@media (max-width: 52rem) {
  .site-header {
    grid-template-columns: 1fr auto;
  }
  .site-header nav {
    grid-column: 1 / -1;
    display: flex;
    justify-content: space-between;
    border-top: 1px solid var(--rule);
  }
  .hero {
    min-height: auto;
    display: block;
    padding-block: 5rem;
  }
  .hero-copy {
    max-width: 46rem;
  }
  .hero h1 {
    font-size: clamp(3.5rem, 15vw, 6.5rem);
  }
  .hero-route {
    margin-top: 4rem;
    min-height: 12rem;
  }
  .system-map,
  .status-grid {
    grid-template-columns: 1fr;
  }
  .contribution-list > a {
    grid-template-columns: 3rem 1fr auto;
  }
  .contribution-list > a p {
    grid-column: 2 / -1;
  }
}

@media (max-width: 30rem) {
  .hero-actions,
  .demo-actions {
    align-items: stretch;
    flex-direction: column;
  }
  .button {
    width: 100%;
    justify-content: center;
  }
  .route-map {
    gap: 0.5rem;
    font-size: 0.75rem;
  }
  .first-contribution code {
    white-space: normal;
  }
}

@media (prefers-reduced-motion: reduce) {
  html {
    scroll-behavior: auto;
  }
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 4: Run formatting and website tests**

Run:

```powershell
npx prettier --write website/index.html website/styles.css website/main.js website/demo-model.js scripts/website-*.test.mjs
npm run test:website
npm run format:check
```

Expected: formatting and all website tests pass.

- [ ] **Step 5: Serve the site and compare desktop sections with concepts**

Run:

```powershell
py -3.11 -m http.server 4173 --directory website
```

Use Browser/IAB at `http://127.0.0.1:4173/`. Capture the hero/demo, system/contribute, and status/footer at the reference widths. Use `view_image` on each concept and each implementation screenshot. Fix type scale, grid, spacing, palette, borders, radii, route motif, illustration framing, and section rhythm until each comparison meets the frontend builder's agency-signoff bar.

- [ ] **Step 6: Commit the visual implementation**

```powershell
git add website/index.html website/styles.css
git diff --staged --check
git commit -m "feat: implement Concourse project site visual system"
```

### Task 6: Complete Browser Accessibility, Fallback, and Fidelity QA

**Files:**

- Modify: `website/index.html`, `website/styles.css`, or `website/main.js` only for failures found in this task.
- Modify: relevant `scripts/website-*.test.mjs` when a regression can be captured deterministically.

**Interfaces:**

- Consumes: the complete site and approved visual concepts.
- Produces: verified desktop/mobile behavior and a fidelity ledger.

- [ ] **Step 1: Exercise the complete interaction path in Browser/IAB**

At 1440×1000:

1. Activate “Explore the demo” and confirm focus reaches `#demo`.
2. Start the route.
3. Continue to recall.
4. Choose DNA and confirm visible and announced incorrect feedback.
5. Retry and choose Cell membrane.
6. Confirm pack reveal, `1 of 3` progress, and complete route node.
7. Use Back and Reset.
8. Open each in-page navigation link and verify the target is not obscured by the header.

Record any mismatch as: concept evidence, render evidence, fix, and final result.

- [ ] **Step 2: Verify responsive layouts**

Inspect and capture:

- 1024×768
- 768×1024
- 390×844
- 320×700

Confirm no horizontal page overflow, no clipped heading or CTA, no answer-control overlap, readable route labels, stable illustration crop, and touch targets at least 44 CSS pixels tall.

- [ ] **Step 3: Verify keyboard, zoom, and reduced motion**

Complete the demo using Tab, Shift+Tab, Enter, and Space only. Confirm focus visibility on canvas, cobalt, midnight, and lime surfaces. Inspect at browser 200% zoom and 320 CSS pixels. Emulate `prefers-reduced-motion: reduce` and confirm no route drawing, smooth scroll, or panel translation remains.

- [ ] **Step 4: Verify the no-JavaScript fallback**

Disable JavaScript in Browser/DevTools. If Browser/IAB cannot disable it reliably, state the limitation and use Playwright Chromium as the fallback for this check only. Confirm all four demo beats, the revealed correct answer, system story, contribution paths, and project status remain readable, while inert enhanced controls are hidden.

- [ ] **Step 5: Run the copy and icon audits**

Compare above-the-fold visible copy against the approved list:

```text
Concourse
Demo
System
Contribute
GitHub
Learning should have a route.
Concourse is an open-source, local-first system for building guided learning routes, practicing recall, and sharing portable course packs.
Explore the demo
View on GitHub
```

Inspect every arrow, route node, mark, and control affordance for consistent stroke/fill style, optical alignment, size, state color, and keyboard focus. Plain text arrows may remain only where the approved concept uses them as editorial link punctuation; directional controls use SVG or CSS geometry.

- [ ] **Step 6: Re-run automated checks after QA fixes**

Run:

```powershell
npm run test:website
npm run format:check
npm run lint
npm run typecheck
```

Expected: every command passes.

- [ ] **Step 7: Commit any QA repairs**

If files changed:

```powershell
git add website scripts/website-*.test.mjs
git diff --staged --check
git commit -m "fix: harden project site responsive accessibility"
```

If no files changed, do not create an empty commit.

### Task 7: Run the Full Gate and Prepare Safe Delivery

**Files:**

- No planned source changes.
- Modify only files required to fix a reproducible full-gate failure caused by this branch.

**Interfaces:**

- Produces: clean verified branch ready to push and integrate.

- [ ] **Step 1: Run complete repository verification**

Run:

```powershell
npm run verify
npm audit --omit=dev
cargo test --locked --manifest-path src-tauri/Cargo.toml
```

Expected: formatting, lint, website tests, all existing TypeScript tests, type checking, browser build, dependency audit, and Rust tests pass.

- [ ] **Step 2: Recheck budgets and tracked scope**

Run:

```powershell
$jsBytes = (Get-Item website/main.js).Length + (Get-Item website/demo-model.js).Length
$siteBytes = (Get-ChildItem website -Recurse -File | Measure-Object Length -Sum).Sum
"JavaScript bytes: $jsBytes"
"Uncompressed site bytes: $siteBytes"
if ($jsBytes -ge 20000) { throw 'JavaScript budget exceeded' }
git diff concourse/main...HEAD --stat
git status --short
```

Expected: JavaScript below 20 KB; changes limited to the spec, plan, `website/`, website test scripts, and `package.json`; clean working tree.

- [ ] **Step 3: Perform final concept-to-render inspection**

Use `view_image` on all four approved concept images and the latest matching browser screenshots in one QA pass. Write the final fidelity ledger with at least five comparison points covering copy, layout, typography, palette, route/asset treatment, spacing, responsive behavior, and motion. Fix every remaining agency-review issue before continuing.

- [ ] **Step 4: Review commit history and staged state**

Run:

```powershell
git log --oneline concourse/main..HEAD
git diff --check concourse/main...HEAD
git status --short --branch
```

Expected: scoped atomic commits, no whitespace errors, no staged or unstaged files.

- [ ] **Step 5: Push the verified branch**

Run:

```powershell
git push -u concourse codey/concourse-project-site
```

Expected: remote branch created successfully.

- [ ] **Step 6: Integrate and verify the canonical site only with explicit authority**

Use `superpowers:finishing-a-development-branch` to present merge/PR/keep options. Do not merge or alter `concourse/main` unless the user selects that path. After integration triggers the existing site deployment, open `https://concourse.conalhickey.com/`, verify the new hero copy and demo path, capture the live render, and confirm the canonical host rather than a preview URL. If deployment is external to the repository and unavailable, report the exact integration state without claiming the live site changed.

## Completion Evidence

The final handoff must include:

- Accepted concept image paths.
- Browser/IAB verification method or exact fallback reason.
- Desktop and mobile screenshot paths.
- Confirmation that `view_image` compared each concept with the final render.
- Fidelity ledger with at least five concrete comparison points.
- Above-the-fold copy diff result.
- Correct, incorrect, retry, Back, Reset, keyboard, reduced-motion, and no-JavaScript outcomes.
- JavaScript and total-site byte counts.
- `npm run verify`, `npm audit --omit=dev`, and Rust test results.
- Commit and pushed branch identifiers.
- Canonical deployment proof, or a precise statement that integration/deployment remains pending.
