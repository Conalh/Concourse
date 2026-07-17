import test from 'node:test'
import assert from 'node:assert/strict'

import { getActivity } from '../website/demo-course.js'
import { createCourseState, transitionCourse } from '../website/demo-model.js'
import {
  STORAGE_KEY,
  clearCourseState,
  loadCourseState,
  saveCourseState,
  toStoredCourseState,
  validateStoredCourseState,
} from '../website/demo-storage.js'

const NOW = '2026-07-16T20:00:00.000Z'

function createMemoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial))
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    peek: (key) => values.get(key) ?? null,
  }
}

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

test('distinguishes incompatible versions and revisions', () => {
  const stored = toStoredCourseState(createCourseState(NOW))

  assert.deepEqual(validateStoredCourseState({ ...stored, version: 2 }), {
    ok: false,
    reason: 'incompatible',
  })
  assert.deepEqual(
    validateStoredCourseState({ ...stored, courseRevision: 99 }),
    { ok: false, reason: 'incompatible' },
  )
})

test('ignores unknown fields while restoring the known boundary', () => {
  const stored = {
    ...toStoredCourseState(createCourseState(NOW)),
    remoteProfileId: 'must-not-survive',
  }
  const result = validateStoredCourseState(stored)

  assert.equal(result.ok, true)
  assert.equal('remoteProfileId' in result.value, false)
})

test('rejects evidence with impossible activity identifiers', () => {
  const stored = toStoredCourseState(createCourseState(NOW))
  stored.evidence = [
    {
      activityId: 'missing-activity',
      conceptId: 'osmosis',
      selectedResponse: 'out',
      correct: true,
      confidence: 'high',
      attempts: 1,
      firstResponseCorrect: true,
      firstConfidence: 'high',
      completedAt: NOW,
      classification: 'strong',
    },
  ]

  assert.deepEqual(validateStoredCourseState(stored), {
    ok: false,
    reason: 'invalid',
  })
})

test('contains storage read and write failures as session-only results', () => {
  const throwingRead = {
    getItem() {
      throw new Error('blocked')
    },
  }
  const throwingWrite = {
    setItem() {
      throw new Error('full')
    },
  }

  assert.deepEqual(loadCourseState(throwingRead), {
    ok: false,
    reason: 'read-failed',
  })
  assert.deepEqual(saveCourseState(throwingWrite, createCourseState(NOW)), {
    ok: false,
    reason: 'write-failed',
  })
})

test('clears only the course record and reports clear failures', () => {
  const storage = createMemoryStorage({
    [STORAGE_KEY]: '{}',
    unrelated: 'keep',
  })

  assert.deepEqual(clearCourseState(storage), { ok: true })
  assert.equal(storage.peek(STORAGE_KEY), null)
  assert.equal(storage.peek('unrelated'), 'keep')
  assert.deepEqual(
    clearCourseState({
      removeItem() {
        throw new Error('blocked')
      },
    }),
    { ok: false, reason: 'clear-failed' },
  )
})

test('restores the local biofilm draft independently from learner evidence', () => {
  const state = createCourseState(NOW)
  const stored = toStoredCourseState({
    ...state,
    draft: { biofilmExtensionEnabled: true, activeFile: 'catalog.json' },
  })
  const result = validateStoredCourseState(stored)

  assert.equal(result.ok, true)
  assert.deepEqual(result.value.draft, {
    biofilmExtensionEnabled: true,
    activeFile: 'catalog.json',
  })
  assert.deepEqual(result.value.evidence, [])
})

test('reports an empty local course record', () => {
  assert.deepEqual(loadCourseState(createMemoryStorage()), {
    ok: false,
    reason: 'empty',
  })
})
