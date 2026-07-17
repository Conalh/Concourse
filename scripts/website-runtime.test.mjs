import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { JSDOM } from 'jsdom'

import {
  REQUIRED_ACTIVITY_IDS,
  getActivity,
  getCourseNode,
  retrievalActivityForConcept,
} from '../website/demo-course.js'
import { createCourseState, transitionCourse } from '../website/demo-model.js'
import * as demoRender from '../website/demo-render.js'
import { mountCourse } from '../website/main.js'
import { selectRetrievalConcept } from '../website/demo-routing.js'
import { saveCourseState, STORAGE_KEY } from '../website/demo-storage.js'

const NOW = '2026-07-16T20:00:00.000Z'
const html = await readFile(
  new URL('../website/demo/index.html', import.meta.url),
  'utf8',
)

function createMemoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial))
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  }
}

function click(document, selector) {
  const control = document.querySelector(selector)
  assert.ok(control, `missing ${selector}`)
  control.click()
}

function advanceCourseTo(nodeId) {
  let state = transitionCourse(createCourseState(NOW), { type: 'start' }, NOW)
  while (state.currentNodeId !== nodeId) {
    const currentNode = getCourseNode(state.currentNodeId)
    const activity = getActivity(currentNode.activityId)
    state = transitionCourse(
      state,
      {
        type: 'submit-response',
        nodeId: activity.activityId,
        response: activity.correctResponse,
        confidence: 'high',
      },
      NOW,
    )
    state = transitionCourse(
      state,
      { type: 'advance-course', nextNodeId: currentNode.nextCoreNodeId },
      NOW,
    )
  }
  return state
}

function setupCourse({
  seededState = null,
  storage = null,
  manageFocus = false,
} = {}) {
  const selectedStorage = storage ?? createMemoryStorage()
  if (seededState !== null) saveCourseState(selectedStorage, seededState)
  const dom = new JSDOM(html, { url: 'https://concourse.test/demo/' })
  const controller = mountCourse(dom.window.document, dom.window, {
    storage: selectedStorage,
    manageFocus,
    confirm: () => true,
    now: () => NOW,
  })
  return {
    document: dom.window.document,
    window: dom.window,
    storage: selectedStorage,
    controller,
  }
}

function fillSubmission(document, activity, response, confidence = 'high') {
  const form = document.querySelector('[data-course-activity]')
  assert.ok(form, `missing form for ${activity.activityId}`)
  const kind = activity.kind === 'retrieval' ? 'single-choice' : activity.kind
  if (kind === 'single-choice') {
    form.querySelector(`input[name="response"][value="${response}"]`).checked =
      true
  } else if (kind === 'multi-select') {
    for (const value of response) {
      form.querySelector(`input[name="response"][value="${value}"]`).checked =
        true
    }
  } else if (kind === 'matching') {
    for (const [promptId, value] of Object.entries(response)) {
      form.querySelector(`[data-match-prompt="${promptId}"]`).value = value
    }
  }
  if (activity.confidenceRequired) {
    form.querySelector(
      `input[name="confidence"][value="${confidence}"]`,
    ).checked = true
  }
  form.requestSubmit()
}

function submitCurrentCorrect(document, controller, confidence = 'high') {
  const node = getCourseNode(controller.getState().currentNodeId)
  const activity =
    node.nodeId === 'antibiotic-retrieval'
      ? retrievalActivityForConcept(
          selectRetrievalConcept(controller.getState().evidence),
        )
      : getActivity(node.activityId)
  fillSubmission(document, activity, activity.correctResponse, confidence)
}

function continueRequiredRoute(document, controller) {
  const { awaitingAdvance } = controller.getState()
  assert.ok(awaitingAdvance, 'required response should be awaiting advancement')
  const controls = [
    ...document.querySelectorAll('[data-course-action="advance-course"]'),
  ]
  const explicitCore = controls.find(
    (control) =>
      control.hasAttribute('data-next-node-id') &&
      (control.dataset.nextNodeId || null) === awaitingAdvance.nextCoreNodeId,
  )
  const control = explicitCore ?? (controls.length === 1 ? controls[0] : null)
  assert.ok(control, 'missing Continue control for the required route')
  control.click()
}

function completeCurrentRequired(document, controller, confidence = 'high') {
  submitCurrentCorrect(document, controller, confidence)
  continueRequiredRoute(document, controller)
}

test('starts a new course and persists the first node', () => {
  const { document, storage, controller } = setupCourse()

  assert.equal(controller.getState().mode, 'entry')
  click(document, '[data-course-action="start"]')

  assert.equal(controller.getState().mode, 'course')
  assert.equal(controller.getState().currentNodeId, 'boundary-permeability')
  assert.equal(document.querySelector('[data-course-workspace]').hidden, false)
  assert.ok(storage.getItem(STORAGE_KEY))
  controller.destroy()
})

test('renders Coach as a focused workspace with six available Modes', () => {
  const { document, controller } = setupCourse()
  click(document, '[data-course-action="start"]')

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
  controller.destroy()
})

test('keeps completed evidence visible until an explicit route choice', () => {
  const { document, controller } = setupCourse()
  click(document, '[data-course-action="start"]')
  submitCurrentCorrect(document, controller)

  assert.equal(controller.getState().currentNodeId, 'boundary-permeability')
  assert.ok(document.querySelector('[data-completion-feedback]'))
  assert.ok(
    document.querySelector(
      '[data-course-action="advance-course"][data-next-node-id="boundary-structure"]',
    ),
  )
  assert.equal(
    document.querySelector('[data-course-activity]').dataset.activityCompleted,
    'true',
  )
  controller.destroy()
})

test('switches Mode without losing an unsubmitted response', () => {
  const { document, controller } = setupCourse()
  click(document, '[data-course-action="start"]')
  document.querySelector('input[name="response"][value="oxygen"]').checked =
    true
  document.querySelector('input[name="confidence"][value="low"]').checked = true

  click(document, '[data-mode-trigger]')
  click(document, '[data-mode-option="flow"]')

  assert.equal(controller.getState().interactionMode, 'flow')
  assert.equal(
    document.querySelector('input[name="response"][value="oxygen"]').checked,
    true,
  )
  assert.equal(
    document.querySelector('input[name="confidence"][value="low"]').checked,
    true,
  )
  assert.equal(document.querySelector('[data-mode-palette]').hidden, true)
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
  click(document, '[data-mode-trigger]')

  assert.equal(document.querySelector('[data-mode-palette]').hidden, false)
  assert.equal(document.activeElement.dataset.modeOption, 'coach')
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
    /welcome back.*move matter/i,
  )
  assert.equal(
    document.activeElement,
    document.querySelector('[data-key-idea-anchor]'),
  )
  controller.destroy()
})

test('explains a support branch beside its explicit route choices', () => {
  const { document, controller } = setupCourse()
  click(document, '[data-course-action="start"]')
  const activity = getActivity('boundary-permeability')
  fillSubmission(document, activity, ['sodium'], 'high')
  fillSubmission(document, activity, activity.correctResponse, 'high')

  const feedback = document.querySelector('[data-completion-feedback]')
  assert.match(feedback.textContent, /high-confidence mismatch/i)
  assert.ok(feedback.querySelector('[data-next-node-id="support-charge-size"]'))
  assert.ok(feedback.querySelector('[data-next-node-id="boundary-structure"]'))
  controller.destroy()
})

test('renders each required key idea before its activity form', () => {
  for (const activityId of REQUIRED_ACTIVITY_IDS) {
    const seededState = advanceCourseTo(activityId)
    const { document, window, controller } = setupCourse({ seededState })
    click(document, '[data-course-action="resume"]')

    const activity = getActivity(activityId)
    const teaching = document.querySelector('[data-activity-teaching]')
    const form = document.querySelector('[data-course-activity]')
    assert.ok(teaching, activityId + ' needs a rendered key idea')
    assert.ok(form, activityId + ' needs an activity form')
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
    { type: 'advance-course', nextNodeId: 'support-charge-size' },
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
  assert.equal(typeof demoRender.renderTeachingBlock, 'function')
  const teaching = demoRender.renderTeachingBlock(dom.window.document, [
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

test('restores an incomplete course through the resume entry', () => {
  const seededState = advanceCourseTo('transport-gradient')
  const { document, controller } = setupCourse({ seededState })

  assert.match(
    document.querySelector('[data-resume-copy]').textContent,
    /move matter/i,
  )
  click(document, '[data-course-action="resume"]')

  assert.equal(controller.getState().currentNodeId, 'transport-gradient')
  assert.equal(
    document.querySelector('[data-course-activity]').dataset.courseActivity,
    'transport-gradient',
  )
  controller.destroy()
})

test('records strong evidence and exposes a transparent extension', () => {
  const { document, controller } = setupCourse()
  click(document, '[data-course-action="start"]')
  submitCurrentCorrect(document, controller)

  assert.equal(controller.getState().evidence[0].classification, 'strong')
  assert.match(
    document.querySelector('[data-course-context]').textContent,
    /high confidence/i,
  )
  assert.ok(
    document.querySelector(
      '[data-course-action="advance-course"][data-next-node-id="extension-cell-envelopes"]',
    ),
  )
  assert.match(
    document.querySelector('[data-course-route]').textContent,
    /two common envelope patterns/i,
  )
  controller.destroy()
})

test('keeps an incorrect attempt in place with specific feedback', () => {
  const { document, controller } = setupCourse({ manageFocus: true })
  click(document, '[data-course-action="start"]')
  const activity = getActivity('boundary-permeability')
  fillSubmission(document, activity, ['sodium'], 'high')

  assert.equal(controller.getState().currentNodeId, 'boundary-permeability')
  assert.equal(controller.getState().evidence.length, 0)
  assert.match(
    document.querySelector('[data-attempt-feedback]').textContent,
    /size, polarity, and charge/i,
  )
  assert.equal(
    document.activeElement,
    document.querySelector('[data-attempt-feedback]'),
  )
  controller.destroy()
})

test('takes and completes a recommended support branch', () => {
  const { document, controller } = setupCourse()
  click(document, '[data-course-action="start"]')
  const activity = getActivity('boundary-permeability')
  fillSubmission(document, activity, ['sodium'], 'high')
  fillSubmission(document, activity, activity.correctResponse, 'high')

  click(
    document,
    '[data-course-action="advance-course"][data-next-node-id="support-charge-size"]',
  )
  assert.equal(controller.getState().currentNodeId, 'support-charge-size')
  submitCurrentCorrect(document, controller)

  assert.equal(controller.getState().currentNodeId, 'boundary-structure')
  assert.ok(
    controller.getState().completedNodeIds.includes('support-charge-size'),
  )
  controller.destroy()
})

test('takes or skips an extension without blocking the required route', () => {
  const taken = setupCourse()
  click(taken.document, '[data-course-action="start"]')
  submitCurrentCorrect(taken.document, taken.controller)
  click(
    taken.document,
    '[data-course-action="advance-course"][data-next-node-id="extension-cell-envelopes"]',
  )
  submitCurrentCorrect(taken.document, taken.controller)
  assert.equal(taken.controller.getState().currentNodeId, 'boundary-structure')
  taken.controller.destroy()

  const skipped = setupCourse()
  click(skipped.document, '[data-course-action="start"]')
  submitCurrentCorrect(skipped.document, skipped.controller)
  continueRequiredRoute(skipped.document, skipped.controller)
  assert.equal(
    skipped.controller.getState().currentNodeId,
    'boundary-structure',
  )
  assert.ok(
    skipped.controller
      .getState()
      .skippedNodeIds.includes('extension-cell-envelopes'),
  )
  skipped.controller.destroy()
})

test('completes the full strong route and renders its recap', () => {
  const { document, controller } = setupCourse()
  click(document, '[data-course-action="start"]')

  while (controller.getState().mode === 'course') {
    completeCurrentRequired(document, controller)
  }

  assert.equal(controller.getState().evidence.length, 13)
  assert.ok(document.querySelector('[data-course-recap]'))
  assert.match(
    document.querySelector('[data-course-stage]').textContent,
    /13 required activities/i,
  )
  assert.match(
    document.querySelector('[data-course-status]').textContent,
    /course complete/i,
  )
  controller.destroy()
})

test('moves ordered items with native buttons before submission', () => {
  const seededState = advanceCourseTo('response-sequence')
  const { document, controller } = setupCourse({ seededState })
  click(document, '[data-course-action="resume"]')
  click(document, '[data-order-item="rna"][data-order-direction="up"]')

  assert.deepEqual(
    controller
      .getState()
      .activityProgress['response-sequence'].draftOrder.slice(0, 2),
    ['rna', 'dna'],
  )
  assert.equal(
    document.querySelector('[data-order-list] > li').dataset.orderItem,
    'rna',
  )
  controller.destroy()
})

test('explains corrupt saves and storage failures without blocking learning', () => {
  const corruptStorage = createMemoryStorage({ [STORAGE_KEY]: '{bad json' })
  const corrupt = setupCourse({ storage: corruptStorage })
  assert.match(
    corrupt.document.querySelector('[data-course-entry]').textContent,
    /could not be restored/i,
  )
  click(corrupt.document, '[data-course-action="start"]')
  assert.equal(corrupt.controller.getState().mode, 'course')
  corrupt.controller.destroy()

  const blocked = setupCourse({
    storage: {
      getItem() {
        throw new Error('blocked')
      },
      setItem() {
        throw new Error('blocked')
      },
      removeItem() {
        throw new Error('blocked')
      },
    },
  })
  assert.match(
    blocked.document.querySelector('[data-save-status]').textContent,
    /session only/i,
  )
  click(blocked.document, '[data-course-action="start"]')
  assert.equal(blocked.controller.getState().mode, 'course')
  blocked.controller.destroy()
})

test('confirms reset clears only course progress', () => {
  const { document, storage, controller } = setupCourse()
  click(document, '[data-course-action="start"]')
  assert.ok(storage.getItem(STORAGE_KEY))
  click(document, '[data-course-action="reset"]')

  assert.equal(controller.getState().mode, 'entry')
  assert.equal(storage.getItem(STORAGE_KEY), null)
  assert.equal(document.querySelector('[data-course-entry]').hidden, false)
  controller.destroy()
})

test('moves focus through the Key idea, feedback, and next Key idea', () => {
  const { document, controller } = setupCourse({ manageFocus: true })
  click(document, '[data-course-action="start"]')
  assert.equal(
    document.activeElement,
    document.querySelector('[data-key-idea-anchor]'),
  )
  submitCurrentCorrect(document, controller)
  assert.equal(
    document.activeElement,
    document.querySelector('[data-completion-feedback]'),
  )
  assert.match(
    document.querySelector('[data-course-status]').textContent,
    /response recorded/i,
  )
  continueRequiredRoute(document, controller)
  assert.equal(
    document.activeElement,
    document.querySelector('[data-key-idea-anchor]'),
  )
  assert.match(
    document.querySelector('[data-course-status]').textContent,
    /boundary structure/i,
  )
  controller.destroy()
})

test('returns a safe no-op controller when required roots are missing', () => {
  const dom = new JSDOM('<!doctype html><body></body>')
  const controller = mountCourse(dom.window.document, dom.window)

  assert.equal(controller.getState().mode, 'entry')
  assert.doesNotThrow(() => controller.dispatch({ type: 'start' }))
  assert.doesNotThrow(() => controller.destroy())
})

test('removes every delegated course listener when destroyed', () => {
  const { document, controller } = setupCourse()
  controller.destroy()
  click(document, '[data-course-action="start"]')

  assert.equal(controller.getState().mode, 'entry')
})

test('uses keyboard-navigable context tabs without changing course evidence', () => {
  const { document, window, controller } = setupCourse()
  click(document, '[data-course-action="start"]')
  const tabs = [...document.querySelectorAll('[data-context-tab]')]

  assert.equal(tabs.length, 3)
  assert.equal(tabs[0].getAttribute('aria-selected'), 'true')
  tabs[0].focus()
  tabs[0].dispatchEvent(
    new window.KeyboardEvent('keydown', { key: 'End', bubbles: true }),
  )
  assert.equal(document.activeElement.dataset.contextTab, 'pack-source')
  assert.equal(
    document.querySelector('[data-context-panel="pack-source"]').hidden,
    false,
  )
  document.activeElement.dispatchEvent(
    new window.KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }),
  )
  assert.equal(document.activeElement.dataset.contextTab, 'route-decision')
  assert.equal(controller.getState().evidence.length, 0)

  click(document, '[data-context-tab="pack-source"]')
  assert.equal(document.activeElement.dataset.contextTab, 'pack-source')
  controller.destroy()
})

test('highlights the pack document responsible for the current activity', () => {
  const { document, controller } = setupCourse()
  click(document, '[data-course-action="start"]')
  click(document, '[data-context-tab="pack-source"]')

  assert.equal(
    document
      .querySelector('[data-pack-file="items.json"]')
      .getAttribute('data-current-source'),
    'true',
  )
  assert.match(
    document.querySelector('[data-current-source-copy]').textContent,
    /items\.json/i,
  )
  controller.destroy()
})

test('renders delayed retrieval from the earliest non-strong evidence', () => {
  let state = transitionCourse(createCourseState(NOW), { type: 'start' }, NOW)
  state = transitionCourse(
    state,
    {
      type: 'submit-response',
      nodeId: 'boundary-permeability',
      response: getActivity('boundary-permeability').correctResponse,
      confidence: 'low',
    },
    NOW,
  )
  state = transitionCourse(
    state,
    { type: 'advance-course', nextNodeId: 'boundary-structure' },
    NOW,
  )
  for (const nodeId of [
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
  ]) {
    state = transitionCourse(
      state,
      {
        type: 'submit-response',
        nodeId,
        response: getActivity(nodeId).correctResponse,
        confidence: 'high',
      },
      NOW,
    )
    state = transitionCourse(
      state,
      {
        type: 'advance-course',
        nextNodeId: getCourseNode(nodeId).nextCoreNodeId,
      },
      NOW,
    )
  }

  const developing = setupCourse({ seededState: state })
  click(developing.document, '[data-course-action="resume"]')
  assert.match(
    developing.document.querySelector('[data-retrieval-target]').textContent,
    /membrane permeability/i,
  )
  developing.controller.destroy()

  const allStrong = setupCourse({
    seededState: advanceCourseTo('antibiotic-retrieval'),
  })
  click(allStrong.document, '[data-course-action="resume"]')
  assert.match(
    allStrong.document.querySelector('[data-retrieval-target]').textContent,
    /osmosis/i,
  )
  allStrong.controller.destroy()
})

test('adds a biofilm extension only to the unpacked local draft', () => {
  const { document, controller } = setupCourse()
  click(document, '[data-course-action="start"]')
  while (controller.getState().mode === 'course') {
    completeCurrentRequired(document, controller)
  }

  click(document, '[data-context-tab="pack-source"]')
  click(document, '[data-course-action="toggle-biofilm-extension"]')

  assert.equal(controller.getState().draft.biofilmExtensionEnabled, true)
  assert.ok(
    document.querySelector('[data-route-node="extension-biofilm-survival"]'),
  )
  assert.match(
    document.querySelector('[data-draft-status]').textContent,
    /2 files changed/i,
  )
  click(document, '[data-pack-file="catalog.json"]')
  assert.match(
    document.querySelector('#course-pack-document code').textContent,
    /biofilm-survival/,
  )
  click(document, '[data-pack-file="items.json"]')
  assert.doesNotMatch(
    document.querySelector('#course-pack-document code').textContent,
    /biofilm-survival/,
  )
  controller.destroy()
})

test('offers another path and resets only after confirmation', () => {
  const { document, controller } = setupCourse()
  click(document, '[data-course-action="start"]')
  while (controller.getState().mode === 'course') {
    completeCurrentRequired(document, controller)
  }
  assert.match(
    document.querySelector('[data-course-recap]').textContent,
    /13 required activities/i,
  )
  click(document, '[data-course-action="try-another-path"]')

  assert.equal(controller.getState().mode, 'entry')
  assert.equal(controller.getState().evidence.length, 0)
  controller.destroy()
})

test('does not repeat course announcements for context or pack edits', async () => {
  const { document, controller } = setupCourse()
  click(document, '[data-course-action="start"]')
  while (controller.getState().mode === 'course') {
    completeCurrentRequired(document, controller)
  }
  const status = document.querySelector('[data-course-status]')
  const completion = status.textContent
  let mutations = 0
  const observer = new document.defaultView.MutationObserver(() => {
    mutations += 1
  })
  observer.observe(status, {
    childList: true,
    characterData: true,
    subtree: true,
  })

  click(document, '[data-context-tab="pack-source"]')
  click(document, '[data-course-action="toggle-biofilm-extension"]')
  await Promise.resolve()

  assert.equal(status.textContent, completion)
  assert.equal(mutations, 0)
  observer.disconnect()
  controller.destroy()
})
