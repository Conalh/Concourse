import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { JSDOM } from 'jsdom'
import { mountDemo } from '../website/main.js'

const html = await readFile(
  new URL('../website/index.html', import.meta.url),
  'utf8',
)

const EXPECTED_ACTIONS = [
  'answer',
  'back',
  'continue',
  'reset',
  'retry',
  'start',
]

function setup(options = { manageFocus: false }) {
  const dom = new JSDOM(html, { url: 'https://concourse.test/' })
  dom.window.HTMLElement.prototype.scrollIntoView = () => {}
  const controller = mountDemo(dom.window.document, options)
  return { document: dom.window.document, controller }
}

function click(document, selector) {
  const button = document.querySelector(selector)
  assert.ok(button, `missing ${selector}`)
  button.click()
}

test('declares the complete demo action contract', () => {
  const { document, controller } = setup()
  const actions = [...document.querySelectorAll('[data-demo-action]')].map(
    (control) => control.dataset.demoAction,
  )

  assert.deepEqual([...new Set(actions)].sort(), EXPECTED_ACTIONS)
  controller.destroy()
})

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
  assert.match(
    document.querySelector('[data-demo-status]')?.textContent ?? '',
    /lesson opened/i,
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
  assert.match(
    document.querySelector('[data-demo-status]')?.textContent ?? '',
    /recall question opened/i,
  )

  click(document, '[data-choice="membrane"]')

  assert.equal(controller.getState().step, 'pack')
  assert.match(
    document.querySelector('[data-demo-progress]')?.textContent ?? '',
    /1 of 3/,
  )
  assert.match(
    document.querySelector('[data-demo-status]')?.textContent ?? '',
    /correct/i,
  )
  controller.destroy()
})

test('supports back, reset, and independent remounting', () => {
  const first = setup()
  first.controller.dispatch({ type: 'start' })
  first.controller.dispatch({ type: 'continue' })
  first.controller.dispatch({ type: 'answer', choice: 'membrane' })
  click(first.document, '[data-demo-panel="pack"] [data-demo-action="back"]')

  assert.equal(first.controller.getState().step, 'recall')

  first.controller.dispatch({ type: 'reset' })

  assert.deepEqual(first.controller.getState(), {
    step: 'route',
    answerStatus: 'unanswered',
  })
  first.controller.destroy()

  const second = setup()
  assert.deepEqual(second.controller.getState(), {
    step: 'route',
    answerStatus: 'unanswered',
  })
  second.controller.destroy()
})

test('moves focus only when focus management is enabled', () => {
  const { document, controller } = setup({ manageFocus: true })

  click(document, '[data-demo-action="start"]')

  assert.equal(
    document.activeElement,
    document.querySelector('[data-demo-panel="lesson"]'),
  )

  controller.dispatch({ type: 'reset' })

  assert.equal(
    document.activeElement,
    document.querySelector('[data-demo-panel="route"]'),
  )
  controller.destroy()
})
