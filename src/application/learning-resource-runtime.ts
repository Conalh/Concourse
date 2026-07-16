import {
  resolveStudySetItemIds,
  validateResourceEngagementEvent,
  type CurriculumEntry,
  type LearningPackDocuments,
  type ResourceEngagementEvent,
  type ResourceLink,
  type StudySet,
} from '@learnt/learning-pack-contracts'

import { cloneDeep, deepFreeze, type DeepReadonly } from '../core/foundation'
import type { InstalledLearningPack } from '../learning-packs/learnt-importer'
import { LearningApplicationError } from './learning-application-error'
import type {
  GetLearningResourceInput,
  LearningPackCurriculumEntryView,
  LearningResourceCheckpointReference,
  LearningResourceLinkReference,
  LearningResourceProgressState,
  LearningResourceSegmentReference,
  LearningResourceTeachingContext,
  ListCurriculumEntriesInput,
  ListResourcesForPackInput,
  ListResourcesForConceptInput,
  ListResourcesForObjectiveInput,
  ListSupportResourcesForLearningItemInput,
} from './learnt-application.types'

type InstalledPackRuntimeInput = Readonly<{
  installedPacks: readonly InstalledLearningPack[]
  engagementEvents: readonly ResourceEngagementEvent[]
}>

type PackIndexes = Readonly<{
  conceptsById: ReadonlyMap<string, Pack['catalog']['concepts'][number]>
  objectivesById: ReadonlyMap<string, Pack['catalog']['objectives'][number]>
  resourcesById: ReadonlyMap<string, ReadonlyResource>
  itemsById: ReadonlyMap<string, ReadonlyItem>
  setsById: ReadonlyMap<string, ReadonlyStudySet>
}>

type Pack = DeepReadonly<LearningPackDocuments>
type ReadonlyResource = NonNullable<Pack['resources']>['resources'][number]
type ReadonlyItem = Pack['items']['items'][number]
type ReadonlyStudySet = Pack['sets']['sets'][number]

const resourceLinkRoleRank: Record<string, number> = {
  primary: 0,
  prerequisite: 1,
  explanation: 2,
  'alternative-explanation': 3,
  'worked-example': 4,
  demonstration: 5,
  remediation: 6,
  reference: 7,
  extension: 8,
}

const supportedResourceSourceKinds = new Set<
  ReadonlyResource['source']['kind']
>([
  'embedded-content',
  'external-link',
  'external-video',
  'external-audio',
  'bibliographic-reference',
  'interactive-reference',
  'pack-asset',
])

export async function buildLearningResourceTeachingContext(
  input: InstalledPackRuntimeInput & GetLearningResourceInput,
): Promise<LearningResourceTeachingContext> {
  await Promise.resolve()
  const installedPack = requireInstalledPack(input.installedPacks, input.packId)
  const indexes = buildPackIndexes(installedPack.documents)
  const resource = requireResource(indexes, input.resourceId, input.packId)
  const selectedSegment =
    input.segmentId === undefined
      ? null
      : requireSegment(resource, input.segmentId, input.packId)
  const progressState = deriveResourceProgress(resource, input.engagementEvents)
  const selectedSegmentView =
    selectedSegment === null
      ? null
      : buildSegmentReference(installedPack.documents, indexes, selectedSegment)
  const context = {
    packId: installedPack.packId,
    packVersion: installedPack.packVersion,
    resourceId: resource.id,
    contentRevision: resource.contentRevision,
    title: resource.title,
    summary: resource.summary ?? null,
    modality: resource.modality,
    roles: resource.roles,
    estimatedDurationSeconds: resource.estimatedDurationSeconds ?? null,
    difficulty: resource.difficulty ?? null,
    sourceKind: resource.source.kind,
    source: resource.source,
    supported: isSupportedResourceSourceKind(resource.source.kind),
    supportMessage: isSupportedResourceSourceKind(resource.source.kind)
      ? null
      : 'This build cannot display this resource source kind.',
    progressState,
    segments: (resource.segments ?? []).map((segment) =>
      buildSegmentReference(installedPack.documents, indexes, segment),
    ),
    selectedSegment: selectedSegmentView,
    concepts: (resource.conceptIds ?? []).flatMap((conceptId) => {
      const concept = indexes.conceptsById.get(conceptId)
      return concept === undefined
        ? []
        : [
            {
              conceptId: concept.conceptId,
              title: concept.title,
              summary: concept.summary,
            },
          ]
    }),
    objectives: (resource.objectiveIds ?? []).flatMap((objectiveId) => {
      const objective = indexes.objectivesById.get(objectiveId)
      return objective === undefined
        ? []
        : [
            {
              objectiveId: objective.objectiveId,
              statement: objective.statement,
            },
          ]
    }),
    checkpoints: resolveCheckpoints(
      installedPack.documents,
      indexes,
      resource.checkpointStudySetIds ?? [],
    ),
    provenance: resource.provenance ?? null,
    accessibility: resource.accessibility ?? null,
    nextEntry: findNextEntryForResource(
      installedPack,
      indexes,
      input.engagementEvents,
      resource.id,
      input.segmentId,
    ),
  } satisfies LearningResourceTeachingContext

  return deepFreeze(cloneDeep(context))
}

export async function listResourcesForPack(
  input: InstalledPackRuntimeInput & ListResourcesForPackInput,
): Promise<readonly LearningResourceTeachingContext[]> {
  await Promise.resolve()
  const installedPack = requireInstalledPack(input.installedPacks, input.packId)

  return Promise.all(
    (installedPack.documents.resources?.resources ?? []).map((resource) =>
      buildLearningResourceTeachingContext({
        ...input,
        resourceId: resource.id,
      }),
    ),
  )
}

export async function listResourcesForConcept(
  input: InstalledPackRuntimeInput & ListResourcesForConceptInput,
): Promise<readonly LearningResourceLinkReference[]> {
  await Promise.resolve()
  const installedPack = requireInstalledPack(input.installedPacks, input.packId)
  const indexes = buildPackIndexes(installedPack.documents)
  const concept = indexes.conceptsById.get(input.conceptId)

  if (concept === undefined) {
    throw new LearningApplicationError(
      'concept-not-found',
      'Concept was not found in the installed pack.',
      { details: { packId: input.packId, conceptId: input.conceptId } },
    )
  }

  return deepFreeze(
    cloneDeep(
      (concept.resourceLinks ?? [])
        .flatMap((link) =>
          buildResourceLinkReference(
            installedPack,
            indexes,
            input.engagementEvents,
            link,
          ),
        )
        .sort(compareResourceLinkReferences),
    ),
  )
}

export async function listResourcesForObjective(
  input: InstalledPackRuntimeInput & ListResourcesForObjectiveInput,
): Promise<readonly LearningResourceLinkReference[]> {
  await Promise.resolve()
  const installedPack = requireInstalledPack(input.installedPacks, input.packId)
  const indexes = buildPackIndexes(installedPack.documents)
  const objective = indexes.objectivesById.get(input.objectiveId)

  if (objective === undefined) {
    throw new LearningApplicationError(
      'session-state-incompatible',
      'Objective was not found in the installed pack.',
      { details: { packId: input.packId, objectiveId: input.objectiveId } },
    )
  }

  return deepFreeze(
    cloneDeep(
      (objective.resourceLinks ?? [])
        .flatMap((link) =>
          buildResourceLinkReference(
            installedPack,
            indexes,
            input.engagementEvents,
            link,
          ),
        )
        .sort(compareResourceLinkReferences),
    ),
  )
}

export async function listSupportResourcesForLearningItem(
  input: InstalledPackRuntimeInput & ListSupportResourcesForLearningItemInput,
): Promise<readonly LearningResourceLinkReference[]> {
  await Promise.resolve()
  const installedPack = requireInstalledPack(input.installedPacks, input.packId)
  const indexes = buildPackIndexes(installedPack.documents)
  const item = indexes.itemsById.get(input.itemId)

  if (item === undefined) {
    throw new LearningApplicationError(
      'session-state-incompatible',
      'Learning item was not found in the installed pack.',
      { details: { packId: input.packId, itemId: input.itemId } },
    )
  }

  return deepFreeze(
    cloneDeep(
      (item.supportResourceLinks ?? [])
        .filter(
          (link) =>
            input.recommendedUse === undefined ||
            link.recommendedUse === input.recommendedUse,
        )
        .flatMap((link) =>
          buildResourceLinkReference(
            installedPack,
            indexes,
            input.engagementEvents,
            link,
          ),
        )
        .sort(compareResourceLinkReferences),
    ),
  )
}

export async function listCurriculumEntries(
  input: InstalledPackRuntimeInput & ListCurriculumEntriesInput,
): Promise<readonly LearningPackCurriculumEntryView[]> {
  await Promise.resolve()
  const installedPack = requireInstalledPack(input.installedPacks, input.packId)
  const indexes = buildPackIndexes(installedPack.documents)
  const node = findCurriculumNode(
    installedPack.documents,
    input.courseId,
    input.nodeId,
  )

  if (node === null) {
    throw new LearningApplicationError(
      'session-state-incompatible',
      'Curriculum node was not found in the installed pack.',
      {
        details: {
          packId: input.packId,
          courseId: input.courseId,
          nodeId: input.nodeId,
        },
      },
    )
  }

  const entries = (node.entries ?? fallbackEntriesForNode(node)).map(
    (entry, index) =>
      buildCurriculumEntryView(
        installedPack,
        indexes,
        input.engagementEvents,
        input.courseId,
        input.nodeId,
        entry,
        index,
      ),
  )

  return deepFreeze(cloneDeep(entries))
}

export function validateResourceEngagementForPack(
  event: ResourceEngagementEvent,
  pack: Pack,
): ResourceEngagementEvent {
  const validation = validateResourceEngagementEvent(event, {
    pack: cloneDeep(pack) as LearningPackDocuments,
  })

  if (!validation.ok || validation.value === undefined) {
    throw new LearningApplicationError(
      'session-state-incompatible',
      'Resource engagement event does not match the installed pack.',
      {
        details: {
          packId: event.packId,
          resourceId: event.resourceId,
          diagnostics: validation.diagnostics,
        },
      },
    )
  }

  return validation.value
}

export function isSupportedResourceSourceKind(
  kind: ReadonlyResource['source']['kind'],
): boolean {
  return supportedResourceSourceKinds.has(kind)
}

export function requireInstalledPack(
  installedPacks: readonly InstalledLearningPack[],
  packId: string,
): InstalledLearningPack {
  const installedPack = installedPacks.find((pack) => pack.packId === packId)

  if (installedPack === undefined) {
    throw new LearningApplicationError(
      'session-state-incompatible',
      'Installed learning pack was not found.',
      { details: { packId } },
    )
  }

  return installedPack
}

function buildPackIndexes(pack: Pack): PackIndexes {
  return {
    conceptsById: new Map(
      pack.catalog.concepts.map((concept) => [concept.conceptId, concept]),
    ),
    objectivesById: new Map(
      pack.catalog.objectives.map((objective) => [
        objective.objectiveId,
        objective,
      ]),
    ),
    resourcesById: new Map(
      (pack.resources?.resources ?? []).map((resource) => [
        resource.id,
        resource,
      ]),
    ),
    itemsById: new Map(pack.items.items.map((item) => [item.itemId, item])),
    setsById: new Map(pack.sets.sets.map((set) => [set.setId, set])),
  }
}

function requireResource(
  indexes: PackIndexes,
  resourceId: string,
  packId: string,
): ReadonlyResource {
  const resource = indexes.resourcesById.get(resourceId)

  if (resource === undefined) {
    throw new LearningApplicationError(
      'session-state-incompatible',
      'Learning resource was not found in the installed pack.',
      { details: { packId, resourceId } },
    )
  }

  return resource
}

function requireSegment(
  resource: ReadonlyResource,
  segmentId: string,
  packId: string,
): NonNullable<ReadonlyResource['segments']>[number] {
  const segment = resource.segments?.find(
    (candidate) => candidate.id === segmentId,
  )

  if (segment === undefined) {
    throw new LearningApplicationError(
      'session-state-incompatible',
      'Learning resource segment was not found in the installed pack.',
      { details: { packId, resourceId: resource.id, segmentId } },
    )
  }

  return segment
}

function buildSegmentReference(
  pack: Pack,
  indexes: PackIndexes,
  segment: NonNullable<ReadonlyResource['segments']>[number],
): LearningResourceSegmentReference {
  return {
    segmentId: segment.id,
    title: segment.title,
    summary: segment.summary ?? null,
    startSeconds: segment.startSeconds ?? null,
    endSeconds: segment.endSeconds ?? null,
    conceptIds: segment.conceptIds,
    objectiveIds: segment.objectiveIds,
    checkpoints: resolveCheckpoints(
      pack,
      indexes,
      segment.checkpointStudySetIds,
    ),
  }
}

function resolveCheckpoints(
  pack: Pack,
  indexes: PackIndexes,
  studySetIds: readonly string[],
): LearningResourceCheckpointReference[] {
  const canonicalPack = cloneDeep(pack) as LearningPackDocuments

  return studySetIds.flatMap((setId) => {
    const set = indexes.setsById.get(setId)

    if (set === undefined) {
      return []
    }

    const itemIds = resolveStudySetItemIds(
      canonicalPack,
      cloneDeep(set) as StudySet,
    )

    return [
      {
        setId: set.setId,
        title: set.title,
        summary: set.summary,
        kind: set.kind,
        itemIds,
        itemCount: itemIds.length,
        playModes: set.playModes,
      },
    ]
  })
}

function buildResourceLinkReference(
  installedPack: InstalledLearningPack,
  indexes: PackIndexes,
  engagementEvents: readonly ResourceEngagementEvent[],
  link: ResourceLink,
): LearningResourceLinkReference[] {
  const resource = indexes.resourcesById.get(link.resourceId)

  if (resource === undefined) {
    return []
  }

  return [
    {
      packId: installedPack.packId,
      packVersion: installedPack.packVersion,
      resourceId: resource.id,
      segmentId: link.segmentId ?? null,
      title: resource.title,
      summary: resource.summary ?? null,
      sourceKind: resource.source.kind,
      modality: resource.modality,
      estimatedDurationSeconds: resource.estimatedDurationSeconds ?? null,
      linkRole: link.role,
      recommendedUse: link.recommendedUse ?? null,
      priority: link.priority ?? null,
      progressState: deriveResourceProgress(resource, engagementEvents),
    },
  ]
}

function compareResourceLinkReferences(
  left: LearningResourceLinkReference,
  right: LearningResourceLinkReference,
): number {
  const roleDifference =
    (resourceLinkRoleRank[left.linkRole] ?? 99) -
    (resourceLinkRoleRank[right.linkRole] ?? 99)

  if (roleDifference !== 0) {
    return roleDifference
  }

  const priorityDifference = (left.priority ?? 9999) - (right.priority ?? 9999)

  if (priorityDifference !== 0) {
    return priorityDifference
  }

  return left.title.localeCompare(right.title)
}

function deriveResourceProgress(
  resource: ReadonlyResource,
  engagementEvents: readonly ResourceEngagementEvent[],
): LearningResourceProgressState {
  const resourceEvents = engagementEvents.filter(
    (event) => event.resourceId === resource.id,
  )

  if (resourceEvents.length === 0) {
    return 'unseen'
  }

  const currentRevisionEvents = resourceEvents.filter(
    (event) => event.contentRevision === resource.contentRevision,
  )
  const oldCompleted = resourceEvents.some(
    (event) =>
      event.contentRevision < resource.contentRevision &&
      (event.action === 'completed' || event.action === 'marked-complete'),
  )

  if (currentRevisionEvents.length === 0) {
    return oldCompleted ? 'completion-stale' : 'opened'
  }

  const latest = [...currentRevisionEvents].sort(compareEngagementEvents).at(-1)

  if (latest === undefined) {
    return oldCompleted ? 'completion-stale' : 'unseen'
  }

  switch (latest.action) {
    case 'completed':
    case 'marked-complete':
      return 'completed'
    case 'progressed':
    case 'started':
      return 'in-progress'
    case 'opened':
    case 'revisited':
    case 'abandoned':
      return 'opened'
  }
}

function compareEngagementEvents(
  left: ResourceEngagementEvent,
  right: ResourceEngagementEvent,
): number {
  const timeDifference =
    Date.parse(left.occurredAt) - Date.parse(right.occurredAt)

  if (timeDifference !== 0) {
    return timeDifference
  }

  const sourceDifference = left.sourceInstanceId.localeCompare(
    right.sourceInstanceId,
  )

  if (sourceDifference !== 0) {
    return sourceDifference
  }

  return left.eventId.localeCompare(right.eventId)
}

function findNextEntryForResource(
  installedPack: InstalledLearningPack,
  indexes: PackIndexes,
  engagementEvents: readonly ResourceEngagementEvent[],
  resourceId: string,
  segmentId: string | undefined,
): LearningPackCurriculumEntryView | null {
  for (const course of installedPack.documents.courses.courses) {
    for (const node of flattenCurriculumNodes(course.rootNodes)) {
      const entries = node.entries ?? fallbackEntriesForNode(node)
      const index = entries.findIndex(
        (entry) =>
          entry.kind === 'resource' &&
          entry.resourceId === resourceId &&
          (segmentId === undefined || entry.segmentId === segmentId),
      )

      if (index < 0) {
        continue
      }

      const nextEntry = entries[index + 1]

      if (nextEntry === undefined) {
        return null
      }

      return buildCurriculumEntryView(
        installedPack,
        indexes,
        engagementEvents,
        course.courseId,
        node.nodeId,
        nextEntry,
        index + 1,
      )
    }
  }

  return null
}

function buildCurriculumEntryView(
  installedPack: InstalledLearningPack,
  indexes: PackIndexes,
  engagementEvents: readonly ResourceEngagementEvent[],
  courseId: string,
  nodeId: string,
  entry: CurriculumEntry,
  index: number,
): LearningPackCurriculumEntryView {
  switch (entry.kind) {
    case 'child-node': {
      const course = installedPack.documents.courses.courses.find(
        (candidate) => candidate.courseId === courseId,
      )
      const childNode =
        course === undefined
          ? null
          : findNodeById(course.rootNodes, entry.nodeId)

      return {
        kind: 'child-node',
        packId: installedPack.packId,
        packVersion: installedPack.packVersion,
        courseId,
        nodeId,
        index,
        childNodeId: entry.nodeId,
        title: childNode?.title ?? entry.nodeId,
        summary: childNode?.summary ?? '',
      }
    }
    case 'resource': {
      const resource = indexes.resourcesById.get(entry.resourceId)

      return {
        kind: 'resource',
        packId: installedPack.packId,
        packVersion: installedPack.packVersion,
        courseId,
        nodeId,
        index,
        resourceId: entry.resourceId,
        segmentId: entry.segmentId ?? null,
        title: resource?.title ?? entry.resourceId,
        summary: resource?.summary ?? null,
        sourceKind: resource?.source.kind ?? 'embedded-content',
        modality: resource?.modality ?? 'mixed',
        progressState:
          resource === undefined
            ? 'unavailable'
            : deriveResourceProgress(resource, engagementEvents),
      }
    }
    case 'item': {
      const item = indexes.itemsById.get(entry.itemId)

      return {
        kind: 'item',
        packId: installedPack.packId,
        packVersion: installedPack.packVersion,
        courseId,
        nodeId,
        index,
        itemId: entry.itemId,
        title: item?.title ?? entry.itemId,
        responseKind: item?.response.kind ?? 'unknown',
        evaluationKind: item?.evaluation.kind ?? 'unknown',
      }
    }
    case 'study-set': {
      const set = indexes.setsById.get(entry.studySetId)
      const checkpoints =
        set === undefined
          ? []
          : resolveCheckpoints(installedPack.documents, indexes, [set.setId])
      const checkpoint = checkpoints[0]

      return {
        kind: 'study-set',
        packId: installedPack.packId,
        packVersion: installedPack.packVersion,
        courseId,
        nodeId,
        index,
        setId: entry.studySetId,
        title: checkpoint?.title ?? entry.studySetId,
        summary: checkpoint?.summary ?? '',
        itemIds: checkpoint?.itemIds ?? [],
        itemCount: checkpoint?.itemCount ?? 0,
      }
    }
  }
}

function findCurriculumNode(
  pack: Pack,
  courseId: string,
  nodeId: string,
): Pack['courses']['courses'][number]['rootNodes'][number] | null {
  const course = pack.courses.courses.find(
    (candidate) => candidate.courseId === courseId,
  )

  if (course === undefined) {
    return null
  }

  return findNodeById(course.rootNodes, nodeId)
}

function findNodeById(
  nodes: readonly Pack['courses']['courses'][number]['rootNodes'][number][],
  nodeId: string,
): Pack['courses']['courses'][number]['rootNodes'][number] | null {
  for (const node of nodes) {
    if (node.nodeId === nodeId) {
      return node
    }

    const child = findNodeById(node.children, nodeId)
    if (child !== null) {
      return child
    }
  }

  return null
}

function flattenCurriculumNodes(
  nodes: readonly Pack['courses']['courses'][number]['rootNodes'][number][],
): Pack['courses']['courses'][number]['rootNodes'][number][] {
  return nodes.flatMap((node) => [
    node,
    ...flattenCurriculumNodes(node.children),
  ])
}

function fallbackEntriesForNode(
  node: Pack['courses']['courses'][number]['rootNodes'][number],
): CurriculumEntry[] {
  return [
    ...node.children.map(
      (child): CurriculumEntry => ({
        kind: 'child-node',
        nodeId: child.nodeId,
      }),
    ),
    ...node.itemIds.map(
      (itemId): CurriculumEntry => ({ kind: 'item', itemId }),
    ),
  ]
}
