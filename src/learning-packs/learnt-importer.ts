import {
  validateLearningPackDocuments,
  type CapabilityDeclaration,
  type ContentBlock as PackContentBlock,
  type Course,
  type CurriculumNode,
  type EvaluationDefinition as PackEvaluationDefinition,
  type LearningItem,
  type LearningPackDiagnostic,
  type LearningPackDocuments,
  type PlayMode,
  type ResponseDefinition as PackResponseDefinition,
  type Subject as PackSubject,
} from '@learnt/learning-pack-contracts'

import type {
  ActivityKind,
  CalloutPurpose,
  ScaffoldLevel,
} from '../core/contracts'
import { cloneDeep, deepFreeze, type DeepReadonly } from '../core/foundation'
import {
  createSubjectAdapter,
  defineSubject,
  type SubjectAdapter,
} from '../subject-sdk'

type ItemsDocument = LearningPackDocuments['items']
type CatalogDocument = LearningPackDocuments['catalog']

export type LearningPackInstallStage =
  | 'inspect'
  | 'extract'
  | 'validate'
  | 'plan'
  | 'install'
  | 'adapt'

export type LearningPackInstallErrorOptions = ErrorOptions & {
  stage?: LearningPackInstallStage
}

export type LearningPackDocumentInstallOptions = Readonly<{
  supportedCapabilities?: readonly CapabilityDeclaration[]
}>

export type InstalledLearningPackSubject = Readonly<{
  packId: string
  packVersion: string
  subjectId: string
  courseIds: readonly string[]
  itemIds: readonly string[]
  curriculumRootNodes: readonly DeepReadonly<CurriculumNode>[]
}>

export type InstalledLearningPack = Readonly<{
  packId: string
  packVersion: string
  documents: DeepReadonly<LearningPackDocuments>
  warnings: readonly LearningPackDiagnostic[]
  adapters: readonly SubjectAdapter[]
  subjects: readonly InstalledLearningPackSubject[]
}>

export class LearningPackInstallError extends Error {
  readonly diagnostics: readonly LearningPackDiagnostic[]
  readonly stage?: LearningPackInstallStage

  constructor(
    message: string,
    diagnostics: readonly LearningPackDiagnostic[] = [],
    options?: LearningPackInstallErrorOptions,
  ) {
    super(message, options)
    this.name = 'LearningPackInstallError'
    this.diagnostics = diagnostics
    if (options?.stage !== undefined) {
      this.stage = options.stage
    }
  }
}

export function installLearningPackDocuments(
  input: Partial<LearningPackDocuments>,
  options: LearningPackDocumentInstallOptions = {},
): InstalledLearningPack {
  const validation = validateLearningPackDocuments(
    input,
    options.supportedCapabilities === undefined
      ? {}
      : { supportedCapabilities: options.supportedCapabilities },
  )

  if (!validation.ok || validation.value === undefined) {
    throw new LearningPackInstallError(
      `Learning pack validation failed: ${validation.diagnostics
        .filter((diagnostic) => diagnostic.severity === 'error')
        .map((diagnostic) => `${diagnostic.code} at ${diagnostic.path}`)
        .join('; ')}`,
      validation.diagnostics,
      { stage: 'validate' },
    )
  }

  const canonicalDocuments = deepFreeze(cloneDeep(validation.value))
  const runtimeSubjects = buildRuntimeSubjects(canonicalDocuments)
  const adapters = Object.freeze(
    runtimeSubjects.map((runtimeSubject) =>
      createSubjectAdapter(runtimeSubject.subject),
    ),
  )
  const subjects = deepFreeze(
    cloneDeep(
      runtimeSubjects.map((runtimeSubject) => runtimeSubject.installation),
    ),
  )
  const warnings = deepFreeze(
    cloneDeep(
      validation.diagnostics.filter(
        (diagnostic) => diagnostic.severity === 'warning',
      ),
    ),
  )

  return Object.freeze({
    packId: canonicalDocuments.manifest.packId,
    packVersion: canonicalDocuments.manifest.version,
    documents: canonicalDocuments,
    warnings,
    adapters,
    subjects,
  })
}

export function registerInstalledLearningPack(
  registry: { register(adapter: SubjectAdapter): void },
  installedPack: InstalledLearningPack,
): void {
  for (const adapter of installedPack.adapters) {
    registry.register(adapter)
  }
}

function buildRuntimeSubjects(pack: DeepReadonly<LearningPackDocuments>): {
  subject: ReturnType<typeof defineSubject>
  installation: InstalledLearningPackSubject
}[] {
  return pack.catalog.subjects.map((subject) => {
    const courses = subject.courseIds.map((courseId) =>
      requireCourse(pack, courseId),
    )
    const flattenedNodes = courses.flatMap((course) =>
      flattenCurriculumNodes(course.rootNodes),
    )
    const itemIds = uniqueStrings(
      flattenedNodes.flatMap((node) => [...node.itemIds]),
    )
    const itemById = new Map(
      pack.items.items.map((item) => [item.itemId, item]),
    )
    const nodeByItemId = firstNodeByItemId(flattenedNodes)
    const conceptIds = collectRuntimeConceptIds(
      subject,
      flattenedNodes,
      itemIds,
      pack.catalog,
      pack.items,
    )
    const objectiveIds = collectRuntimeObjectiveIds(
      subject,
      flattenedNodes,
      itemIds,
      pack.items,
    )
    const modules = buildRuntimeModules(flattenedNodes, itemIds)
    const activities = itemIds.map((itemId, index) => {
      const item = itemById.get(itemId)
      const module = nodeByItemId.get(itemId)

      if (item === undefined) {
        throw new LearningPackInstallError(
          `Curriculum node references missing learning item "${itemId}".`,
        )
      }
      if (module === undefined) {
        throw new LearningPackInstallError(
          `Learning item "${itemId}" is not owned by a curriculum node.`,
        )
      }

      return mapLearningItemToActivity(item, module.nodeId, itemIds[index + 1])
    })

    const subjectPackage = {
      schemaVersion: pack.manifest.schemaVersion,
      id: subject.subjectId,
      version: pack.manifest.version,
      title: subject.title,
      summary: subject.summary,
      tags: [...subject.tags],
      modules,
      concepts: pack.catalog.concepts
        .filter((concept) => conceptIds.has(concept.conceptId))
        .map((concept) => ({
          id: concept.conceptId,
          title: concept.title,
          summary: concept.summary,
          prerequisiteConceptIds: concept.prerequisiteConceptIds.filter((id) =>
            conceptIds.has(id),
          ),
          relatedConceptIds: concept.relatedConceptIds.filter((id) =>
            conceptIds.has(id),
          ),
          tags: [...concept.tags],
        })),
      objectives: pack.catalog.objectives
        .filter((objective) => objectiveIds.has(objective.objectiveId))
        .map((objective) => ({
          id: objective.objectiveId,
          conceptIds: objective.conceptIds.filter((id) => conceptIds.has(id)),
          statement: objective.statement,
          successCriteria: [...objective.successCriteria],
        })),
      activities,
      extensions: [],
    }

    const definedSubject = defineImportedSubject(subjectPackage)

    return {
      subject: definedSubject,
      installation: {
        packId: pack.manifest.packId,
        packVersion: pack.manifest.version,
        subjectId: subject.subjectId,
        courseIds: [...subject.courseIds],
        itemIds,
        curriculumRootNodes: courses.flatMap((course) =>
          course.rootNodes.map((node) => cloneDeep(node)),
        ),
      },
    }
  })
}

function defineImportedSubject(subjectPackage: unknown) {
  try {
    return defineSubject(subjectPackage)
  } catch (error: unknown) {
    throw new LearningPackInstallError(
      `Validated learning pack could not be exposed through Concourse's runtime subject registry: ${
        error instanceof Error ? error.message : String(error)
      }`,
      [],
      { cause: error, stage: 'adapt' },
    )
  }
}

function requireCourse(
  pack: DeepReadonly<LearningPackDocuments>,
  courseId: string,
): DeepReadonly<Course> {
  const course = pack.courses.courses.find(
    (candidate) => candidate.courseId === courseId,
  )

  if (course === undefined) {
    throw new LearningPackInstallError(
      `Subject references missing course "${courseId}".`,
    )
  }

  return course
}

function flattenCurriculumNodes(
  nodes: readonly DeepReadonly<CurriculumNode>[],
): DeepReadonly<CurriculumNode>[] {
  return nodes.flatMap((node) => [
    node,
    ...flattenCurriculumNodes(node.children),
  ])
}

function firstNodeByItemId(
  nodes: readonly DeepReadonly<CurriculumNode>[],
): ReadonlyMap<string, DeepReadonly<CurriculumNode>> {
  const owners = new Map<string, DeepReadonly<CurriculumNode>>()

  for (const node of nodes) {
    for (const itemId of node.itemIds) {
      if (!owners.has(itemId)) {
        owners.set(itemId, node)
      }
    }
  }

  return owners
}

function buildRuntimeModules(
  nodes: readonly DeepReadonly<CurriculumNode>[],
  subjectItemIds: readonly string[],
): unknown[] {
  const itemIds = new Set(subjectItemIds)

  return nodes.map((node, index) => ({
    id: node.nodeId,
    title: node.title,
    summary: node.summary,
    order: index,
    conceptIds: [...node.conceptIds],
    objectiveIds: [...node.objectiveIds],
    activityIds: node.itemIds.filter((itemId) => itemIds.has(itemId)),
  }))
}

function collectRuntimeObjectiveIds(
  subject: DeepReadonly<PackSubject>,
  nodes: readonly DeepReadonly<CurriculumNode>[],
  itemIds: readonly string[],
  items: DeepReadonly<ItemsDocument>,
): Set<string> {
  const objectiveIds = new Set<string>(subject.objectiveIds)
  const itemIdSet = new Set(itemIds)

  for (const node of nodes) {
    for (const objectiveId of node.objectiveIds) {
      objectiveIds.add(objectiveId)
    }
  }

  for (const item of items.items) {
    if (!itemIdSet.has(item.itemId)) {
      continue
    }
    for (const objectiveId of item.objectiveIds) {
      objectiveIds.add(objectiveId)
    }
  }

  return objectiveIds
}

function collectRuntimeConceptIds(
  subject: DeepReadonly<PackSubject>,
  nodes: readonly DeepReadonly<CurriculumNode>[],
  itemIds: readonly string[],
  catalog: DeepReadonly<CatalogDocument>,
  items: DeepReadonly<ItemsDocument>,
): Set<string> {
  const conceptIds = new Set<string>(subject.conceptIds)
  const objectiveIds = new Set<string>(subject.objectiveIds)
  const itemIdSet = new Set(itemIds)
  const conceptsById = new Map(
    catalog.concepts.map((concept) => [concept.conceptId, concept]),
  )
  const objectivesById = new Map(
    catalog.objectives.map((objective) => [objective.objectiveId, objective]),
  )

  for (const node of nodes) {
    for (const conceptId of node.conceptIds) {
      conceptIds.add(conceptId)
    }
    for (const objectiveId of node.objectiveIds) {
      objectiveIds.add(objectiveId)
    }
  }

  for (const item of items.items) {
    if (!itemIdSet.has(item.itemId)) {
      continue
    }
    for (const conceptId of item.conceptIds) {
      conceptIds.add(conceptId)
    }
    for (const objectiveId of item.objectiveIds) {
      objectiveIds.add(objectiveId)
    }
  }

  for (const objectiveId of objectiveIds) {
    const objective = objectivesById.get(objectiveId)
    if (objective === undefined) {
      continue
    }
    for (const conceptId of objective.conceptIds) {
      conceptIds.add(conceptId)
    }
  }

  let changed = true
  while (changed) {
    changed = false
    for (const conceptId of [...conceptIds]) {
      const concept = conceptsById.get(conceptId)
      if (concept === undefined) {
        continue
      }
      for (const relatedConceptId of [
        ...concept.prerequisiteConceptIds,
        ...concept.relatedConceptIds,
      ]) {
        if (!conceptIds.has(relatedConceptId)) {
          conceptIds.add(relatedConceptId)
          changed = true
        }
      }
    }
  }

  return conceptIds
}

function mapLearningItemToActivity(
  item: DeepReadonly<LearningItem>,
  moduleId: string,
  nextItemId: string | undefined,
): unknown {
  const contract = mapResponseAndEvaluation(item.response, item.evaluation)

  return {
    id: item.itemId,
    moduleId,
    conceptIds: [...item.conceptIds],
    objectiveIds: [...item.objectiveIds],
    title: item.title,
    kind: mapActivityKind(item.allowedPlayModes),
    scaffoldLevel: mapScaffoldLevel(item.allowedPlayModes),
    blocks: item.promptBlocks.flatMap(mapPackContentBlock),
    ...(contract.response === undefined ? {} : { response: contract.response }),
    evaluation: contract.evaluation,
    completionPolicy: contract.completionPolicy,
    nextActivityIds: nextItemId === undefined ? [] : [nextItemId],
  }
}

function mapResponseAndEvaluation(
  response: DeepReadonly<PackResponseDefinition>,
  evaluation: DeepReadonly<PackEvaluationDefinition>,
) {
  switch (response.kind) {
    case 'none':
      return {
        evaluation: { kind: 'manual-completion' },
        completionPolicy: { kind: 'manual' },
      }
    case 'single-choice':
      return {
        response: {
          kind: 'single-choice',
          options: response.options.map(mapChoiceOption),
        },
        evaluation: requireChoiceEvaluation(evaluation),
        completionPolicy: { kind: 'passing-evaluation' },
      }
    case 'multiple-choice':
      return {
        response: {
          kind: 'multiple-choice',
          options: response.options.map(mapChoiceOption),
        },
        evaluation: requireChoiceEvaluation(evaluation),
        completionPolicy: { kind: 'passing-evaluation' },
      }
    case 'text':
      return {
        response: {
          kind: 'text',
          multiline: false,
          ...(response.textInput?.placeholder === null ||
          response.textInput?.placeholder === undefined
            ? {}
            : { placeholder: response.textInput.placeholder }),
          ...(response.textInput?.minLength === null ||
          response.textInput?.minLength === undefined
            ? {}
            : { minimumLength: response.textInput.minLength }),
          ...(response.textInput?.maxLength === null ||
          response.textInput?.maxLength === undefined
            ? {}
            : { maximumLength: response.textInput.maxLength }),
        },
        evaluation: requireExactTextEvaluation(evaluation),
        completionPolicy: { kind: 'passing-evaluation' },
      }
    case 'number':
      return {
        response: {
          kind: 'number',
          ...(response.numberInput?.min === null ||
          response.numberInput?.min === undefined
            ? {}
            : { minimum: response.numberInput.min }),
          ...(response.numberInput?.max === null ||
          response.numberInput?.max === undefined
            ? {}
            : { maximum: response.numberInput.max }),
        },
        evaluation: requireNumericalEvaluation(evaluation),
        completionPolicy: { kind: 'passing-evaluation' },
      }
    case 'self-grade':
      return {
        evaluation: { kind: 'manual-completion' },
        completionPolicy: { kind: 'manual' },
      }
  }
}

function requireChoiceEvaluation(
  evaluation: DeepReadonly<PackEvaluationDefinition>,
) {
  if (evaluation.kind !== 'choice-selection') {
    throw new LearningPackInstallError(
      `Expected choice-selection evaluation for choice response, got "${evaluation.kind}".`,
    )
  }

  return {
    kind: 'choice-selection',
    correctOptionIds: [...evaluation.correctOptionIds],
  }
}

function requireExactTextEvaluation(
  evaluation: DeepReadonly<PackEvaluationDefinition>,
) {
  if (evaluation.kind !== 'exact-text') {
    throw new LearningPackInstallError(
      `Expected exact-text evaluation for text response, got "${evaluation.kind}".`,
    )
  }

  return {
    kind: 'exact-text',
    acceptedAnswers: [...evaluation.acceptedAnswers],
    caseSensitive: evaluation.caseSensitive,
    trimWhitespace: evaluation.trimWhitespace,
  }
}

function requireNumericalEvaluation(
  evaluation: DeepReadonly<PackEvaluationDefinition>,
) {
  if (evaluation.kind !== 'numerical-tolerance') {
    throw new LearningPackInstallError(
      `Expected numerical-tolerance evaluation for number response, got "${evaluation.kind}".`,
    )
  }

  if (
    evaluation.expectedNumber === null ||
    evaluation.absoluteTolerance === null
  ) {
    throw new LearningPackInstallError(
      'Numerical-tolerance evaluation must include expectedNumber and absoluteTolerance.',
    )
  }

  return {
    kind: 'numerical-tolerance',
    expected: evaluation.expectedNumber,
    absoluteTolerance: evaluation.absoluteTolerance,
  }
}

function mapChoiceOption(
  option: DeepReadonly<PackResponseDefinition['options'][number]>,
) {
  const description = textFromPackBlocks(option.contentBlocks)

  return {
    id: option.optionId,
    label: option.label,
    ...(description === null ? {} : { description }),
  }
}

function mapPackContentBlock(block: DeepReadonly<PackContentBlock>): unknown[] {
  switch (block.kind) {
    case 'text':
      return [{ kind: 'text', body: block.text }]
    case 'question':
      return [{ kind: 'question', prompt: block.text }]
    case 'code':
      return [
        {
          kind: 'code',
          language: block.language ?? 'text',
          source: block.text,
        },
      ]
    case 'equation':
      return [{ kind: 'equation', expression: block.text }]
    case 'callout':
      return [
        {
          kind: 'callout',
          purpose: mapCalloutPurpose(block.calloutRole),
          body: block.text,
        },
      ]
    case 'image':
      return [
        {
          kind: 'text',
          body: `Image: ${block.altText ?? block.assetId ?? 'referenced asset'}`,
        },
      ]
    case 'audio':
      return [
        {
          kind: 'text',
          body: `Audio: ${block.altText ?? block.assetId ?? 'referenced asset'}`,
        },
      ]
  }
}

function mapCalloutPurpose(
  role: PackContentBlock['calloutRole'],
): CalloutPurpose {
  switch (role) {
    case 'warning':
      return 'warning'
    case 'definition':
      return 'mental-model'
    case 'tip':
      return 'connection'
    case 'note':
    case null:
      return 'observation'
  }
}

function textFromPackBlocks(
  blocks: readonly DeepReadonly<PackContentBlock>[],
): string | null {
  if (blocks.length === 0) {
    return null
  }

  return blocks
    .map((block) =>
      block.text.trim().length > 0
        ? block.text
        : (block.altText ?? block.assetId ?? block.kind),
    )
    .join('\n')
}

function mapActivityKind(playModes: readonly PlayMode[]): ActivityKind {
  if (playModes.includes('manual-read')) {
    return 'orient'
  }
  if (
    playModes.includes('text-recall') ||
    playModes.includes('number-recall') ||
    playModes.includes('flashcard') ||
    playModes.includes('self-grade-review')
  ) {
    return 'recall'
  }
  return 'predict'
}

function mapScaffoldLevel(playModes: readonly PlayMode[]): ScaffoldLevel {
  return playModes.includes('manual-read') ? 'worked' : 'guided'
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values)]
}
