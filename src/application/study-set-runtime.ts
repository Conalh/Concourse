import {
  resolveStudySetItemIds,
  type LearningPackDocuments,
  type StudySet,
} from '@learnt/learning-pack-contracts'

import {
  ActivityIdSchema,
  type LearningFlowOrigin,
  type LearningFlowSessionState,
} from '../core/contracts'
import type { LearningSubject } from '../core/engine'
import { cloneDeep, deepFreeze, type DeepReadonly } from '../core/foundation'
import type { InstalledLearningPack } from '../learning-packs/learnt-importer'
import { defineSubject } from '../subject-sdk'
import type {
  ResolveStudySetInput,
  ResolvedStudySet,
} from './learnt-application.types'
import { LearningApplicationError } from './learning-application-error'
import { requireInstalledPack } from './learning-resource-runtime'

type RuntimeStudySetInput = ResolveStudySetInput &
  Readonly<{
    installedPacks: readonly InstalledLearningPack[]
  }>

const DEFAULT_REPEATED_INCORRECT_THRESHOLD = 2

export function repeatedIncorrectThreshold(): number {
  return DEFAULT_REPEATED_INCORRECT_THRESHOLD
}

export function resolveStudySet(input: RuntimeStudySetInput): ResolvedStudySet {
  const installedPack = requireInstalledPack(input.installedPacks, input.packId)
  const studySet = installedPack.documents.sets.sets.find(
    (candidate) => candidate.setId === input.studySetId,
  )

  if (studySet === undefined) {
    throw new LearningApplicationError(
      'session-state-incompatible',
      'StudySet was not found in the installed pack.',
      {
        details: {
          packId: input.packId,
          studySetId: input.studySetId,
        },
      },
    )
  }

  const seed =
    input.seed ??
    `${installedPack.packId}:${installedPack.packVersion}:${studySet.setId}`
  const itemIds = orderedStudySetItemIds(
    installedPack.documents,
    studySet,
    seed,
  )
  const parsedItemIds = itemIds.map((itemId) => {
    const parsed = ActivityIdSchema.safeParse(itemId)

    if (!parsed.success) {
      throw new LearningApplicationError(
        'session-state-incompatible',
        'StudySet selected an item ID Concourse cannot use as an activity ID.',
        {
          details: {
            packId: input.packId,
            studySetId: studySet.setId,
            itemId,
          },
        },
      )
    }

    return parsed.data
  })

  assertNoDuplicateItemIds(installedPack.packId, studySet.setId, parsedItemIds)
  assertStudySetItemsAvailable(installedPack, studySet, parsedItemIds)

  const resolved: ResolvedStudySet = {
    packId: installedPack.packId,
    packVersion: installedPack.packVersion,
    studySetId: studySet.setId,
    title: studySet.title,
    summary: studySet.summary,
    kind: studySet.kind,
    ordering: studySet.ordering,
    playModes: studySet.playModes,
    timeLimitSeconds: studySet.timeLimitSeconds,
    attemptLimit: studySet.attemptLimit,
    seed,
    itemIds: parsedItemIds,
    itemCount: parsedItemIds.length,
  }

  return deepFreeze(cloneDeep(resolved))
}

export function createStudySetLearningFlow(
  studySet: ResolvedStudySet,
  origin: LearningFlowOrigin,
): LearningFlowSessionState {
  const flow: LearningFlowSessionState = {
    kind: 'study-set-checkpoint',
    packId: studySet.packId,
    packVersion: studySet.packVersion,
    studySetId: studySet.studySetId,
    studySetTitle: studySet.title,
    seed: studySet.seed,
    itemIds: [...studySet.itemIds],
    origin: cloneDeep(origin),
  }

  return cloneDeep(flow)
}

export function buildStudySetScopedSubject(
  baseSubject: LearningSubject,
  studySet: ResolvedStudySet,
): LearningSubject {
  if (studySet.itemIds.length === 0) {
    throw new LearningApplicationError(
      'session-state-incompatible',
      'StudySet did not resolve to any LearningItems.',
      {
        details: {
          packId: studySet.packId,
          studySetId: studySet.studySetId,
        },
      },
    )
  }

  const activitiesById = new Map(
    baseSubject.activities.map((activity) => [activity.id, activity]),
  )
  const selectedActivities = studySet.itemIds.map((itemId, index) => {
    const activity = activitiesById.get(itemId)
    const nextActivityId = studySet.itemIds[index + 1]

    if (activity === undefined) {
      throw new LearningApplicationError(
        'session-state-incompatible',
        'StudySet item was not found in the installed subject runtime.',
        {
          details: {
            packId: studySet.packId,
            studySetId: studySet.studySetId,
            itemId,
          },
        },
      )
    }

    return {
      ...cloneDeep(activity),
      moduleId: `checkpoint-${studySet.studySetId}`,
      nextActivityIds: nextActivityId === undefined ? [] : [nextActivityId],
    }
  })
  const conceptIds = uniqueStrings(
    selectedActivities.flatMap((activity) => activity.conceptIds),
  )
  const objectiveIds = uniqueStrings(
    selectedActivities.flatMap((activity) => activity.objectiveIds),
  )

  return defineSubject({
    ...cloneDeep(baseSubject),
    title: `${baseSubject.title}: ${studySet.title}`,
    modules: [
      {
        id: `checkpoint-${studySet.studySetId}`,
        title: studySet.title,
        summary: studySet.summary,
        order: 0,
        conceptIds,
        objectiveIds,
        activityIds: studySet.itemIds,
      },
    ],
    concepts: cloneDeep(baseSubject.concepts),
    objectives: cloneDeep(baseSubject.objectives),
    activities: selectedActivities,
  })
}

function orderedStudySetItemIds(
  pack: DeepReadonly<LearningPackDocuments>,
  studySet: DeepReadonly<StudySet>,
  seed: string,
): string[] {
  const itemIds = resolveStudySetItemIds(
    cloneDeep(pack) as LearningPackDocuments,
    cloneDeep(studySet) as StudySet,
  )

  switch (studySet.ordering) {
    case 'authored':
    case 'adaptive':
      return itemIds
    case 'shuffle':
      return stableShuffle(itemIds, seed)
  }
}

function stableShuffle(values: readonly string[], seed: string): string[] {
  return [...values].sort((left, right) => {
    const leftHash = stableHash(`${seed}:${left}`)
    const rightHash = stableHash(`${seed}:${right}`)

    return leftHash === rightHash
      ? left.localeCompare(right)
      : leftHash - rightHash
  })
}

function stableHash(value: string): number {
  let hash = 2166136261

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return hash >>> 0
}

function assertNoDuplicateItemIds(
  packId: string,
  studySetId: string,
  itemIds: readonly string[],
): void {
  const seen = new Set<string>()
  const duplicate = itemIds.find((itemId) => {
    if (seen.has(itemId)) {
      return true
    }
    seen.add(itemId)
    return false
  })

  if (duplicate !== undefined) {
    throw new LearningApplicationError(
      'session-state-incompatible',
      'StudySet selected the same LearningItem more than once.',
      { details: { packId, studySetId, itemId: duplicate } },
    )
  }
}

function assertStudySetItemsAvailable(
  installedPack: InstalledLearningPack,
  studySet: DeepReadonly<StudySet>,
  itemIds: readonly string[],
): void {
  const itemsById = new Map(
    installedPack.documents.items.items.map((item) => [item.itemId, item]),
  )

  for (const itemId of itemIds) {
    const item = itemsById.get(itemId)

    if (item === undefined) {
      throw new LearningApplicationError(
        'session-state-incompatible',
        'StudySet selected a missing LearningItem.',
        {
          details: {
            packId: installedPack.packId,
            studySetId: studySet.setId,
            itemId,
          },
        },
      )
    }

    if (
      studySet.playModes.length > 0 &&
      !item.allowedPlayModes.some((mode) => studySet.playModes.includes(mode))
    ) {
      throw new LearningApplicationError(
        'session-state-incompatible',
        'StudySet selected a LearningItem without a compatible play mode.',
        {
          details: {
            packId: installedPack.packId,
            studySetId: studySet.setId,
            itemId,
            studySetPlayModes: studySet.playModes,
            itemPlayModes: item.allowedPlayModes,
          },
        },
      )
    }
  }
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values)]
}
