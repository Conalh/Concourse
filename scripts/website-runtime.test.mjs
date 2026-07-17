import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { JSDOM } from 'jsdom'

import {
  getActivity,
  getCourseNode,
  retrievalActivityForConcept,
} from '../website/demo-course.js'
import { createCourseState, transitionCourse } from '../website/demo-model.js'
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
    const activity = getActivity(getCourseNode(state.currentNodeId).activityId)
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
      '[data-branch-action="take"][data-node-id="extension-cell-envelopes"]',
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
    '[data-branch-action="take"][data-node-id="support-charge-size"]',
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
    '[data-branch-action="take"][data-node-id="extension-cell-envelopes"]',
  )
  submitCurrentCorrect(taken.document, taken.controller)
  assert.equal(taken.controller.getState().currentNodeId, 'boundary-structure')
  taken.controller.destroy()

  const skipped = setupCourse()
  click(skipped.document, '[data-course-action="start"]')
  submitCurrentCorrect(skipped.document, skipped.controller)
  click(
    skipped.document,
    '[data-branch-action="skip"][data-node-id="extension-cell-envelopes"]',
  )
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
    submitCurrentCorrect(document, controller)
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

test('moves focus and announces only meaningful course transitions', () => {
  const { document, controller } = setupCourse({ manageFocus: true })
  click(document, '[data-course-action="start"]')
  assert.ok(document.activeElement.matches('[data-course-activity] input'))
  submitCurrentCorrect(document, controller)
  assert.equal(
    document.activeElement.closest('form')?.dataset.courseActivity,
    'boundary-structure',
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
    submitCurrentCorrect(document, controller)
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
    submitCurrentCorrect(document, controller)
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
    submitCurrentCorrect(document, controller)
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
