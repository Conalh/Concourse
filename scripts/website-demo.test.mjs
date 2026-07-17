import test from 'node:test'
import assert from 'node:assert/strict'

import {
  createGuidedDemoState,
  transitionGuidedDemo,
} from '../website/demo-model.js'
import {
  APPLICATION_OPTIONS,
  PACK_FILES,
  PREDICTION_OPTIONS,
  derivePackDocuments,
  deriveRouteNodes,
  excerptForFile,
} from '../website/demo-content.js'
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
  PACK_FILES as COURSE_PACK_FILES,
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
  assert.equal(ACTIVITIES.length, 22)
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
  assert.deepEqual(COURSE_PACK_FILES, [
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

test('guided demo starts inside the membrane prediction', () => {
  assert.deepEqual(createGuidedDemoState(), {
    phase: 'predict',
    prediction: { choice: null, confidence: null, status: 'unanswered' },
    bridge: { offered: false, accepted: false, completed: false },
    application: { choice: null, status: 'unanswered' },
    dnaSideRouteEnabled: false,
    activePackFile: 'catalog.json',
  })
  assert.equal(
    PREDICTION_OPTIONS.find(({ id }) => id === 'oxygen')?.correct,
    true,
  )
  assert.equal(
    APPLICATION_OPTIONS.find(({ id }) => id === 'transport-protein')?.correct,
    true,
  )
  assert.deepEqual(PACK_FILES, [
    'pack.json',
    'catalog.json',
    'courses.json',
    'items.json',
  ])
})

test('guided demo takes the direct path only for correct high-confidence evidence', () => {
  const result = transitionGuidedDemo(createGuidedDemoState(), {
    type: 'submit-prediction',
    choice: 'oxygen',
    confidence: 'high',
  })

  assert.equal(result.phase, 'result')
  assert.equal(result.prediction.status, 'correct')
  assert.equal(result.bridge.offered, false)
  assert.equal(
    transitionGuidedDemo(result, { type: 'continue-result' }).phase,
    'apply',
  )
})

test('guided demo offers a bridge for correct low-confidence evidence', () => {
  const result = transitionGuidedDemo(createGuidedDemoState(), {
    type: 'submit-prediction',
    choice: 'oxygen',
    confidence: 'low',
  })

  assert.equal(result.prediction.status, 'correct')
  assert.equal(result.bridge.offered, true)
  assert.equal(
    transitionGuidedDemo(result, { type: 'continue-result' }).phase,
    'bridge-offer',
  )
})

test('guided demo offers and completes a learner-controlled bridge for incorrect evidence', () => {
  const result = transitionGuidedDemo(createGuidedDemoState(), {
    type: 'submit-prediction',
    choice: 'sodium',
    confidence: 'high',
  })
  const offer = transitionGuidedDemo(result, { type: 'continue-result' })
  const bridge = transitionGuidedDemo(offer, { type: 'accept-bridge' })
  const apply = transitionGuidedDemo(bridge, { type: 'complete-bridge' })

  assert.equal(offer.phase, 'bridge-offer')
  assert.deepEqual(bridge.bridge, {
    offered: true,
    accepted: true,
    completed: false,
  })
  assert.equal(apply.phase, 'apply')
  assert.equal(apply.bridge.completed, true)
  assert.deepEqual(
    deriveRouteNodes(apply).map(({ id }) => id),
    ['membrane-permeability', 'charge-and-size', 'transport-proteins'],
  )
})

test('guided demo permits skipping the offered bridge', () => {
  const result = transitionGuidedDemo(createGuidedDemoState(), {
    type: 'submit-prediction',
    choice: 'glucose',
    confidence: 'high',
  })
  const offer = transitionGuidedDemo(result, { type: 'continue-result' })
  const apply = transitionGuidedDemo(offer, { type: 'skip-bridge' })

  assert.equal(apply.phase, 'apply')
  assert.equal(apply.bridge.accepted, false)
  assert.deepEqual(
    deriveRouteNodes(apply).map(({ id }) => id),
    ['membrane-permeability', 'transport-proteins'],
  )
})

test('guided demo retries an incorrect application and completes a correct one', () => {
  const result = transitionGuidedDemo(createGuidedDemoState(), {
    type: 'submit-prediction',
    choice: 'oxygen',
    confidence: 'high',
  })
  const apply = transitionGuidedDemo(result, { type: 'continue-result' })
  const incorrect = transitionGuidedDemo(apply, {
    type: 'answer-application',
    choice: 'ribosome',
  })
  const complete = transitionGuidedDemo(incorrect, {
    type: 'answer-application',
    choice: 'transport-protein',
  })

  assert.deepEqual(incorrect.application, {
    choice: 'ribosome',
    status: 'incorrect',
  })
  assert.equal(incorrect.phase, 'apply')
  assert.equal(complete.phase, 'pack')
  assert.equal(complete.application.status, 'correct')
})

test('guided demo derives an atomic DNA side-route draft', () => {
  const before = derivePackDocuments(false)
  const after = derivePackDocuments(true)
  const beforeConcepts = before.catalog.concepts.map(
    ({ conceptId }) => conceptId,
  )
  const afterConcepts = after.catalog.concepts.map(({ conceptId }) => conceptId)
  const afterNodes = after.courses.courses[0].rootNodes.map(
    ({ nodeId }) => nodeId,
  )

  assert.equal(beforeConcepts.includes('dna-storage'), false)
  assert.equal(afterConcepts.includes('dna-storage'), true)
  assert.equal(afterNodes.includes('node-dna-storage'), true)
  assert.match(excerptForFile(after, 'catalog.json'), /dna-storage/)
  assert.match(excerptForFile(after, 'courses.json'), /node-dna-storage/)
  assert.doesNotMatch(excerptForFile(after, 'pack.json'), /sha256/)
})

test('guided demo selects pack files, navigates back, resets, and rejects invalid actions', () => {
  const result = transitionGuidedDemo(createGuidedDemoState(), {
    type: 'submit-prediction',
    choice: 'oxygen',
    confidence: 'high',
  })
  const apply = transitionGuidedDemo(result, { type: 'continue-result' })
  const pack = transitionGuidedDemo(apply, {
    type: 'answer-application',
    choice: 'transport-protein',
  })
  const selected = transitionGuidedDemo(pack, {
    type: 'select-pack-file',
    fileName: 'courses.json',
  })

  assert.equal(selected.activePackFile, 'courses.json')
  assert.equal(transitionGuidedDemo(selected, { type: 'back' }).phase, 'apply')
  assert.deepEqual(
    transitionGuidedDemo(selected, { type: 'reset' }),
    createGuidedDemoState(),
  )
  assert.deepEqual(
    transitionGuidedDemo({ phase: 'missing' }, { type: 'back' }),
    createGuidedDemoState(),
  )
  assert.deepEqual(
    transitionGuidedDemo(createGuidedDemoState(), { type: 'continue-result' }),
    createGuidedDemoState(),
  )
})
