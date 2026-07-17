import test from 'node:test'
import assert from 'node:assert/strict'

import {
  createCourseState,
  projectRecap,
  transitionCourse,
} from '../website/demo-model.js'
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
  PACK_FILES,
  createSourceDocuments,
  deriveDraftDocuments,
  sourceForNode,
} from '../website/demo-pack.js'
import {
  classifyEvidence,
  deriveCourseRoute,
  explainRouteDecision,
  selectRetrievalConcept,
} from '../website/demo-routing.js'

const NOW = '2026-07-16T12:00:00.000Z'

function startCourse() {
  return transitionCourse(createCourseState(NOW), { type: 'start' }, NOW)
}

function submitCorrect(state, nodeId, confidence = 'high') {
  return transitionCourse(
    state,
    {
      type: 'submit-response',
      nodeId,
      response: getActivity(nodeId).correctResponse,
      confidence,
    },
    NOW,
  )
}

test('classifies evidence from accuracy confidence and attempts', () => {
  assert.equal(
    classifyEvidence({
      correct: true,
      firstResponseCorrect: true,
      confidence: 'high',
      attempts: 1,
    }),
    'strong',
  )
  assert.equal(
    classifyEvidence({
      correct: true,
      firstResponseCorrect: true,
      confidence: 'low',
      attempts: 1,
    }),
    'developing',
  )
  assert.equal(
    classifyEvidence({
      correct: true,
      firstResponseCorrect: false,
      firstConfidence: 'low',
      confidence: 'low',
      attempts: 2,
    }),
    'developing',
  )
  assert.equal(
    classifyEvidence({
      correct: true,
      firstResponseCorrect: false,
      firstConfidence: 'high',
      confidence: 'high',
      attempts: 2,
    }),
    'support-indicated',
  )
  assert.equal(
    classifyEvidence({
      correct: false,
      firstResponseCorrect: false,
      firstConfidence: 'low',
      confidence: 'low',
      attempts: 2,
    }),
    'support-indicated',
  )
})

test('strong evidence unlocks an optional chapter extension', () => {
  const state = submitCorrect(startCourse(), 'boundary-permeability')

  assert.equal(state.evidence[0].classification, 'strong')
  assert.equal(state.currentNodeId, 'boundary-structure')
  assert.ok(state.availableNodeIds.includes('extension-cell-envelopes'))
  assert.equal(
    state.branchDecisions['extension-cell-envelopes'].status,
    'recommended',
  )
  assert.match(
    explainRouteDecision(state.branchDecisions['extension-cell-envelopes']),
    /high confidence/i,
  )
})

test('developing evidence schedules delayed retrieval', () => {
  const state = submitCorrect(startCourse(), 'boundary-permeability', 'low')

  assert.equal(state.evidence[0].classification, 'developing')
  assert.deepEqual(state.scheduledRetrievalConceptIds, [
    'membrane-permeability',
  ])
})

test('support-indicated evidence recommends support and schedules retrieval', () => {
  const firstAttempt = transitionCourse(
    startCourse(),
    {
      type: 'submit-response',
      nodeId: 'boundary-permeability',
      response: ['sodium'],
      confidence: 'high',
    },
    NOW,
  )
  const state = submitCorrect(firstAttempt, 'boundary-permeability')

  assert.equal(firstAttempt.currentNodeId, 'boundary-permeability')
  assert.equal(firstAttempt.evidence.length, 0)
  assert.equal(state.evidence[0].classification, 'support-indicated')
  assert.ok(state.availableNodeIds.includes('support-charge-size'))
  assert.deepEqual(state.scheduledRetrievalConceptIds, [
    'membrane-permeability',
  ])
})

test('takes completes and skips optional branches without blocking the spine', () => {
  const offered = submitCorrect(startCourse(), 'boundary-permeability')
  const taking = transitionCourse(
    offered,
    { type: 'take-branch', nodeId: 'extension-cell-envelopes' },
    NOW,
  )
  const completed = transitionCourse(
    taking,
    { type: 'complete-branch', nodeId: 'extension-cell-envelopes' },
    NOW,
  )

  assert.equal(taking.currentNodeId, 'extension-cell-envelopes')
  assert.equal(completed.currentNodeId, 'boundary-structure')
  assert.ok(completed.completedNodeIds.includes('extension-cell-envelopes'))

  const skipped = transitionCourse(
    offered,
    { type: 'skip-branch', nodeId: 'extension-cell-envelopes' },
    NOW,
  )
  assert.ok(skipped.skippedNodeIds.includes('extension-cell-envelopes'))
  assert.equal(skipped.currentNodeId, 'boundary-structure')
})

test('selects the earliest non-strong retrieval concept or osmotic stress', () => {
  const evidence = [
    { conceptId: 'membrane-permeability', classification: 'strong' },
    { conceptId: 'transport-proteins', classification: 'developing' },
    { conceptId: 'osmosis', classification: 'support-indicated' },
  ]

  assert.equal(selectRetrievalConcept(evidence), 'transport-proteins')
  assert.equal(
    selectRetrievalConcept(
      evidence.map((record) => ({ ...record, classification: 'strong' })),
    ),
    'osmosis',
  )
})

test('completes the required spine while keeping extensions as enrichment', () => {
  let state = startCourse()
  for (const nodeId of REQUIRED_ACTIVITY_IDS)
    state = submitCorrect(state, nodeId)

  const recap = projectRecap(state)
  assert.equal(state.mode, 'recap')
  assert.equal(recap.requiredCompleted, 13)
  assert.equal(recap.requiredTotal, 13)
  assert.equal(recap.extensionsCompleted, 0)
  assert.equal(recap.evidence.strong, 13)
  assert.equal(recap.routeTaken.length, 13)
  assert.ok(
    deriveCourseRoute(state).every(({ status }) => status !== 'current'),
  )
})

test('invalid and out-of-order events preserve the identical state object', () => {
  const state = startCourse()
  assert.equal(
    transitionCourse(
      state,
      {
        type: 'submit-response',
        nodeId: 'transport-gradient',
        response: 'in',
        confidence: 'high',
      },
      NOW,
    ),
    state,
  )
  assert.equal(transitionCourse(state, { type: 'unknown' }, NOW), state)
})

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
  assert.deepEqual(PACK_FILES, [
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
