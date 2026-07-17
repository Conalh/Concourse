import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { JSDOM } from 'jsdom'
import * as runtime from '../website/main.js'

const { mountDemo } = runtime
const html = await readFile(
  new URL('../website/index.html', import.meta.url),
  'utf8',
)

function setup(options = { manageFocus: false }) {
  const dom = new JSDOM(html, { url: 'https://concourse.test/' })
  const controller = mountDemo(dom.window.document, options)
  return { document: dom.window.document, controller }
}

function click(document, selector) {
  const control = document.querySelector(selector)
  assert.ok(control, `missing ${selector}`)
  control.click()
}

function submitPrediction(document, choice, confidence) {
  click(document, `[name="molecule"][value="${choice}"]`)
  click(document, `[name="confidence"][value="${confidence}"]`)
  const form = document.querySelector('[data-demo-form="prediction"]')
  assert.ok(form)
  form.requestSubmit()
}

test('mounts directly into the prediction phase', () => {
  const { document, controller } = setup()
  assert.equal(controller.getState().phase, 'predict')
  assert.equal(
    document.querySelector('[data-demo-panel="predict"]')?.hidden,
    false,
  )
  assert.equal(
    document.querySelector('[data-demo-panel="result"]')?.hidden,
    true,
  )
  assert.match(
    document.querySelector('[data-demo-progress]')?.textContent ?? '',
    /0 of 2 activities/i,
  )
  controller.destroy()
})

test('completes the direct evidence path', () => {
  const { document, controller } = setup()
  submitPrediction(document, 'oxygen', 'high')

  assert.equal(controller.getState().phase, 'result')
  assert.equal(
    document.querySelector('[data-membrane-figure]')?.dataset.result,
    'oxygen',
  )
  assert.match(
    document.querySelector('[data-demo-status]')?.textContent ?? '',
    /correct.*oxygen/i,
  )

  click(document, '[data-demo-action="continue-result"]')
  assert.equal(controller.getState().phase, 'apply')
  click(
    document,
    '[data-demo-action="answer-application"][data-choice="transport-protein"]',
  )
  assert.equal(controller.getState().phase, 'pack')
  assert.match(
    document.querySelector('[data-demo-progress]')?.textContent ?? '',
    /route complete.*2 of 2 activities/i,
  )
  controller.destroy()
})

test('offers, accepts, and returns from the bridge', () => {
  const { document, controller } = setup()
  submitPrediction(document, 'glucose', 'high')
  click(document, '[data-demo-action="continue-result"]')

  assert.equal(controller.getState().phase, 'bridge-offer')
  assert.equal(
    document.querySelector('[data-route-node="charge-and-size"]')?.hidden,
    true,
  )

  click(document, '[data-demo-action="accept-bridge"]')
  assert.equal(controller.getState().phase, 'bridge')
  assert.equal(
    document.querySelector('[data-route-node="charge-and-size"]')?.hidden,
    false,
  )

  click(document, '[data-demo-action="complete-bridge"]')
  assert.equal(controller.getState().phase, 'apply')
  assert.equal(controller.getState().bridge.completed, true)
  assert.match(
    document.querySelector('[data-evidence-context]')?.textContent ?? '',
    /bridge completed/i,
  )
  controller.destroy()
})

test('permits skipping an offered bridge', () => {
  const { document, controller } = setup()
  submitPrediction(document, 'oxygen', 'low')
  click(document, '[data-demo-action="continue-result"]')
  click(document, '[data-demo-action="skip-bridge"]')

  assert.equal(controller.getState().phase, 'apply')
  assert.equal(controller.getState().bridge.accepted, false)
  assert.equal(
    document.querySelector('[data-route-node="charge-and-size"]')?.hidden,
    true,
  )
  controller.destroy()
})

test('keeps incorrect application feedback in place and accepts a retry', () => {
  const { document, controller } = setup({ manageFocus: true })
  submitPrediction(document, 'oxygen', 'high')
  click(document, '[data-demo-action="continue-result"]')

  const incorrect = document.querySelector(
    '[data-demo-action="answer-application"][data-choice="ribosome"]',
  )
  assert.ok(incorrect)
  incorrect.focus()
  incorrect.click()

  assert.equal(document.activeElement, incorrect)
  assert.equal(
    document.querySelector('[data-application-feedback]')?.hidden,
    false,
  )
  assert.match(
    document.querySelector('[data-demo-status]')?.textContent ?? '',
    /not quite.*transport protein/i,
  )

  click(
    document,
    '[data-demo-action="answer-application"][data-choice="transport-protein"]',
  )
  assert.equal(controller.getState().phase, 'pack')
  controller.destroy()
})

test('supports back, reset, and independent remounting', () => {
  const first = setup()
  first.controller.dispatch({
    type: 'submit-prediction',
    choice: 'oxygen',
    confidence: 'high',
  })
  first.controller.dispatch({ type: 'continue-result' })
  first.controller.dispatch({
    type: 'answer-application',
    choice: 'transport-protein',
  })
  click(first.document, '[data-demo-panel="pack"] [data-demo-action="back"]')
  assert.equal(first.controller.getState().phase, 'apply')

  first.controller.dispatch({ type: 'reset' })
  assert.equal(first.controller.getState().phase, 'predict')
  first.controller.destroy()

  const second = setup()
  assert.equal(second.controller.getState().phase, 'predict')
  second.controller.destroy()
})

test('moves focus only when a phase changes and focus management is enabled', () => {
  const enabled = setup({ manageFocus: true })
  submitPrediction(enabled.document, 'oxygen', 'high')
  assert.equal(
    enabled.document.activeElement,
    enabled.document.querySelector('[data-demo-panel="result"]'),
  )
  enabled.controller.dispatch({ type: 'reset' })
  assert.equal(
    enabled.document.activeElement,
    enabled.document.querySelector('[name="molecule"]'),
  )
  enabled.controller.destroy()

  const disabled = setup({ manageFocus: false })
  submitPrediction(disabled.document, 'oxygen', 'high')
  assert.equal(disabled.document.activeElement, disabled.document.body)
  disabled.controller.destroy()
})

test('explains missing prediction fields and focuses the message', () => {
  const { document, controller } = setup({ manageFocus: true })
  const form = document.querySelector('[data-demo-form="prediction"]')
  const error = document.querySelector('[data-prediction-error]')
  assert.ok(form)
  assert.ok(error)

  form.requestSubmit()

  assert.equal(controller.getState().phase, 'predict')
  assert.equal(error.hidden, false)
  assert.equal(document.activeElement, error)
  assert.match(error.textContent ?? '', /substance.*confidence/i)
  controller.destroy()
})

test('exposes route state semantics alongside visible progress', () => {
  const { document, controller } = setup()
  assert.match(
    document
      .querySelector('[data-route-node="membrane-permeability"]')
      ?.getAttribute('aria-label') ?? '',
    /membrane permeability.*active/i,
  )
  submitPrediction(document, 'oxygen', 'high')
  assert.match(
    document
      .querySelector('[data-route-node="membrane-permeability"]')
      ?.getAttribute('aria-label') ?? '',
    /membrane permeability.*complete/i,
  )
  controller.destroy()
})

test('resets a completed demo when the final rerun link is activated', () => {
  const dom = new JSDOM(html, { url: 'https://concourse.test/' })
  dom.window.requestAnimationFrame = (callback) => callback()
  const controller = runtime.mountPage(dom.window.document, dom.window)
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

  click(dom.window.document, '.final-invitation [data-focus-demo]')

  assert.equal(controller.getState().phase, 'predict')
  assert.equal(
    dom.window.document.activeElement,
    dom.window.document.querySelector('[name="molecule"]'),
  )
  controller.destroy()
})

test('removes page-level focus listeners when destroyed', () => {
  const dom = new JSDOM(html, { url: 'https://concourse.test/' })
  dom.window.requestAnimationFrame = (callback) => callback()
  const controller = runtime.mountPage(dom.window.document, dom.window)
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
  controller.destroy()

  click(dom.window.document, '.final-invitation [data-focus-demo]')

  assert.equal(controller.getState().phase, 'pack')
})

function completeDirectPath(document) {
  submitPrediction(document, 'oxygen', 'high')
  click(document, '[data-demo-action="continue-result"]')
  click(
    document,
    '[data-demo-action="answer-application"][data-choice="transport-protein"]',
  )
}

test('renders authentic pack tabs and switches document excerpts', () => {
  const { document, controller } = setup()
  completeDirectPath(document)

  assert.equal(document.querySelector('[data-pack-inspector]')?.hidden, false)
  assert.equal(document.querySelectorAll('[role="tab"]').length, 4)
  assert.match(
    document.querySelector('[data-pack-code]')?.textContent ?? '',
    /membrane-permeability/,
  )

  click(document, '[data-pack-file="courses.json"]')
  assert.match(
    document.querySelector('[data-pack-code]')?.textContent ?? '',
    /bacterial-cell-route/,
  )
  assert.equal(
    document
      .querySelector('[data-pack-file="courses.json"]')
      ?.getAttribute('aria-selected'),
    'true',
  )
  assert.equal(
    document
      .querySelector('[role="tabpanel"]')
      ?.getAttribute('aria-labelledby'),
    'pack-tab-courses',
  )
  controller.destroy()
})

test('supports arrow-key navigation between pack documents', () => {
  const { document, controller } = setup()
  completeDirectPath(document)
  const catalog = document.querySelector('[data-pack-file="catalog.json"]')
  assert.ok(catalog)
  catalog.focus()
  catalog.dispatchEvent(
    new document.defaultView.KeyboardEvent('keydown', {
      key: 'ArrowRight',
      bubbles: true,
    }),
  )

  const courses = document.querySelector('[data-pack-file="courses.json"]')
  assert.equal(document.activeElement, courses)
  assert.equal(courses?.getAttribute('aria-selected'), 'true')
  assert.match(
    document.querySelector('[data-pack-code]')?.textContent ?? '',
    /bacterial-cell-route/,
  )
  controller.destroy()
})

test('toggles the DNA draft across documents and route projection', () => {
  const { document, controller } = setup()
  completeDirectPath(document)
  click(document, '[data-demo-action="toggle-dna-route"]')

  assert.equal(controller.getState().dnaSideRouteEnabled, true)
  assert.equal(
    document.querySelector('[data-route-node="dna-storage"]')?.hidden,
    false,
  )
  assert.match(
    document.querySelector('[data-draft-status]')?.textContent ?? '',
    /2 files changed/i,
  )
  click(document, '[data-pack-file="catalog.json"]')
  assert.match(
    document.querySelector('[data-pack-code]')?.textContent ?? '',
    /dna-storage/,
  )
  click(document, '[data-pack-file="courses.json"]')
  assert.match(
    document.querySelector('[data-pack-code]')?.textContent ?? '',
    /node-dna-storage/,
  )

  click(document, '[data-demo-action="toggle-dna-route"]')
  assert.equal(controller.getState().dnaSideRouteEnabled, false)
  assert.equal(
    document.querySelector('[data-route-node="dna-storage"]')?.hidden,
    true,
  )
  controller.destroy()
})

test('keeps draft controls synchronized through back, forward, and reset', () => {
  const { document, controller } = setup({ manageFocus: true })
  completeDirectPath(document)
  click(document, '[data-demo-action="toggle-dna-route"]')
  click(document, '[data-pack-file="courses.json"]')
  click(document, '[data-demo-panel="pack"] [data-demo-action="back"]')
  click(
    document,
    '[data-demo-action="answer-application"][data-choice="transport-protein"]',
  )

  const toggle = document.querySelector('[data-demo-action="toggle-dna-route"]')
  assert.equal(toggle?.checked, true)
  assert.equal(
    document
      .querySelector('[data-pack-file="courses.json"]')
      ?.getAttribute('aria-selected'),
    'true',
  )

  click(document, '[data-demo-action="reset"]')
  assert.equal(toggle?.checked, false)
  assert.equal(document.querySelector('[name="molecule"]')?.checked, false)
  assert.equal(document.querySelector('[name="confidence"]')?.checked, false)
  assert.equal(
    document.querySelector('[data-membrane-figure]')?.dataset.result,
    'idle',
  )
  assert.equal(document.querySelector('[data-pack-inspector]')?.hidden, true)
  assert.equal(
    document
      .querySelector('[data-pack-file="catalog.json"]')
      ?.getAttribute('aria-selected'),
    'true',
  )
  assert.equal(
    document.querySelector('[data-route-node="dna-storage"]')?.hidden,
    true,
  )
  controller.destroy()
})

test('does not repeat phase announcements for local pack edits', async () => {
  const { document, controller } = setup()
  completeDirectPath(document)
  const status = document.querySelector('[data-demo-status]')
  assert.ok(status)
  const completionAnnouncement = status.textContent
  let mutations = 0
  const observer = new document.defaultView.MutationObserver(() => {
    mutations += 1
  })
  observer.observe(status, {
    childList: true,
    characterData: true,
    subtree: true,
  })

  click(document, '[data-pack-file="courses.json"]')
  assert.equal(status.textContent, completionAnnouncement)
  click(document, '[data-demo-action="toggle-dna-route"]')
  assert.equal(status.textContent, completionAnnouncement)
  await Promise.resolve()
  assert.equal(mutations, 0)
  observer.disconnect()
  controller.destroy()
})

test('removes every demo event listener when destroyed', () => {
  const { document, controller } = setup()
  submitPrediction(document, 'oxygen', 'high')
  controller.destroy()

  click(document, '[data-demo-action="continue-result"]')
  assert.equal(controller.getState().phase, 'result')
})
