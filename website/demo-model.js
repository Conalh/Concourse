import {
  APPLICATION_OPTIONS,
  PACK_FILES,
  PREDICTION_OPTIONS,
} from './demo-content.js'
import {
  CHAPTERS,
  COURSE_ID,
  COURSE_REVISION,
  EXTENSION_NODE_IDS,
  REQUIRED_ACTIVITY_IDS,
  SUPPORT_NODE_IDS,
  getActivity,
  getCourseNode,
} from './demo-course.js'
import {
  classifyEvidence,
  recommendRoute,
  requiredRouteComplete,
  selectRetrievalConcept,
} from './demo-routing.js'

const GUIDED_PHASES = new Set([
  'predict',
  'result',
  'bridge-offer',
  'bridge',
  'apply',
  'pack',
])
const GUIDED_STATUSES = new Set(['unanswered', 'correct', 'incorrect'])

export function createGuidedDemoState() {
  return {
    phase: 'predict',
    prediction: { choice: null, confidence: null, status: 'unanswered' },
    bridge: { offered: false, accepted: false, completed: false },
    application: { choice: null, status: 'unanswered' },
    dnaSideRouteEnabled: false,
    activePackFile: 'catalog.json',
  }
}

function isValidGuidedState(state) {
  return (
    state !== null &&
    typeof state === 'object' &&
    GUIDED_PHASES.has(state.phase) &&
    GUIDED_STATUSES.has(state.prediction?.status) &&
    GUIDED_STATUSES.has(state.application?.status) &&
    typeof state.bridge?.offered === 'boolean' &&
    typeof state.bridge?.accepted === 'boolean' &&
    typeof state.bridge?.completed === 'boolean' &&
    typeof state.dnaSideRouteEnabled === 'boolean' &&
    PACK_FILES.includes(state.activePackFile)
  )
}

function submitPrediction(state, event) {
  const option = PREDICTION_OPTIONS.find(({ id }) => id === event.choice)
  if (option === undefined || !['high', 'low'].includes(event.confidence)) {
    return { ...state }
  }

  const status = option.correct ? 'correct' : 'incorrect'
  return {
    ...state,
    phase: 'result',
    prediction: { choice: option.id, confidence: event.confidence, status },
    bridge: {
      offered: status === 'incorrect' || event.confidence === 'low',
      accepted: false,
      completed: false,
    },
  }
}

function navigateBack(state) {
  if (state.phase === 'pack') return { ...state, phase: 'apply' }
  if (state.phase === 'apply') {
    return {
      ...state,
      phase: state.bridge.completed ? 'bridge' : 'result',
      application: { choice: null, status: 'unanswered' },
      bridge: state.bridge.completed
        ? { ...state.bridge, completed: false }
        : state.bridge,
    }
  }
  if (state.phase === 'bridge') {
    return {
      ...state,
      phase: 'bridge-offer',
      bridge: { ...state.bridge, accepted: false, completed: false },
    }
  }
  if (state.phase === 'bridge-offer') return { ...state, phase: 'result' }
  if (state.phase === 'result') {
    return {
      ...createGuidedDemoState(),
      prediction: {
        choice: state.prediction.choice,
        confidence: state.prediction.confidence,
        status: 'unanswered',
      },
    }
  }
  return { ...state }
}

export function transitionGuidedDemo(state, event) {
  if (!isValidGuidedState(state)) return createGuidedDemoState()
  if (event === null || typeof event !== 'object') return { ...state }
  if (event.type === 'reset') return createGuidedDemoState()

  if (state.phase === 'predict' && event.type === 'submit-prediction') {
    return submitPrediction(state, event)
  }
  if (state.phase === 'result' && event.type === 'continue-result') {
    return { ...state, phase: state.bridge.offered ? 'bridge-offer' : 'apply' }
  }
  if (state.phase === 'bridge-offer' && event.type === 'accept-bridge') {
    return {
      ...state,
      phase: 'bridge',
      bridge: { ...state.bridge, accepted: true, completed: false },
    }
  }
  if (state.phase === 'bridge-offer' && event.type === 'skip-bridge') {
    return {
      ...state,
      phase: 'apply',
      bridge: { ...state.bridge, accepted: false, completed: false },
    }
  }
  if (state.phase === 'bridge' && event.type === 'complete-bridge') {
    return {
      ...state,
      phase: 'apply',
      bridge: { ...state.bridge, completed: true },
    }
  }
  if (state.phase === 'apply' && event.type === 'answer-application') {
    const option = APPLICATION_OPTIONS.find(({ id }) => id === event.choice)
    if (option === undefined) return { ...state }
    return {
      ...state,
      phase: option.correct ? 'pack' : 'apply',
      application: {
        choice: option.id,
        status: option.correct ? 'correct' : 'incorrect',
      },
    }
  }
  if (state.phase === 'pack' && event.type === 'select-pack-file') {
    return PACK_FILES.includes(event.fileName)
      ? { ...state, activePackFile: event.fileName }
      : { ...state }
  }
  if (
    state.phase === 'pack' &&
    event.type === 'toggle-dna-route' &&
    typeof event.enabled === 'boolean'
  ) {
    return { ...state, dnaSideRouteEnabled: event.enabled }
  }
  if (event.type === 'back') return navigateBack(state)
  return { ...state }
}

const COURSE_MODES = new Set(['entry', 'course', 'recap'])
const COURSE_CLASSIFICATIONS = new Set([
  'strong',
  'developing',
  'support-indicated',
])

export function createCourseState() {
  return {
    version: 1,
    courseId: COURSE_ID,
    courseRevision: COURSE_REVISION,
    mode: 'entry',
    currentNodeId: REQUIRED_ACTIVITY_IDS[0],
    completedNodeIds: [],
    skippedNodeIds: [],
    availableNodeIds: [REQUIRED_ACTIVITY_IDS[0]],
    activityProgress: {},
    evidence: [],
    branchDecisions: {},
    scheduledRetrievalConceptIds: [],
    routeHistory: [],
    draft: {
      biofilmExtensionEnabled: false,
      activeFile: 'courses.json',
    },
    startedAt: null,
    updatedAt: null,
  }
}

function validNodeIds(values) {
  return (
    Array.isArray(values) &&
    values.every(
      (nodeId) => typeof nodeId === 'string' && getCourseNode(nodeId) !== null,
    )
  )
}

export function isValidCourseState(state) {
  return (
    state !== null &&
    typeof state === 'object' &&
    state.version === 1 &&
    state.courseId === COURSE_ID &&
    state.courseRevision === COURSE_REVISION &&
    COURSE_MODES.has(state.mode) &&
    getCourseNode(state.currentNodeId) !== null &&
    validNodeIds(state.completedNodeIds) &&
    validNodeIds(state.skippedNodeIds) &&
    validNodeIds(state.availableNodeIds) &&
    state.activityProgress !== null &&
    typeof state.activityProgress === 'object' &&
    Array.isArray(state.evidence) &&
    state.evidence.every(
      (record) =>
        getActivity(record.activityId) !== null &&
        COURSE_CLASSIFICATIONS.has(record.classification),
    ) &&
    state.branchDecisions !== null &&
    typeof state.branchDecisions === 'object' &&
    Array.isArray(state.scheduledRetrievalConceptIds) &&
    state.scheduledRetrievalConceptIds.every(
      (conceptId) => typeof conceptId === 'string',
    ) &&
    validNodeIds(state.routeHistory) &&
    state.draft !== null &&
    typeof state.draft === 'object' &&
    typeof state.draft.biofilmExtensionEnabled === 'boolean' &&
    PACK_FILES.includes(state.draft.activeFile) &&
    (state.startedAt === null || typeof state.startedAt === 'string') &&
    (state.updatedAt === null || typeof state.updatedAt === 'string')
  )
}

function responseEqual(activity, response) {
  const correct = activity.correctResponse
  if (activity.kind === 'multi-select') {
    return (
      Array.isArray(response) &&
      response.length === correct.length &&
      [...response]
        .sort()
        .every((value, index) => value === [...correct].sort()[index])
    )
  }
  if (activity.kind === 'ordering') {
    return (
      Array.isArray(response) &&
      response.length === correct.length &&
      response.every((value, index) => value === correct[index])
    )
  }
  if (activity.kind === 'matching') {
    return (
      response !== null &&
      typeof response === 'object' &&
      !Array.isArray(response) &&
      Object.keys(correct).length === Object.keys(response).length &&
      Object.entries(correct).every(([key, value]) => response[key] === value)
    )
  }
  return response === correct
}

function appendUnique(values, value) {
  return values.includes(value) ? values : [...values, value]
}

function without(values, value) {
  return values.filter((candidate) => candidate !== value)
}

function submitCourseResponse(state, event, now) {
  if (state.mode !== 'course' || event.nodeId !== state.currentNodeId) {
    return state
  }
  const node = getCourseNode(event.nodeId)
  const activity = getActivity(node?.activityId)
  if (
    node === null ||
    activity === null ||
    node.required !== true ||
    !['high', 'low'].includes(event.confidence)
  ) {
    return state
  }

  const previous = state.activityProgress[event.nodeId]
  const attempts = (previous?.attempts ?? 0) + 1
  if (attempts > 2) return state
  const correct = responseEqual(activity, event.response)
  const firstResponseCorrect = previous?.firstResponseCorrect ?? correct
  const firstConfidence = previous?.firstConfidence ?? event.confidence
  const progress = {
    attempts,
    firstResponseCorrect,
    firstConfidence,
    lastResponse: event.response,
    lastResponseCorrect: correct,
    status: correct ? 'correct' : 'incorrect',
  }

  if (!correct && attempts === 1) {
    return {
      ...state,
      activityProgress: {
        ...state.activityProgress,
        [event.nodeId]: progress,
      },
      updatedAt: now,
    }
  }

  const classification = classifyEvidence({
    correct,
    firstResponseCorrect,
    firstConfidence,
    confidence: event.confidence,
    attempts,
  })
  if (classification === null) return state

  const conceptId =
    event.nodeId === 'antibiotic-retrieval'
      ? selectRetrievalConcept(state.evidence)
      : activity.conceptId
  const record = {
    activityId: activity.activityId,
    conceptId,
    selectedResponse: event.response,
    correct,
    confidence: event.confidence,
    attempts,
    firstResponseCorrect,
    firstConfidence,
    completedAt: now,
    classification,
  }
  const nextNodeId = node.nextCoreNodeId
  const completedNodeIds = appendUnique(state.completedNodeIds, event.nodeId)
  const availableNodeIds = nextNodeId
    ? appendUnique(without(state.availableNodeIds, event.nodeId), nextNodeId)
    : without(state.availableNodeIds, event.nodeId)
  let nextState = {
    ...state,
    currentNodeId: nextNodeId ?? state.currentNodeId,
    completedNodeIds,
    availableNodeIds,
    activityProgress: {
      ...state.activityProgress,
      [event.nodeId]: { ...progress, classification, completedAt: now },
    },
    evidence: [...state.evidence, record],
    scheduledRetrievalConceptIds:
      classification === 'strong'
        ? state.scheduledRetrievalConceptIds
        : appendUnique(state.scheduledRetrievalConceptIds, conceptId),
    routeHistory: [...state.routeHistory, event.nodeId],
    updatedAt: now,
  }

  const decision = recommendRoute(nextState, record)
  if (decision !== null) {
    nextState = {
      ...nextState,
      availableNodeIds: appendUnique(
        nextState.availableNodeIds,
        decision.nodeId,
      ),
      branchDecisions: {
        ...nextState.branchDecisions,
        [decision.nodeId]: decision,
      },
    }
  }
  if (requiredRouteComplete(nextState)) {
    nextState = { ...nextState, mode: 'recap' }
  }
  return nextState
}

function takeBranch(state, event, now) {
  const node = getCourseNode(event.nodeId)
  const decision = state.branchDecisions[event.nodeId]
  if (
    state.mode !== 'course' ||
    node?.required !== false ||
    decision?.status !== 'recommended' ||
    !state.availableNodeIds.includes(event.nodeId)
  ) {
    return state
  }
  return {
    ...state,
    currentNodeId: event.nodeId,
    availableNodeIds: without(state.availableNodeIds, event.nodeId),
    branchDecisions: {
      ...state.branchDecisions,
      [event.nodeId]: {
        ...decision,
        status: 'taken',
        returnNodeId: state.currentNodeId,
      },
    },
    updatedAt: now,
  }
}

function completeBranch(state, event, now) {
  const node = getCourseNode(event.nodeId)
  const decision = state.branchDecisions[event.nodeId]
  if (
    state.mode !== 'course' ||
    state.currentNodeId !== event.nodeId ||
    node?.required !== false ||
    decision?.status !== 'taken' ||
    getCourseNode(decision.returnNodeId) === null
  ) {
    return state
  }
  return {
    ...state,
    currentNodeId: decision.returnNodeId,
    completedNodeIds: appendUnique(state.completedNodeIds, event.nodeId),
    availableNodeIds: appendUnique(
      state.availableNodeIds,
      decision.returnNodeId,
    ),
    branchDecisions: {
      ...state.branchDecisions,
      [event.nodeId]: { ...decision, status: 'completed', completedAt: now },
    },
    routeHistory: [...state.routeHistory, event.nodeId],
    updatedAt: now,
  }
}

function skipBranch(state, event, now) {
  const node = getCourseNode(event.nodeId)
  const decision = state.branchDecisions[event.nodeId]
  if (
    state.mode !== 'course' ||
    node?.required !== false ||
    !['recommended', 'taken'].includes(decision?.status)
  ) {
    return state
  }
  const currentNodeId =
    state.currentNodeId === event.nodeId
      ? decision.returnNodeId
      : state.currentNodeId
  if (getCourseNode(currentNodeId) === null) return state
  return {
    ...state,
    currentNodeId,
    skippedNodeIds: appendUnique(state.skippedNodeIds, event.nodeId),
    availableNodeIds: without(state.availableNodeIds, event.nodeId),
    branchDecisions: {
      ...state.branchDecisions,
      [event.nodeId]: { ...decision, status: 'skipped', skippedAt: now },
    },
    updatedAt: now,
  }
}

function moveOrderItem(state, event, now) {
  if (state.mode !== 'course' || state.currentNodeId !== event.nodeId) {
    return state
  }
  const activity = getActivity(event.nodeId)
  const order =
    state.activityProgress[event.nodeId]?.draftOrder ??
    activity?.choices?.map(({ id }) => id)
  if (
    activity?.kind !== 'ordering' ||
    !Array.isArray(order) ||
    !Number.isInteger(event.fromIndex) ||
    !Number.isInteger(event.toIndex) ||
    event.fromIndex < 0 ||
    event.toIndex < 0 ||
    event.fromIndex >= order.length ||
    event.toIndex >= order.length
  ) {
    return state
  }
  const nextOrder = [...order]
  const [moved] = nextOrder.splice(event.fromIndex, 1)
  nextOrder.splice(event.toIndex, 0, moved)
  return {
    ...state,
    activityProgress: {
      ...state.activityProgress,
      [event.nodeId]: {
        ...state.activityProgress[event.nodeId],
        draftOrder: nextOrder,
      },
    },
    updatedAt: now,
  }
}

export function transitionCourse(state, event, now = new Date().toISOString()) {
  if (
    !isValidCourseState(state) ||
    event === null ||
    typeof event !== 'object'
  ) {
    return state
  }
  if (event.type === 'reset') return createCourseState()
  if (event.type === 'start' && state.mode === 'entry') {
    return { ...state, mode: 'course', startedAt: now, updatedAt: now }
  }
  if (event.type === 'resume' && state.mode === 'entry') {
    return { ...state, mode: 'course', updatedAt: now }
  }
  if (event.type === 'submit-response') {
    return submitCourseResponse(state, event, now)
  }
  if (event.type === 'take-branch') return takeBranch(state, event, now)
  if (event.type === 'skip-branch') return skipBranch(state, event, now)
  if (event.type === 'complete-branch') {
    return completeBranch(state, event, now)
  }
  if (event.type === 'move-order-item') return moveOrderItem(state, event, now)
  if (
    event.type === 'select-pack-file' &&
    PACK_FILES.includes(event.fileName)
  ) {
    return {
      ...state,
      draft: { ...state.draft, activeFile: event.fileName },
      updatedAt: now,
    }
  }
  if (
    event.type === 'toggle-biofilm-extension' &&
    state.mode === 'recap' &&
    typeof event.enabled === 'boolean'
  ) {
    return {
      ...state,
      draft: { ...state.draft, biofilmExtensionEnabled: event.enabled },
      updatedAt: now,
    }
  }
  return state
}

export function projectRecap(state) {
  const count = (classification) =>
    state.evidence.filter((record) => record.classification === classification)
      .length
  return {
    chaptersCompleted: CHAPTERS.filter(({ coreNodeIds }) =>
      coreNodeIds.every((nodeId) => state.completedNodeIds.includes(nodeId)),
    ).length,
    requiredCompleted: REQUIRED_ACTIVITY_IDS.filter((nodeId) =>
      state.completedNodeIds.includes(nodeId),
    ).length,
    requiredTotal: REQUIRED_ACTIVITY_IDS.length,
    evidence: {
      strong: count('strong'),
      developing: count('developing'),
      supportIndicated: count('support-indicated'),
    },
    supportsCompleted: SUPPORT_NODE_IDS.filter((nodeId) =>
      state.completedNodeIds.includes(nodeId),
    ).length,
    supportsSkipped: SUPPORT_NODE_IDS.filter((nodeId) =>
      state.skippedNodeIds.includes(nodeId),
    ).length,
    extensionsCompleted: EXTENSION_NODE_IDS.filter((nodeId) =>
      state.completedNodeIds.includes(nodeId),
    ).length,
    extensionsSkipped: EXTENSION_NODE_IDS.filter((nodeId) =>
      state.skippedNodeIds.includes(nodeId),
    ).length,
    delayedRetrievalConceptIds: state.scheduledRetrievalConceptIds,
    routeTaken: [...state.routeHistory],
    packFiles: [...PACK_FILES],
  }
}
