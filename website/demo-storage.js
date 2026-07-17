import {
  COURSE_ID,
  COURSE_REVISION,
  REQUIRED_ACTIVITY_IDS,
  getActivity,
  getCourseNode,
} from './demo-course.js'
import { normalizeInteractionMode } from './demo-modes.js'
import { isValidCourseState } from './demo-model.js'

export const STORAGE_KEY = 'concourse.demo.course.v1'

const CLASSIFICATIONS = new Set(['strong', 'developing', 'support-indicated'])
const BRANCH_STATUSES = new Set([
  'recommended',
  'taken',
  'completed',
  'skipped',
])

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function unique(values) {
  return new Set(values).size === values.length
}

function validNodeIdList(values) {
  return (
    Array.isArray(values) &&
    unique(values) &&
    values.every((nodeId) => getCourseNode(nodeId) !== null)
  )
}

function validTimestamp(value) {
  return (
    value === null ||
    (typeof value === 'string' && Number.isFinite(Date.parse(value)))
  )
}

function validEvidenceRecord(record) {
  return (
    record !== null &&
    typeof record === 'object' &&
    getActivity(record.activityId) !== null &&
    typeof record.conceptId === 'string' &&
    record.conceptId.length > 0 &&
    typeof record.correct === 'boolean' &&
    ['high', 'low'].includes(record.confidence) &&
    [1, 2].includes(record.attempts) &&
    typeof record.firstResponseCorrect === 'boolean' &&
    ['high', 'low'].includes(record.firstConfidence) &&
    validTimestamp(record.completedAt) &&
    record.completedAt !== null &&
    CLASSIFICATIONS.has(record.classification)
  )
}

function validBranchDecisions(decisions) {
  if (
    decisions === null ||
    typeof decisions !== 'object' ||
    Array.isArray(decisions)
  ) {
    return false
  }
  return Object.entries(decisions).every(([nodeId, decision]) => {
    const node = getCourseNode(nodeId)
    return (
      node?.required === false &&
      decision !== null &&
      typeof decision === 'object' &&
      decision.nodeId === nodeId &&
      BRANCH_STATUSES.has(decision.status)
    )
  })
}

export function toStoredCourseState(state) {
  return clone({
    version: state.version,
    courseId: state.courseId,
    courseRevision: state.courseRevision,
    interactionMode: state.interactionMode,
    currentNodeId: state.currentNodeId,
    awaitingAdvance: state.awaitingAdvance,
    completedNodeIds: state.completedNodeIds,
    availableNodeIds: state.availableNodeIds,
    evidence: state.evidence,
    branchDecisions: state.branchDecisions,
    draft: state.draft,
    startedAt: state.startedAt,
    updatedAt: state.updatedAt,
  })
}

function reconstructedProgress(evidence) {
  return Object.fromEntries(
    evidence.map((record) => [
      record.activityId,
      {
        attempts: record.attempts,
        firstResponseCorrect: record.firstResponseCorrect,
        firstConfidence: record.firstConfidence,
        lastResponse: record.selectedResponse,
        lastResponseCorrect: record.correct,
        status: record.correct ? 'correct' : 'incorrect',
        classification: record.classification,
        completedAt: record.completedAt,
      },
    ]),
  )
}

export function validateStoredCourseState(candidate) {
  if (
    candidate === null ||
    typeof candidate !== 'object' ||
    Array.isArray(candidate)
  ) {
    return { ok: false, reason: 'invalid' }
  }
  if (
    candidate.version !== 1 ||
    candidate.courseId !== COURSE_ID ||
    candidate.courseRevision !== COURSE_REVISION
  ) {
    return { ok: false, reason: 'incompatible' }
  }
  if (
    getCourseNode(candidate.currentNodeId) === null ||
    !validNodeIdList(candidate.completedNodeIds) ||
    !validNodeIdList(candidate.availableNodeIds) ||
    !Array.isArray(candidate.evidence) ||
    !candidate.evidence.every(validEvidenceRecord) ||
    !unique(candidate.evidence.map(({ activityId }) => activityId)) ||
    !validBranchDecisions(candidate.branchDecisions) ||
    candidate.draft === null ||
    typeof candidate.draft !== 'object' ||
    typeof candidate.draft.biofilmExtensionEnabled !== 'boolean' ||
    !['pack.json', 'catalog.json', 'courses.json', 'items.json'].includes(
      candidate.draft.activeFile,
    ) ||
    !validTimestamp(candidate.startedAt) ||
    !validTimestamp(candidate.updatedAt)
  ) {
    return { ok: false, reason: 'invalid' }
  }

  const evidenceIds = new Set(
    candidate.evidence.map(({ activityId }) => activityId),
  )
  const completedCoreIds = candidate.completedNodeIds.filter((nodeId) =>
    REQUIRED_ACTIVITY_IDS.includes(nodeId),
  )
  if (completedCoreIds.some((nodeId) => !evidenceIds.has(nodeId))) {
    return { ok: false, reason: 'invalid' }
  }

  const skippedNodeIds = Object.values(candidate.branchDecisions)
    .filter(({ status }) => status === 'skipped')
    .map(({ nodeId }) => nodeId)
  const scheduledRetrievalConceptIds = [
    ...new Set(
      candidate.evidence
        .filter(({ classification }) => classification !== 'strong')
        .map(({ conceptId }) => conceptId),
    ),
  ]
  const complete = REQUIRED_ACTIVITY_IDS.every((nodeId) =>
    candidate.completedNodeIds.includes(nodeId),
  )
  const awaitingAdvance = candidate.awaitingAdvance ?? null
  if (
    awaitingAdvance !== null &&
    (typeof awaitingAdvance !== 'object' ||
      Array.isArray(awaitingAdvance) ||
      getCourseNode(awaitingAdvance.nodeId)?.required !== true ||
      !validTimestamp(awaitingAdvance.completedAt) ||
      awaitingAdvance.completedAt === null)
  ) {
    return { ok: false, reason: 'invalid' }
  }
  const value = {
    version: 1,
    courseId: COURSE_ID,
    courseRevision: COURSE_REVISION,
    mode: complete ? 'recap' : 'entry',
    interactionMode: normalizeInteractionMode(candidate.interactionMode),
    currentNodeId: candidate.currentNodeId,
    awaitingAdvance: clone(awaitingAdvance),
    completedNodeIds: clone(candidate.completedNodeIds),
    skippedNodeIds,
    availableNodeIds: clone(candidate.availableNodeIds),
    activityProgress: reconstructedProgress(candidate.evidence),
    evidence: clone(candidate.evidence),
    branchDecisions: clone(candidate.branchDecisions),
    scheduledRetrievalConceptIds,
    routeHistory: clone(candidate.completedNodeIds),
    draft: {
      biofilmExtensionEnabled: candidate.draft.biofilmExtensionEnabled,
      activeFile: candidate.draft.activeFile,
    },
    startedAt: candidate.startedAt,
    updatedAt: candidate.updatedAt,
  }

  return isValidCourseState(value)
    ? { ok: true, value }
    : { ok: false, reason: 'invalid' }
}

export function loadCourseState(storage) {
  let serialized
  try {
    serialized = storage.getItem(STORAGE_KEY)
  } catch {
    return { ok: false, reason: 'read-failed' }
  }
  if (serialized === null) return { ok: false, reason: 'empty' }

  let candidate
  try {
    candidate = JSON.parse(serialized)
  } catch {
    return { ok: false, reason: 'corrupt' }
  }
  return validateStoredCourseState(candidate)
}

export function saveCourseState(storage, state) {
  if (!isValidCourseState(state)) return { ok: false, reason: 'invalid' }
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(toStoredCourseState(state)))
    return { ok: true }
  } catch {
    return { ok: false, reason: 'write-failed' }
  }
}

export function clearCourseState(storage) {
  try {
    storage.removeItem(STORAGE_KEY)
    return { ok: true }
  } catch {
    return { ok: false, reason: 'clear-failed' }
  }
}
