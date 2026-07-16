import {
  LearningPackErrorCode,
  resolveStudySetItemIds,
  type LearningPackDocuments,
  type PlayMode,
  type StudySet,
} from '@learnt/learning-pack-contracts'

import type { LearnerProfile } from '../core/contracts'
import { cloneDeep, deepFreeze, type DeepReadonly } from '../core/foundation'
import type { LearningSessionRecord } from '../core/ports'
import type { InstalledLearningPack } from '../learning-packs/learnt-importer'
import type {
  LearningPackLearningStatus,
  LearningPackCurriculumEntryView,
  LearningPackLibraryCourse,
  LearningPackLibraryFilterOption,
  LearningPackLibraryFilters,
  LearningPackLibraryItem,
  LearningPackLibraryNode,
  LearningPackLibraryPack,
  LearningPackLibraryPackState,
  LearningPackLibraryResource,
  LearningPackLibrarySnapshot,
  LearningPackLibraryStateEntry,
  LearningPackLibraryStudySet,
  LearningPackLibrarySubject,
  LearningPackVisualToken,
} from './learnt-application.types'

type ReadonlyPack = DeepReadonly<LearningPackDocuments>
type ReadonlyCourse = ReadonlyPack['courses']['courses'][number]
type ReadonlyNode = ReadonlyCourse['rootNodes'][number]
type ReadonlyItem = ReadonlyPack['items']['items'][number]
type ReadonlyResource = NonNullable<
  ReadonlyPack['resources']
>['resources'][number]
type ReadonlySubject = ReadonlyPack['catalog']['subjects'][number]
type ReadonlyConcept = ReadonlyPack['catalog']['concepts'][number]
type ReadonlyObjective = ReadonlyPack['catalog']['objectives'][number]

type LearningPackLibraryInput = Readonly<{
  installedPacks: readonly InstalledLearningPack[]
  stateEntries: readonly LearningPackLibraryStateEntry[]
  records: readonly LearningSessionRecord[]
  profile: DeepReadonly<LearnerProfile>
  filters?: LearningPackLibraryFilters
}>

type PackIndexes = Readonly<{
  conceptsById: ReadonlyMap<string, DeepReadonly<ReadonlyConcept>>
  objectivesById: ReadonlyMap<string, DeepReadonly<ReadonlyObjective>>
  coursesById: ReadonlyMap<string, DeepReadonly<ReadonlyCourse>>
  itemsById: ReadonlyMap<string, DeepReadonly<ReadonlyItem>>
  resourcesById: ReadonlyMap<string, DeepReadonly<ReadonlyResource>>
  setsById: ReadonlyMap<string, DeepReadonly<StudySet>>
  resolvedSets: readonly ResolvedStudySet[]
}>

type ResolvedStudySet = Readonly<{
  set: DeepReadonly<StudySet>
  itemIds: readonly string[]
  authoredTags: readonly string[]
}>

type CountableLibraryNode = Readonly<{
  resources: readonly LearningPackLibraryResource[]
  items: readonly LearningPackLibraryItem[]
  studySets: readonly LearningPackLibraryStudySet[]
  children: readonly CountableLibraryNode[]
}>

type CountableLibraryPack = Readonly<{
  state: LearningPackLibraryPackState
  itemCount: number
  subjects: readonly CountableLibrarySubject[]
}>

type CountableLibrarySubject = Readonly<{
  courses: readonly CountableLibraryCourse[]
}>

type CountableLibraryCourse = Readonly<{
  rootNodes: readonly CountableLibraryNode[]
}>

type ItemBuildContext = Readonly<{
  pack: InstalledLearningPack
  subject: DeepReadonly<ReadonlySubject>
  course: DeepReadonly<ReadonlyCourse>
  node: DeepReadonly<ReadonlyNode>
  indexes: PackIndexes
  statusIndex: ReadonlyMap<string, LearningPackLearningStatus>
  filters: LearningPackLibraryFilters
  inheritedTags: readonly string[]
}>

const learningStatusRank: Record<LearningPackLearningStatus, number> = {
  'not-started': 0,
  unavailable: 0,
  attempted: 1,
  completed: 2,
  active: 3,
}

const learningStatuses: readonly LearningPackLearningStatus[] = [
  'not-started',
  'active',
  'attempted',
  'completed',
  'unavailable',
]

export function buildLearningPackLibrarySnapshot(
  input: LearningPackLibraryInput,
): LearningPackLibrarySnapshot {
  const filters = input.filters ?? {}
  const statusIndex = buildStatusIndex(input.records, input.profile)
  const stateEntriesByKey = groupStateEntries(input.stateEntries)
  const installedKeys = new Set<string>()
  const packs: LearningPackLibraryPack[] = []

  for (const installedPack of input.installedPacks) {
    const stateEntry = resolveStateEntry(stateEntriesByKey, installedPack)
    const pack = buildInstalledPack({
      installedPack,
      stateEntry,
      statusIndex,
      filters,
    })
    installedKeys.add(
      packStateKey(installedPack.packId, installedPack.packVersion),
    )

    if (pack !== null) {
      packs.push(pack)
    }
  }

  for (const stateEntry of input.stateEntries) {
    const key = packStateKey(stateEntry.packId, stateEntry.packVersion ?? null)

    if (installedKeys.has(key)) {
      continue
    }
    if (!stateOnlyPackMatchesFilters(stateEntry, filters)) {
      continue
    }

    packs.push(buildStateOnlyPack(stateEntry))
  }

  const sortedPacks = packs.sort((left, right) =>
    left.title.localeCompare(right.title),
  )
  const snapshot = {
    packs: sortedPacks,
    filterOptions: buildFilterOptions(input.installedPacks, statusIndex),
    appliedFilters: filters,
    summary: summarizePacks(sortedPacks),
    isEmpty:
      input.installedPacks.length === 0 && input.stateEntries.length === 0,
  }

  return deepFreeze(cloneDeep(snapshot))
}

function buildInstalledPack(
  input: Readonly<{
    installedPack: InstalledLearningPack
    stateEntry: LearningPackLibraryStateEntry | null
    statusIndex: ReadonlyMap<
      string,
      ReadonlyMap<string, LearningPackLearningStatus>
    >
    filters: LearningPackLibraryFilters
  }>,
): LearningPackLibraryPack | null {
  const { installedPack, filters } = input

  if (
    filters.installedPackId !== undefined &&
    filters.installedPackId !== installedPack.packId
  ) {
    return null
  }

  const indexes = buildPackIndexes(installedPack.documents)
  const packStatusIndex =
    input.statusIndex.get(versionedSubjectKey('', installedPack.packVersion)) ??
    new Map<string, LearningPackLearningStatus>()
  const subjects = installedPack.documents.catalog.subjects.flatMap((subject) =>
    buildSubject({
      installedPack,
      subject,
      indexes,
      statusIndex: packStatusIndex,
      filters,
    }),
  )
  const packState = derivePackState(installedPack, input.stateEntry)

  if (subjects.length === 0 && hasContentFilters(filters)) {
    return null
  }

  return {
    packId: installedPack.packId,
    packVersion: installedPack.packVersion,
    title: installedPack.documents.manifest.title,
    summary: installedPack.documents.manifest.summary,
    state: packState.state,
    stateMessage: packState.message,
    diagnostics: packState.diagnostics,
    requiredCapabilities:
      installedPack.documents.manifest.capabilities.required.map(
        formatCapability,
      ),
    optionalCapabilities:
      installedPack.documents.manifest.capabilities.optional.map(
        formatCapability,
      ),
    visualToken: visualTokenForPack(installedPack.documents, packState.state),
    visualLabel: installedPack.documents.theme?.displayName ?? null,
    releasedAt: installedPack.documents.manifest.releasedAt,
    subjects,
    subjectCount: installedPack.documents.catalog.subjects.length,
    courseCount: installedPack.documents.courses.courses.length,
    itemCount: installedPack.documents.items.items.length,
  }
}

function buildSubject(
  input: Readonly<{
    installedPack: InstalledLearningPack
    subject: DeepReadonly<ReadonlySubject>
    indexes: PackIndexes
    statusIndex: ReadonlyMap<string, LearningPackLearningStatus>
    filters: LearningPackLibraryFilters
  }>,
): LearningPackLibrarySubject[] {
  const { installedPack, subject, filters, indexes } = input

  if (
    filters.subjectId !== undefined &&
    filters.subjectId !== subject.subjectId
  ) {
    return []
  }

  const courses = subject.courseIds.flatMap((courseId) => {
    const course = indexes.coursesById.get(courseId)

    if (course === undefined) {
      return []
    }

    return buildCourse({
      installedPack,
      subject,
      course,
      indexes,
      statusIndex: input.statusIndex,
      filters,
    })
  })

  if (courses.length === 0 && hasContentFilters(filters)) {
    return []
  }

  return [
    {
      packId: installedPack.packId,
      packVersion: installedPack.packVersion,
      subjectId: subject.subjectId,
      title: subject.title,
      summary: subject.summary,
      tags: subject.tags,
      conceptIds: subject.conceptIds,
      objectiveIds: subject.objectiveIds,
      courses,
    },
  ]
}

function buildCourse(
  input: Readonly<{
    installedPack: InstalledLearningPack
    subject: DeepReadonly<ReadonlySubject>
    course: DeepReadonly<ReadonlyCourse>
    indexes: PackIndexes
    statusIndex: ReadonlyMap<string, LearningPackLearningStatus>
    filters: LearningPackLibraryFilters
  }>,
): LearningPackLibraryCourse[] {
  const { installedPack, subject, course, filters, indexes } = input

  if (filters.courseId !== undefined && filters.courseId !== course.courseId) {
    return []
  }

  const inheritedTags = uniqueStrings([
    ...subject.tags,
    ...course.tags,
    ...tagsForConceptIds(subject.conceptIds, indexes),
  ])
  const rootNodes = course.rootNodes.flatMap((node) =>
    buildNode({
      pack: installedPack,
      subject,
      course,
      node,
      indexes,
      statusIndex: input.statusIndex,
      filters,
      inheritedTags,
    }),
  )

  if (rootNodes.length === 0 && hasContentFilters(filters)) {
    return []
  }

  return [
    {
      packId: installedPack.packId,
      packVersion: installedPack.packVersion,
      subjectId: subject.subjectId,
      courseId: course.courseId,
      title: course.title,
      summary: course.summary,
      tags: course.tags,
      rootNodes,
    },
  ]
}

function buildNode(context: ItemBuildContext): LearningPackLibraryNode[] {
  const directItems = context.node.itemIds.flatMap((itemId) => {
    const item = context.indexes.itemsById.get(itemId)

    if (item === undefined) {
      return []
    }

    return buildItem(item, context)
  })
  const childTags = uniqueStrings([
    ...context.inheritedTags,
    ...tagsForConceptIds(context.node.conceptIds, context.indexes),
  ])
  const children = context.node.children.flatMap((node) =>
    buildNode({
      ...context,
      node,
      inheritedTags: childTags,
    }),
  )
  const visibleItemIds = collectVisibleItemIds(directItems, children)
  const studySets = buildStudySetsForNode(context, visibleItemIds)
  const resources = buildResourcesForNode(context)
  const entries = buildEntriesForNode(context, studySets)

  if (
    resources.length === 0 &&
    directItems.length === 0 &&
    children.length === 0 &&
    studySets.length === 0 &&
    hasContentFilters(context.filters)
  ) {
    return []
  }

  return [
    {
      packId: context.pack.packId,
      packVersion: context.pack.packVersion,
      subjectId: context.subject.subjectId,
      courseId: context.course.courseId,
      nodeId: context.node.nodeId,
      kind: context.node.kind,
      kindLabel: context.node.customKindLabel ?? context.node.kind,
      title: context.node.title,
      summary: context.node.summary,
      conceptIds: context.node.conceptIds,
      objectiveIds: context.node.objectiveIds,
      entries,
      resources,
      items: directItems,
      studySets,
      children,
    },
  ]
}

function buildItem(
  item: DeepReadonly<ReadonlyItem>,
  context: ItemBuildContext,
): LearningPackLibraryItem[] {
  const learningStatus =
    context.statusIndex.get(
      itemStatusKey(context.subject.subjectId, item.itemId),
    ) ?? 'not-started'

  if (!itemMatchesFilters(item, learningStatus, context, true)) {
    return []
  }

  return [
    {
      packId: context.pack.packId,
      packVersion: context.pack.packVersion,
      subjectId: context.subject.subjectId,
      courseId: context.course.courseId,
      curriculumNodeId: context.node.nodeId,
      itemId: item.itemId,
      learningRevision: item.learningRevision,
      title: item.title,
      responseKind: item.response.kind,
      evaluationKind: item.evaluation.kind,
      conceptIds: item.conceptIds,
      objectiveIds: item.objectiveIds,
      allowedPlayModes: item.allowedPlayModes,
      learningStatus,
    },
  ]
}

function buildStudySetsForNode(
  context: ItemBuildContext,
  visibleItemIds: ReadonlySet<string>,
): LearningPackLibraryStudySet[] {
  const nodeItemIds = collectNodeItemIds(context.node)

  return context.indexes.resolvedSets.flatMap((resolvedSet) => {
    if (
      context.filters.itemMode !== undefined &&
      !resolvedSet.set.playModes.includes(context.filters.itemMode)
    ) {
      return []
    }

    const itemIds = resolvedSet.itemIds.filter(
      (itemId) => nodeItemIds.has(itemId) && visibleItemIds.has(itemId),
    )

    if (itemIds.length === 0) {
      return []
    }

    if (
      context.filters.authoredTag !== undefined &&
      !resolvedSet.authoredTags.includes(context.filters.authoredTag)
    ) {
      const setItemsMatchTag = itemIds.some((itemId) => {
        const item = context.indexes.itemsById.get(itemId)

        return (
          item !== undefined &&
          itemMatchesFilters(item, 'not-started', context, true)
        )
      })

      if (!setItemsMatchTag) {
        return []
      }
    }

    return [
      {
        packId: context.pack.packId,
        packVersion: context.pack.packVersion,
        setId: resolvedSet.set.setId,
        kind: resolvedSet.set.kind,
        title: resolvedSet.set.title,
        summary: resolvedSet.set.summary,
        ordering: resolvedSet.set.ordering,
        playModes: resolvedSet.set.playModes,
        itemIds,
        itemCount: itemIds.length,
      },
    ]
  })
}

function buildResourcesForNode(
  context: ItemBuildContext,
): LearningPackLibraryResource[] {
  const entries = context.node.entries ?? []

  return entries.flatMap((entry) => {
    if (entry.kind !== 'resource') {
      return []
    }

    const resource = context.indexes.resourcesById.get(entry.resourceId)

    if (resource === undefined) {
      return []
    }

    return [
      {
        packId: context.pack.packId,
        packVersion: context.pack.packVersion,
        subjectId: context.subject.subjectId,
        courseId: context.course.courseId,
        curriculumNodeId: context.node.nodeId,
        resourceId: resource.id,
        segmentId: entry.segmentId ?? null,
        title: resource.title,
        summary: resource.summary ?? null,
        sourceKind: resource.source.kind,
        modality: resource.modality,
        estimatedDurationSeconds: resource.estimatedDurationSeconds ?? null,
      },
    ]
  })
}

function buildEntriesForNode(
  context: ItemBuildContext,
  studySets: readonly LearningPackLibraryStudySet[],
): LearningPackCurriculumEntryView[] {
  const entries = context.node.entries ?? []

  return entries.flatMap((entry, index): LearningPackCurriculumEntryView[] => {
    switch (entry.kind) {
      case 'child-node': {
        const child = context.node.children.find(
          (candidate) => candidate.nodeId === entry.nodeId,
        )

        return [
          {
            kind: 'child-node',
            packId: context.pack.packId,
            packVersion: context.pack.packVersion,
            courseId: context.course.courseId,
            nodeId: context.node.nodeId,
            index,
            childNodeId: entry.nodeId,
            title: child?.title ?? entry.nodeId,
            summary: child?.summary ?? '',
          },
        ]
      }
      case 'resource': {
        const resource = context.indexes.resourcesById.get(entry.resourceId)

        return [
          {
            kind: 'resource',
            packId: context.pack.packId,
            packVersion: context.pack.packVersion,
            courseId: context.course.courseId,
            nodeId: context.node.nodeId,
            index,
            resourceId: entry.resourceId,
            segmentId: entry.segmentId ?? null,
            title: resource?.title ?? entry.resourceId,
            summary: resource?.summary ?? null,
            sourceKind: resource?.source.kind ?? 'embedded-content',
            modality: resource?.modality ?? 'mixed',
            progressState: resource === undefined ? 'unavailable' : 'unseen',
          },
        ]
      }
      case 'item': {
        const item = context.indexes.itemsById.get(entry.itemId)

        if (item === undefined) {
          return []
        }

        const learningStatus =
          context.statusIndex.get(
            itemStatusKey(context.subject.subjectId, item.itemId),
          ) ?? 'not-started'

        if (!itemMatchesFilters(item, learningStatus, context, true)) {
          return []
        }

        return [
          {
            kind: 'item',
            packId: context.pack.packId,
            packVersion: context.pack.packVersion,
            courseId: context.course.courseId,
            nodeId: context.node.nodeId,
            index,
            itemId: entry.itemId,
            title: item.title,
            responseKind: item.response.kind,
            evaluationKind: item.evaluation.kind,
          },
        ]
      }
      case 'study-set': {
        const projectedStudySet = studySets.find(
          (set) => set.setId === entry.studySetId,
        )
        const canonicalStudySet = context.indexes.setsById.get(entry.studySetId)

        return [
          {
            kind: 'study-set',
            packId: context.pack.packId,
            packVersion: context.pack.packVersion,
            courseId: context.course.courseId,
            nodeId: context.node.nodeId,
            index,
            setId: entry.studySetId,
            title: canonicalStudySet?.title ?? entry.studySetId,
            summary: canonicalStudySet?.summary ?? '',
            itemIds: projectedStudySet?.itemIds ?? [],
            itemCount: projectedStudySet?.itemCount ?? 0,
          },
        ]
      }
    }
  })
}

function itemMatchesFilters(
  item: DeepReadonly<ReadonlyItem>,
  learningStatus: LearningPackLearningStatus,
  context: ItemBuildContext,
  includeTagFilter: boolean,
): boolean {
  const filters = context.filters

  if (
    filters.conceptId !== undefined &&
    !itemConceptIds(item, context).has(filters.conceptId)
  ) {
    return false
  }
  if (
    filters.objectiveId !== undefined &&
    !itemObjectiveIds(item, context).has(filters.objectiveId)
  ) {
    return false
  }
  if (
    filters.itemMode !== undefined &&
    !item.allowedPlayModes.includes(filters.itemMode)
  ) {
    return false
  }
  if (
    filters.learningStatus !== undefined &&
    filters.learningStatus !== learningStatus
  ) {
    return false
  }
  if (
    includeTagFilter &&
    filters.authoredTag !== undefined &&
    !itemAuthoredTags(item, context).has(filters.authoredTag)
  ) {
    return false
  }

  return true
}

function itemConceptIds(
  item: DeepReadonly<ReadonlyItem>,
  context: ItemBuildContext,
): Set<string> {
  const conceptIds = new Set<string>([
    ...context.node.conceptIds,
    ...item.conceptIds,
  ])

  for (const objectiveId of item.objectiveIds) {
    const objective = context.indexes.objectivesById.get(objectiveId)

    for (const conceptId of objective?.conceptIds ?? []) {
      conceptIds.add(conceptId)
    }
  }

  return conceptIds
}

function itemObjectiveIds(
  item: DeepReadonly<ReadonlyItem>,
  context: ItemBuildContext,
): Set<string> {
  return new Set([...context.node.objectiveIds, ...item.objectiveIds])
}

function itemAuthoredTags(
  item: DeepReadonly<ReadonlyItem>,
  context: ItemBuildContext,
): Set<string> {
  return new Set([
    ...context.inheritedTags,
    ...tagsForConceptIds(item.conceptIds, context.indexes),
  ])
}

function buildPackIndexes(pack: ReadonlyPack): PackIndexes {
  const canonicalPack = cloneDeep(pack) as LearningPackDocuments

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
    coursesById: new Map(
      pack.courses.courses.map((course) => [course.courseId, course]),
    ),
    itemsById: new Map(pack.items.items.map((item) => [item.itemId, item])),
    resourcesById: new Map(
      (pack.resources?.resources ?? []).map((resource) => [
        resource.id,
        resource,
      ]),
    ),
    setsById: new Map(pack.sets.sets.map((set) => [set.setId, set])),
    resolvedSets: pack.sets.sets.map((set) => ({
      set,
      itemIds: resolveStudySetItemIds(
        canonicalPack,
        cloneDeep(set) as StudySet,
      ),
      authoredTags: authoredTagsForStudySet(set),
    })),
  }
}

function buildFilterOptions(
  installedPacks: readonly InstalledLearningPack[],
  statusIndex: ReadonlyMap<
    string,
    ReadonlyMap<string, LearningPackLearningStatus>
  >,
) {
  const installedPackOptions = new Map<string, string>()
  const subjectOptions = new Map<string, string>()
  const courseOptions = new Map<string, string>()
  const conceptOptions = new Map<string, string>()
  const objectiveOptions = new Map<string, string>()
  const modeOptions = new Map<string, string>()
  const authoredTags = new Set<string>()
  const statusOptions = new Map<string, string>()

  for (const status of learningStatuses) {
    statusOptions.set(status, learningStatusLabel(status))
  }

  for (const installedPack of installedPacks) {
    const pack = installedPack.documents
    installedPackOptions.set(installedPack.packId, pack.manifest.title)

    for (const subject of pack.catalog.subjects) {
      subjectOptions.set(subject.subjectId, subject.title)
      for (const tag of subject.tags) {
        authoredTags.add(tag)
      }
    }

    for (const course of pack.courses.courses) {
      courseOptions.set(course.courseId, course.title)
      for (const tag of course.tags) {
        authoredTags.add(tag)
      }
    }

    for (const concept of pack.catalog.concepts) {
      conceptOptions.set(concept.conceptId, concept.title)
      for (const tag of concept.tags) {
        authoredTags.add(tag)
      }
    }

    for (const objective of pack.catalog.objectives) {
      objectiveOptions.set(objective.objectiveId, objective.statement)
    }

    for (const item of pack.items.items) {
      for (const mode of item.allowedPlayModes) {
        modeOptions.set(mode, playModeLabel(mode))
      }
    }

    for (const set of pack.sets.sets) {
      for (const tag of authoredTagsForStudySet(set)) {
        authoredTags.add(tag)
      }
    }
  }

  if (hasAnyStatus(statusIndex)) {
    for (const status of learningStatuses) {
      statusOptions.set(status, learningStatusLabel(status))
    }
  }

  return {
    installedPacks: toOptions(installedPackOptions),
    subjects: toOptions(subjectOptions),
    courses: toOptions(courseOptions),
    concepts: toOptions(conceptOptions),
    objectives: toOptions(objectiveOptions),
    itemModes: toOptions(modeOptions),
    authoredTags: [...authoredTags]
      .sort((left, right) => left.localeCompare(right))
      .map((tag) => ({ id: tag, label: tag })),
    learningStatuses: toOptions(statusOptions),
  }
}

function buildStatusIndex(
  records: readonly LearningSessionRecord[],
  profile: DeepReadonly<LearnerProfile>,
): ReadonlyMap<string, ReadonlyMap<string, LearningPackLearningStatus>> {
  const bySubjectVersion = new Map<
    string,
    Map<string, LearningPackLearningStatus>
  >()

  for (const record of records) {
    if (
      record.session.learnerId !== profile.learnerId ||
      record.session.profileId !== profile.id
    ) {
      continue
    }

    const subjectVersionKey = versionedSubjectKey(
      record.session.subjectId,
      record.subjectVersion,
    )
    const itemStatuses =
      bySubjectVersion.get(subjectVersionKey) ??
      new Map<string, LearningPackLearningStatus>()
    bySubjectVersion.set(subjectVersionKey, itemStatuses)

    for (const progress of record.session.activityProgress) {
      const itemKey = itemStatusKey(
        record.session.subjectId,
        progress.activityId,
      )
      const nextStatus =
        progress.status === 'unseen' ? 'not-started' : progress.status
      const currentStatus = itemStatuses.get(itemKey) ?? 'not-started'

      if (learningStatusRank[nextStatus] > learningStatusRank[currentStatus]) {
        itemStatuses.set(itemKey, nextStatus)
      }
    }
  }

  const combinedByPackVersion = new Map<
    string,
    Map<string, LearningPackLearningStatus>
  >()

  for (const [subjectVersionKey, itemStatuses] of bySubjectVersion.entries()) {
    const [, packVersion] = subjectVersionKey.split('\u0000')
    const packVersionKey = versionedSubjectKey('', packVersion ?? '')
    const target =
      combinedByPackVersion.get(packVersionKey) ??
      new Map<string, LearningPackLearningStatus>()
    combinedByPackVersion.set(packVersionKey, target)

    for (const [itemKey, status] of itemStatuses.entries()) {
      const currentStatus = target.get(itemKey) ?? 'not-started'
      if (learningStatusRank[status] > learningStatusRank[currentStatus]) {
        target.set(itemKey, status)
      }
    }
  }

  return combinedByPackVersion
}

function groupStateEntries(
  entries: readonly LearningPackLibraryStateEntry[],
): ReadonlyMap<string, LearningPackLibraryStateEntry> {
  return new Map(
    entries.map((entry) => [
      packStateKey(entry.packId, entry.packVersion ?? null),
      entry,
    ]),
  )
}

function resolveStateEntry(
  entries: ReadonlyMap<string, LearningPackLibraryStateEntry>,
  installedPack: InstalledLearningPack,
): LearningPackLibraryStateEntry | null {
  return (
    entries.get(
      packStateKey(installedPack.packId, installedPack.packVersion),
    ) ??
    entries.get(packStateKey(installedPack.packId, null)) ??
    null
  )
}

function derivePackState(
  installedPack: InstalledLearningPack,
  stateEntry: LearningPackLibraryStateEntry | null,
): Readonly<{
  state: LearningPackLibraryPackState
  message: string | null
  diagnostics: LearningPackLibraryPack['diagnostics']
}> {
  if (stateEntry !== null) {
    return {
      state: stateEntry.state,
      message: stateEntry.message,
      diagnostics: [
        ...(stateEntry.diagnostics ?? []),
        ...installedPack.warnings,
      ],
    }
  }

  const unsupportedOptional = installedPack.warnings.some(
    (diagnostic) =>
      diagnostic.code === LearningPackErrorCode.UNSUPPORTED_OPTIONAL_CAPABILITY,
  )

  if (unsupportedOptional) {
    return {
      state: 'partially-supported',
      message:
        'Some optional pack capabilities are not supported by this build.',
      diagnostics: installedPack.warnings,
    }
  }

  return {
    state: 'ready',
    message: null,
    diagnostics: installedPack.warnings,
  }
}

function buildStateOnlyPack(
  stateEntry: LearningPackLibraryStateEntry,
): LearningPackLibraryPack {
  return {
    packId: stateEntry.packId,
    packVersion: stateEntry.packVersion ?? 'unknown',
    title: stateEntry.title,
    summary: stateEntry.message,
    state: stateEntry.state,
    stateMessage: stateEntry.message,
    diagnostics: stateEntry.diagnostics ?? [],
    requiredCapabilities: [],
    optionalCapabilities: [],
    visualToken:
      stateEntry.state === 'update-available' ? 'practice' : 'warning',
    visualLabel: null,
    releasedAt: null,
    subjects: [],
    subjectCount: 0,
    courseCount: 0,
    itemCount: 0,
  }
}

function stateOnlyPackMatchesFilters(
  stateEntry: LearningPackLibraryStateEntry,
  filters: LearningPackLibraryFilters,
): boolean {
  if (
    filters.installedPackId !== undefined &&
    filters.installedPackId !== stateEntry.packId
  ) {
    return false
  }

  return !hasContentFilters(filters)
}

function summarizePacks(packs: readonly CountableLibraryPack[]) {
  const visibleItems = packs.flatMap((pack) =>
    pack.subjects.flatMap((subject) =>
      subject.courses.flatMap((course) =>
        course.rootNodes.flatMap(collectItemsFromNode),
      ),
    ),
  )

  return {
    packCount: packs.length,
    subjectCount: packs.reduce(
      (count, pack) => count + pack.subjects.length,
      0,
    ),
    courseCount: packs.reduce(
      (count, pack) =>
        count +
        pack.subjects.reduce(
          (subjectCount, subject) => subjectCount + subject.courses.length,
          0,
        ),
      0,
    ),
    curriculumNodeCount: packs.reduce(
      (count, pack) =>
        count +
        pack.subjects.reduce(
          (subjectCount, subject) =>
            subjectCount +
            subject.courses.reduce(
              (courseCount, course) =>
                courseCount +
                course.rootNodes.reduce(
                  (nodeCount, node) => nodeCount + countNodes(node),
                  0,
                ),
              0,
            ),
          0,
        ),
      0,
    ),
    studySetCount: packs.reduce(
      (count, pack) =>
        count +
        pack.subjects.reduce(
          (subjectCount, subject) =>
            subjectCount +
            subject.courses.reduce(
              (courseCount, course) =>
                courseCount +
                course.rootNodes.reduce(
                  (setCount, node) => setCount + countStudySets(node),
                  0,
                ),
              0,
            ),
          0,
        ),
      0,
    ),
    itemCount: packs.reduce((count, pack) => count + pack.itemCount, 0),
    visibleItemCount: visibleItems.length,
    invalidPackCount: packs.filter((pack) => pack.state === 'invalid-pack')
      .length,
    unsupportedCapabilityCount: packs.filter(
      (pack) => pack.state === 'unsupported-capability',
    ).length,
    updateAvailableCount: packs.filter(
      (pack) => pack.state === 'update-available',
    ).length,
    partiallySupportedCount: packs.filter(
      (pack) => pack.state === 'partially-supported',
    ).length,
  }
}

function collectItemsFromNode(
  node: CountableLibraryNode,
): LearningPackLibraryItem[] {
  return [
    ...node.items,
    ...node.children.flatMap((child) => collectItemsFromNode(child)),
  ]
}

function collectVisibleItemIds(
  directItems: readonly LearningPackLibraryItem[],
  children: readonly LearningPackLibraryNode[],
): ReadonlySet<string> {
  return new Set([
    ...directItems.map((item) => item.itemId),
    ...children.flatMap((node) =>
      collectItemsFromNode(node).map((item) => item.itemId),
    ),
  ])
}

function countNodes(node: CountableLibraryNode): number {
  return (
    1 + node.children.reduce((count, child) => count + countNodes(child), 0)
  )
}

function countStudySets(node: CountableLibraryNode): number {
  return (
    node.studySets.length +
    node.children.reduce((count, child) => count + countStudySets(child), 0)
  )
}

function collectNodeItemIds(
  node: DeepReadonly<ReadonlyNode>,
): ReadonlySet<string> {
  return new Set([
    ...node.itemIds,
    ...node.children.flatMap((child) => [...collectNodeItemIds(child)]),
  ])
}

function tagsForConceptIds(
  conceptIds: readonly string[],
  indexes: PackIndexes,
): string[] {
  return conceptIds.flatMap(
    (conceptId) => indexes.conceptsById.get(conceptId)?.tags ?? [],
  )
}

function authoredTagsForStudySet(set: DeepReadonly<StudySet>): string[] {
  if (set.selection.kind === 'explicit') {
    return []
  }

  return uniqueStrings([
    ...set.selection.include.tags,
    ...set.selection.exclude.tags,
  ])
}

function hasContentFilters(filters: LearningPackLibraryFilters): boolean {
  return (
    filters.subjectId !== undefined ||
    filters.courseId !== undefined ||
    filters.conceptId !== undefined ||
    filters.objectiveId !== undefined ||
    filters.itemMode !== undefined ||
    filters.authoredTag !== undefined ||
    filters.learningStatus !== undefined
  )
}

function visualTokenForPack(
  pack: ReadonlyPack,
  state: LearningPackLibraryPackState,
): LearningPackVisualToken {
  if (state === 'invalid-pack' || state === 'unsupported-capability') {
    return 'warning'
  }

  const text = `${pack.manifest.title} ${pack.theme?.displayName ?? ''}`
    .toLowerCase()
    .trim()

  if (text.includes('proof')) {
    return 'proof'
  }
  if (text.includes('practice')) {
    return 'practice'
  }
  if (text.includes('logic')) {
    return 'logic'
  }

  return 'neutral'
}

function formatCapability(capability: {
  readonly capabilityId: string
  readonly version: string
}): string {
  return `${capability.capabilityId}@${capability.version}`
}

function playModeLabel(mode: PlayMode): string {
  switch (mode) {
    case 'flashcard':
      return 'Flashcard'
    case 'single-choice-quiz':
      return 'Single-choice quiz'
    case 'multiple-choice-quiz':
      return 'Multiple-choice quiz'
    case 'text-recall':
      return 'Text recall'
    case 'number-recall':
      return 'Number recall'
    case 'manual-read':
      return 'Manual reading'
    case 'self-grade-review':
      return 'Self-grade review'
  }
}

function learningStatusLabel(status: LearningPackLearningStatus): string {
  switch (status) {
    case 'not-started':
      return 'Not started'
    case 'active':
      return 'Active'
    case 'attempted':
      return 'Attempted'
    case 'completed':
      return 'Completed'
    case 'unavailable':
      return 'Unavailable'
  }
}

function toOptions(
  values: ReadonlyMap<string, string>,
): LearningPackLibraryFilterOption[] {
  return [...values.entries()]
    .sort((left, right) => left[1].localeCompare(right[1]))
    .map(([id, label]) => ({ id, label }))
}

function hasAnyStatus(
  statusIndex: ReadonlyMap<
    string,
    ReadonlyMap<string, LearningPackLearningStatus>
  >,
): boolean {
  for (const itemStatuses of statusIndex.values()) {
    if (itemStatuses.size > 0) {
      return true
    }
  }

  return false
}

function packStateKey(packId: string, packVersion: string | null): string {
  return `${packId}\u0000${packVersion ?? ''}`
}

function versionedSubjectKey(
  subjectId: string,
  subjectVersion: string,
): string {
  return `${subjectId}\u0000${subjectVersion}`
}

function itemStatusKey(subjectId: string, itemId: string): string {
  return `${subjectId}\u0000${itemId}`
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values)]
}
