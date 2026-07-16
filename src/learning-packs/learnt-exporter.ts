import { createHash } from 'node:crypto'

import {
  SCHEMA_VERSION,
  validateLearningPackDocuments,
  type CalloutRole,
  type CapabilityDeclaration,
  type CatalogDocument,
  type ContentBlock as PackContentBlock,
  type Course,
  type CoursesDocument,
  type CurriculumNode,
  type EvaluationDefinition as PackEvaluationDefinition,
  type LearningItem,
  type LearningPackDocuments,
  type LearningPackManifest,
  type PackFileManifestEntry,
  type PackFileRole,
  type PlayMode,
  type ResponseDefinition as PackResponseDefinition,
  type SetsDocument,
  type StudySet,
} from '@learnt/learning-pack-contracts'

import type {
  ActivityDefinition,
  ChoiceSelectionEvaluation,
  ContentBlock,
  ResponseDefinition,
  SubjectPackage,
} from '../core/contracts'
import type { DeepReadonly } from '../core/foundation'

type ItemsDocument = LearningPackDocuments['items']
type LearntChoiceResponse = Extract<
  ResponseDefinition,
  { kind: 'single-choice' | 'multiple-choice' }
>
type LearntChoiceOption = LearntChoiceResponse['options'][number]

const DEFAULT_AUTHOR = 'Concourse'
const DEFAULT_LANGUAGE = 'en-US'
const DEFAULT_LICENSE = 'proprietary-review-required'
const DEFAULT_RELEASED_AT = '2026-06-23T00:00:00.000Z'
const REQUIRED_CAPABILITY: CapabilityDeclaration = {
  capabilityId: 'core.learning-pack',
  version: SCHEMA_VERSION,
}

export type LearntLearningPackCourseMetadata = Readonly<{
  courseId: string
  title: string
  summary: string
  tags?: readonly string[]
}>

export type LearntLearningPackExportOptions = Readonly<{
  packId?: string
  authorName?: string
  language?: string
  license?: string
  releasedAt?: string
  course?: LearntLearningPackCourseMetadata
  reviewedSolutions?: Readonly<Record<string, readonly PackContentBlock[]>>
}>

export class LearningPackExportError extends Error {
  readonly subjectId: string | null
  readonly activityId: string | null

  constructor(
    message: string,
    details: Readonly<{
      subjectId?: string
      activityId?: string
      cause?: unknown
    }> = {},
  ) {
    super(message, { cause: details.cause })
    this.name = 'LearningPackExportError'
    this.subjectId = details.subjectId ?? null
    this.activityId = details.activityId ?? null
  }
}

export function adaptSubjectPackageToLearningPack(
  subject: DeepReadonly<SubjectPackage>,
  options: LearntLearningPackExportOptions = {},
): LearningPackDocuments {
  const context = createExportContext()
  const packId = options.packId ?? `learnt.${subject.id}`
  const course = buildCourse(subject, options.course)
  const catalog = buildCatalog(subject, course.courseId)
  const courses = buildCourses(course)
  const items = buildItems(subject, options, context)
  const sets = buildSets(subject, course.courseId, items.items)

  declareSubjectExtensionCapabilities(subject, context)

  const manifest: LearningPackManifest = {
    schemaVersion: SCHEMA_VERSION,
    packId,
    version: subject.version,
    title: subject.title,
    summary: subject.summary,
    language: options.language ?? DEFAULT_LANGUAGE,
    license: options.license ?? DEFAULT_LICENSE,
    authors: [{ name: options.authorName ?? DEFAULT_AUTHOR }],
    releasedAt: options.releasedAt ?? DEFAULT_RELEASED_AT,
    capabilities: {
      required: [REQUIRED_CAPABILITY],
      optional: [...context.optionalCapabilities.values()].sort((left, right) =>
        left.capabilityId.localeCompare(right.capabilityId),
      ),
    },
    files: manifestFilesFor({ catalog, courses, items, sets }),
    keywords: [...subject.tags],
  }

  const pack: LearningPackDocuments = {
    manifest,
    catalog,
    courses,
    items,
    sets,
  }

  const validation = validateLearningPackDocuments(pack)
  if (!validation.ok) {
    throw new LearningPackExportError(
      `Learning pack export for subject "${subject.id}" failed shared validation: ${validation.diagnostics
        .map((diagnostic) => `${diagnostic.code} at ${diagnostic.path}`)
        .join('; ')}`,
      { subjectId: subject.id },
    )
  }

  return pack
}

export function serializeLearningPackJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`
}

function createExportContext() {
  return {
    optionalCapabilities: new Map<string, CapabilityDeclaration>(),
  }
}

function buildCatalog(
  subject: DeepReadonly<SubjectPackage>,
  courseId: string,
): CatalogDocument {
  return {
    schemaVersion: SCHEMA_VERSION,
    subjects: [
      {
        subjectId: subject.id,
        title: subject.title,
        summary: subject.summary,
        tags: [...subject.tags],
        conceptIds: subject.concepts.map((concept) => concept.id),
        objectiveIds: subject.objectives.map((objective) => objective.id),
        courseIds: [courseId],
      },
    ],
    concepts: subject.concepts.map((concept) => ({
      conceptId: concept.id,
      title: concept.title,
      summary: concept.summary,
      tags: [...concept.tags],
      prerequisiteConceptIds: [...concept.prerequisiteConceptIds],
      relatedConceptIds: [...concept.relatedConceptIds],
    })),
    objectives: subject.objectives.map((objective) => ({
      objectiveId: objective.id,
      statement: objective.statement,
      successCriteria: [...objective.successCriteria],
      conceptIds: [...objective.conceptIds],
    })),
  }
}

function buildCourse(
  subject: DeepReadonly<SubjectPackage>,
  explicitCourse: LearntLearningPackCourseMetadata | undefined,
): Course {
  const courseId = explicitCourse?.courseId ?? `${subject.id}-course`
  return {
    courseId,
    title: explicitCourse?.title ?? subject.title,
    summary: explicitCourse?.summary ?? subject.summary,
    subjectIds: [subject.id],
    tags: [...(explicitCourse?.tags ?? subject.tags)],
    rootNodes: [...subject.modules]
      .sort(
        (left, right) =>
          left.order - right.order || left.id.localeCompare(right.id),
      )
      .map<CurriculumNode>((module) => ({
        nodeId: module.id,
        kind: 'module',
        title: module.title,
        summary: module.summary,
        itemIds: [...module.activityIds],
        conceptIds: [...module.conceptIds],
        objectiveIds: [...module.objectiveIds],
        children: [],
        customKindLabel: null,
      })),
  }
}

function buildCourses(course: Course): CoursesDocument {
  return {
    schemaVersion: SCHEMA_VERSION,
    courses: [course],
  }
}

function buildItems(
  subject: DeepReadonly<SubjectPackage>,
  options: LearntLearningPackExportOptions,
  context: ReturnType<typeof createExportContext>,
): ItemsDocument {
  return {
    schemaVersion: SCHEMA_VERSION,
    items: subject.activities.map((activity) =>
      buildLearningItem(subject, activity, options, context),
    ),
  }
}

function buildLearningItem(
  subject: DeepReadonly<SubjectPackage>,
  activity: DeepReadonly<ActivityDefinition>,
  options: LearntLearningPackExportOptions,
  context: ReturnType<typeof createExportContext>,
): LearningItem {
  const projection = projectResponseAndEvaluation(subject.id, activity, context)
  const explicitSolutionBlocks = options.reviewedSolutions?.[activity.id]
  const reviewedSolutionBlocks =
    explicitSolutionBlocks === undefined
      ? generateDeterministicSolutionBlocks(activity)
      : explicitSolutionBlocks.map((block) => ({ ...block }))
  const allowedPlayModes = [...projection.allowedPlayModes]

  if (
    reviewedSolutionBlocks.length > 0 &&
    !allowedPlayModes.includes('flashcard') &&
    canUseFlashcardMode(projection.response, projection.evaluation)
  ) {
    allowedPlayModes.push('flashcard')
  }

  return {
    itemId: activity.id,
    learningRevision: 1,
    title: activity.title,
    promptBlocks: activity.blocks.flatMap((block) =>
      mapContentBlock(block, context),
    ),
    response: projection.response,
    evaluation: projection.evaluation,
    reviewedSolutionBlocks,
    conceptIds: [...activity.conceptIds],
    objectiveIds: [...activity.objectiveIds],
    allowedPlayModes,
  }
}

function projectResponseAndEvaluation(
  subjectId: string,
  activity: DeepReadonly<ActivityDefinition>,
  context: ReturnType<typeof createExportContext>,
): Readonly<{
  response: PackResponseDefinition
  evaluation: PackEvaluationDefinition
  allowedPlayModes: readonly PlayMode[]
}> {
  if (activity.response === undefined) {
    if (
      activity.evaluation.kind === 'manual-completion' &&
      activity.completionPolicy.kind === 'manual'
    ) {
      return {
        response: responseNone(),
        evaluation: manualEvaluation(),
        allowedPlayModes: ['manual-read'],
      }
    }

    throw unsupportedActivity(
      subjectId,
      activity,
      'activity without a response cannot be represented unless it is manual completion',
    )
  }

  switch (activity.response.kind) {
    case 'confidence':
      throw unsupportedActivity(
        subjectId,
        activity,
        'confidence response cannot be represented in Learning Pack Contract 0.1',
      )
    case 'code':
      if (activity.evaluation.kind === 'rubric-assisted-text') {
        return projectRubricAssistedAsSelfGrade(activity, context)
      }
      throw unsupportedActivity(
        subjectId,
        activity,
        'code response cannot be represented in Learning Pack Contract 0.1',
      )
    case 'single-choice':
      assertRepresentableEvaluation(subjectId, activity)
      return projectSingleChoice(subjectId, activity, activity.response)
    case 'multiple-choice':
      assertRepresentableEvaluation(subjectId, activity)
      return projectMultipleChoice(subjectId, activity, activity.response)
    case 'text':
      if (activity.evaluation.kind === 'rubric-assisted-text') {
        return projectRubricAssistedAsSelfGrade(activity, context)
      }
      assertRepresentableEvaluation(subjectId, activity)
      return projectText(subjectId, activity, activity.response)
    case 'number':
      assertRepresentableEvaluation(subjectId, activity)
      return projectNumber(subjectId, activity, activity.response)
  }
}

function assertRepresentableEvaluation(
  subjectId: string,
  activity: DeepReadonly<ActivityDefinition>,
): void {
  switch (activity.evaluation.kind) {
    case 'manual-completion':
    case 'choice-selection':
    case 'exact-text':
    case 'numerical-tolerance':
      return
    case 'rubric-assisted-text':
      throw unsupportedActivity(
        subjectId,
        activity,
        'rubric-assisted-text evaluation cannot be represented deterministically',
      )
    case 'extension':
      throw unsupportedActivity(
        subjectId,
        activity,
        'extension evaluation cannot be represented in Learning Pack Contract 0.1',
      )
  }
}

function projectSingleChoice(
  subjectId: string,
  activity: DeepReadonly<ActivityDefinition>,
  response: DeepReadonly<
    Extract<ResponseDefinition, { kind: 'single-choice' }>
  >,
) {
  const evaluation = requireChoiceEvaluation(subjectId, activity)
  if (evaluation.correctOptionIds.length !== 1) {
    throw unsupportedActivity(
      subjectId,
      activity,
      'single-choice response requires exactly one correct option',
    )
  }

  return {
    response: {
      kind: 'single-choice',
      options: response.options.map(mapChoiceOption),
      textInput: null,
      numberInput: null,
    },
    evaluation: choiceEvaluation(evaluation.correctOptionIds),
    allowedPlayModes: ['single-choice-quiz'],
  } satisfies Readonly<{
    response: PackResponseDefinition
    evaluation: PackEvaluationDefinition
    allowedPlayModes: readonly PlayMode[]
  }>
}

function projectMultipleChoice(
  subjectId: string,
  activity: DeepReadonly<ActivityDefinition>,
  response: DeepReadonly<
    Extract<ResponseDefinition, { kind: 'multiple-choice' }>
  >,
) {
  const evaluation = requireChoiceEvaluation(subjectId, activity)

  return {
    response: {
      kind: 'multiple-choice',
      options: response.options.map(mapChoiceOption),
      textInput: null,
      numberInput: null,
    },
    evaluation: choiceEvaluation(evaluation.correctOptionIds),
    allowedPlayModes: ['multiple-choice-quiz'],
  } satisfies Readonly<{
    response: PackResponseDefinition
    evaluation: PackEvaluationDefinition
    allowedPlayModes: readonly PlayMode[]
  }>
}

function projectText(
  subjectId: string,
  activity: DeepReadonly<ActivityDefinition>,
  response: DeepReadonly<Extract<ResponseDefinition, { kind: 'text' }>>,
) {
  if (activity.evaluation.kind !== 'exact-text') {
    throw unsupportedActivity(
      subjectId,
      activity,
      'text response requires exact-text evaluation',
    )
  }

  return {
    response: {
      kind: 'text',
      options: [],
      textInput: {
        placeholder: response.placeholder ?? null,
        minLength: response.minimumLength ?? null,
        maxLength: response.maximumLength ?? null,
      },
      numberInput: null,
    },
    evaluation: {
      kind: 'exact-text',
      correctOptionIds: [],
      acceptedAnswers: [...activity.evaluation.acceptedAnswers],
      caseSensitive: activity.evaluation.caseSensitive,
      trimWhitespace: activity.evaluation.trimWhitespace,
      expectedNumber: null,
      absoluteTolerance: null,
      passingSelfGrades: [],
    },
    allowedPlayModes: ['text-recall'],
  } satisfies Readonly<{
    response: PackResponseDefinition
    evaluation: PackEvaluationDefinition
    allowedPlayModes: readonly PlayMode[]
  }>
}

function projectNumber(
  subjectId: string,
  activity: DeepReadonly<ActivityDefinition>,
  response: DeepReadonly<Extract<ResponseDefinition, { kind: 'number' }>>,
) {
  if (activity.evaluation.kind !== 'numerical-tolerance') {
    throw unsupportedActivity(
      subjectId,
      activity,
      'number response requires numerical-tolerance evaluation',
    )
  }

  return {
    response: {
      kind: 'number',
      options: [],
      textInput: null,
      numberInput: {
        placeholder: null,
        unitLabel: null,
        min: response.minimum ?? null,
        max: response.maximum ?? null,
      },
    },
    evaluation: {
      kind: 'numerical-tolerance',
      correctOptionIds: [],
      acceptedAnswers: [],
      caseSensitive: false,
      trimWhitespace: true,
      expectedNumber: activity.evaluation.expected,
      absoluteTolerance: activity.evaluation.absoluteTolerance,
      passingSelfGrades: [],
    },
    allowedPlayModes: ['number-recall'],
  } satisfies Readonly<{
    response: PackResponseDefinition
    evaluation: PackEvaluationDefinition
    allowedPlayModes: readonly PlayMode[]
  }>
}

function projectRubricAssistedAsSelfGrade(
  activity: DeepReadonly<ActivityDefinition>,
  context: ReturnType<typeof createExportContext>,
) {
  declareOptionalCapability(context, 'learnt.evaluation.rubric-assisted-text')
  if (activity.response?.kind === 'text') {
    declareOptionalCapability(context, 'learnt.response.text-draft')
  }
  if (activity.response?.kind === 'code') {
    declareOptionalCapability(context, 'learnt.response.code-draft')
  }

  return {
    response: {
      kind: 'self-grade',
      options: [],
      textInput: null,
      numberInput: null,
    },
    evaluation: {
      kind: 'self-grade',
      correctOptionIds: [],
      acceptedAnswers: [],
      caseSensitive: false,
      trimWhitespace: true,
      expectedNumber: null,
      absoluteTolerance: null,
      passingSelfGrades: ['good', 'easy'],
    },
    allowedPlayModes: ['self-grade-review'],
  } satisfies Readonly<{
    response: PackResponseDefinition
    evaluation: PackEvaluationDefinition
    allowedPlayModes: readonly PlayMode[]
  }>
}

function requireChoiceEvaluation(
  subjectId: string,
  activity: DeepReadonly<ActivityDefinition>,
): DeepReadonly<ChoiceSelectionEvaluation> {
  if (activity.evaluation.kind !== 'choice-selection') {
    throw unsupportedActivity(
      subjectId,
      activity,
      'choice response requires choice-selection evaluation',
    )
  }
  return activity.evaluation
}

function mapChoiceOption(option: DeepReadonly<LearntChoiceOption>) {
  return {
    optionId: option.id,
    label: option.label,
    contentBlocks:
      option.description === undefined ? [] : [textBlock(option.description)],
  }
}

function responseNone(): PackResponseDefinition {
  return {
    kind: 'none',
    options: [],
    textInput: null,
    numberInput: null,
  }
}

function manualEvaluation(): PackEvaluationDefinition {
  return {
    kind: 'manual-completion',
    correctOptionIds: [],
    acceptedAnswers: [],
    caseSensitive: false,
    trimWhitespace: true,
    expectedNumber: null,
    absoluteTolerance: null,
    passingSelfGrades: [],
  }
}

function choiceEvaluation(
  correctOptionIds: readonly string[],
): PackEvaluationDefinition {
  return {
    kind: 'choice-selection',
    correctOptionIds: [...correctOptionIds],
    acceptedAnswers: [],
    caseSensitive: false,
    trimWhitespace: true,
    expectedNumber: null,
    absoluteTolerance: null,
    passingSelfGrades: [],
  }
}

function generateDeterministicSolutionBlocks(
  activity: DeepReadonly<ActivityDefinition>,
): PackContentBlock[] {
  if (activity.response === undefined) {
    return []
  }

  if (
    (activity.response.kind === 'single-choice' ||
      activity.response.kind === 'multiple-choice') &&
    activity.evaluation.kind === 'choice-selection'
  ) {
    const labels = labelsForCorrectOptions(
      activity.response,
      activity.evaluation.correctOptionIds,
    )
    const prefix =
      activity.response.kind === 'single-choice'
        ? 'Correct answer'
        : 'Correct answers'
    return [textBlock(`${prefix}: ${labels.join('; ')}.`)]
  }

  if (
    activity.response.kind === 'text' &&
    activity.evaluation.kind === 'exact-text'
  ) {
    return [
      textBlock(
        `Accepted answers: ${activity.evaluation.acceptedAnswers.join('; ')}.`,
      ),
    ]
  }

  if (
    activity.response.kind === 'number' &&
    activity.evaluation.kind === 'numerical-tolerance'
  ) {
    return [
      textBlock(
        `Expected answer: ${String(activity.evaluation.expected)} (tolerance ${String(activity.evaluation.absoluteTolerance)}).`,
      ),
    ]
  }

  return []
}

function labelsForCorrectOptions(
  response: DeepReadonly<LearntChoiceResponse>,
  correctOptionIds: readonly string[],
): string[] {
  const optionsById = new Map<string, string>()
  for (const option of response.options) {
    optionsById.set(option.id, option.label)
  }
  return correctOptionIds.map((optionId) => {
    const label = optionsById.get(optionId)
    if (label === undefined) {
      throw new LearningPackExportError(
        `Choice solution references missing option "${optionId}".`,
      )
    }
    return label
  })
}

function canUseFlashcardMode(
  response: PackResponseDefinition,
  evaluation: PackEvaluationDefinition,
): boolean {
  if (response.kind === 'single-choice') {
    return (
      evaluation.kind === 'choice-selection' &&
      evaluation.correctOptionIds.length === 1
    )
  }
  if (response.kind === 'multiple-choice') {
    return (
      evaluation.kind === 'choice-selection' &&
      evaluation.correctOptionIds.length > 0
    )
  }
  if (response.kind === 'text') {
    return (
      evaluation.kind === 'exact-text' && evaluation.acceptedAnswers.length > 0
    )
  }
  if (response.kind === 'number') {
    return (
      evaluation.kind === 'numerical-tolerance' &&
      evaluation.expectedNumber !== null &&
      evaluation.absoluteTolerance !== null
    )
  }
  return false
}

function mapContentBlock(
  block: DeepReadonly<ContentBlock>,
  context: ReturnType<typeof createExportContext>,
): PackContentBlock[] {
  switch (block.kind) {
    case 'text':
      return [textBlock(block.body)]
    case 'question':
      return [
        {
          kind: 'question',
          text:
            block.supportingText === undefined
              ? block.prompt
              : `${block.prompt}\n\n${block.supportingText}`,
          language: null,
          calloutRole: null,
          assetId: null,
          altText: null,
        },
      ]
    case 'code':
      return [
        {
          kind: 'code',
          text:
            block.caption === undefined
              ? block.source
              : `${block.caption}\n\n${block.source}`,
          language: block.language,
          calloutRole: null,
          assetId: null,
          altText: null,
        },
      ]
    case 'equation':
      return [
        {
          kind: 'equation',
          text:
            block.description === undefined
              ? block.expression
              : `${block.expression}\n\n${block.description}`,
          language: null,
          calloutRole: null,
          assetId: null,
          altText: null,
        },
      ]
    case 'callout':
      return [
        {
          kind: 'callout',
          text:
            block.title === undefined
              ? block.body
              : `${block.title}\n\n${block.body}`,
          language: null,
          calloutRole: mapCalloutRole(block.purpose),
          assetId: null,
          altText: null,
        },
      ]
    case 'comparison':
      return [
        textBlock(
          block.items.map((item) => `${item.label}: ${item.body}`).join('\n'),
        ),
      ]
    case 'extension':
      declareOptionalCapability(context, `learnt.renderer.${block.rendererKey}`)
      return []
  }
}

function mapCalloutRole(
  purpose: DeepReadonly<Extract<ContentBlock, { kind: 'callout' }>['purpose']>,
): CalloutRole {
  switch (purpose) {
    case 'warning':
    case 'misconception':
      return 'warning'
    case 'mental-model':
      return 'tip'
    case 'connection':
    case 'observation':
      return 'note'
  }
}

function textBlock(text: string): PackContentBlock {
  return {
    kind: 'text',
    text,
    language: null,
    calloutRole: null,
    assetId: null,
    altText: null,
  }
}

function buildSets(
  subject: DeepReadonly<SubjectPackage>,
  courseId: string,
  items: readonly LearningItem[],
): SetsDocument {
  const playModes = uniquePlayModes(
    items.flatMap((item) => item.allowedPlayModes),
  )
  const studySet: StudySet = {
    setId: `${subject.id}-study-set`,
    kind: 'practice',
    title: `${subject.title} Practice`,
    summary: `All exported practice items for ${subject.title}.`,
    selection: {
      kind: 'rule',
      include: {
        subjectIds: [subject.id],
        courseIds: [courseId],
        nodeIds: [],
        conceptIds: [],
        objectiveIds: [],
        allowedPlayModes: [],
        tags: [],
      },
      exclude: {
        itemIds: [],
        conceptIds: [],
        objectiveIds: [],
        tags: [],
      },
      limit: null,
    },
    playModes,
    ordering: 'authored',
    timeLimitSeconds: null,
    attemptLimit: null,
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    sets: [studySet],
  }
}

function uniquePlayModes(playModes: readonly PlayMode[]): PlayMode[] {
  return [...new Set(playModes)]
}

function declareSubjectExtensionCapabilities(
  subject: DeepReadonly<SubjectPackage>,
  context: ReturnType<typeof createExportContext>,
): void {
  for (const extension of subject.extensions) {
    declareOptionalCapability(
      context,
      extension.kind === 'renderer'
        ? `learnt.renderer.${extension.key}`
        : `learnt.evaluator.${extension.key}`,
    )
  }
}

function declareOptionalCapability(
  context: ReturnType<typeof createExportContext>,
  capabilityId: string,
): void {
  context.optionalCapabilities.set(capabilityId, {
    capabilityId,
    version: SCHEMA_VERSION,
  })
}

function manifestFilesFor(
  documents: Readonly<{
    catalog: CatalogDocument
    courses: CoursesDocument
    items: ItemsDocument
    sets: SetsDocument
  }>,
): PackFileManifestEntry[] {
  return [
    manifestFile('catalog.json', 'catalog', documents.catalog),
    manifestFile('courses.json', 'courses', documents.courses),
    manifestFile('items.json', 'items', documents.items),
    manifestFile('sets.json', 'sets', documents.sets),
  ]
}

function manifestFile(
  path: string,
  role: PackFileRole,
  document: CatalogDocument | CoursesDocument | ItemsDocument | SetsDocument,
): PackFileManifestEntry {
  const serializedDocument = serializeLearningPackJson(document)
  return {
    assetId: null,
    path,
    role,
    mediaType: 'application/json',
    sha256: createHash('sha256').update(serializedDocument).digest('hex'),
    bytes: Buffer.byteLength(serializedDocument, 'utf8'),
  }
}

function unsupportedActivity(
  subjectId: string,
  activity: DeepReadonly<Pick<ActivityDefinition, 'id'>>,
  reason: string,
): LearningPackExportError {
  return new LearningPackExportError(`Activity "${activity.id}" ${reason}.`, {
    subjectId,
    activityId: activity.id,
  })
}
