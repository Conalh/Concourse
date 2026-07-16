import type {
  ActivityDefinition,
  ConceptDefinition,
  ContentBlock,
  ModuleDefinition,
  SubjectPackage,
} from '../core/contracts'

import type { SubjectDefinitionIssue } from './subject-sdk-error'

type EntityCollectionName = 'activities' | 'concepts' | 'modules' | 'objectives'

interface LookupMaps {
  readonly activities: ReadonlyMap<string, ActivityDefinition>
  readonly concepts: ReadonlyMap<string, ConceptDefinition>
  readonly modules: ReadonlyMap<string, ModuleDefinition>
  readonly objectives: ReadonlyMap<string, SubjectPackage['objectives'][number]>
}

export function validateSubjectIntegrity(
  subject: SubjectPackage,
): readonly SubjectDefinitionIssue[] {
  const issues: SubjectDefinitionIssue[] = []

  issues.push(...validateDuplicateEntityIds(subject))
  issues.push(...validateDuplicateModuleOrders(subject))

  const lookupMaps = createLookupMaps(subject)

  issues.push(...validateReferences(subject, lookupMaps))
  issues.push(...validateActivityOwnership(subject, lookupMaps))
  issues.push(...validatePrerequisiteGraph(subject))
  issues.push(...validateActivityGraph(subject))
  issues.push(...validateChoiceIntegrity(subject))
  issues.push(...validateExtensionManifests(subject))

  return issues
}

function createLookupMaps(subject: SubjectPackage): LookupMaps {
  return {
    activities: createEntityMap(subject.activities),
    concepts: createEntityMap(subject.concepts),
    modules: createEntityMap(subject.modules),
    objectives: createEntityMap(subject.objectives),
  }
}

function createEntityMap<Entity extends { readonly id: string }>(
  entities: readonly Entity[],
): ReadonlyMap<string, Entity> {
  const map = new Map<string, Entity>()

  for (const entity of entities) {
    if (!map.has(entity.id)) {
      map.set(entity.id, entity)
    }
  }

  return map
}

function validateDuplicateEntityIds(
  subject: SubjectPackage,
): SubjectDefinitionIssue[] {
  return [
    ...duplicateEntityIssues('modules', subject.modules),
    ...duplicateEntityIssues('concepts', subject.concepts),
    ...duplicateEntityIssues('objectives', subject.objectives),
    ...duplicateEntityIssues('activities', subject.activities),
  ]
}

function duplicateEntityIssues(
  collectionName: EntityCollectionName,
  entities: readonly { readonly id: string }[],
): SubjectDefinitionIssue[] {
  const firstSeen = new Map<string, number>()
  const issues: SubjectDefinitionIssue[] = []

  entities.forEach((entity, index) => {
    const firstIndex = firstSeen.get(entity.id)

    if (firstIndex === undefined) {
      firstSeen.set(entity.id, index)
      return
    }

    issues.push({
      code: 'duplicate-entity-id',
      path: [collectionName, index, 'id'],
      message: `${collectionName}[${String(index)}] duplicates ID "${entity.id}" from ${collectionName}[${String(firstIndex)}].`,
    })
  })

  return issues
}

function validateDuplicateModuleOrders(
  subject: SubjectPackage,
): SubjectDefinitionIssue[] {
  const firstSeen = new Map<number, number>()
  const issues: SubjectDefinitionIssue[] = []

  subject.modules.forEach((module, index) => {
    const firstIndex = firstSeen.get(module.order)

    if (firstIndex === undefined) {
      firstSeen.set(module.order, index)
      return
    }

    issues.push({
      code: 'duplicate-module-order',
      path: ['modules', index, 'order'],
      message: `Module "${module.id}" repeats order ${String(module.order)} from module "${subject.modules[firstIndex]?.id ?? 'unknown'}".`,
    })
  })

  return issues
}

function validateReferences(
  subject: SubjectPackage,
  lookupMaps: LookupMaps,
): SubjectDefinitionIssue[] {
  const issues: SubjectDefinitionIssue[] = []

  subject.modules.forEach((module, moduleIndex) => {
    issues.push(
      ...missingReferenceIssues(
        module.conceptIds,
        lookupMaps.concepts,
        ['modules', moduleIndex, 'conceptIds'],
        'concept',
      ),
      ...missingReferenceIssues(
        module.objectiveIds,
        lookupMaps.objectives,
        ['modules', moduleIndex, 'objectiveIds'],
        'objective',
      ),
      ...missingReferenceIssues(
        module.activityIds,
        lookupMaps.activities,
        ['modules', moduleIndex, 'activityIds'],
        'activity',
      ),
    )
  })

  subject.concepts.forEach((concept, conceptIndex) => {
    issues.push(
      ...missingReferenceIssues(
        concept.prerequisiteConceptIds,
        lookupMaps.concepts,
        ['concepts', conceptIndex, 'prerequisiteConceptIds'],
        'concept',
      ),
      ...missingReferenceIssues(
        concept.relatedConceptIds,
        lookupMaps.concepts,
        ['concepts', conceptIndex, 'relatedConceptIds'],
        'concept',
      ),
    )
  })

  subject.objectives.forEach((objective, objectiveIndex) => {
    issues.push(
      ...missingReferenceIssues(
        objective.conceptIds,
        lookupMaps.concepts,
        ['objectives', objectiveIndex, 'conceptIds'],
        'concept',
      ),
    )
  })

  subject.activities.forEach((activity, activityIndex) => {
    if (!lookupMaps.modules.has(activity.moduleId)) {
      issues.push({
        code: 'missing-reference',
        path: ['activities', activityIndex, 'moduleId'],
        message: `Activity "${activity.id}" references missing module "${activity.moduleId}".`,
      })
    }

    issues.push(
      ...missingReferenceIssues(
        activity.conceptIds,
        lookupMaps.concepts,
        ['activities', activityIndex, 'conceptIds'],
        'concept',
      ),
      ...missingReferenceIssues(
        activity.objectiveIds,
        lookupMaps.objectives,
        ['activities', activityIndex, 'objectiveIds'],
        'objective',
      ),
      ...missingReferenceIssues(
        activity.nextActivityIds,
        lookupMaps.activities,
        ['activities', activityIndex, 'nextActivityIds'],
        'activity',
      ),
    )
  })

  return issues
}

function missingReferenceIssues(
  ids: readonly string[],
  lookup: ReadonlyMap<string, unknown>,
  pathPrefix: readonly (number | string)[],
  entityLabel: string,
): SubjectDefinitionIssue[] {
  return ids.flatMap((id, index) =>
    lookup.has(id)
      ? []
      : [
          {
            code: 'missing-reference',
            path: [...pathPrefix, index],
            message: `Reference "${id}" does not identify an existing ${entityLabel}.`,
          },
        ],
  )
}

function validateActivityOwnership(
  subject: SubjectPackage,
  lookupMaps: LookupMaps,
): SubjectDefinitionIssue[] {
  const issues: SubjectDefinitionIssue[] = []
  const listedByModule = new Map<string, string[]>()

  subject.modules.forEach((module) => {
    for (const activityId of module.activityIds) {
      const owners = listedByModule.get(activityId) ?? []
      owners.push(module.id)
      listedByModule.set(activityId, owners)
    }
  })

  subject.activities.forEach((activity, activityIndex) => {
    const owners = listedByModule.get(activity.id) ?? []

    if (owners.length === 0) {
      issues.push({
        code: 'module-activity-mismatch',
        path: ['activities', activityIndex, 'moduleId'],
        message: `Activity "${activity.id}" declares module "${activity.moduleId}" but is not listed by that module.`,
      })
      return
    }

    if (owners.length > 1) {
      issues.push({
        code: 'activity-listed-multiple-times',
        path: ['activities', activityIndex, 'id'],
        message: `Activity "${activity.id}" is listed by multiple modules: ${owners.join(', ')}.`,
      })
    }

    if (!owners.includes(activity.moduleId)) {
      issues.push({
        code: 'module-activity-mismatch',
        path: ['activities', activityIndex, 'moduleId'],
        message: `Activity "${activity.id}" declares module "${activity.moduleId}" but is listed by ${owners.join(', ')}.`,
      })
    }
  })

  subject.modules.forEach((module, moduleIndex) => {
    module.activityIds.forEach((activityId, activityIdIndex) => {
      const activity = lookupMaps.activities.get(activityId)

      if (activity !== undefined && activity.moduleId !== module.id) {
        issues.push({
          code: 'module-activity-mismatch',
          path: ['modules', moduleIndex, 'activityIds', activityIdIndex],
          message: `Module "${module.id}" lists activity "${activityId}", but the activity declares module "${activity.moduleId}".`,
        })
      }
    })
  })

  return issues
}

function validatePrerequisiteGraph(
  subject: SubjectPackage,
): SubjectDefinitionIssue[] {
  const graph = new Map<string, readonly string[]>()

  for (const concept of subject.concepts) {
    graph.set(concept.id, concept.prerequisiteConceptIds)
  }

  const cycle = findCycle(
    subject.concepts.map((concept) => concept.id),
    graph,
  )

  return cycle === undefined
    ? []
    : [
        {
          code: 'concept-prerequisite-cycle',
          path: ['concepts'],
          message: `Concept prerequisite cycle detected: ${cycle.join(' -> ')}.`,
        },
      ]
}

function validateActivityGraph(
  subject: SubjectPackage,
): SubjectDefinitionIssue[] {
  const graph = new Map<string, readonly string[]>()

  for (const activity of subject.activities) {
    graph.set(activity.id, activity.nextActivityIds)
  }

  const cycle = findCycle(
    subject.activities.map((activity) => activity.id),
    graph,
  )

  return cycle === undefined
    ? []
    : [
        {
          code: 'activity-sequence-cycle',
          path: ['activities'],
          message: `Activity sequence cycle detected: ${cycle.join(' -> ')}.`,
        },
      ]
}

function findCycle(
  orderedNodeIds: readonly string[],
  graph: ReadonlyMap<string, readonly string[]>,
): readonly string[] | undefined {
  const visited = new Set<string>()
  const visiting = new Set<string>()
  const stack: string[] = []

  function visit(nodeId: string): readonly string[] | undefined {
    if (visiting.has(nodeId)) {
      const cycleStartIndex = stack.indexOf(nodeId)
      return [...stack.slice(cycleStartIndex), nodeId]
    }

    if (visited.has(nodeId)) {
      return undefined
    }

    visiting.add(nodeId)
    stack.push(nodeId)

    for (const nextId of graph.get(nodeId) ?? []) {
      if (!graph.has(nextId)) {
        continue
      }

      const cycle = visit(nextId)

      if (cycle !== undefined) {
        return cycle
      }
    }

    stack.pop()
    visiting.delete(nodeId)
    visited.add(nodeId)

    return undefined
  }

  for (const nodeId of orderedNodeIds) {
    const cycle = visit(nodeId)

    if (cycle !== undefined) {
      return cycle
    }
  }

  return undefined
}

function validateChoiceIntegrity(
  subject: SubjectPackage,
): SubjectDefinitionIssue[] {
  const issues: SubjectDefinitionIssue[] = []

  subject.activities.forEach((activity, activityIndex) => {
    if (
      activity.evaluation.kind !== 'choice-selection' ||
      activity.response?.kind === undefined ||
      (activity.response.kind !== 'single-choice' &&
        activity.response.kind !== 'multiple-choice')
    ) {
      return
    }

    const optionIds = new Set(
      activity.response.options.map((option) => option.id),
    )
    const correctOptionIds = activity.evaluation.correctOptionIds

    correctOptionIds.forEach((optionId, optionIndex) => {
      if (!optionIds.has(optionId)) {
        issues.push({
          code: 'invalid-choice-answer-reference',
          path: [
            'activities',
            activityIndex,
            'evaluation',
            'correctOptionIds',
            optionIndex,
          ],
          message: `Activity "${activity.id}" marks missing option "${optionId}" as correct.`,
        })
      }
    })

    if (
      activity.response.kind === 'single-choice' &&
      correctOptionIds.length !== 1
    ) {
      issues.push({
        code: 'invalid-choice-answer-reference',
        path: ['activities', activityIndex, 'evaluation', 'correctOptionIds'],
        message: `Single-choice activity "${activity.id}" must have exactly one correct option.`,
      })
    }

    if (
      activity.response.kind === 'multiple-choice' &&
      correctOptionIds.length < 1
    ) {
      issues.push({
        code: 'invalid-choice-answer-reference',
        path: ['activities', activityIndex, 'evaluation', 'correctOptionIds'],
        message: `Multiple-choice activity "${activity.id}" must have at least one correct option.`,
      })
    }

    if (activity.response.kind === 'multiple-choice') {
      if (
        activity.response.minimumSelections !== undefined &&
        correctOptionIds.length < activity.response.minimumSelections
      ) {
        issues.push({
          code: 'invalid-choice-answer-reference',
          path: ['activities', activityIndex, 'response', 'minimumSelections'],
          message: `Multiple-choice activity "${activity.id}" requires at least ${String(activity.response.minimumSelections)} selections but has ${String(correctOptionIds.length)} correct options.`,
        })
      }

      if (
        activity.response.maximumSelections !== undefined &&
        correctOptionIds.length > activity.response.maximumSelections
      ) {
        issues.push({
          code: 'invalid-choice-answer-reference',
          path: ['activities', activityIndex, 'response', 'maximumSelections'],
          message: `Multiple-choice activity "${activity.id}" allows at most ${String(activity.response.maximumSelections)} selections but has ${String(correctOptionIds.length)} correct options.`,
        })
      }
    }
  })

  return issues
}

function validateExtensionManifests(
  subject: SubjectPackage,
): SubjectDefinitionIssue[] {
  const declaredRenderers = new Set(
    subject.extensions
      .filter((extension) => extension.kind === 'renderer')
      .map((extension) => extension.key),
  )
  const declaredEvaluators = new Set(
    subject.extensions
      .filter((extension) => extension.kind === 'evaluator')
      .map((extension) => extension.key),
  )
  const issues: SubjectDefinitionIssue[] = []

  subject.activities.forEach((activity, activityIndex) => {
    activity.blocks.forEach((block, blockIndex) => {
      for (const extensionBlock of collectExtensionBlocks(block)) {
        if (!declaredRenderers.has(extensionBlock.rendererKey)) {
          issues.push({
            code: 'undeclared-renderer-extension',
            path: [
              'activities',
              activityIndex,
              'blocks',
              blockIndex,
              'rendererKey',
            ],
            message: `Activity "${activity.id}" uses undeclared renderer extension "${extensionBlock.rendererKey}".`,
          })
        }
      }
    })

    if (
      activity.evaluation.kind === 'extension' &&
      !declaredEvaluators.has(activity.evaluation.evaluatorKey)
    ) {
      issues.push({
        code: 'undeclared-evaluator-extension',
        path: ['activities', activityIndex, 'evaluation', 'evaluatorKey'],
        message: `Activity "${activity.id}" uses undeclared evaluator extension "${activity.evaluation.evaluatorKey}".`,
      })
    }
  })

  return issues
}

function collectExtensionBlocks(
  block: ContentBlock,
): readonly Extract<ContentBlock, { readonly kind: 'extension' }>[] {
  return block.kind === 'extension' ? [block] : []
}
