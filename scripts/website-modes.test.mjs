import test from 'node:test'
import assert from 'node:assert/strict'

import {
  DEFAULT_INTERACTION_MODE,
  INTERACTION_MODES,
  getInteractionModeDefinition,
  isInteractionMode,
  normalizeInteractionMode,
  resolveDemoPresentation,
} from '../website/demo-modes.js'

const IDS = ['coach', 'flow', 'test', 'rescue', 'zoom', 'recap']

test('defines the six canonical Concourse Modes in product order', () => {
  assert.equal(DEFAULT_INTERACTION_MODE, 'coach')
  assert.deepEqual(
    INTERACTION_MODES.map(({ id }) => id),
    IDS,
  )
  assert.deepEqual(
    INTERACTION_MODES.map(({ label }) => label),
    ['Coach', 'Flow', 'Test', 'Rescue', 'Zoom', 'Recap'],
  )
  assert.equal(
    new Set(INTERACTION_MODES.map(({ description }) => description)).size,
    6,
  )
  assert.ok(
    INTERACTION_MODES.every(({ description }) => description.length > 20),
  )
})

test('normalizes unknown presentation input to Coach', () => {
  assert.equal(isInteractionMode('zoom'), true)
  assert.equal(isInteractionMode('entry'), false)
  assert.equal(normalizeInteractionMode('rescue'), 'rescue')
  assert.equal(normalizeInteractionMode('unknown'), 'coach')
  assert.equal(normalizeInteractionMode(null), 'coach')
  assert.equal(getInteractionModeDefinition('unknown').id, 'coach')
})

test('resolves immutable policy without grading or routing dimensions', () => {
  const policies = Object.fromEntries(
    IDS.map((id) => [id, resolveDemoPresentation(id)]),
  )

  assert.equal(Object.isFrozen(policies.coach), true)
  assert.equal(policies.flow.workspaceDensity, 'focus')
  assert.equal(policies.flow.interruptionDensity, 'reduced')
  assert.equal(policies.test.teachingVisibility, 'available')
  assert.equal(policies.test.hintAccess, 'withheld-until-requested')
  assert.equal(policies.rescue.guidanceVisibility, 'expanded')
  assert.equal(policies.rescue.feedbackDetail, 'detailed')
  assert.equal(policies.zoom.routeVisibility, 'expanded')
  assert.equal(policies.zoom.contextVisibility, 'expanded')
  assert.equal(policies.recap.teachingVisibility, 'available')
  assert.equal(policies.recap.optionalContentVisibility, 'collapsed')

  for (const policy of Object.values(policies)) {
    assert.equal('correctResponse' in policy, false)
    assert.equal('nextNodeId' in policy, false)
    assert.equal('classification' in policy, false)
    assert.equal('score' in policy, false)
  }
})
