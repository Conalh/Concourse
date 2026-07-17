import {
  CHAPTERS,
  COURSE_NODES,
  REQUIRED_ACTIVITY_IDS,
  getCourseNode,
} from './demo-course.js'

const CLASSIFICATIONS = new Set(['strong', 'developing', 'support-indicated'])

export function classifyEvidence(record) {
  if (
    record === null ||
    typeof record !== 'object' ||
    !['high', 'low'].includes(record.confidence) ||
    !Number.isInteger(record.attempts) ||
    record.attempts < 1
  ) {
    return null
  }

  if (
    record.correct === true &&
    record.firstResponseCorrect === true &&
    record.attempts === 1
  ) {
    return record.confidence === 'high' ? 'strong' : 'developing'
  }

  if (
    record.correct === true &&
    record.attempts === 2 &&
    record.firstResponseCorrect === false
  ) {
    return record.firstConfidence === 'high'
      ? 'support-indicated'
      : 'developing'
  }

  if (record.attempts >= 2) return 'support-indicated'
  return null
}

function branchAlreadyResolved(state, nodeId) {
  return (
    state.completedNodeIds.includes(nodeId) ||
    state.skippedNodeIds.includes(nodeId)
  )
}

export function recommendRoute(state, record) {
  if (!CLASSIFICATIONS.has(record?.classification)) return null
  const node = getCourseNode(record.activityId)
  const chapter = CHAPTERS.find(
    ({ chapterId }) => chapterId === node?.chapterId,
  )
  if (chapter === undefined) return null

  if (
    record.classification === 'strong' &&
    chapter.extensionNodeId !== null &&
    !branchAlreadyResolved(state, chapter.extensionNodeId)
  ) {
    return {
      nodeId: chapter.extensionNodeId,
      chapterId: chapter.chapterId,
      kind: 'extension',
      status: 'recommended',
      evidenceActivityId: record.activityId,
      classification: record.classification,
      reason:
        'You answered correctly on the first attempt with high confidence, so an optional extension is available.',
    }
  }

  if (
    record.classification === 'support-indicated' &&
    chapter.supportNodeId !== null &&
    !branchAlreadyResolved(state, chapter.supportNodeId)
  ) {
    return {
      nodeId: chapter.supportNodeId,
      chapterId: chapter.chapterId,
      kind: 'support',
      status: 'recommended',
      evidenceActivityId: record.activityId,
      classification: record.classification,
      reason:
        'Two attempts or a high-confidence mismatch indicate that a short support bridge may help.',
    }
  }

  return null
}

export function selectRetrievalConcept(evidence) {
  if (!Array.isArray(evidence)) return 'osmosis'
  const record = evidence.find(
    (candidate) =>
      candidate?.classification !== 'strong' &&
      typeof candidate?.conceptId === 'string' &&
      candidate.conceptId !== 'retrieval',
  )
  return record?.conceptId ?? 'osmosis'
}

function routeStatus(state, nodeId) {
  if (state.completedNodeIds.includes(nodeId)) return 'completed'
  if (state.skippedNodeIds.includes(nodeId)) return 'skipped'
  if (state.mode === 'course' && state.currentNodeId === nodeId)
    return 'current'
  if (state.availableNodeIds.includes(nodeId)) return 'available'
  return 'upcoming'
}

export function deriveCourseRoute(state) {
  const projected = []
  for (const chapter of CHAPTERS) {
    for (const nodeId of chapter.coreNodeIds) {
      const node = getCourseNode(nodeId)
      projected.push({
        nodeId,
        chapterId: chapter.chapterId,
        chapterTitle: chapter.title,
        title: node.title,
        kind: node.kind,
        required: true,
        status: routeStatus(state, nodeId),
      })
    }

    for (const nodeId of [chapter.supportNodeId, chapter.extensionNodeId]) {
      if (nodeId === null) continue
      const decision = state.branchDecisions[nodeId]
      if (
        decision === undefined &&
        !state.completedNodeIds.includes(nodeId) &&
        !state.skippedNodeIds.includes(nodeId)
      ) {
        continue
      }
      const node = getCourseNode(nodeId)
      projected.push({
        nodeId,
        chapterId: chapter.chapterId,
        chapterTitle: chapter.title,
        title: node.title,
        kind: node.kind,
        required: false,
        status: routeStatus(state, nodeId),
      })
    }
  }

  if (state.draft?.biofilmExtensionEnabled === true) {
    projected.push({
      nodeId: 'extension-biofilm-survival',
      chapterId: 'draft',
      chapterTitle: 'Unpacked local draft',
      title: 'Biofilm survival',
      kind: 'extension',
      required: false,
      status: 'draft',
    })
  }
  return projected
}

export function explainRouteDecision(decision) {
  if (decision === null || typeof decision !== 'object') {
    return 'The required learning spine remains available.'
  }
  if (typeof decision.reason === 'string') return decision.reason
  if (decision.status === 'skipped') {
    return 'You skipped this optional branch; the required route remains available.'
  }
  if (decision.status === 'completed') {
    return 'You completed this optional branch without replacing the original evidence.'
  }
  return 'This route decision follows the visible evidence rules for the course.'
}

export function validateRouteProjection(route) {
  if (!Array.isArray(route)) return false
  const nodeIds = new Set(COURSE_NODES.map(({ nodeId }) => nodeId))
  return route.every(
    ({ nodeId, status }) =>
      (nodeIds.has(nodeId) || nodeId === 'extension-biofilm-survival') &&
      [
        'completed',
        'skipped',
        'current',
        'available',
        'upcoming',
        'draft',
      ].includes(status),
  )
}

export function requiredRouteComplete(state) {
  return REQUIRED_ACTIVITY_IDS.every((nodeId) =>
    state.completedNodeIds.includes(nodeId),
  )
}
