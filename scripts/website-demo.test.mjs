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
  retrievalActivityForConcept,
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

const TEACHING_SEGMENT_KINDS = new Set(['text', 'term'])

function teachingText(activity) {
  return activity.teaching
    .map(({ segments }) => segments.map(({ text }) => text).join(''))
    .join('\n')
}

function wordCount(value) {
  return value.trim().split(/\s+/u).length
}

function startCourse() {
  return transitionCourse(createCourseState(NOW), { type: 'start' }, NOW)
}

function submitCorrect(state, nodeId, confidence = 'high') {
  const activity =
    nodeId === 'antibiotic-retrieval'
      ? retrievalActivityForConcept(selectRetrievalConcept(state.evidence))
      : getActivity(nodeId)
  return transitionCourse(
    state,
    {
      type: 'submit-response',
      nodeId,
      response: activity.correctResponse,
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

test('evaluates the antibiotic retrieval against the selected earlier concept', () => {
  let developing = submitCorrect(startCourse(), 'boundary-permeability', 'low')
  for (const nodeId of REQUIRED_ACTIVITY_IDS.slice(1, -1)) {
    developing = submitCorrect(developing, nodeId)
  }
  const target = selectRetrievalConcept(developing.evidence)
  const retrieval = retrievalActivityForConcept(target)
  developing = transitionCourse(
    developing,
    {
      type: 'submit-response',
      nodeId: 'antibiotic-retrieval',
      response: retrieval.correctResponse,
      confidence: 'high',
    },
    NOW,
  )

  assert.equal(target, 'membrane-permeability')
  assert.equal(developing.evidence.at(-1).conceptId, 'membrane-permeability')
  assert.equal(developing.evidence.at(-1).correct, true)

  let allStrong = startCourse()
  for (const nodeId of REQUIRED_ACTIVITY_IDS.slice(0, -1)) {
    allStrong = submitCorrect(allStrong, nodeId)
  }
  assert.equal(selectRetrievalConcept(allStrong.evidence), 'osmosis')
  assert.match(retrievalActivityForConcept('osmosis').prompt, /saltier/i)
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

test('gives every required activity a concise structured micro-lesson', () => {
  const lessons = REQUIRED_ACTIVITY_IDS.map((activityId) => {
    const activity = getActivity(activityId)
    assert.ok(Array.isArray(activity.teaching), activityId + ' needs teaching')
    assert.ok(
      activity.teaching.length >= 1 && activity.teaching.length <= 2,
      activityId + ' must contain one or two paragraphs',
    )

    const segments = activity.teaching.flatMap(({ segments }) => {
      assert.ok(Array.isArray(segments) && segments.length > 0)
      return segments
    })
    const text = teachingText(activity)
    const terms = segments.filter(({ kind }) => kind === 'term')

    assert.ok(wordCount(text) >= 35 && wordCount(text) <= 55, activityId)
    assert.ok(terms.length >= 1 && terms.length <= 4, activityId)
    assert.doesNotMatch(text, / {2,}/u)
    assert.match(text, /[.!?]$/u)
    for (const segment of segments) {
      assert.ok(TEACHING_SEGMENT_KINDS.has(segment.kind), activityId)
      assert.equal(typeof segment.text, 'string')
      assert.ok(segment.text.trim().length > 0, activityId)
      assert.doesNotMatch(segment.text, /<\/?[a-z][^>]*>|\*\*|__/iu)
    }

    return text
  })

  assert.equal(new Set(lessons).size, REQUIRED_ACTIVITY_IDS.length)
  const packItems = createSourceDocuments()['items.json'].items
  for (const activityId of [...SUPPORT_NODE_IDS, ...EXTENSION_NODE_IDS]) {
    assert.equal(getActivity(activityId).teaching, undefined)
    assert.equal(
      packItems.find(({ itemId }) => itemId === activityId).teaching,
      undefined,
    )
  }
  for (const activityId of REQUIRED_ACTIVITY_IDS) {
    assert.deepEqual(
      packItems.find(({ itemId }) => itemId === activityId).teaching,
      getActivity(activityId).teaching,
    )
  }

  const retrievalLesson = teachingText(getActivity('antibiotic-retrieval'))
  const retrievalTokens = retrievalLesson.toLowerCase().split(/[^a-z0-9-]+/u)
  for (const conceptId of [
    'membrane-permeability',
    'cell-envelope',
    'concentration-gradient',
    'transport-proteins',
    'osmosis',
    'energy-coupling',
    'gene-expression',
  ]) {
    const selectedResponse = String(
      retrievalActivityForConcept(conceptId).correctResponse,
    ).toLowerCase()
    assert.equal(retrievalTokens.includes(selectedResponse), false)
  }
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
