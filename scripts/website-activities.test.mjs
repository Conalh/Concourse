import test from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'

import * as activities from '../website/demo-activities.js'
import { getActivity } from '../website/demo-course.js'
import {
  moveOrderedItem,
  readActivityResponse,
  renderActivity,
  validateActivityResponse,
} from '../website/demo-activities.js'

function render(activityId, progress = {}) {
  const dom = new JSDOM('<!doctype html><body></body>')
  const activity = getActivity(activityId)
  const form = renderActivity(dom.window.document, activity, progress)
  dom.window.document.body.append(form)
  return { dom, form, activity }
}

test('renders single choices as a labelled radio fieldset', () => {
  const { form } = render('transport-gradient')

  assert.equal(form.matches('form[data-course-activity]'), true)
  assert.match(
    form.querySelector('[data-response-group] legend').textContent,
    /net movement/i,
  )
  assert.equal(
    form.querySelectorAll('input[type="radio"][name="response"]').length,
    3,
  )
  assert.ok(
    form.querySelector('[data-activity-error][role="status"][tabindex="-1"]'),
  )
})

test('renders multi-select choices with checkboxes and selection guidance', () => {
  const { form } = render('boundary-permeability')

  assert.equal(
    form.querySelectorAll('input[type="checkbox"][name="response"]').length,
    3,
  )
  assert.match(
    form.querySelector('[data-selection-guidance]').textContent,
    /all that apply/i,
  )
})

test('renders matching activities as one labelled native select per prompt', () => {
  const { form } = render('transport-mechanism')
  const selects = [...form.querySelectorAll('select[data-match-prompt]')]

  assert.equal(selects.length, 3)
  assert.ok(selects.every((select) => select.labels.length === 1))
  assert.ok(selects.every((select) => select.querySelector('option[value=""]')))
})

test('renders ordering as a list with move controls for every item', () => {
  const { form } = render('response-sequence')
  const items = [...form.querySelectorAll('ol[data-order-list] > li')]

  assert.equal(items.length, 4)
  assert.ok(
    items.every((item) => item.querySelector('[data-order-direction="up"]')),
  )
  assert.ok(
    items.every((item) => item.querySelector('[data-order-direction="down"]')),
  )
  assert.match(
    items[0].querySelector('button').getAttribute('aria-label'),
    /move .* up/i,
  )
})

test('adds confidence choices only when the activity requires them', () => {
  const required = render('transport-gradient').form
  const optional = render('support-gradient').form

  assert.ok(required.querySelector('[data-confidence-group]'))
  assert.equal(required.querySelectorAll('input[name="confidence"]').length, 2)
  assert.equal(optional.querySelector('[data-confidence-group]'), null)
})

test('reads stable choice multi-select matching and ordering responses', () => {
  const single = render('transport-gradient')
  single.form.querySelector('input[value="in"]').checked = true
  single.form.querySelector('input[name="confidence"][value="high"]').checked =
    true
  assert.deepEqual(readActivityResponse(single.form, single.activity), {
    response: 'in',
    confidence: 'high',
  })

  const multiple = render('boundary-permeability')
  multiple.form.querySelector('input[value="oxygen"]').checked = true
  assert.deepEqual(readActivityResponse(multiple.form, multiple.activity), {
    response: ['oxygen'],
    confidence: null,
  })

  const matching = render('boundary-structure')
  matching.form.querySelector('[data-match-prompt="passage"]').value =
    'membrane'
  matching.form.querySelector('[data-match-prompt="rupture"]').value = 'wall'
  assert.deepEqual(
    readActivityResponse(matching.form, matching.activity).response,
    {
      passage: 'membrane',
      rupture: 'wall',
    },
  )

  const ordering = render('response-sequence', {
    draftOrder: ['rna', 'dna', 'ribosome', 'protein'],
  })
  assert.deepEqual(
    readActivityResponse(ordering.form, ordering.activity).response,
    ['rna', 'dna', 'ribosome', 'protein'],
  )
})

test('returns specific validation messages for incomplete responses', () => {
  assert.deepEqual(
    validateActivityResponse(getActivity('transport-gradient'), {
      response: null,
      confidence: null,
    }),
    { valid: false, message: 'Choose one response.' },
  )
  assert.deepEqual(
    validateActivityResponse(getActivity('boundary-permeability'), {
      response: [],
      confidence: 'high',
    }),
    { valid: false, message: 'Choose at least one response.' },
  )
  assert.deepEqual(
    validateActivityResponse(getActivity('boundary-structure'), {
      response: { passage: 'membrane', rupture: '' },
      confidence: 'high',
    }),
    { valid: false, message: 'Match every row before continuing.' },
  )
  assert.deepEqual(
    validateActivityResponse(getActivity('transport-gradient'), {
      response: 'in',
      confidence: null,
    }),
    { valid: false, message: 'Choose how sure you are.' },
  )
})

test('moves ordered items immutably and clamps at list boundaries', () => {
  const original = ['dna', 'rna', 'ribosome', 'protein']

  assert.deepEqual(moveOrderedItem(original, 'rna', 'up'), [
    'rna',
    'dna',
    'ribosome',
    'protein',
  ])
  assert.deepEqual(moveOrderedItem(original, 'dna', 'up'), original)
  assert.deepEqual(moveOrderedItem(original, 'protein', 'down'), original)
  assert.deepEqual(original, ['dna', 'rna', 'ribosome', 'protein'])
})

test('writes authored text as text rather than executable markup', () => {
  const dom = new JSDOM('<!doctype html><body></body>')
  const activity = {
    ...getActivity('transport-gradient'),
    prompt: '<img src=x onerror=alert(1)> Choose safely',
  }
  const form = renderActivity(dom.window.document, activity, {})

  assert.equal(form.querySelector('img'), null)
  assert.match(form.textContent, /<img src=x/)
})

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
  assert.equal(typeof activities.restoreActivityResponse, 'function')
  activities.restoreActivityResponse(form, activity, {
    response: 'out',
    confidence: 'low',
  })

  assert.equal(form.querySelector('input[value="out"]').checked, true)
  assert.equal(
    form.querySelector('input[name="confidence"][value="low"]').checked,
    true,
  )
})
