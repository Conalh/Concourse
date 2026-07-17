# Concourse Activity Micro-Lessons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a concise, activity-specific microbiology lesson before each of the 13 required demo activities without changing routing, evidence, persistence, answers, or optional branches.

**Architecture:** Keep the authored lesson copy in `website/demo-course-data.json` as structured paragraph and segment data. Extend the framework-free renderer with one safe DOM helper that emits text nodes and semantic `<strong>` elements, then add a restrained inline teaching style and matching no-JavaScript emphasis.

**Tech Stack:** Static HTML and CSS, native browser DOM APIs, JSON modules, Node.js test runner, jsdom, Vite, GitHub CLI, and Cloudflare Wrangler.

## Global Constraints

- Exactly 13 required activities receive tailored micro-lessons.
- Each lesson contains one or two short paragraphs, 35-55 words total, and one to four emphasized vocabulary terms.
- Required lessons use structured `text` and `term` segments; do not add Markdown, authored HTML, a sanitizer, or a rich-text dependency.
- Render text with text nodes and terms with semantic `<strong>`; never use `innerHTML`.
- Teach the governing mechanism without copying the prompt or exposing the selected response.
- Support and extension activities keep their current chapter-model copy and receive no placeholder lessons.
- The delayed-retrieval lesson teaches systems reasoning and retrieval practice without exposing the earlier selected answer.
- Do not add a screen, click, disclosure, focus target, animation, card, icon, account, backend, analytics, or remote runtime dependency.
- Do not change the course graph, routing rules, evidence classifications, persistence, activity answers, pack editing, or recap behavior.
- Keep the typical required route within 15-20 minutes.
- Keep guided-course JavaScript below 90 KB and total website CSS below 80 KB uncompressed.
- Preserve the existing 320, 390, 768, 1024, and 1440 CSS-pixel responsive targets, reduced-motion behavior, heading order, and no-horizontal-overflow requirement.
- Publish only a clean, committed tree to the public `concourse` remote and verify the canonical production origin separately from the Pages deployment URL.

---

## File Map

- Modify `website/demo-course-data.json`: own the 13 authored teaching payloads.
- Modify `website/demo-pack.js`: project required teaching into the inspectable `items.json` pack document.
- Modify `website/demo-render.js`: render structured teaching safely and place it before each required activity form.
- Modify `website/demo.css`: style the teaching block as compact inline instruction.
- Modify `website/demo/index.html`: add semantic bold emphasis to the six existing no-JavaScript chapter explanations.
- Modify `scripts/website-demo.test.mjs`: enforce the authored teaching contract and editorial limits.
- Modify `scripts/website-runtime.test.mjs`: prove required, optional, retrieval, DOM-order, and safe-rendering behavior.
- Modify `scripts/website-styles.test.mjs`: lock the restrained, responsive teaching presentation.
- Modify `scripts/website-document.test.mjs`: require semantic emphasis in all six static explanations.
- Do not add dependencies or modify `package.json`; the existing `test:website` command already includes every affected test file.

### Task 1: Author and Validate the 13 Teaching Payloads

**Files:**

- Modify: `scripts/website-demo.test.mjs:36-57,264-282`
- Modify: `website/demo-course-data.json:6-454`
- Modify: `website/demo-pack.js:104-123`

**Interfaces:**

- Consumes: `REQUIRED_ACTIVITY_IDS`, `SUPPORT_NODE_IDS`, `EXTENSION_NODE_IDS`, and `getActivity(activityId)`.
- Produces: `activity.teaching: Array<{ segments: Array<{ kind: 'text' | 'term'; text: string }> }>` on exactly the 13 required activities.
- Produces: the identical structured `teaching` payload on each corresponding required item in the generated `items.json` pack source.
- Invariant: joining segment text in authored order yields the visible lesson verbatim.

- [ ] **Step 1: Add helpers and the failing authored-content contract test**

Insert these helpers below `NOW` in `scripts/website-demo.test.mjs`:

```js
const TEACHING_SEGMENT_KINDS = new Set(['text', 'term'])

function teachingText(activity) {
  return activity.teaching
    .map(({ segments }) => segments.map(({ text }) => text).join(''))
    .join('\n')
}

function wordCount(value) {
  return value.trim().split(/\s+/u).length
}
```

Add this test immediately after `defines the complete bacterial-survival course`:

```js
test('gives every required activity a concise structured micro-lesson', () => {
  const lessons = REQUIRED_ACTIVITY_IDS.map((activityId) => {
    const activity = getActivity(activityId)
    assert.ok(Array.isArray(activity.teaching), activityId + ' needs teaching')
    assert.ok(
      activity.teaching.length >= 1 && activity.teaching.length <= 2,
      activityId + ' must contain one or two paragraphs',
    )

    const segments = activity.teaching.flatMap(({ segments }) => {
      assert.ok(Array.isArray(segments) && segments.length > 0)
      return segments
    })
    const text = teachingText(activity)
    const terms = segments.filter(({ kind }) => kind === 'term')

    assert.ok(wordCount(text) >= 35 && wordCount(text) <= 55, activityId)
    assert.ok(terms.length >= 1 && terms.length <= 4, activityId)
    assert.doesNotMatch(text, / {2,}/u)
    assert.match(text, /[.!?]$/u)
    for (const segment of segments) {
      assert.ok(TEACHING_SEGMENT_KINDS.has(segment.kind), activityId)
      assert.equal(typeof segment.text, 'string')
      assert.ok(segment.text.trim().length > 0, activityId)
      assert.doesNotMatch(segment.text, /<\/?[a-z][^>]*>|\*\*|__/iu)
    }

    return text
  })

  assert.equal(new Set(lessons).size, REQUIRED_ACTIVITY_IDS.length)
  const packItems = createSourceDocuments()['items.json'].items
  for (const activityId of [...SUPPORT_NODE_IDS, ...EXTENSION_NODE_IDS]) {
    assert.equal(getActivity(activityId).teaching, undefined)
    assert.equal(
      packItems.find(({ itemId }) => itemId === activityId).teaching,
      undefined,
    )
  }
  for (const activityId of REQUIRED_ACTIVITY_IDS) {
    assert.deepEqual(
      packItems.find(({ itemId }) => itemId === activityId).teaching,
      getActivity(activityId).teaching,
    )
  }

  const retrievalLesson = teachingText(getActivity('antibiotic-retrieval'))
  const retrievalTokens = retrievalLesson.toLowerCase().split(/[^a-z0-9-]+/u)
  for (const conceptId of [
    'membrane-permeability',
    'cell-envelope',
    'concentration-gradient',
    'transport-proteins',
    'osmosis',
    'energy-coupling',
    'gene-expression',
  ]) {
    const selectedResponse = String(
      retrievalActivityForConcept(conceptId).correctResponse,
    ).toLowerCase()
    assert.equal(retrievalTokens.includes(selectedResponse), false)
  }
})
```

- [ ] **Step 2: Run the focused test and verify the red state**

Run:

```powershell
node --test scripts/website-demo.test.mjs
```

Expected: FAIL in `gives every required activity a concise structured micro-lesson` with `boundary-permeability needs teaching`.

- [ ] **Step 3: Add the exact teaching payloads**

For each named activity in `website/demo-course-data.json`, add the corresponding `teaching` field after `conceptId`. Keep each lesson as one paragraph and preserve this exact segment order.

`boundary-permeability`:

```json
"teaching": [
  {
    "segments": [
      { "kind": "text", "text": "The " },
      { "kind": "term", "text": "cell membrane" },
      { "kind": "text", "text": " is " },
      { "kind": "term", "text": "selectively permeable" },
      {
        "kind": "text",
        "text": ": its lipid core lets some substances cross more readily than others. "
      },
      { "kind": "term", "text": "Small nonpolar molecules" },
      {
        "kind": "text",
        "text": " usually pass directly more easily, while "
      },
      { "kind": "term", "text": "charged ions" },
      {
        "kind": "text",
        "text": " and large polar molecules usually need a protein pathway. Compare size, polarity, and charge before predicting passage."
      }
    ]
  }
]
```

`boundary-structure`:

```json
"teaching": [
  {
    "segments": [
      { "kind": "text", "text": "A bacterial " },
      { "kind": "term", "text": "cell envelope" },
      {
        "kind": "text",
        "text": " combines structures with different jobs. The "
      },
      { "kind": "term", "text": "cell membrane" },
      {
        "kind": "text",
        "text": " regulates what enters and leaves, helping maintain a controlled interior. The "
      },
      { "kind": "term", "text": "cell wall" },
      { "kind": "text", "text": " sits outside it and bears " },
      { "kind": "term", "text": "mechanical stress" },
      {
        "kind": "text",
        "text": ". When reasoning about survival, separate control of passage from resistance to swelling."
      }
    ]
  }
]
```

`transport-gradient`:

```json
"teaching": [
  {
    "segments": [
      { "kind": "text", "text": "A " },
      { "kind": "term", "text": "concentration gradient" },
      {
        "kind": "text",
        "text": " is a difference in the amount of a substance between two regions. Random molecular motion occurs in both directions, but "
      },
      { "kind": "term", "text": "net diffusion" },
      { "kind": "text", "text": " favors the direction from " },
      { "kind": "term", "text": "higher concentration" },
      { "kind": "text", "text": " toward " },
      { "kind": "term", "text": "lower concentration" },
      {
        "kind": "text",
        "text": " until the difference becomes smaller."
      }
    ]
  }
]
```

`transport-mechanism`:

```json
"teaching": [
  {
    "segments": [
      { "kind": "text", "text": "The membrane's " },
      { "kind": "term", "text": "lipid core" },
      {
        "kind": "text",
        "text": " resists most ions and many polar nutrients. "
      },
      { "kind": "term", "text": "Transport proteins" },
      { "kind": "text", "text": " create selective routes: " },
      { "kind": "term", "text": "channels" },
      {
        "kind": "text",
        "text": " form hydrophilic passages, while "
      },
      { "kind": "term", "text": "carriers" },
      {
        "kind": "text",
        "text": " bind particular substances and change shape. The substance's chemistry and the protein's mechanism together determine which route fits."
      }
    ]
  }
]
```

`osmosis-water`:

```json
"teaching": [
  {
    "segments": [
      { "kind": "term", "text": "Osmosis" },
      { "kind": "text", "text": " describes water crossing a " },
      { "kind": "term", "text": "selectively permeable membrane" },
      {
        "kind": "text",
        "text": ". Water molecules move in both directions, but "
      },
      { "kind": "term", "text": "net movement" },
      { "kind": "text", "text": " depends on relative " },
      { "kind": "term", "text": "solute concentration" },
      {
        "kind": "text",
        "text": ". A side with more dissolved solute has less freely available water, so compare the two environments before predicting the overall flow."
      }
    ]
  }
]
```

`osmosis-response`:

```json
"teaching": [
  {
    "segments": [
      { "kind": "term", "text": "Osmotic stress" },
      {
        "kind": "text",
        "text": " changes a bacterium's water balance. "
      },
      { "kind": "term", "text": "Net water loss" },
      {
        "kind": "text",
        "text": " reduces cell volume and can crowd internal components; "
      },
      { "kind": "term", "text": "net water entry" },
      {
        "kind": "text",
        "text": " increases internal pressure. The "
      },
      { "kind": "term", "text": "cell wall" },
      {
        "kind": "text",
        "text": " helps resist expansion, but it does not decide water's direction across the membrane."
      }
    ]
  }
]
```

`energy-classify`:

```json
"teaching": [
  {
    "segments": [
      { "kind": "text", "text": "Transport is " },
      { "kind": "term", "text": "passive" },
      {
        "kind": "text",
        "text": " when net movement follows a "
      },
      { "kind": "term", "text": "favorable gradient" },
      {
        "kind": "text",
        "text": " without an added energy source. Moving against a substance's gradient requires "
      },
      { "kind": "term", "text": "energy coupling" },
      {
        "kind": "text",
        "text": ", which can come directly from chemical reactions or indirectly from another "
      },
      { "kind": "term", "text": "ion gradient" },
      {
        "kind": "text",
        "text": ". Judge the direction first, then ask what powers it."
      }
    ]
  }
]
```

`energy-scarce-nutrient`:

```json
"teaching": [
  {
    "segments": [
      { "kind": "term", "text": "Active transport" },
      {
        "kind": "text",
        "text": " can accumulate a substance where it is already more concentrated. A transporter must couple that "
      },
      { "kind": "term", "text": "uphill movement" },
      { "kind": "text", "text": " to a usable " },
      { "kind": "term", "text": "energy source" },
      {
        "kind": "text",
        "text": ", such as a chemical reaction or an existing "
      },
      { "kind": "term", "text": "ion gradient" },
      {
        "kind": "text",
        "text": ". The transported nutrient does not supply the needed push by simple diffusion."
      }
    ]
  }
]
```

`response-sequence`:

```json
"teaching": [
  {
    "segments": [
      { "kind": "term", "text": "Gene expression" },
      {
        "kind": "text",
        "text": " links stored information to cellular work. In this instructional model, "
      },
      { "kind": "term", "text": "DNA" },
      { "kind": "text", "text": " holds a gene, " },
      { "kind": "term", "text": "RNA" },
      {
        "kind": "text",
        "text": " carries an expressed message, and a "
      },
      { "kind": "term", "text": "ribosome" },
      {
        "kind": "text",
        "text": " reads that message while assembling a protein. The sequence explains information flow without representing every regulatory step."
      }
    ]
  }
]
```

`response-transporter`:

```json
"teaching": [
  {
    "segments": [
      {
        "kind": "text",
        "text": "Cells adjust behavior by changing which "
      },
      { "kind": "term", "text": "genes" },
      {
        "kind": "text",
        "text": " are expressed. When a transport gene is expressed more often, additional "
      },
      { "kind": "term", "text": "RNA messages" },
      {
        "kind": "text",
        "text": " can be produced and "
      },
      { "kind": "term", "text": "ribosomes" },
      {
        "kind": "text",
        "text": " can assemble more copies of its protein. Existing DNA remains the instruction source; "
      },
      { "kind": "term", "text": "expression" },
      {
        "kind": "text",
        "text": " changes use of that information."
      }
    ]
  }
]
```

`antibiotic-targets`:

```json
"teaching": [
  {
    "segments": [
      { "kind": "text", "text": "An " },
      { "kind": "term", "text": "antibiotic target" },
      {
        "kind": "text",
        "text": " is the cellular structure or process a drug mechanism disrupts. Damaging "
      },
      { "kind": "term", "text": "cell-wall assembly" },
      {
        "kind": "text",
        "text": " weakens structural support; disturbing the "
      },
      { "kind": "term", "text": "membrane" },
      {
        "kind": "text",
        "text": " undermines controlled gradients; blocking "
      },
      { "kind": "term", "text": "ribosome function" },
      {
        "kind": "text",
        "text": " interrupts protein production. Matching target to process predicts the first cellular failure, not a treatment outcome."
      }
    ]
  }
]
```

`antibiotic-consequence`:

```json
"teaching": [
  {
    "segments": [
      { "kind": "term", "text": "Translation" },
      {
        "kind": "text",
        "text": " is the process in which a "
      },
      { "kind": "term", "text": "ribosome" },
      { "kind": "text", "text": " reads " },
      { "kind": "term", "text": "RNA" },
      {
        "kind": "text",
        "text": " and assembles a protein. If ribosome function is blocked, the cell cannot complete normal translation for newly needed proteins. Follow the interrupted process to its immediate product before considering broader "
      },
      { "kind": "term", "text": "downstream effects" },
      { "kind": "text", "text": "." }
    ]
  }
]
```

`antibiotic-retrieval`:

```json
"teaching": [
  {
    "segments": [
      { "kind": "term", "text": "Systems reasoning" },
      {
        "kind": "text",
        "text": " connects an interrupted process to what happens next. "
      },
      { "kind": "term", "text": "Retrieval practice" },
      {
        "kind": "text",
        "text": " strengthens that connection by asking you to reconstruct an earlier mechanism from memory. Identify the "
      },
      { "kind": "term", "text": "affected process" },
      {
        "kind": "text",
        "text": ", recall its normal role, and trace one "
      },
      { "kind": "term", "text": "consequence" },
      {
        "kind": "text",
        "text": " without relying on the answer you selected earlier."
      }
    ]
  }
]
```

In `website/demo-pack.js`, add this conditional field immediately after the item `title` so required teaching appears in the exact source document shown by the pack inspector while optional items remain unchanged:

```js
...(activity.teaching === undefined
  ? {}
  : { teaching: activity.teaching }),
```

- [ ] **Step 4: Run content, pack-projection, and complete website tests**

Run:

```powershell
node --test scripts/website-demo.test.mjs
npm run test:website
```

Expected: both commands PASS; the new test reports 13 unique valid lessons, proves the delayed-retrieval copy contains no possible selected response, verifies exact `items.json` projection, and leaves every existing website test green.

- [ ] **Step 5: Format and commit the authored content**

Run:

```powershell
npx prettier --write website/demo-course-data.json website/demo-pack.js scripts/website-demo.test.mjs
git add website/demo-course-data.json website/demo-pack.js scripts/website-demo.test.mjs
git diff --staged --check
git commit -m "feat: author activity micro-lessons"
```

Expected: Prettier is clean and the commit contains only the course data, pack projection, and their contract test.

### Task 2: Render Required Lessons Safely and Preserve Optional Copy

**Files:**

- Modify: `scripts/website-runtime.test.mjs:6-14,113-235,400-454`
- Modify: `website/demo-render.js:18-35,184-244`

**Interfaces:**

- Consumes: the Task 1 `activity.teaching` payload.
- Produces: `renderTeachingBlock(documentRoot, teaching) -> HTMLElement`.
- DOM contract: `section.activity-teaching[data-activity-teaching]` contains `h3#activity-key-idea-title` followed by one or two paragraphs; it appears before `form[data-course-activity]`.
- Optional-node contract: support and extension headers continue to render `chapter.model` and do not render `[data-activity-teaching]`.

- [ ] **Step 1: Add failing runtime tests for required, optional, and hostile authored text**

Add `REQUIRED_ACTIVITY_IDS` to the import from `demo-course.js`, and add:

```js
import { renderTeachingBlock } from '../website/demo-render.js'
```

Insert these tests after `starts a new course and persists the first node`:

```js
test('renders each required key idea before its activity form', () => {
  for (const activityId of REQUIRED_ACTIVITY_IDS) {
    const seededState = advanceCourseTo(activityId)
    const { document, window, controller } = setupCourse({ seededState })
    click(document, '[data-course-action="resume"]')

    const activity = getActivity(activityId)
    const teaching = document.querySelector('[data-activity-teaching]')
    const form = document.querySelector('[data-course-activity]')
    const renderedText = [...teaching.querySelectorAll('p')]
      .map((paragraph) => paragraph.textContent)
      .join('\n')
    const authoredText = activity.teaching
      .map(({ segments }) => segments.map(({ text }) => text).join(''))
      .join('\n')

    assert.equal(teaching.querySelector('h3').textContent, 'Key idea')
    assert.equal(
      teaching.getAttribute('aria-labelledby'),
      'activity-key-idea-title',
    )
    assert.deepEqual(
      [
        ...document
          .querySelector('[data-course-stage]')
          .querySelectorAll('h2, h3'),
      ].map(({ tagName }) => tagName),
      ['H2', 'H3'],
    )
    assert.equal(renderedText, authoredText)
    assert.equal(
      teaching.querySelectorAll('strong').length,
      activity.teaching
        .flatMap(({ segments }) => segments)
        .filter(({ kind }) => kind === 'term').length,
    )
    assert.ok(
      teaching.compareDocumentPosition(form) &
        window.Node.DOCUMENT_POSITION_FOLLOWING,
    )
    controller.destroy()
  }
})

test('keeps chapter context for optional branches without a key idea block', () => {
  let state = transitionCourse(createCourseState(NOW), { type: 'start' }, NOW)
  state = transitionCourse(
    state,
    {
      type: 'submit-response',
      nodeId: 'boundary-permeability',
      response: ['sodium'],
      confidence: 'high',
    },
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
  state = transitionCourse(
    state,
    { type: 'take-branch', nodeId: 'support-charge-size' },
    NOW,
  )

  const { document, controller } = setupCourse({ seededState: state })
  click(document, '[data-course-action="resume"]')

  assert.equal(document.querySelector('[data-activity-teaching]'), null)
  assert.match(
    document.querySelector('.activity-heading > p:last-child').textContent,
    /lipid membrane/i,
  )
  controller.destroy()
})

test('renders authored tag-like teaching as inert text', () => {
  const dom = new JSDOM('<!doctype html><body></body>')
  const teaching = renderTeachingBlock(dom.window.document, [
    {
      segments: [
        { kind: 'text', text: '<img src=x onerror=alert(1)> remains ' },
        { kind: 'term', text: 'inert text' },
        { kind: 'text', text: '.' },
      ],
    },
  ])

  assert.equal(teaching.querySelector('img'), null)
  assert.match(teaching.textContent, /<img src=x onerror=alert\(1\)>/)
  assert.equal(teaching.querySelector('strong').textContent, 'inert text')
})
```

- [ ] **Step 2: Run the runtime test and verify all three red assertions**

Run:

```powershell
node --test scripts/website-runtime.test.mjs
```

Expected: FAIL because `renderTeachingBlock` is not exported and required stages have no `[data-activity-teaching]`.

- [ ] **Step 3: Add the minimal safe teaching renderer**

Add this export immediately after `el` in `website/demo-render.js`:

```js
export function renderTeachingBlock(documentRoot, teaching) {
  const section = el(documentRoot, 'section', {
    className: 'activity-teaching',
    'data-activity-teaching': '',
    'aria-labelledby': 'activity-key-idea-title',
  })
  section.append(
    el(documentRoot, 'h3', { id: 'activity-key-idea-title' }, 'Key idea'),
  )

  for (const { segments } of teaching) {
    const paragraph = el(documentRoot, 'p')
    for (const segment of segments) {
      paragraph.append(
        segment.kind === 'term'
          ? el(documentRoot, 'strong', {}, segment.text)
          : documentRoot.createTextNode(segment.text),
      )
    }
    section.append(paragraph)
  }

  return section
}
```

Replace the current activity-header construction in `renderActivityStage` with:

```js
const header = el(documentRoot, 'header', { className: 'activity-heading' })
header.append(
  el(
    documentRoot,
    'p',
    { className: 'eyebrow' },
    node.required
      ? `Chapter ${chapter.number} · ${chapter.kicker}`
      : `${node.kind === 'support' ? 'Support bridge' : 'Optional extension'} · ${chapter.title}`,
  ),
  el(documentRoot, 'h2', {}, node.required ? chapter.title : node.title),
)
if (!node.required) {
  header.append(el(documentRoot, 'p', {}, chapter.model))
}
stage.append(header)

if (node.required) {
  stage.append(renderTeachingBlock(documentRoot, activity.teaching))
}
```

Leave the existing delayed-retrieval block immediately after this code. It will therefore remain between the lesson and the form.

- [ ] **Step 4: Run the runtime and complete website suites**

Run:

```powershell
node --test scripts/website-runtime.test.mjs
npm run test:website
```

Expected: PASS. Required activities render their own lessons, optional activities retain chapter context, the hostile string remains text, retrieval still selects its earlier concept, and all route/evidence behavior remains unchanged.

- [ ] **Step 5: Format and commit the renderer**

Run:

```powershell
npx prettier --write website/demo-render.js scripts/website-runtime.test.mjs
git add website/demo-render.js scripts/website-runtime.test.mjs
git diff --staged --check
git commit -m "feat: render semantic activity teaching"
```

Expected: the commit contains only the safe renderer and runtime coverage.

### Task 3: Style the Teaching Block and Strengthen the Static Fallback

**Files:**

- Modify: `scripts/website-styles.test.mjs:99-130`
- Modify: `scripts/website-document.test.mjs:106-132`
- Modify: `website/demo.css:327-367`
- Modify: `website/demo/index.html:110-201`

**Interfaces:**

- Consumes: Task 2's `.activity-teaching` DOM.
- Produces: a max-42-rem inline reading block with a lime left rule, semantic heading, readable body copy, and no card treatment.
- Static contract: each of the six no-JavaScript chapter explanations contains at least two `<strong>` terms while retaining its existing text and representative-answer disclosure.

- [ ] **Step 1: Add failing CSS and static-document tests**

Add to `scripts/website-styles.test.mjs` after `makes route states textual and pack overflow internal`:

```js
test('styles key ideas as compact inline teaching rather than cards', () => {
  const teaching = ruleBody('.activity-teaching')
  assert.match(teaching, /max-width:\s*42rem;/)
  assert.match(teaching, /border-left:\s*3px solid var\(--lime\);/)
  assert.doesNotMatch(teaching, /background|border-radius|box-shadow/)
  assert.match(ruleBody('.activity-teaching p'), /line-height:\s*1\.6;/)
  assert.match(
    ruleBody('.activity-teaching strong'),
    /color:\s*var\(--paper\);/,
  )
})
```

Extend `provides the complete six-chapter no-JavaScript course` in `scripts/website-document.test.mjs` with:

```js
const staticExplanations = staticCourse.querySelectorAll(
  '.static-chapters > li > p',
)
assert.equal(staticExplanations.length, 6)
for (const explanation of staticExplanations) {
  assert.ok(explanation.querySelectorAll('strong').length >= 2)
}
```

- [ ] **Step 2: Run the two focused files and verify the red state**

Run:

```powershell
node --test scripts/website-styles.test.mjs scripts/website-document.test.mjs
```

Expected: FAIL because `.activity-teaching` has no CSS rule and the six static explanations currently contain no required semantic emphasis.

- [ ] **Step 3: Add the restrained teaching styles**

Insert after `.activity-heading > p:last-child` in `website/demo.css`:

```css
.activity-teaching {
  max-width: 42rem;
  margin: 1.25rem 0 0;
  padding: 0.15rem 0 0.15rem 1rem;
  border-left: 3px solid var(--lime);
}

.activity-teaching h3 {
  margin: 0;
  color: var(--lime);
  font-family: var(--font-mono);
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  line-height: 1.2;
  text-transform: uppercase;
}

.activity-teaching p {
  margin: 0.65rem 0 0;
  color: #dce4f0;
  line-height: 1.6;
}

.activity-teaching strong {
  color: var(--paper);
  font-weight: 700;
}
```

Do not add a background, shadow, radius, icon, motion, hover state, or breakpoint-specific width.

- [ ] **Step 4: Add semantic emphasis to all six static explanations**

Replace only the six explanation paragraphs in `website/demo/index.html` with:

```html
<p>
  The <strong>cell membrane</strong> controls molecular passage; the
  <strong>cell wall</strong> primarily resists mechanical and osmotic stress.
  <strong>Small nonpolar oxygen</strong> crosses the lipid bilayer more readily
  than glucose or a charged sodium ion.
</p>
```

```html
<p>
  <strong>Diffusion</strong> describes <strong>net movement</strong> from higher
  concentration to lower concentration. <strong>Channels</strong> and
  <strong>carriers</strong> give selected substances paths through the membrane.
</p>
```

```html
<p>
  In <strong>osmosis</strong>, water moves both ways while the
  <strong>net movement</strong> follows relative water availability. A saltier
  exterior produces net water loss; a dilute exterior produces net water entry
  and the <strong>cell wall</strong> helps resist expansion.
</p>
```

```html
<p>
  Down-gradient transport can be <strong>passive</strong>. Accumulating a scarce
  nutrient <strong>against its gradient</strong> requires an
  <strong>energy-coupled process</strong>, though the transporter need not use
  ATP directly.
</p>
```

```html
<p>
  <strong>DNA</strong> stores an instruction, <strong>RNA</strong> carries an
  expressed message, and a <strong>ribosome</strong> reads the message while
  assembling a <strong>protein</strong>. This useful model leaves out more
  complex regulation.
</p>
```

```html
<p>
  Simplified antibiotic targets include <strong>cell-wall assembly</strong>,
  <strong>membrane integrity</strong>, and <strong>ribosome function</strong>. A
  ribosome-targeting mechanism disrupts normal production of a new transport
  protein. This is not treatment guidance.
</p>
```

- [ ] **Step 5: Run focused and complete website verification**

Run:

```powershell
node --test scripts/website-styles.test.mjs scripts/website-document.test.mjs
npm run test:website
```

Expected: PASS. The static copy is unchanged except for semantic element boundaries, all six explanations have emphasized vocabulary, and no layout or document regression appears.

- [ ] **Step 6: Format and commit presentation and fallback**

Run:

```powershell
npx prettier --write website/demo.css website/demo/index.html scripts/website-styles.test.mjs scripts/website-document.test.mjs
git add website/demo.css website/demo/index.html scripts/website-styles.test.mjs scripts/website-document.test.mjs
git diff --staged --check
git commit -m "feat: present concise lesson key ideas"
```

Expected: the commit contains only teaching presentation, fallback emphasis, and their tests.

### Task 4: Verify, Publish, and Prove the Canonical Site

**Files:**

- Modify only if a test or browser check exposes a concrete defect: `website/demo-course-data.json`, `website/demo-pack.js`, `website/demo-render.js`, `website/demo.css`, `website/demo/index.html`, or the directly corresponding `scripts/website-*.test.mjs`.
- Do not modify generated output or unrelated application files.

**Interfaces:**

- Consumes: the three implementation commits from Tasks 1-3.
- Produces: passing repository gates, responsive real-browser evidence, a pushed `concourse/main`, a Cloudflare Pages deployment tied to the exact commit, and canonical live proof.
- Required sub-skill for the browser portion: `browser-testing-with-devtools`.

- [ ] **Step 1: Run the strongest local automated gates**

Run:

```powershell
npm run verify
npm audit --omit=dev
cargo test --locked --manifest-path src-tauri/Cargo.toml
```

Expected: format, lint, package tests, website tests, TypeScript tests, type checking, production build, dependency audit, and Rust tests all PASS with zero audit vulnerabilities.

- [ ] **Step 2: Recheck budgets and implementation scope**

Run:

```powershell
$websiteFiles = Get-ChildItem -LiteralPath website -Recurse -File
$jsBytes = ($websiteFiles | Where-Object Extension -eq '.js' | Measure-Object Length -Sum).Sum
$cssBytes = ($websiteFiles | Where-Object Extension -eq '.css' | Measure-Object Length -Sum).Sum
Write-Output "Website JavaScript bytes: $jsBytes"
Write-Output "Website CSS bytes: $cssBytes"
if ($jsBytes -ge 92160) { throw '90 KB JavaScript budget exceeded' }
if ($cssBytes -ge 81920) { throw '80 KB CSS budget exceeded' }
git diff concourse/main...HEAD --stat
git status --short
```

Expected: JavaScript remains below 92,160 bytes, CSS remains below 81,920 bytes, the diff is limited to the approved design/plan and the nine implementation/test files, and the working tree is clean.

- [ ] **Step 3: Start an isolated local Vite server**

Run:

```powershell
$server = Start-Process -FilePath 'py.exe' -ArgumentList '-3.11','-m','http.server','4174','--directory','website' -WorkingDirectory 'C:\Projects\Learning\Concourse-Main' -WindowStyle Hidden -PassThru
Invoke-WebRequest -UseBasicParsing 'http://127.0.0.1:4174/demo/' | Select-Object StatusCode
```

Expected: HTTP 200. Record `$server.Id` and stop only that process after browser verification with `Stop-Process -Id $server.Id`.

- [ ] **Step 4: Verify representative lessons in a real browser**

Use the browser-testing skill at `http://127.0.0.1:4174/demo/`. Check the first required activity, `energy-classify`, and `antibiotic-retrieval`. Use the existing controls to advance; do not inject state or bypass the UI.

At each representative activity:

- Confirm the visible order is chapter heading, **Key idea**, retrieval context when applicable, then prompt and controls.
- Confirm every emphasized term is a real `<strong>` descendant of `[data-activity-teaching]`.
- Confirm the lesson text is brief, fully visible, and does not disclose a selected radio/select value.
- Confirm keyboard focus still enters the first activity control after a transition.
- Confirm support/extension nodes retain chapter context rather than the required lesson block.

At viewport widths 320, 390, 768, 1024, and 1440 CSS pixels, evaluate:

```js
;({
  viewport: window.innerWidth,
  documentWidth: document.documentElement.scrollWidth,
  noHorizontalOverflow:
    document.documentElement.scrollWidth <=
    document.documentElement.clientWidth,
  keyIdeaVisible:
    document.querySelector('[data-activity-teaching]')?.getBoundingClientRect()
      .height > 0,
  keyIdeaBeforeForm: Boolean(
    document
      .querySelector('[data-activity-teaching]')
      ?.compareDocumentPosition(
        document.querySelector('[data-course-activity]'),
      ) & Node.DOCUMENT_POSITION_FOLLOWING,
  ),
})
```

Expected at every width: `noHorizontalOverflow`, `keyIdeaVisible`, and `keyIdeaBeforeForm` are `true`. The browser console has zero errors and the network log contains no request leaving the local origin.

Finally, disable JavaScript and reload at 390 CSS pixels. Confirm the interactive entry is absent, all six static chapter explanations are visible, each explanation contains semantic bold vocabulary, representative-answer disclosures remain keyboard operable, and the document has no horizontal overflow.

- [ ] **Step 5: Fix and commit only concrete QA regressions**

If Step 4 exposes a defect, first add the narrowest deterministic regression assertion to the corresponding existing test file, verify it fails, apply the minimal fix, rerun `npm run test:website`, then commit:

```powershell
npx prettier --write website/demo-course-data.json website/demo-pack.js website/demo-render.js website/demo.css website/demo/index.html scripts/website-demo.test.mjs scripts/website-runtime.test.mjs scripts/website-styles.test.mjs scripts/website-document.test.mjs
npm run test:website
git add website/demo-course-data.json website/demo-pack.js website/demo-render.js website/demo.css website/demo/index.html scripts/website-demo.test.mjs scripts/website-runtime.test.mjs scripts/website-styles.test.mjs scripts/website-document.test.mjs
git diff --staged --check
git commit -m "fix: harden activity micro-lessons"
```

If Step 4 finds no defect, do not create an empty commit.

- [ ] **Step 6: Push the exact verified commit to the public default branch**

Run:

```powershell
$commit = git rev-parse HEAD
git status --short
git push concourse HEAD:main
$remote = git ls-remote concourse refs/heads/main
Write-Output "Expected commit: $commit"
Write-Output "Remote main: $remote"
```

Expected: the tree is clean, the push succeeds, and `concourse/main` resolves to `$commit`.

- [ ] **Step 7: Watch GitHub CI to completion**

Run:

```powershell
$commit = git rev-parse HEAD
$runId = gh run list --repo Conalh/Concourse --commit $commit --workflow CI --limit 1 --json databaseId --jq '.[0].databaseId'
gh run watch $runId --repo Conalh/Concourse --exit-status
gh run view $runId --repo Conalh/Concourse --json status,conclusion,url
```

Expected: both `web-and-packages` and `desktop-core` complete successfully and the workflow conclusion is `success`.

- [ ] **Step 8: Deploy the committed website directory to Cloudflare Pages**

Run only after CI is green:

```powershell
$commit = git rev-parse HEAD
$message = git log -1 --pretty=%s
npx --yes wrangler@latest pages deploy website --project-name concourse --branch main --commit-hash $commit --commit-message $message --commit-dirty=false
```

Expected: Wrangler reports a successful production deployment for project `concourse` and returns a Pages deployment URL tied to the verified commit.

- [ ] **Step 9: Verify the deployment URL and canonical production origin separately**

Open both the returned Pages URL and `https://concourse.conalhickey.com/demo/`. On each origin:

- hard-refresh and start the course;
- confirm the first **Key idea** contains semantic bold terms;
- confirm no horizontal overflow at 390 and 1440 CSS pixels;
- confirm console errors are zero and all runtime requests remain same-origin;
- confirm the canonical page source includes the current deployed lesson copy.

Run the independent HTTP checks:

```powershell
$canonical = Invoke-WebRequest -UseBasicParsing 'https://concourse.conalhickey.com/demo/'
$courseData = Invoke-WebRequest -UseBasicParsing 'https://concourse.conalhickey.com/demo-course-data.json'
Write-Output $canonical.StatusCode
Write-Output $courseData.StatusCode
if ($canonical.Content -notmatch 'Read the complete required route') {
  throw 'Canonical demo returned unexpected HTML'
}
if (
  $courseData.Content -notmatch '"teaching"' -or
  $courseData.Content -notmatch 'Systems reasoning'
) {
  throw 'Canonical course data is not the verified micro-lesson release'
}
```

Expected: both hosts return HTTP 200, the new lesson UI works on both, and the canonical host is not inferred from the preview result.

- [ ] **Step 10: Record final evidence**

The implementation handoff must state:

- final commit SHA and `concourse/main` equality;
- Task 1-3 commit SHAs;
- website test count and full `npm run verify` result;
- dependency audit and Rust test results;
- final JavaScript and CSS byte counts;
- viewport results for 320, 390, 768, 1024, and 1440;
- first, middle, delayed-retrieval, optional-branch, keyboard, overflow, console, and network outcomes;
- GitHub Actions run URL;
- Cloudflare deployment URL or ID;
- canonical `https://concourse.conalhickey.com/demo/` HTTP and browser proof.

## Completion Boundary

This plan is complete only when the 13 lessons are authored and rendered, all automated and browser checks pass, `concourse/main` contains the exact verified commit, Cloudflare Pages has deployed that commit, and the canonical demo independently shows the new teaching blocks. A local patch, green unit test, successful push, or preview URL alone is not completion.
