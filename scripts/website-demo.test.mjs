import test from 'node:test'
import assert from 'node:assert/strict'

import {
  DEMO_ANSWERS,
  createDemoState,
  createGuidedDemoState,
  transitionDemo,
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
