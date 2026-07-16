import {
  validateReviewEvent,
  type JsonObject,
  type LearningItem,
  type LearningPackDiagnostic,
  type LearningPackDocuments,
  type PlayMode,
  type ReviewEvent,
  type ReviewEventResponseSummary,
  type ReviewEventResult,
  type SelfGrade,
} from '@learnt/learning-pack-contracts'

import {
  EvidenceEventSchema,
  type ActivityKind,
  type EvaluationResult,
  type EvidenceEvent,
  type EvidencePayload,
} from '../core/contracts'
import { cloneDeep, deepFreeze, type DeepReadonly } from '../core/foundation'

const LEARNT_EXTENSION_KEY = 'learnt' as const

export class ReviewEventAdapterError extends Error {
  readonly diagnostics: readonly LearningPackDiagnostic[]

  constructor(
    message: string,
    diagnostics: readonly LearningPackDiagnostic[] = [],
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = 'ReviewEventAdapterError'
    this.diagnostics = diagnostics
  }
}

export type ExportLearntEvidenceToReviewEventsInput = Readonly<{
  evidenceEvents: readonly EvidenceEvent[]
  pack: LearningPackDocuments
  sourceInstanceId: string
  sourceAppId?: string
  sourceAppVersion?: string
  includeNativeLearntEvidence?: boolean
}>

export type ReviewEventImportDefaults = Readonly<{
  learnerId: string
  profileId: string
  sessionId: string
  subjectId?: string
}>

export type ImportReviewEventsToLearntEvidenceInput = Readonly<{
  events: readonly ReviewEvent[]
  pack: LearningPackDocuments
  defaults: ReviewEventImportDefaults
  existingEvidenceEvents?: readonly EvidenceEvent[]
}>

export type ImportReviewEventsToLearntEvidenceResult = DeepReadonly<{
  evidenceEvents: readonly EvidenceEvent[]
  importedEventIds: readonly string[]
  skippedDuplicateEventIds: readonly string[]
}>

type ItemContext = Readonly<{
  item: LearningItem
  subjectId: string
  courseId: string
  nodeId: string
  objectiveIds: readonly string[]
}>

export function exportLearntEvidenceToReviewEvents(
  input: ExportLearntEvidenceToReviewEventsInput,
): readonly ReviewEvent[] {
  return Object.freeze(
    input.evidenceEvents.map((evidenceEvent, index) => {
      const context = requireItemContext(input.pack, evidenceEvent.activityId)
      const reviewEvent: ReviewEvent = {
        schemaVersion: '0.1',
        eventId: evidenceEvent.id,
        packId: input.pack.manifest.packId,
        packVersion: input.pack.manifest.version,
        itemId: evidenceEvent.activityId,
        learningRevision: context.item.learningRevision,
        subjectId: evidenceEvent.subjectId,
        courseId: context.courseId,
        playMode: inferPlayMode(evidenceEvent, context.item),
        responseSummary: toReviewResponseSummary(evidenceEvent.response),
        result: toReviewResult(evidenceEvent),
        normalizedScore: evidenceEvent.evaluation.score ?? null,
        responseTimeMs: null,
        occurredAt: evidenceEvent.timestamp,
        sourceInstanceId: input.sourceInstanceId,
        confusionTargetIds: [],
        privacy: {
          learnerId: evidenceEvent.learnerId,
          sessionId: evidenceEvent.sessionId,
          sourceAppId: input.sourceAppId ?? null,
          sourceAppVersion: input.sourceAppVersion ?? null,
        },
        extensions:
          input.includeNativeLearntEvidence === false
            ? null
            : nativeEvidenceExtension(evidenceEvent),
      }

      assertValidReviewEvent(
        reviewEvent,
        input.pack,
        `reviewEvents[${String(index)}]`,
      )
      return reviewEvent
    }),
  )
}

export function importReviewEventsToLearntEvidence(
  input: ImportReviewEventsToLearntEvidenceInput,
): ImportReviewEventsToLearntEvidenceResult {
  const evidenceById = new Map<string, EvidenceEvent>()
  const importedEventIds: string[] = []
  const skippedDuplicateEventIds = new Set<string>()

  for (const evidenceEvent of input.existingEvidenceEvents ?? []) {
    evidenceById.set(evidenceEvent.id, cloneDeep(evidenceEvent))
  }

  for (const [index, event] of input.events.entries()) {
    assertValidReviewEvent(event, input.pack, `reviewEvents[${String(index)}]`)

    if (evidenceById.has(event.eventId)) {
      skippedDuplicateEventIds.add(event.eventId)
      continue
    }

    const nativeEvidence =
      readNativeEvidenceExtension(event) ??
      synthesizeNativeEvidence(event, input.pack, input.defaults)
    evidenceById.set(nativeEvidence.id, nativeEvidence)
    importedEventIds.push(event.eventId)
  }

  const evidenceEvents = [...evidenceById.values()].sort(compareEvidenceEvents)

  return deepFreeze(
    cloneDeep({
      evidenceEvents,
      importedEventIds,
      skippedDuplicateEventIds: [...skippedDuplicateEventIds].sort(),
    }),
  )
}

function assertValidReviewEvent(
  event: ReviewEvent,
  pack: LearningPackDocuments,
  path: string,
): void {
  const validation = validateReviewEvent(event, { pack, path })

  if (!validation.ok || validation.value === undefined) {
    throw new ReviewEventAdapterError(
      `ReviewEvent validation failed: ${validation.diagnostics
        .filter((diagnostic) => diagnostic.severity === 'error')
        .map((diagnostic) => `${diagnostic.code} at ${diagnostic.path}`)
        .join('; ')}`,
      validation.diagnostics,
    )
  }
}

function toReviewResponseSummary(
  response: EvidencePayload,
): ReviewEventResponseSummary {
  switch (response.kind) {
    case 'manual':
      return emptyResponseSummary('none')
    case 'single-choice':
      return {
        ...emptyResponseSummary('choice'),
        selectedOptionIds: [response.optionId],
      }
    case 'multiple-choice':
      return {
        ...emptyResponseSummary('choice'),
        selectedOptionIds: [...response.optionIds],
      }
    case 'text':
      return { ...emptyResponseSummary('text'), enteredText: response.value }
    case 'number':
      return {
        ...emptyResponseSummary('number'),
        enteredNumber: response.value,
      }
    case 'confidence':
      return {
        ...emptyResponseSummary('custom'),
        customSummary: {
          learntEvidenceKind: 'confidence',
          value: response.value,
        },
      }
    case 'code':
      return {
        ...emptyResponseSummary('custom'),
        customSummary: {
          learntEvidenceKind: 'code',
          language: response.language,
          source: response.source,
        },
      }
  }
}

function emptyResponseSummary(
  kind: ReviewEventResponseSummary['kind'],
): ReviewEventResponseSummary {
  return {
    kind,
    selectedOptionIds: [],
    enteredText: null,
    enteredNumber: null,
    selfGrade: null,
    customSummary: null,
  }
}

function toReviewResult(evidenceEvent: EvidenceEvent): ReviewEventResult {
  switch (evidenceEvent.evaluation.status) {
    case 'passed':
      return evidenceEvent.response.kind === 'manual' ? 'completed' : 'correct'
    case 'partial':
    case 'retry':
      return 'incorrect'
    case 'ungraded':
      return 'ungraded'
  }
}

function inferPlayMode(
  evidenceEvent: EvidenceEvent,
  item: LearningItem,
): PlayMode {
  const allowed = new Set(item.allowedPlayModes)

  switch (evidenceEvent.response.kind) {
    case 'single-choice':
      return requireAllowedMode(allowed, 'single-choice-quiz', item.itemId)
    case 'multiple-choice':
      return requireAllowedMode(allowed, 'multiple-choice-quiz', item.itemId)
    case 'text':
      return requireAllowedMode(allowed, 'text-recall', item.itemId)
    case 'number':
      return requireAllowedMode(allowed, 'number-recall', item.itemId)
    case 'confidence':
      return allowed.has('self-grade-review')
        ? 'self-grade-review'
        : firstAllowedMode(item)
    case 'code':
      return firstAllowedMode(item)
    case 'manual':
      if (
        evidenceEvent.activityKind === 'orient' &&
        allowed.has('manual-read')
      ) {
        return 'manual-read'
      }
      if (allowed.has('flashcard')) {
        return 'flashcard'
      }
      if (allowed.has('manual-read')) {
        return 'manual-read'
      }
      return firstAllowedMode(item)
  }
}

function requireAllowedMode(
  allowed: ReadonlySet<PlayMode>,
  mode: PlayMode,
  itemId: string,
): PlayMode {
  if (!allowed.has(mode)) {
    throw new ReviewEventAdapterError(
      `Learning item "${itemId}" does not allow play mode "${mode}".`,
    )
  }

  return mode
}

function firstAllowedMode(item: LearningItem): PlayMode {
  const first = item.allowedPlayModes[0]
  if (first === undefined) {
    throw new ReviewEventAdapterError(
      `Learning item "${item.itemId}" does not declare any play modes.`,
    )
  }

  return first
}

function nativeEvidenceExtension(evidenceEvent: EvidenceEvent): JsonObject {
  return {
    [LEARNT_EXTENSION_KEY]: {
      nativeEvidence: toJsonObject(evidenceEvent),
    },
  }
}

function readNativeEvidenceExtension(event: ReviewEvent): EvidenceEvent | null {
  const nativeEvidence = readNestedObject(
    event.extensions,
    LEARNT_EXTENSION_KEY,
    'nativeEvidence',
  )
  if (nativeEvidence === null) {
    return null
  }

  const parsed = EvidenceEventSchema.safeParse(nativeEvidence)
  if (!parsed.success) {
    throw new ReviewEventAdapterError(
      `ReviewEvent "${event.eventId}" contains invalid Learnt native evidence extension.`,
      [],
      { cause: parsed.error },
    )
  }
  if (parsed.data.id !== event.eventId) {
    throw new ReviewEventAdapterError(
      `ReviewEvent "${event.eventId}" native evidence extension has mismatched evidence ID "${parsed.data.id}".`,
    )
  }

  return cloneDeep(parsed.data)
}

function synthesizeNativeEvidence(
  event: ReviewEvent,
  pack: LearningPackDocuments,
  defaults: ReviewEventImportDefaults,
): EvidenceEvent {
  const context = requireItemContext(pack, event.itemId)
  const response = toNativeEvidencePayload(event)
  const evaluation = toNativeEvaluationResult(event)
  const objectiveIds = context.objectiveIds

  if (objectiveIds.length === 0) {
    throw new ReviewEventAdapterError(
      `ReviewEvent "${event.eventId}" cannot be imported because item "${event.itemId}" has no objective IDs.`,
    )
  }

  return EvidenceEventSchema.parse({
    schemaVersion: '0.1',
    id: event.eventId,
    timestamp: event.occurredAt,
    learnerId: event.privacy?.learnerId ?? defaults.learnerId,
    profileId: defaults.profileId,
    sessionId: event.privacy?.sessionId ?? defaults.sessionId,
    subjectId: event.subjectId ?? defaults.subjectId ?? context.subjectId,
    moduleId: context.nodeId,
    activityId: event.itemId,
    objectiveIds,
    activityKind: activityKindForPlayMode(event.playMode),
    response,
    hintsUsed: 0,
    evaluation,
  })
}

function toNativeEvidencePayload(event: ReviewEvent): unknown {
  const summary = event.responseSummary

  switch (summary.kind) {
    case 'none':
      return { kind: 'manual', completed: true }
    case 'choice':
      if (
        event.playMode === 'multiple-choice-quiz' ||
        summary.selectedOptionIds.length > 1
      ) {
        return {
          kind: 'multiple-choice',
          optionIds: [...summary.selectedOptionIds],
        }
      }
      return {
        kind: 'single-choice',
        optionId: summary.selectedOptionIds[0] ?? '',
      }
    case 'text':
      return { kind: 'text', value: summary.enteredText ?? '' }
    case 'number':
      return { kind: 'number', value: summary.enteredNumber ?? Number.NaN }
    case 'self-grade':
      return {
        kind: 'confidence',
        value: confidenceForSelfGrade(summary.selfGrade),
      }
    case 'custom':
      return nativePayloadFromCustomSummary(summary.customSummary)
  }
}

function nativePayloadFromCustomSummary(
  customSummary: JsonObject | null,
): unknown {
  if (
    customSummary?.learntEvidenceKind === 'confidence' &&
    typeof customSummary.value === 'number'
  ) {
    return { kind: 'confidence', value: customSummary.value }
  }
  if (
    customSummary?.learntEvidenceKind === 'code' &&
    typeof customSummary.language === 'string' &&
    typeof customSummary.source === 'string'
  ) {
    return {
      kind: 'code',
      language: customSummary.language,
      source: customSummary.source,
    }
  }

  return { kind: 'manual', completed: true }
}

function confidenceForSelfGrade(selfGrade: SelfGrade | null): number {
  switch (selfGrade) {
    case 'again':
      return 1
    case 'hard':
      return 2
    case 'good':
      return 4
    case 'easy':
      return 5
    case null:
      return 3
  }
}

function toNativeEvaluationResult(event: ReviewEvent): EvaluationResult {
  const score = event.normalizedScore

  switch (event.result) {
    case 'correct':
    case 'completed':
      return {
        status: 'passed',
        ...(score === null ? { score: 1 } : { score }),
        matchedCriteria: [],
        missingCriteria: [],
      }
    case 'incorrect':
      return {
        status: 'retry',
        ...(score === null ? { score: 0 } : { score }),
        matchedCriteria: [],
        missingCriteria: [],
      }
    case 'self-graded':
    case 'ungraded':
      return {
        status: 'ungraded',
        ...(score === null ? {} : { score }),
        matchedCriteria: [],
        missingCriteria: [],
      }
  }
}

function activityKindForPlayMode(playMode: PlayMode): ActivityKind {
  switch (playMode) {
    case 'manual-read':
      return 'orient'
    case 'flashcard':
    case 'text-recall':
    case 'number-recall':
    case 'self-grade-review':
      return 'recall'
    case 'single-choice-quiz':
    case 'multiple-choice-quiz':
      return 'predict'
  }
}

function requireItemContext(
  pack: LearningPackDocuments,
  itemId: string,
): ItemContext {
  const item = pack.items.items.find((candidate) => candidate.itemId === itemId)
  if (item === undefined) {
    throw new ReviewEventAdapterError(
      `Learning pack does not contain item "${itemId}".`,
    )
  }

  for (const course of pack.courses.courses) {
    const node = findNodeForItem(course.rootNodes, itemId)
    if (node === null) {
      continue
    }
    const subject = pack.catalog.subjects.find((candidate) =>
      candidate.courseIds.includes(course.courseId),
    )

    if (subject === undefined) {
      throw new ReviewEventAdapterError(
        `Learning pack course "${course.courseId}" is not attached to a subject.`,
      )
    }

    return {
      item,
      subjectId: subject.subjectId,
      courseId: course.courseId,
      nodeId: node.nodeId,
      objectiveIds:
        item.objectiveIds.length > 0 ? item.objectiveIds : node.objectiveIds,
    }
  }

  throw new ReviewEventAdapterError(
    `Learning pack curriculum does not reference item "${itemId}".`,
  )
}

function findNodeForItem(
  nodes: LearningPackDocuments['courses']['courses'][number]['rootNodes'],
  itemId: string,
):
  | LearningPackDocuments['courses']['courses'][number]['rootNodes'][number]
  | null {
  for (const node of nodes) {
    if (node.itemIds.includes(itemId)) {
      return node
    }

    const child = findNodeForItem(node.children, itemId)
    if (child !== null) {
      return child
    }
  }

  return null
}

function readNestedObject(
  root: JsonObject | null,
  firstKey: string,
  secondKey: string,
): JsonObject | null {
  const first = root?.[firstKey]

  if (first === null || typeof first !== 'object' || Array.isArray(first)) {
    return null
  }

  const second = first[secondKey]

  if (second === null || typeof second !== 'object' || Array.isArray(second)) {
    return null
  }

  return second
}

function toJsonObject(value: unknown): JsonObject {
  const cloned = JSON.parse(JSON.stringify(value)) as unknown

  if (cloned === null || typeof cloned !== 'object' || Array.isArray(cloned)) {
    throw new ReviewEventAdapterError('Expected JSON object.')
  }

  return cloned as JsonObject
}

function compareEvidenceEvents(
  left: EvidenceEvent,
  right: EvidenceEvent,
): number {
  const timeDifference =
    Date.parse(left.timestamp) - Date.parse(right.timestamp)

  return timeDifference === 0 ? left.id.localeCompare(right.id) : timeDifference
}
