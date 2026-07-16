import {
  createLogicFoundationsRelease,
  validateReviewEvent,
  type LearningPackDocuments,
  type ReviewEvent,
} from '@learnt/learning-pack-contracts'
import { describe, expect, it } from 'vitest'

import {
  EvidenceEventSchema,
  type ActivityKind,
  type EvaluationResult,
  type EvidenceEvent,
} from '../core/contracts'

import {
  ReviewEventAdapterError,
  exportLearntEvidenceToReviewEvents,
  importReviewEventsToLearntEvidence,
} from './learnt-review-event-adapter'

const packV1 = createLogicFoundationsRelease('1.0.0')
const packV2 = createLogicFoundationsRelease('2.0.0')

describe('Learnt ReviewEvent adapter export', () => {
  it('exports native Learnt evidence as valid shared ReviewEvents for each supported play mode', () => {
    const evidenceEvents = [
      nativeEvidence({
        id: 'evidence-flashcard',
        pack: packV1,
        itemId: 'item-truth-values-flashcard',
        timestamp: '2026-06-23T12:00:00.000Z',
        activityKind: 'recall',
        response: { kind: 'manual', completed: true },
        evaluation: passedEvaluation(),
      }),
      nativeEvidence({
        id: 'evidence-single-choice',
        pack: packV1,
        itemId: 'item-negation-single-choice',
        timestamp: '2026-06-23T12:01:00.000Z',
        activityKind: 'predict',
        response: { kind: 'single-choice', optionId: 'option-true' },
        evaluation: passedEvaluation(),
      }),
      nativeEvidence({
        id: 'evidence-multiple-choice',
        pack: packV1,
        itemId: 'item-connectives-multiple-choice',
        timestamp: '2026-06-23T12:02:00.000Z',
        activityKind: 'predict',
        response: {
          kind: 'multiple-choice',
          optionIds: ['option-and', 'option-or', 'option-if-then'],
        },
        evaluation: passedEvaluation(),
      }),
      nativeEvidence({
        id: 'evidence-text',
        pack: packV1,
        itemId: 'item-validity-text-recall',
        timestamp: '2026-06-23T12:03:00.000Z',
        activityKind: 'recall',
        response: { kind: 'text', value: 'validity' },
        evaluation: passedEvaluation(),
      }),
      nativeEvidence({
        id: 'evidence-number',
        pack: packV1,
        itemId: 'item-truth-table-row-count',
        timestamp: '2026-06-23T12:04:00.000Z',
        activityKind: 'recall',
        response: { kind: 'number', value: 4 },
        evaluation: passedEvaluation(),
      }),
      nativeEvidence({
        id: 'evidence-manual-read',
        pack: packV1,
        itemId: 'item-soundness-manual-read',
        timestamp: '2026-06-23T12:05:00.000Z',
        activityKind: 'orient',
        response: { kind: 'manual', completed: true },
        evaluation: passedEvaluation(),
      }),
    ]

    const reviewEvents = exportLearntEvidenceToReviewEvents({
      evidenceEvents,
      pack: packV1,
      sourceInstanceId: 'learnt-local',
      sourceAppId: 'learnt',
      sourceAppVersion: '0.0.0',
    })

    expect(reviewEvents.map((event) => event.playMode)).toEqual([
      'flashcard',
      'single-choice-quiz',
      'multiple-choice-quiz',
      'text-recall',
      'number-recall',
      'manual-read',
    ])
    for (const event of reviewEvents) {
      expect(validateReviewEvent(event, { pack: packV1 }).ok).toBe(true)
    }

    const imported = importReviewEventsToLearntEvidence({
      events: reviewEvents,
      pack: packV1,
      defaults: defaultImportContext(),
    })

    expect(imported.evidenceEvents).toEqual(evidenceEvents)
  })
})

describe('Learnt ReviewEvent adapter import', () => {
  it('is idempotent for duplicate ReviewEvents and preserves existing native evidence details', () => {
    const existingNativeEvidence = nativeEvidence({
      id: 'evidence-duplicate',
      pack: packV1,
      itemId: 'item-validity-text-recall',
      timestamp: '2026-06-23T12:00:00.000Z',
      activityKind: 'recall',
      response: { kind: 'text', value: 'native detailed response' },
      confidence: 5,
      hintsUsed: 3,
      evaluation: {
        status: 'partial',
        score: 0.5,
        feedback: 'Native feedback that ReviewEvent cannot represent.',
        matchedCriteria: ['uses the target term'],
        missingCriteria: ['explains the distinction'],
      },
    })
    const lessDetailedSharedEvent = reviewEvent({
      eventId: 'evidence-duplicate',
      itemId: 'item-validity-text-recall',
      playMode: 'text-recall',
      learningRevision: 1,
      responseSummary: {
        kind: 'text',
        selectedOptionIds: [],
        enteredText: 'shared summary only',
        enteredNumber: null,
        selfGrade: null,
        customSummary: null,
      },
      result: 'ungraded',
      normalizedScore: null,
      occurredAt: '2026-06-23T12:00:00.000Z',
      subjectId: 'subject-proof-strategies',
      courseId: 'course-proof-practice',
    })

    const imported = importReviewEventsToLearntEvidence({
      existingEvidenceEvents: [existingNativeEvidence],
      events: [lessDetailedSharedEvent, lessDetailedSharedEvent],
      pack: packV1,
      defaults: defaultImportContext(),
    })

    expect(imported.importedEventIds).toEqual([])
    expect(imported.skippedDuplicateEventIds).toEqual(['evidence-duplicate'])
    expect(imported.evidenceEvents).toEqual([existingNativeEvidence])
  })

  it('imports out-of-order ReviewEvents into deterministic chronological native evidence order', () => {
    const later = reviewEvent({
      eventId: 'evidence-later',
      itemId: 'item-truth-table-row-count',
      playMode: 'number-recall',
      learningRevision: 1,
      responseSummary: {
        kind: 'number',
        selectedOptionIds: [],
        enteredText: null,
        enteredNumber: 4,
        selfGrade: null,
        customSummary: null,
      },
      result: 'correct',
      normalizedScore: 1,
      occurredAt: '2026-06-23T12:10:00.000Z',
      subjectId: 'subject-propositional-logic',
      courseId: 'course-logic-core',
    })
    const earlier = reviewEvent({
      eventId: 'evidence-earlier',
      itemId: 'item-negation-single-choice',
      playMode: 'single-choice-quiz',
      learningRevision: 1,
      responseSummary: {
        kind: 'choice',
        selectedOptionIds: ['option-true'],
        enteredText: null,
        enteredNumber: null,
        selfGrade: null,
        customSummary: null,
      },
      result: 'correct',
      normalizedScore: 1,
      occurredAt: '2026-06-23T12:01:00.000Z',
      subjectId: 'subject-propositional-logic',
      courseId: 'course-logic-core',
    })

    const imported = importReviewEventsToLearntEvidence({
      events: [later, earlier],
      pack: packV1,
      defaults: defaultImportContext(),
    })

    expect(imported.importedEventIds).toEqual([
      'evidence-later',
      'evidence-earlier',
    ])
    expect(imported.evidenceEvents.map((event) => event.id)).toEqual([
      'evidence-earlier',
      'evidence-later',
    ])
  })

  it('uses pack learningRevision during export and rejects stale shared events for revised items', () => {
    const nativeNegationEvidence = nativeEvidence({
      id: 'evidence-negation',
      pack: packV2,
      itemId: 'item-negation-single-choice',
      timestamp: '2026-06-23T12:00:00.000Z',
      activityKind: 'predict',
      response: { kind: 'single-choice', optionId: 'option-true' },
      evaluation: passedEvaluation(),
    })

    const v1Event = exportLearntEvidenceToReviewEvents({
      evidenceEvents: [nativeNegationEvidence],
      pack: packV1,
      sourceInstanceId: 'learnt-local',
    })[0]
    const v2Event = exportLearntEvidenceToReviewEvents({
      evidenceEvents: [nativeNegationEvidence],
      pack: packV2,
      sourceInstanceId: 'learnt-local',
    })[0]
    if (v1Event === undefined || v2Event === undefined) {
      throw new Error('Expected exported ReviewEvents.')
    }

    expect(v1Event.learningRevision).toBe(1)
    expect(v2Event.learningRevision).toBe(2)
    expect(validateReviewEvent(v2Event, { pack: packV2 }).ok).toBe(true)
    expect(() =>
      importReviewEventsToLearntEvidence({
        events: [v1Event],
        pack: packV2,
        defaults: defaultImportContext(),
      }),
    ).toThrow(ReviewEventAdapterError)
  })
})

function nativeEvidence(input: {
  id: string
  pack: LearningPackDocuments
  itemId: string
  timestamp: string
  activityKind: ActivityKind
  response: unknown
  evaluation: EvaluationResult
  confidence?: number
  hintsUsed?: number
}): EvidenceEvent {
  const item = requireItem(input.pack, input.itemId)

  return EvidenceEventSchema.parse({
    schemaVersion: '0.1',
    id: input.id,
    timestamp: input.timestamp,
    learnerId: 'learner-a',
    profileId: 'profile-a',
    sessionId: 'session-a',
    subjectId: subjectIdForItem(input.pack, input.itemId),
    moduleId: nodeIdForItem(input.pack, input.itemId),
    activityId: input.itemId,
    objectiveIds: item.objectiveIds,
    activityKind: input.activityKind,
    response: input.response,
    ...(input.confidence === undefined ? {} : { confidence: input.confidence }),
    hintsUsed: input.hintsUsed ?? 0,
    evaluation: input.evaluation,
  })
}

function reviewEvent(
  input: Omit<
    ReviewEvent,
    | 'schemaVersion'
    | 'packId'
    | 'packVersion'
    | 'responseTimeMs'
    | 'sourceInstanceId'
    | 'confusionTargetIds'
    | 'privacy'
    | 'extensions'
  >,
): ReviewEvent {
  return {
    schemaVersion: '0.1',
    packId: packV1.manifest.packId,
    packVersion: packV1.manifest.version,
    responseTimeMs: null,
    sourceInstanceId: 'external-source',
    confusionTargetIds: [],
    privacy: {
      learnerId: 'learner-a',
      sessionId: 'session-a',
      sourceAppId: 'external-app',
      sourceAppVersion: '1.0.0',
    },
    extensions: null,
    ...input,
  }
}

function defaultImportContext() {
  return {
    learnerId: 'learner-a',
    profileId: 'profile-a',
    sessionId: 'session-a',
  } as const
}

function passedEvaluation(): EvaluationResult {
  return {
    status: 'passed',
    score: 1,
    matchedCriteria: [],
    missingCriteria: [],
  }
}

function requireItem(pack: LearningPackDocuments, itemId: string) {
  const item = pack.items.items.find((candidate) => candidate.itemId === itemId)

  if (item === undefined) {
    throw new Error(`Missing item ${itemId}.`)
  }

  return item
}

function subjectIdForItem(pack: LearningPackDocuments, itemId: string): string {
  const course = pack.courses.courses.find((candidate) =>
    courseContainsItem(candidate.rootNodes, itemId),
  )
  const subjectId = pack.catalog.subjects.find((subject) =>
    course === undefined ? false : subject.courseIds.includes(course.courseId),
  )?.subjectId

  if (subjectId === undefined) {
    throw new Error(`Missing subject for item ${itemId}.`)
  }

  return subjectId
}

function nodeIdForItem(pack: LearningPackDocuments, itemId: string): string {
  for (const course of pack.courses.courses) {
    const nodeId = findNodeId(course.rootNodes, itemId)
    if (nodeId !== null) {
      return nodeId
    }
  }

  throw new Error(`Missing curriculum node for item ${itemId}.`)
}

function courseContainsItem(
  nodes: LearningPackDocuments['courses']['courses'][number]['rootNodes'],
  itemId: string,
): boolean {
  return findNodeId(nodes, itemId) !== null
}

function findNodeId(
  nodes: LearningPackDocuments['courses']['courses'][number]['rootNodes'],
  itemId: string,
): string | null {
  for (const node of nodes) {
    if (node.itemIds.includes(itemId)) {
      return node.nodeId
    }
    const childNodeId = findNodeId(node.children, itemId)
    if (childNodeId !== null) {
      return childNodeId
    }
  }

  return null
}
