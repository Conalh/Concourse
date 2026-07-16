import {
  LearningPackErrorCode,
  hasBlockingDiagnostics,
  makeDiagnostic,
  type LearningPackDiagnostic,
  type ValidationResult,
} from './errors.js'
import { isValidLocalEntityId } from './helpers.js'
import { validateJsonFile } from './structural-validation.js'
import type {
  CurriculumNode,
  LearningItem,
  LearningPackDocuments,
  ReviewEvent,
  ReviewEventResponseSummary,
} from './types.js'

export interface ReviewEventValidationOptions {
  pack?: LearningPackDocuments
  path?: string
}

interface ReviewEventPackIndex {
  subjects: Set<string>
  courses: Set<string>
  curriculumNodes: Set<string>
  concepts: Set<string>
  objectives: Set<string>
  items: Map<string, LearningItem>
  sets: Set<string>
}

export function validateReviewEvent(
  value: unknown,
  options: ReviewEventValidationOptions = {},
): ValidationResult<ReviewEvent> {
  const rootPath = options.path ?? 'reviewEvent'
  const structural = validateJsonFile('reviewEvent', value, { path: rootPath })
  if (!structural.value || hasBlockingDiagnostics(structural.diagnostics)) {
    return structural
  }

  const diagnostics = [
    ...structural.diagnostics,
    ...validateReviewEventSemantics(structural.value, options),
  ]

  return {
    ok: !hasBlockingDiagnostics(diagnostics),
    value: !hasBlockingDiagnostics(diagnostics) ? structural.value : undefined,
    diagnostics,
  }
}

export function validateReviewEventSemantics(
  event: ReviewEvent,
  options: ReviewEventValidationOptions = {},
): LearningPackDiagnostic[] {
  const rootPath = options.path ?? 'reviewEvent'
  const diagnostics: LearningPackDiagnostic[] = []
  validateResponseSummary(
    event.responseSummary,
    `${rootPath}.responseSummary`,
    diagnostics,
  )

  if (options.pack) {
    validatePackReferences(event, rootPath, options.pack, diagnostics)
  }

  return diagnostics
}

function validateResponseSummary(
  summary: ReviewEventResponseSummary,
  path: string,
  diagnostics: LearningPackDiagnostic[],
): void {
  if (summary.kind !== 'choice' && summary.selectedOptionIds.length > 0) {
    diagnostics.push(
      makeDiagnostic(
        LearningPackErrorCode.INVALID_RESPONSE_EVALUATION_PAIR,
        'error',
        `${path}.selectedOptionIds`,
        'Only choice response summaries may include selectedOptionIds.',
      ),
    )
  }

  if (summary.kind === 'choice' && summary.selectedOptionIds.length === 0) {
    diagnostics.push(
      makeDiagnostic(
        LearningPackErrorCode.INVALID_RESPONSE_EVALUATION_PAIR,
        'error',
        `${path}.selectedOptionIds`,
        'Choice response summaries must include at least one selected option ID.',
      ),
    )
  }

  if (summary.kind !== 'text' && summary.enteredText !== null) {
    diagnostics.push(
      makeDiagnostic(
        LearningPackErrorCode.INVALID_RESPONSE_EVALUATION_PAIR,
        'error',
        `${path}.enteredText`,
        'Only text response summaries may include enteredText.',
      ),
    )
  }

  if (summary.kind !== 'number' && summary.enteredNumber !== null) {
    diagnostics.push(
      makeDiagnostic(
        LearningPackErrorCode.INVALID_RESPONSE_EVALUATION_PAIR,
        'error',
        `${path}.enteredNumber`,
        'Only number response summaries may include enteredNumber.',
      ),
    )
  }

  if (summary.kind !== 'self-grade' && summary.selfGrade !== null) {
    diagnostics.push(
      makeDiagnostic(
        LearningPackErrorCode.INVALID_RESPONSE_EVALUATION_PAIR,
        'error',
        `${path}.selfGrade`,
        'Only self-grade response summaries may include selfGrade.',
      ),
    )
  }

  if (summary.kind === 'self-grade' && summary.selfGrade === null) {
    diagnostics.push(
      makeDiagnostic(
        LearningPackErrorCode.INVALID_RESPONSE_EVALUATION_PAIR,
        'error',
        `${path}.selfGrade`,
        'Self-grade response summaries must include selfGrade.',
      ),
    )
  }

  if (summary.kind !== 'custom' && summary.customSummary !== null) {
    diagnostics.push(
      makeDiagnostic(
        LearningPackErrorCode.INVALID_RESPONSE_EVALUATION_PAIR,
        'error',
        `${path}.customSummary`,
        'Only custom response summaries may include customSummary.',
      ),
    )
  }

  if (summary.kind === 'custom' && summary.customSummary === null) {
    diagnostics.push(
      makeDiagnostic(
        LearningPackErrorCode.INVALID_RESPONSE_EVALUATION_PAIR,
        'error',
        `${path}.customSummary`,
        'Custom response summaries must include customSummary.',
      ),
    )
  }
}

function validatePackReferences(
  event: ReviewEvent,
  rootPath: string,
  pack: LearningPackDocuments,
  diagnostics: LearningPackDiagnostic[],
): void {
  const index = buildReviewEventPackIndex(pack)
  const item = index.items.get(event.itemId)

  if (pack.manifest.packId !== event.packId) {
    diagnostics.push(
      makeDiagnostic(
        LearningPackErrorCode.MISSING_REFERENCE,
        'error',
        `${rootPath}.packId`,
        `ReviewEvent references packId ${event.packId}, but validation pack is ${pack.manifest.packId}.`,
      ),
    )
  }

  if (pack.manifest.version !== event.packVersion) {
    diagnostics.push(
      makeDiagnostic(
        LearningPackErrorCode.MISSING_REFERENCE,
        'error',
        `${rootPath}.packVersion`,
        `ReviewEvent references pack version ${event.packVersion}, but validation pack is ${pack.manifest.version}.`,
      ),
    )
  }

  if (!item) {
    diagnostics.push(
      makeDiagnostic(
        LearningPackErrorCode.MISSING_REFERENCE,
        'error',
        `${rootPath}.itemId`,
        `ReviewEvent references missing item ${event.itemId}.`,
      ),
    )
  } else {
    if (item.learningRevision !== event.learningRevision) {
      diagnostics.push(
        makeDiagnostic(
          LearningPackErrorCode.MISSING_REFERENCE,
          'error',
          `${rootPath}.learningRevision`,
          `ReviewEvent learningRevision ${event.learningRevision} does not match item revision ${item.learningRevision}.`,
        ),
      )
    }
    if (!item.allowedPlayModes.includes(event.playMode)) {
      diagnostics.push(
        makeDiagnostic(
          LearningPackErrorCode.MISSING_REFERENCE,
          'error',
          `${rootPath}.playMode`,
          `ReviewEvent playMode ${event.playMode} is not allowed for item ${event.itemId}.`,
        ),
      )
    }
    validateSelectedOptionReferences(event, rootPath, item, diagnostics)
  }

  if (event.subjectId !== null && !index.subjects.has(event.subjectId)) {
    diagnostics.push(
      missingLocalReference(
        `${rootPath}.subjectId`,
        'subject',
        event.subjectId,
      ),
    )
  }
  if (event.courseId !== null && !index.courses.has(event.courseId)) {
    diagnostics.push(
      missingLocalReference(`${rootPath}.courseId`, 'course', event.courseId),
    )
  }

  for (const [targetIndex, targetId] of event.confusionTargetIds.entries()) {
    if (!hasAnyLocalEntity(index, targetId)) {
      diagnostics.push(
        missingLocalReference(
          `${rootPath}.confusionTargetIds[${targetIndex}]`,
          'confusion target',
          targetId,
        ),
      )
    }
  }
}

function validateSelectedOptionReferences(
  event: ReviewEvent,
  rootPath: string,
  item: LearningItem,
  diagnostics: LearningPackDiagnostic[],
): void {
  if (event.responseSummary.kind !== 'choice') {
    return
  }
  const optionIds = new Set(
    item.response.options.map((option) => option.optionId),
  )
  for (const [
    optionIndex,
    optionId,
  ] of event.responseSummary.selectedOptionIds.entries()) {
    if (!optionIds.has(optionId)) {
      diagnostics.push(
        makeDiagnostic(
          LearningPackErrorCode.INVALID_ANSWER_OPTION_REFERENCE,
          'error',
          `${rootPath}.responseSummary.selectedOptionIds[${optionIndex}]`,
          `Selected option ${optionId} is not defined by item ${event.itemId}.`,
        ),
      )
    }
  }
}

function buildReviewEventPackIndex(
  pack: LearningPackDocuments,
): ReviewEventPackIndex {
  const index: ReviewEventPackIndex = {
    subjects: new Set(
      pack.catalog.subjects.map((subject) => subject.subjectId),
    ),
    courses: new Set(pack.courses.courses.map((course) => course.courseId)),
    curriculumNodes: new Set(),
    concepts: new Set(
      pack.catalog.concepts.map((concept) => concept.conceptId),
    ),
    objectives: new Set(
      pack.catalog.objectives.map((objective) => objective.objectiveId),
    ),
    items: new Map(pack.items.items.map((item) => [item.itemId, item])),
    sets: new Set(pack.sets.sets.map((set) => set.setId)),
  }

  for (const course of pack.courses.courses) {
    for (const node of course.rootNodes) {
      addCurriculumNodeIds(node, index.curriculumNodes)
    }
  }

  return index
}

function addCurriculumNodeIds(node: CurriculumNode, ids: Set<string>): void {
  ids.add(node.nodeId)
  for (const child of node.children) {
    addCurriculumNodeIds(child, ids)
  }
}

function hasAnyLocalEntity(index: ReviewEventPackIndex, id: string): boolean {
  return (
    index.subjects.has(id) ||
    index.courses.has(id) ||
    index.curriculumNodes.has(id) ||
    index.concepts.has(id) ||
    index.objectives.has(id) ||
    index.items.has(id) ||
    index.sets.has(id)
  )
}

function missingLocalReference(
  path: string,
  kind: string,
  id: string,
): LearningPackDiagnostic {
  return makeDiagnostic(
    isValidLocalEntityId(id)
      ? LearningPackErrorCode.MISSING_REFERENCE
      : LearningPackErrorCode.INVALID_ID,
    'error',
    path,
    `ReviewEvent references missing ${kind} ${id}.`,
  )
}
