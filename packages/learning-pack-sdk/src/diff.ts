import {
  canPreserveMasteryAcrossRevision,
  compareResourceRevisions,
  type CurriculumNode,
  type LearningResource,
  type ResourceSegment,
} from '@learnt/learning-pack-contracts'
import {
  loadLearningPackArchive,
  loadLearningPackDirectory,
} from './archive.js'
import type {
  DiffLearningPackResult,
  LearningPackSdkOptions,
  LoadedLearningPack,
} from './types.js'

export async function diffLearningPacks(
  oldPath: string,
  newPath: string,
  options: LearningPackSdkOptions = {},
): Promise<DiffLearningPackResult> {
  const [oldLoaded, newLoaded] = await Promise.all([
    loadLearningPackSource(oldPath, options),
    loadLearningPackSource(newPath, options),
  ])
  const diagnostics = [...oldLoaded.diagnostics, ...newLoaded.diagnostics]

  if (!('documents' in oldLoaded) || !('documents' in newLoaded)) {
    return emptyDiff(oldPath, newPath, diagnostics)
  }

  const oldItems = new Map(
    oldLoaded.documents.items.items.map((item) => [item.itemId, item]),
  )
  const newItems = new Map(
    newLoaded.documents.items.items.map((item) => [item.itemId, item]),
  )
  const addedItems = [...newItems.keys()]
    .filter((itemId) => !oldItems.has(itemId))
    .sort()
  const removedItems = [...oldItems.keys()]
    .filter((itemId) => !newItems.has(itemId))
    .sort()
  const changedItems = [...newItems.entries()]
    .filter(([itemId, item]) => {
      const oldItem = oldItems.get(itemId)
      return (
        oldItem !== undefined &&
        JSON.stringify(oldItem) !== JSON.stringify(item)
      )
    })
    .map(([itemId]) => itemId)
    .sort()
  const learningRevisionIncreases = [...newItems.entries()]
    .flatMap(([itemId, item]) => {
      const oldItem = oldItems.get(itemId)
      if (!oldItem || item.learningRevision <= oldItem.learningRevision) {
        return []
      }
      return [
        {
          itemId,
          fromLearningRevision: oldItem.learningRevision,
          toLearningRevision: item.learningRevision,
          masteryMustReset: !canPreserveMasteryAcrossRevision(
            oldItem.learningRevision,
            item.learningRevision,
          ),
        },
      ]
    })
    .sort((left, right) => left.itemId.localeCompare(right.itemId))

  const oldResources = new Map(
    (oldLoaded.documents.resources?.resources ?? []).map((resource) => [
      resource.id,
      resource,
    ]),
  )
  const newResources = new Map(
    (newLoaded.documents.resources?.resources ?? []).map((resource) => [
      resource.id,
      resource,
    ]),
  )
  const addedResources = [...newResources.keys()]
    .filter((resourceId) => !oldResources.has(resourceId))
    .sort()
  const removedResources = [...oldResources.keys()]
    .filter((resourceId) => !newResources.has(resourceId))
    .sort()
  const changedResources = [...newResources.entries()]
    .filter(([resourceId, resource]) => {
      const oldResource = oldResources.get(resourceId)
      return (
        oldResource !== undefined &&
        JSON.stringify(oldResource) !== JSON.stringify(resource)
      )
    })
    .map(([resourceId]) => resourceId)
    .sort()
  const resourceRevisionIncreases = [...newResources.entries()]
    .flatMap(([resourceId, resource]) => {
      const oldResource = oldResources.get(resourceId)
      if (
        !oldResource ||
        compareResourceRevisions(
          oldResource.contentRevision,
          resource.contentRevision,
        ) >= 0
      ) {
        return []
      }
      return [
        {
          resourceId,
          fromContentRevision: oldResource.contentRevision,
          toContentRevision: resource.contentRevision,
          engagementMayBeStale: true,
        },
      ]
    })
    .sort((left, right) => left.resourceId.localeCompare(right.resourceId))
  const changedResourceMetadata = changedResources
    .filter((resourceId) => {
      const oldResource = oldResources.get(resourceId)
      const newResource = newResources.get(resourceId)
      return (
        oldResource !== undefined &&
        newResource !== undefined &&
        JSON.stringify(resourceMetadataProjection(oldResource)) !==
          JSON.stringify(resourceMetadataProjection(newResource))
      )
    })
    .sort()
  const changedResourceSources = changedResources
    .filter((resourceId) => {
      const oldResource = oldResources.get(resourceId)
      const newResource = newResources.get(resourceId)
      return (
        oldResource !== undefined &&
        newResource !== undefined &&
        JSON.stringify(oldResource.source) !==
          JSON.stringify(newResource.source)
      )
    })
    .sort()
  const changedResourceSegments = changedResources
    .map((resourceId) => {
      const oldResource = oldResources.get(resourceId)
      const newResource = newResources.get(resourceId)
      if (!oldResource || !newResource) {
        return null
      }
      const segmentDiff = diffSegments(
        oldResource.segments ?? [],
        newResource.segments ?? [],
      )
      if (
        segmentDiff.addedSegmentIds.length === 0 &&
        segmentDiff.removedSegmentIds.length === 0 &&
        segmentDiff.changedSegmentIds.length === 0
      ) {
        return null
      }
      return { resourceId, ...segmentDiff }
    })
    .filter((value): value is NonNullable<typeof value> => value !== null)
    .sort((left, right) => left.resourceId.localeCompare(right.resourceId))
  const changedResourceCheckpoints = changedResources
    .map((resourceId) => {
      const oldResource = oldResources.get(resourceId)
      const newResource = newResources.get(resourceId)
      if (!oldResource || !newResource) {
        return null
      }
      const checkpointDiff = diffCheckpointRefs(oldResource, newResource)
      if (
        checkpointDiff.addedCheckpointIds.length === 0 &&
        checkpointDiff.removedCheckpointIds.length === 0
      ) {
        return null
      }
      return { resourceId, ...checkpointDiff }
    })
    .filter((value): value is NonNullable<typeof value> => value !== null)
    .sort((left, right) => left.resourceId.localeCompare(right.resourceId))
  const changedCurriculumOrders = diffCurriculumOrders(oldLoaded, newLoaded)

  const oldFiles = new Map(
    oldLoaded.files.map((file) => [file.path, file.sha256]),
  )
  const newFiles = new Map(
    newLoaded.files.map((file) => [file.path, file.sha256]),
  )
  const addedFiles = [...newFiles.keys()]
    .filter((filePath) => !oldFiles.has(filePath))
    .sort()
  const removedFiles = [...oldFiles.keys()]
    .filter((filePath) => !newFiles.has(filePath))
    .sort()
  const changedFiles = [...newFiles.entries()]
    .filter(
      ([filePath, hash]) =>
        oldFiles.has(filePath) && oldFiles.get(filePath) !== hash,
    )
    .map(([filePath]) => filePath)
    .sort()

  return {
    ok: diagnostics.every((diagnostic) => diagnostic.severity !== 'error'),
    oldPath,
    newPath,
    oldPackId: oldLoaded.documents.manifest.packId,
    newPackId: newLoaded.documents.manifest.packId,
    oldVersion: oldLoaded.documents.manifest.version,
    newVersion: newLoaded.documents.manifest.version,
    changedRelease:
      oldLoaded.documents.manifest.packId !==
        newLoaded.documents.manifest.packId ||
      oldLoaded.documents.manifest.version !==
        newLoaded.documents.manifest.version,
    addedItems,
    removedItems,
    changedItems,
    addedResources,
    removedResources,
    changedResources,
    learningRevisionIncreases,
    resourceRevisionIncreases,
    changedResourceMetadata,
    changedResourceSources,
    changedResourceSegments,
    changedResourceCheckpoints,
    changedCurriculumOrders,
    addedFiles,
    removedFiles,
    changedFiles,
    migrations: newLoaded.documents.migrations?.migrations ?? [],
    diagnostics,
  }
}

async function loadLearningPackSource(
  sourcePath: string,
  options: LearningPackSdkOptions,
): Promise<
  LoadedLearningPack | { diagnostics: LoadedLearningPack['diagnostics'] }
> {
  if (sourcePath.toLowerCase().endsWith('.learntpack')) {
    return loadLearningPackArchive(sourcePath, options)
  }
  return loadLearningPackDirectory(sourcePath, options)
}

function emptyDiff(
  oldPath: string,
  newPath: string,
  diagnostics: DiffLearningPackResult['diagnostics'],
): DiffLearningPackResult {
  return {
    ok: false,
    oldPath,
    newPath,
    addedItems: [],
    removedItems: [],
    changedItems: [],
    addedResources: [],
    removedResources: [],
    changedResources: [],
    learningRevisionIncreases: [],
    resourceRevisionIncreases: [],
    changedResourceMetadata: [],
    changedResourceSources: [],
    changedResourceSegments: [],
    changedResourceCheckpoints: [],
    changedCurriculumOrders: [],
    addedFiles: [],
    removedFiles: [],
    changedFiles: [],
    migrations: [],
    diagnostics,
  }
}

function resourceMetadataProjection(resource: LearningResource): unknown {
  return {
    title: resource.title,
    summary: resource.summary,
    modality: resource.modality,
    roles: resource.roles,
    conceptIds: resource.conceptIds,
    objectiveIds: resource.objectiveIds,
    estimatedDurationSeconds: resource.estimatedDurationSeconds,
    difficulty: resource.difficulty,
    language: resource.language,
    tags: resource.tags,
    provenance: resource.provenance,
    accessibility: resource.accessibility,
    metadata: resource.metadata,
  }
}

function diffSegments(
  oldSegments: readonly ResourceSegment[],
  newSegments: readonly ResourceSegment[],
): {
  addedSegmentIds: string[]
  removedSegmentIds: string[]
  changedSegmentIds: string[]
} {
  const oldById = new Map(oldSegments.map((segment) => [segment.id, segment]))
  const newById = new Map(newSegments.map((segment) => [segment.id, segment]))

  return {
    addedSegmentIds: [...newById.keys()]
      .filter((segmentId) => !oldById.has(segmentId))
      .sort(),
    removedSegmentIds: [...oldById.keys()]
      .filter((segmentId) => !newById.has(segmentId))
      .sort(),
    changedSegmentIds: [...newById.entries()]
      .filter(([segmentId, segment]) => {
        const oldSegment = oldById.get(segmentId)
        return (
          oldSegment !== undefined &&
          JSON.stringify(oldSegment) !== JSON.stringify(segment)
        )
      })
      .map(([segmentId]) => segmentId)
      .sort(),
  }
}

function diffCheckpointRefs(
  oldResource: LearningResource,
  newResource: LearningResource,
): {
  addedCheckpointIds: string[]
  removedCheckpointIds: string[]
} {
  const oldRefs = new Set(resourceCheckpointRefs(oldResource))
  const newRefs = new Set(resourceCheckpointRefs(newResource))

  return {
    addedCheckpointIds: [...newRefs]
      .filter((checkpointId) => !oldRefs.has(checkpointId))
      .sort(),
    removedCheckpointIds: [...oldRefs]
      .filter((checkpointId) => !newRefs.has(checkpointId))
      .sort(),
  }
}

function resourceCheckpointRefs(resource: LearningResource): string[] {
  return [
    ...(resource.checkpointStudySetIds ?? []).map(
      (setId) => `resource:${setId}`,
    ),
    ...(resource.segments ?? []).flatMap((segment) =>
      segment.checkpointStudySetIds.map((setId) => `${segment.id}:${setId}`),
    ),
  ]
}

function diffCurriculumOrders(
  oldLoaded: LoadedLearningPack,
  newLoaded: LoadedLearningPack,
): string[] {
  const oldEntries = curriculumEntryMap(oldLoaded)
  const newEntries = curriculumEntryMap(newLoaded)

  return [...newEntries.entries()]
    .filter(([nodeKey, entries]) => {
      const oldNodeEntries = oldEntries.get(nodeKey)
      return oldNodeEntries !== undefined && oldNodeEntries !== entries
    })
    .map(([nodeKey]) => nodeKey)
    .sort()
}

function curriculumEntryMap(loaded: LoadedLearningPack): Map<string, string> {
  const entries = new Map<string, string>()
  for (const course of loaded.documents.courses.courses) {
    for (const node of flattenNodes(course.rootNodes)) {
      entries.set(
        `${course.courseId}:${node.nodeId}`,
        JSON.stringify(node.entries ?? []),
      )
    }
  }
  return entries
}

function flattenNodes(nodes: readonly CurriculumNode[]): CurriculumNode[] {
  return nodes.flatMap((node) => [node, ...flattenNodes(node.children)])
}
