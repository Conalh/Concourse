import {
  resolveStudySetItemIds,
  type ContentBlock as PackContentBlock,
  type CurriculumEntry,
  type CurriculumNode,
  type LearningItem,
  type LearningPackDocuments,
  type PlayMode,
  type StudySet,
} from '@learnt/learning-pack-contracts'

import {
  ActivityIdSchema,
  ConceptIdSchema,
  ExtensionKeySchema,
  ModuleIdSchema,
  ObjectiveIdSchema,
  SubjectIdSchema,
  type ActivityDefinition,
  type ActivityId,
  type ConceptId,
  type ContentBlock,
  type LearningFlowSessionState,
  type ObjectiveId,
} from '../core/contracts'
import type { LearningSubject } from '../core/engine'
import { cloneDeep, deepFreeze, type DeepReadonly } from '../core/foundation'
import type { LearningSessionRecord } from '../core/ports'
import type { InstalledLearningPack } from '../learning-packs/learnt-importer'
import { defineSubject } from '../subject-sdk'
import { LearningApplicationError } from './learning-application-error'
import { requireInstalledPack } from './learning-resource-runtime'
import type {
  GetPracticeRecommendationsInput,
  GetPracticeSummaryInput,
  PracticeCandidateResolution,
  PracticeConceptWeakness,
  PracticeItemMetrics,
  PracticeMetricsSummary,
  PracticeMode,
  PracticeModeAvailability,
  PracticePlan,
  PracticePlanExclusion,
  PracticePlanItem,
  PracticePreferences,
  PracticePresetInput,
  PracticeRequest,
  PracticeScope,
  PracticeScopeOption,
  PracticeSelectionStrategy,
  PracticeSelfGrade,
  PracticeSessionContext,
  PracticeSessionCurrentItem,
  PracticeSessionSummary,
  PracticeUnavailableReason,
  ResolvedPracticeMode,
} from './learnt-application.types'

type RuntimePracticeInput = Readonly<{
  installedPacks: readonly InstalledLearningPack[]
  evidenceRecords: readonly LearningSessionRecord[]
}>

type CreatePracticePlanInput = RuntimePracticeInput &
  Readonly<{
    request: PracticeRequest
    createdAt: string
  }>

type PracticeScopeResolution = Readonly<{
  installedPack: InstalledLearningPack
  itemIds: readonly string[]
  scopeKey: string
  scopeLabel: string
  title: string
  exclusions: readonly PracticePlanExclusion[]
  warnings: readonly string[]
}>

type ModeSelection = Readonly<{
  resolvedMode: ResolvedPracticeMode
  playMode: PlayMode
}>

const DEFAULT_PRACTICE_COUNT = 12
const FLASHCARD_EVALUATOR_KEY = 'learnt.practice-flashcard-self-grade'

export function defaultPracticePreferences(): PracticePreferences {
  return deepFreeze(
    cloneDeep({
      defaultCount: DEFAULT_PRACTICE_COUNT,
      includeWeakItems: true,
      includeRecentMistakes: true,
      flashcardGradeScale: ['again', 'hard', 'good', 'easy'] as const,
    }),
  )
}

export function getSupportedPracticeModes(
  item: DeepReadonly<LearningItem>,
): readonly PracticeModeAvailability[] {
  return deepFreeze(
    cloneDeep([
      availabilityForMode(item, 'flashcard'),
      availabilityForMode(item, 'quiz'),
      availabilityForMode(item, 'recall'),
    ]),
  )
}

export function getAvailablePracticeScopes(
  input: RuntimePracticeInput,
): readonly PracticeScopeOption[] {
  const options: PracticeScopeOption[] = []
  const metrics = summarizePracticeMetrics(input)

  for (const installedPack of input.installedPacks) {
    const allItemIds = packItemIds(installedPack)
    options.push({
      kind: 'pack',
      packId: installedPack.packId,
      label: installedPack.documents.manifest.title,
      itemCount: allItemIds.length,
    })

    for (const subject of installedPack.documents.catalog.subjects) {
      const subjectInstall = installedPack.subjects.find(
        (candidate) => candidate.subjectId === subject.subjectId,
      )
      options.push({
        kind: 'subject',
        packId: installedPack.packId,
        subjectId: subject.subjectId,
        label: subject.title,
        itemCount: subjectInstall?.itemIds.length ?? 0,
      })
    }

    for (const course of installedPack.documents.courses.courses) {
      options.push({
        kind: 'course',
        packId: installedPack.packId,
        courseId: course.courseId,
        label: course.title,
        itemCount: itemIdsFromNodes(
          installedPack.documents,
          course.rootNodes,
          true,
        ).length,
      })

      for (const node of flattenCurriculumNodes(course.rootNodes)) {
        options.push({
          kind: 'curriculum-node',
          packId: installedPack.packId,
          courseId: course.courseId,
          nodeId: node.nodeId,
          label: node.title,
          itemCount: itemIdsFromNodes(installedPack.documents, [node], true)
            .length,
        })
      }
    }

    for (const concept of installedPack.documents.catalog.concepts) {
      options.push({
        kind: 'concept',
        packId: installedPack.packId,
        conceptId: concept.conceptId,
        label: concept.title,
        itemCount: itemsForConcept(installedPack, concept.conceptId).length,
      })
    }

    for (const objective of installedPack.documents.catalog.objectives) {
      options.push({
        kind: 'objective',
        packId: installedPack.packId,
        objectiveId: objective.objectiveId,
        label: objective.statement,
        itemCount: itemsForObjective(installedPack, objective.objectiveId)
          .length,
      })
    }

    for (const studySet of installedPack.documents.sets.sets) {
      options.push({
        kind: 'study-set',
        packId: installedPack.packId,
        studySetId: studySet.setId,
        label: studySet.title,
        itemCount: resolveStudySetItemIds(
          cloneDeep(installedPack.documents) as LearningPackDocuments,
          cloneDeep(studySet) as StudySet,
        ).length,
      })
    }
  }

  const weakItemCount = Object.values(metrics.items).filter(
    (item) => item.recentUnsuccessful || isWeakPracticeMetric(item),
  ).length
  const recentMistakeCount = metrics.recentMistakes.length

  if (weakItemCount > 0) {
    options.push({
      kind: 'weak-items',
      label: 'Weak items',
      itemCount: weakItemCount,
    })
  }

  if (recentMistakeCount > 0) {
    options.push({
      kind: 'recent-mistakes',
      label: 'Recent mistakes',
      itemCount: recentMistakeCount,
    })
  }

  return deepFreeze(cloneDeep(options))
}

export function createPracticePreset(
  input: PracticePresetInput,
): PracticeRequest {
  const origin = cloneDeep(input.origin)

  switch (input.kind) {
    case 'quick-practice':
      return definePracticeRequest({
        scope: defaultPackOrSubjectScope(input),
        mode: 'mixed',
        selectionStrategy: 'due-or-weak',
        count: 8,
        origin,
      })
    case 'weakest-concepts':
      return definePracticeRequest({
        scope: {
          kind: 'weak-items',
          ...(input.packId === undefined ? {} : { packId: input.packId }),
          ...(input.subjectId === undefined
            ? {}
            : { subjectId: input.subjectId }),
        },
        mode: 'mixed',
        selectionStrategy: 'weakest-first',
        count: 10,
        origin,
      })
    case 'recent-mistakes':
      return definePracticeRequest({
        scope: {
          kind: 'recent-mistakes',
          ...(input.packId === undefined ? {} : { packId: input.packId }),
          ...(input.subjectId === undefined
            ? {}
            : { subjectId: input.subjectId }),
        },
        mode: 'mixed',
        selectionStrategy: 'recent-mistakes',
        count: 10,
        origin,
      })
    case 'flashcards':
      return definePracticeRequest({
        scope: defaultPackOrSubjectScope(input),
        mode: 'flashcard',
        selectionStrategy: 'least-seen',
        count: 12,
        origin,
      })
    case 'quiz-me':
      return definePracticeRequest({
        scope: defaultPackOrSubjectScope(input),
        mode: 'quiz',
        selectionStrategy: 'balanced-by-concept',
        count: 10,
        origin,
      })
    case 'course-review':
      return definePracticeRequest({
        scope: {
          kind: 'course',
          packId: requirePresetValue(input.packId, 'packId'),
          courseId: requirePresetValue(input.courseId, 'courseId'),
        },
        mode: 'mixed',
        selectionStrategy: 'balanced-by-concept',
        origin,
      })
    case 'chapter-review':
      return definePracticeRequest({
        scope: {
          kind: 'curriculum-node',
          packId: requirePresetValue(input.packId, 'packId'),
          courseId: requirePresetValue(input.courseId, 'courseId'),
          nodeId: requirePresetValue(input.nodeId, 'nodeId'),
          includeDescendants: true,
        },
        mode: 'mixed',
        selectionStrategy: 'authored-order',
        origin,
      })
    case 'study-set-practice':
      return definePracticeRequest({
        scope: {
          kind: 'study-set',
          packId: requirePresetValue(input.packId, 'packId'),
          studySetId: requirePresetValue(input.studySetId, 'studySetId'),
        },
        mode: 'flashcard',
        selectionStrategy: 'authored-order',
        origin,
      })
  }
}

export function createPracticePlan(
  input: CreatePracticePlanInput,
): PracticePlan {
  const resolution = resolvePracticeScope(input)
  const metrics = summarizePracticeMetrics(input)
  const itemsById = itemMap(resolution.installedPack)
  const exclusions: PracticePlanExclusion[] = [...resolution.exclusions]
  const candidates: PracticePlanItem[] = []

  for (const itemId of applyExplicitIncludeExclude(
    resolution.itemIds,
    input.request,
  )) {
    const item = itemsById.get(itemId)

    if (item === undefined) {
      exclusions.push({
        itemId,
        reason: 'item-not-found',
      })
      continue
    }

    const selectedMode = selectModeForItem(item, input.request.mode)

    if (selectedMode === null) {
      exclusions.push({
        itemId,
        reason: `mode-unavailable:${input.request.mode}`,
      })
      continue
    }

    candidates.push({
      itemId: parseActivityId(item.itemId),
      title: item.title,
      resolvedMode: selectedMode.resolvedMode,
      playMode: selectedMode.playMode,
      learningRevision: item.learningRevision,
      conceptIds: item.conceptIds.map(parseConceptId),
      objectiveIds: item.objectiveIds.map(parseObjectiveId),
    })
  }

  if (candidates.length === 0) {
    throw new LearningApplicationError(
      'session-state-incompatible',
      'Practice request did not resolve to any compatible LearningItems.',
      {
        details: {
          scope: input.request.scope,
          mode: input.request.mode,
          exclusions,
        },
      },
    )
  }

  const warnings = [...resolution.warnings]
  const orderedCandidates = orderPracticeItems(
    candidates,
    input.request.selectionStrategy,
    input.request.seed ?? defaultPracticeSeed(input),
    metrics,
    warnings,
  )
  const selectedItems =
    input.request.count === undefined
      ? orderedCandidates
      : orderedCandidates.slice(0, input.request.count)
  const conceptIds = uniqueStrings(
    selectedItems.flatMap((item) => item.conceptIds),
  )
  const objectiveIds = uniqueStrings(
    selectedItems.flatMap((item) => item.objectiveIds),
  )
  const seed = input.request.seed ?? defaultPracticeSeed(input)
  const plan: PracticePlan = {
    planId: createPracticePlanId({
      installedPack: resolution.installedPack,
      scopeKey: resolution.scopeKey,
      mode: input.request.mode,
      strategy: input.request.selectionStrategy,
      seed: input.request.seed,
    }),
    request: cloneDeep(input.request),
    packId: resolution.installedPack.packId,
    packVersion: resolution.installedPack.packVersion,
    mode: input.request.mode,
    selectedItemIds: selectedItems.map((item) => item.itemId),
    selectedItems,
    selectionStrategy: input.request.selectionStrategy,
    seed,
    coverage: {
      candidateCount: candidates.length,
      selectedCount: selectedItems.length,
      conceptCount: conceptIds.length,
      objectiveCount: objectiveIds.length,
      excludedCount: exclusions.length,
    },
    exclusions,
    warnings,
    origin: cloneDeep(input.request.origin),
    createdAt: input.createdAt,
    displaySummary: {
      title: resolution.title,
      scopeLabel: resolution.scopeLabel,
      modeLabel: practiceModeLabel(input.request.mode),
      strategyLabel: practiceStrategyLabel(input.request.selectionStrategy),
      itemCount: selectedItems.length,
    },
  }

  return deepFreeze(cloneDeep(plan))
}

export function resolvePracticeCandidates(
  input: RuntimePracticeInput & Readonly<{ scope: PracticeScope }>,
): readonly PracticeCandidateResolution[] {
  const resolution = resolvePracticeScope({
    ...input,
    request: {
      scope: input.scope,
      mode: 'mixed',
      selectionStrategy: 'authored-order',
      origin: { kind: 'library' },
    },
  })
  const itemsById = itemMap(resolution.installedPack)

  return deepFreeze(
    cloneDeep(
      resolution.itemIds.flatMap((itemId) => {
        const item = itemsById.get(itemId)

        if (item === undefined) {
          return []
        }

        return [
          {
            itemId: parseActivityId(item.itemId),
            title: item.title,
            learningRevision: item.learningRevision,
            conceptIds: item.conceptIds.map(parseConceptId),
            objectiveIds: item.objectiveIds.map(parseObjectiveId),
            availableModes: getSupportedPracticeModes(item),
          },
        ]
      }),
    ),
  )
}

export function summarizePracticeMetrics(
  input: RuntimePracticeInput & GetPracticeSummaryInput,
): PracticeMetricsSummary {
  const packItems = collectPracticeItems(input)
  const itemMetrics = new Map<string, MutablePracticeItemMetrics>()

  for (const entry of packItems) {
    itemMetrics.set(entry.item.itemId, {
      itemId: parseActivityId(entry.item.itemId),
      title: entry.item.title,
      packId: entry.installedPack.packId,
      packVersion: entry.installedPack.packVersion,
      conceptIds: entry.item.conceptIds.map(parseConceptId),
      objectiveIds: entry.item.objectiveIds.map(parseObjectiveId),
      attempts: 0,
      successes: 0,
      deterministicAttempts: 0,
      selfGrades: { again: 0, hard: 0, good: 0, easy: 0 },
      lastPracticedAt: null,
      recentUnsuccessful: false,
      modeAvailability: getSupportedPracticeModes(entry.item),
    })
  }

  for (const event of input.evidenceRecords.flatMap(
    (record) => record.evidenceEvents,
  )) {
    const metric = itemMetrics.get(event.activityId)

    if (metric === undefined) {
      continue
    }

    metric.attempts += 1
    metric.lastPracticedAt = maxIsoTimestamp(
      metric.lastPracticedAt,
      event.timestamp,
    )

    if (event.response.kind === 'confidence') {
      const grade = practiceSelfGradeFromConfidence(event.response.value)
      metric.selfGrades[grade] += 1
      if (event.response.value <= 2) {
        metric.recentUnsuccessful = true
      }
      continue
    }

    metric.deterministicAttempts += 1
    if (event.evaluation.status === 'passed') {
      metric.successes += 1
    } else if (
      event.evaluation.status === 'retry' ||
      event.evaluation.status === 'partial'
    ) {
      metric.recentUnsuccessful = true
    }
  }

  const frozenItems = Object.fromEntries(
    [...itemMetrics.entries()].map(([itemId, metric]) => [
      itemId,
      freezePracticeItemMetric(metric),
    ]),
  )
  const weakConcepts = buildWeakConcepts(frozenItems, input.installedPacks)
  const recentMistakes = Object.values(frozenItems)
    .filter((item) => item.recentUnsuccessful)
    .sort(compareLastPracticedDescending)
  const leastSeen = Object.values(frozenItems)
    .sort((left, right) =>
      left.attempts === right.attempts
        ? left.itemId.localeCompare(right.itemId)
        : left.attempts - right.attempts,
    )
    .slice(0, DEFAULT_PRACTICE_COUNT)
  const modeAvailability = Object.fromEntries(
    Object.values(frozenItems).map((item) => [
      item.itemId,
      item.modeAvailability,
    ]),
  )

  return deepFreeze(
    cloneDeep({
      items: frozenItems,
      weakConcepts,
      recentMistakes,
      leastSeen,
      modeAvailability,
      exclusions: [],
      confusionRelationships: [],
      warnings: [
        'Confusion relationships require authored or evaluator-produced confusion evidence; no portable confusion signal is persisted yet.',
      ],
    }),
  )
}

export function getWeakConcepts(
  input: RuntimePracticeInput & GetPracticeRecommendationsInput,
): readonly PracticeConceptWeakness[] {
  return summarizePracticeMetrics(input).weakConcepts.slice(
    0,
    input.limit ?? DEFAULT_PRACTICE_COUNT,
  )
}

export function getRecentMistakes(
  input: RuntimePracticeInput & GetPracticeRecommendationsInput,
): readonly PracticeItemMetrics[] {
  return summarizePracticeMetrics(input).recentMistakes.slice(
    0,
    input.limit ?? DEFAULT_PRACTICE_COUNT,
  )
}

export function createPracticeLearningFlow(
  plan: PracticePlan,
): LearningFlowSessionState {
  return cloneDeep({
    kind: 'practice-plan',
    planId: plan.planId,
    title: plan.displaySummary.title,
    packId: plan.packId,
    packVersion: plan.packVersion,
    mode: plan.mode,
    seed: plan.seed,
    selectedItems: plan.selectedItems.map((item) => ({
      itemId: item.itemId,
      title: item.title,
      resolvedMode: item.resolvedMode,
      playMode: item.playMode,
      learningRevision: item.learningRevision,
    })),
    origin: cloneDeep(plan.origin),
  })
}

export function buildPracticeScopedSubject(
  baseSubject: LearningSubject,
  plan:
    | PracticePlan
    | DeepReadonly<
        Extract<LearningFlowSessionState, { kind: 'practice-plan' }>
      >,
): LearningSubject {
  const selectedItems = practicePlanItemsFromPlanOrFlow(baseSubject, plan)
  const activitiesById = new Map(
    baseSubject.activities.map((activity) => [activity.id, activity]),
  )
  const moduleId = parseModuleId(`practice-${sanitizeStableId(plan.planId)}`)
  const selectedActivities = selectedItems.map((item, index) => {
    const activity = activitiesById.get(item.itemId)
    const nextActivityId = selectedItems[index + 1]?.itemId

    if (activity === undefined) {
      throw new LearningApplicationError(
        'session-state-incompatible',
        'Practice item was not found in the installed subject runtime.',
        {
          details: {
            planId: plan.planId,
            itemId: item.itemId,
          },
        },
      )
    }

    const base = cloneDeep(activity) as ActivityDefinition
    const projected =
      item.resolvedMode === 'flashcard' || item.playMode === 'self-grade-review'
        ? projectFlashcardActivity(base, item)
        : base

    return {
      ...projected,
      moduleId,
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
    title: `${baseSubject.title}: ${practicePlanTitle(plan)}`,
    modules: [
      {
        id: moduleId,
        title: practicePlanTitle(plan),
        summary: `Practice plan with ${String(selectedItems.length)} item${
          selectedItems.length === 1 ? '' : 's'
        }.`,
        order: 0,
        conceptIds,
        objectiveIds,
        activityIds: selectedItems.map((item) => item.itemId),
      },
    ],
    concepts: cloneDeep(baseSubject.concepts),
    objectives: cloneDeep(baseSubject.objectives),
    activities: selectedActivities,
    extensions: practiceSubjectExtensions(baseSubject, selectedItems),
  })
}

export function buildPracticePackBaseSubject(
  installedPack: InstalledLearningPack,
  selectedItems: readonly Pick<PracticePlanItem, 'itemId'>[],
): LearningSubject {
  const selectedIds = selectedItems.map((item) => item.itemId)
  const sourceActivities = selectedIds.map((itemId, index) => {
    const activity = installedPack.adapters
      .flatMap((adapter) => adapter.subject.activities)
      .find((candidate) => candidate.id === itemId)
    const nextActivityId = selectedIds[index + 1]

    if (activity === undefined) {
      throw new LearningApplicationError(
        'session-state-incompatible',
        'Practice item was not found in any installed subject runtime.',
        {
          details: {
            packId: installedPack.packId,
            itemId,
          },
        },
      )
    }

    return {
      ...(cloneDeep(activity) as ActivityDefinition),
      moduleId: parseModuleId(
        `practice-source-${sanitizeStableId(installedPack.packId)}`,
      ),
      nextActivityIds: nextActivityId === undefined ? [] : [nextActivityId],
    }
  })
  const conceptIds = uniqueStrings(
    sourceActivities.flatMap((activity) => activity.conceptIds),
  )
  const objectiveIds = uniqueStrings(
    sourceActivities.flatMap((activity) => activity.objectiveIds),
  )
  const concepts = uniqueById(
    installedPack.adapters.flatMap((adapter) => adapter.subject.concepts),
    (concept) => concept.id,
  )
  const objectives = uniqueById(
    installedPack.adapters.flatMap((adapter) => adapter.subject.objectives),
    (objective) => objective.id,
  )
  const extensions = uniqueById(
    installedPack.adapters.flatMap((adapter) => adapter.subject.extensions),
    (extension) => `${extension.kind}:${extension.key}`,
  )
  const sourceModuleId = parseModuleId(
    `practice-source-${sanitizeStableId(installedPack.packId)}`,
  )

  return defineSubject({
    schemaVersion: installedPack.documents.manifest.schemaVersion,
    id: SubjectIdSchema.parse(
      `practice-source-${sanitizeStableId(installedPack.packId)}`,
    ),
    version: installedPack.packVersion,
    title: installedPack.documents.manifest.title,
    summary: installedPack.documents.manifest.summary,
    tags: [...(installedPack.documents.manifest.keywords ?? [])],
    modules: [
      {
        id: sourceModuleId,
        title: 'Practice source',
        summary: 'Synthetic source module for pack-scoped practice.',
        order: 0,
        conceptIds,
        objectiveIds,
        activityIds: selectedIds,
      },
    ],
    concepts: cloneDeep(concepts),
    objectives: cloneDeep(objectives),
    activities: sourceActivities,
    extensions: cloneDeep(extensions),
  })
}

export function buildPracticeSessionContext(
  input: Readonly<{
    record: LearningSessionRecord
    subject: LearningSubject
    installedPack: InstalledLearningPack | null
  }>,
): PracticeSessionContext | undefined {
  const flow = input.record.session.exploration.learningFlow

  if (flow?.kind !== 'practice-plan') {
    return undefined
  }

  const selectedItems = practicePlanItemsFromPlanOrFlow(input.subject, flow)
  const currentItem =
    input.record.session.currentActivityId === null
      ? null
      : buildCurrentPracticeItem({
          activityId: input.record.session.currentActivityId,
          selectedItems,
          subject: input.subject,
          installedPack: input.installedPack,
        })

  return deepFreeze(
    cloneDeep({
      planId: flow.planId,
      packId: flow.packId,
      packVersion: flow.packVersion,
      mode: flow.mode,
      origin: flow.origin,
      selectedItems,
      currentItem,
      summary: summarizePracticeSession(flow, input.record),
    }),
  )
}

export function practiceFlowPackId(
  flow: LearningFlowSessionState | undefined,
): string | null {
  return flow?.kind === 'practice-plan' ? flow.packId : null
}

function definePracticeRequest(request: PracticeRequest): PracticeRequest {
  return deepFreeze(cloneDeep(request))
}

function defaultPackOrSubjectScope(input: PracticePresetInput): PracticeScope {
  if (input.subjectId !== undefined) {
    return {
      kind: 'subject',
      ...(input.packId === undefined ? {} : { packId: input.packId }),
      subjectId: input.subjectId,
    }
  }

  return {
    kind: 'pack',
    packId: requirePresetValue(input.packId, 'packId'),
  }
}

function requirePresetValue(value: string | undefined, field: string): string {
  if (value === undefined) {
    throw new LearningApplicationError(
      'session-state-incompatible',
      `Practice preset requires ${field}.`,
      { details: { field } },
    )
  }

  return value
}

function availabilityForMode(
  item: DeepReadonly<LearningItem>,
  mode: ResolvedPracticeMode,
): PracticeModeAvailability {
  const reasons: PracticeUnavailableReason[] = []
  const playModes = playModesForResolvedMode(item, mode)

  if (playModes.length === 0) {
    reasons.push('play-mode-not-authored')
  }

  if (mode === 'flashcard' && !hasUsableSolution(item)) {
    reasons.push('missing-reviewed-solution')
  }

  if (mode === 'quiz' && playModes.length > 0 && quizPlayMode(item) === null) {
    reasons.push('missing-deterministic-evaluation')
  }

  if (
    mode === 'recall' &&
    playModes.length > 0 &&
    recallPlayMode(item) === null
  ) {
    reasons.push('missing-deterministic-evaluation')
  }

  return {
    mode,
    available: reasons.length === 0,
    playModes,
    reasons,
  }
}

function playModesForResolvedMode(
  item: DeepReadonly<LearningItem>,
  mode: ResolvedPracticeMode,
): PlayMode[] {
  switch (mode) {
    case 'flashcard':
      return item.allowedPlayModes.includes('flashcard') ? ['flashcard'] : []
    case 'quiz':
      return ['single-choice-quiz', 'multiple-choice-quiz'].filter(
        (playMode): playMode is PlayMode =>
          item.allowedPlayModes.includes(playMode as PlayMode),
      )
    case 'recall':
      return ['text-recall', 'number-recall', 'self-grade-review'].filter(
        (playMode): playMode is PlayMode =>
          item.allowedPlayModes.includes(playMode as PlayMode),
      )
  }
}

function quizPlayMode(item: DeepReadonly<LearningItem>): PlayMode | null {
  if (
    item.allowedPlayModes.includes('single-choice-quiz') &&
    item.response.kind === 'single-choice' &&
    item.evaluation.kind === 'choice-selection' &&
    item.evaluation.correctOptionIds.length === 1
  ) {
    return 'single-choice-quiz'
  }

  if (
    item.allowedPlayModes.includes('multiple-choice-quiz') &&
    item.response.kind === 'multiple-choice' &&
    item.evaluation.kind === 'choice-selection' &&
    item.evaluation.correctOptionIds.length > 0
  ) {
    return 'multiple-choice-quiz'
  }

  return null
}

function recallPlayMode(item: DeepReadonly<LearningItem>): PlayMode | null {
  if (
    item.allowedPlayModes.includes('text-recall') &&
    item.response.kind === 'text' &&
    item.evaluation.kind === 'exact-text' &&
    item.evaluation.acceptedAnswers.length > 0
  ) {
    return 'text-recall'
  }

  if (
    item.allowedPlayModes.includes('number-recall') &&
    item.response.kind === 'number' &&
    item.evaluation.kind === 'numerical-tolerance' &&
    item.evaluation.expectedNumber !== null &&
    item.evaluation.absoluteTolerance !== null
  ) {
    return 'number-recall'
  }

  if (
    item.allowedPlayModes.includes('self-grade-review') &&
    item.response.kind === 'self-grade' &&
    item.evaluation.kind === 'self-grade' &&
    hasUsableSolution(item)
  ) {
    return 'self-grade-review'
  }

  return null
}

function selectModeForItem(
  item: DeepReadonly<LearningItem>,
  mode: PracticeMode,
): ModeSelection | null {
  switch (mode) {
    case 'flashcard':
      return isModeAvailable(item, 'flashcard')
        ? { resolvedMode: 'flashcard', playMode: 'flashcard' }
        : null
    case 'quiz': {
      const playMode = quizPlayMode(item)
      return playMode === null ? null : { resolvedMode: 'quiz', playMode }
    }
    case 'recall': {
      const playMode = recallPlayMode(item)
      return playMode === null ? null : { resolvedMode: 'recall', playMode }
    }
    case 'mixed': {
      const quiz = quizPlayMode(item)
      if (quiz !== null) {
        return { resolvedMode: 'quiz', playMode: quiz }
      }

      const recall = recallPlayMode(item)
      if (recall !== null) {
        return { resolvedMode: 'recall', playMode: recall }
      }

      return isModeAvailable(item, 'flashcard')
        ? { resolvedMode: 'flashcard', playMode: 'flashcard' }
        : null
    }
  }
}

function isModeAvailable(
  item: DeepReadonly<LearningItem>,
  mode: ResolvedPracticeMode,
): boolean {
  return availabilityForMode(item, mode).available
}

function hasUsableSolution(item: DeepReadonly<LearningItem>): boolean {
  return item.reviewedSolutionBlocks.some((block) => {
    if (block.text.trim().length > 0) {
      return true
    }

    return (block.altText ?? block.assetId ?? '').trim().length > 0
  })
}

function resolvePracticeScope(
  input: RuntimePracticeInput & Readonly<{ request: PracticeRequest }>,
): PracticeScopeResolution {
  const scope = input.request.scope
  const metrics = summarizePracticeMetrics(input)

  switch (scope.kind) {
    case 'pack': {
      const installedPack = requireInstalledPack(
        input.installedPacks,
        scope.packId,
      )
      return {
        installedPack,
        itemIds: packItemIds(installedPack),
        scopeKey: 'pack',
        scopeLabel: `Pack: ${installedPack.documents.manifest.title}`,
        title: installedPack.documents.manifest.title,
        exclusions: [],
        warnings: [],
      }
    }
    case 'subject': {
      const installedPack = findInstalledPackForSubject(
        input.installedPacks,
        scope,
      )
      const subject = installedPack.documents.catalog.subjects.find(
        (candidate) => candidate.subjectId === scope.subjectId,
      )
      const installedSubject = installedPack.subjects.find(
        (candidate) => candidate.subjectId === scope.subjectId,
      )

      if (subject === undefined || installedSubject === undefined) {
        throw new LearningApplicationError(
          'session-state-incompatible',
          'Practice subject scope was not found in installed packs.',
          { details: { scope } },
        )
      }

      return {
        installedPack,
        itemIds: installedSubject.itemIds,
        scopeKey: scope.subjectId,
        scopeLabel: `Subject: ${subject.title}`,
        title: subject.title,
        exclusions: [],
        warnings: [],
      }
    }
    case 'course': {
      const installedPack = requireInstalledPack(
        input.installedPacks,
        scope.packId,
      )
      const course = requireCourse(installedPack, scope.courseId)
      return {
        installedPack,
        itemIds: itemIdsFromNodes(
          installedPack.documents,
          course.rootNodes,
          true,
        ),
        scopeKey: scope.courseId,
        scopeLabel: `Course: ${course.title}`,
        title: course.title,
        exclusions: [],
        warnings: [],
      }
    }
    case 'curriculum-node': {
      const installedPack = requireInstalledPack(
        input.installedPacks,
        scope.packId,
      )
      const course = requireCourse(installedPack, scope.courseId)
      const node = flattenCurriculumNodes(course.rootNodes).find(
        (candidate) => candidate.nodeId === scope.nodeId,
      )

      if (node === undefined) {
        throw new LearningApplicationError(
          'session-state-incompatible',
          'Practice curriculum node scope was not found in the installed pack.',
          { details: { scope } },
        )
      }

      return {
        installedPack,
        itemIds: itemIdsFromNodes(
          installedPack.documents,
          [node],
          scope.includeDescendants ?? true,
        ),
        scopeKey: scope.nodeId,
        scopeLabel: `Curriculum node: ${node.title}`,
        title: node.title,
        exclusions: [],
        warnings: [],
      }
    }
    case 'concepts': {
      const installedPack = requireInstalledPack(
        input.installedPacks,
        scope.packId,
      )
      const conceptTitles = scope.conceptIds.map(
        (conceptId) =>
          installedPack.documents.catalog.concepts.find(
            (concept) => concept.conceptId === conceptId,
          )?.title ?? conceptId,
      )
      const conceptSet = new Set(scope.conceptIds)

      return {
        installedPack,
        itemIds: packItemIds(installedPack).filter((itemId) => {
          const item = itemMap(installedPack).get(itemId)
          return item?.conceptIds.some((conceptId) => conceptSet.has(conceptId))
        }),
        scopeKey: `concepts-${scope.conceptIds.join('-')}`,
        scopeLabel: `Concepts: ${conceptTitles.join(', ')}`,
        title: conceptTitles.join(', '),
        exclusions: [],
        warnings: [],
      }
    }
    case 'objectives': {
      const installedPack = requireInstalledPack(
        input.installedPacks,
        scope.packId,
      )
      const objectiveSet = new Set(scope.objectiveIds)

      return {
        installedPack,
        itemIds: packItemIds(installedPack).filter((itemId) => {
          const item = itemMap(installedPack).get(itemId)
          return item?.objectiveIds.some((objectiveId) =>
            objectiveSet.has(objectiveId),
          )
        }),
        scopeKey: `objectives-${scope.objectiveIds.join('-')}`,
        scopeLabel: `Objectives: ${scope.objectiveIds.join(', ')}`,
        title: 'Objective Practice',
        exclusions: [],
        warnings: [],
      }
    }
    case 'study-set': {
      const installedPack = requireInstalledPack(
        input.installedPacks,
        scope.packId,
      )
      const studySet = installedPack.documents.sets.sets.find(
        (candidate) => candidate.setId === scope.studySetId,
      )

      if (studySet === undefined) {
        throw new LearningApplicationError(
          'session-state-incompatible',
          'Practice StudySet scope was not found in the installed pack.',
          { details: { scope } },
        )
      }

      return {
        installedPack,
        itemIds: resolveStudySetItemIds(
          cloneDeep(installedPack.documents) as LearningPackDocuments,
          cloneDeep(studySet) as StudySet,
        ),
        scopeKey: studySet.setId,
        scopeLabel: `StudySet: ${studySet.title}`,
        title: studySet.title,
        exclusions: [],
        warnings: [],
      }
    }
    case 'items': {
      const installedPack = requireInstalledPack(
        input.installedPacks,
        scope.packId,
      )
      return {
        installedPack,
        itemIds: [...scope.itemIds],
        scopeKey: `items-${scope.itemIds.join('-')}`,
        scopeLabel: 'Explicit items',
        title: 'Item Practice',
        exclusions: [],
        warnings: [],
      }
    }
    case 'weak-items':
    case 'recent-mistakes': {
      const scopedItems =
        scope.kind === 'weak-items'
          ? Object.values(metrics.items).filter(
              (item) => item.recentUnsuccessful || isWeakPracticeMetric(item),
            )
          : metrics.recentMistakes
      const firstMetric = scopedItems.find(
        (item) =>
          (scope.packId === undefined || item.packId === scope.packId) &&
          (scope.subjectId === undefined ||
            subjectOwnsItem(
              input.installedPacks,
              scope.subjectId,
              item.itemId,
            )),
      )
      const installedPack =
        firstMetric === undefined
          ? input.installedPacks[0]
          : requireInstalledPack(input.installedPacks, firstMetric.packId)

      if (installedPack === undefined) {
        throw new LearningApplicationError(
          'session-state-incompatible',
          'Practice requires at least one installed learning pack.',
        )
      }

      return {
        installedPack,
        itemIds: scopedItems
          .filter(
            (item) =>
              (scope.packId === undefined || item.packId === scope.packId) &&
              (scope.subjectId === undefined ||
                subjectOwnsItem(
                  input.installedPacks,
                  scope.subjectId,
                  item.itemId,
                )),
          )
          .map((item) => item.itemId),
        scopeKey: scope.kind,
        scopeLabel:
          scope.kind === 'weak-items' ? 'Weak items' : 'Recent mistakes',
        title: scope.kind === 'weak-items' ? 'Weak Items' : 'Recent Mistakes',
        exclusions: [],
        warnings:
          scopedItems.length === 0
            ? [
                'No learner evidence matched this scope yet; use a broader preset until practice history exists.',
              ]
            : [],
      }
    }
  }
}

function applyExplicitIncludeExclude(
  itemIds: readonly string[],
  request: PracticeRequest,
): readonly string[] {
  const included =
    request.includeItemIds === undefined
      ? [...itemIds]
      : uniqueStrings([...request.includeItemIds, ...itemIds])
  const excluded = new Set(request.excludeItemIds ?? [])

  return included.filter((itemId) => !excluded.has(itemId))
}

function orderPracticeItems(
  candidates: readonly PracticePlanItem[],
  strategy: PracticeSelectionStrategy,
  seed: string,
  metrics: PracticeMetricsSummary,
  warnings: string[],
): readonly PracticePlanItem[] {
  switch (strategy) {
    case 'authored-order':
      return [...candidates]
    case 'random':
      return stableShuffle(candidates, seed, (item) => item.itemId)
    case 'least-seen':
      return [...candidates].sort((left, right) =>
        compareByMetric(left, right, metrics, (metric) => metric.attempts),
      )
    case 'weakest-first':
      if (
        candidates.every(
          (item) => (metrics.items[item.itemId]?.attempts ?? 0) < 2,
        )
      ) {
        warnings.push(
          'Weakest-first has limited evidence; least-seen ordering was used as a fallback.',
        )
      }
      return [...candidates].sort((left, right) => {
        const leftMetric = metrics.items[left.itemId]
        const rightMetric = metrics.items[right.itemId]
        const leftWeak = weaknessScore(leftMetric)
        const rightWeak = weaknessScore(rightMetric)

        return leftWeak === rightWeak
          ? compareByMetric(left, right, metrics, (metric) => metric.attempts)
          : rightWeak - leftWeak
      })
    case 'recent-mistakes': {
      const recent = candidates.filter(
        (item) => metrics.items[item.itemId]?.recentUnsuccessful === true,
      )
      if (recent.length === 0) {
        warnings.push(
          'No recent mistakes matched this scope; authored ordering was used as a fallback.',
        )
        return [...candidates]
      }
      return recent.sort((left, right) =>
        compareLastPracticedDescending(
          metrics.items[left.itemId],
          metrics.items[right.itemId],
        ),
      )
    }
    case 'balanced-by-concept':
      return balanceByConcept(candidates)
    case 'due-or-weak':
      warnings.push(
        'Due scheduling is not portable yet; weak and least-seen ordering was used.',
      )
      return [...candidates].sort((left, right) => {
        const leftMetric = metrics.items[left.itemId]
        const rightMetric = metrics.items[right.itemId]
        const leftWeak = weaknessScore(leftMetric)
        const rightWeak = weaknessScore(rightMetric)

        return leftWeak === rightWeak
          ? compareByMetric(left, right, metrics, (metric) => metric.attempts)
          : rightWeak - leftWeak
      })
  }
}

function compareByMetric(
  left: PracticePlanItem,
  right: PracticePlanItem,
  metrics: PracticeMetricsSummary,
  getValue: (metric: PracticeItemMetrics) => number,
): number {
  const leftMetric = metrics.items[left.itemId]
  const rightMetric = metrics.items[right.itemId]
  const leftValue = leftMetric === undefined ? 0 : getValue(leftMetric)
  const rightValue = rightMetric === undefined ? 0 : getValue(rightMetric)

  return leftValue === rightValue
    ? left.itemId.localeCompare(right.itemId)
    : leftValue - rightValue
}

function weaknessScore(metric: PracticeItemMetrics | undefined): number {
  if (metric === undefined || metric.attempts === 0) {
    return 0
  }

  const failedAttempts = metric.attempts - metric.successes
  const lowSelfGrades = metric.selfGrades.again + metric.selfGrades.hard

  return failedAttempts + lowSelfGrades
}

function balanceByConcept(
  candidates: readonly PracticePlanItem[],
): readonly PracticePlanItem[] {
  const buckets = new Map<string, PracticePlanItem[]>()

  for (const candidate of candidates) {
    const conceptKey = candidate.conceptIds[0] ?? 'unmapped'
    const bucket = buckets.get(conceptKey) ?? []
    bucket.push(candidate)
    buckets.set(conceptKey, bucket)
  }

  const balanced: PracticePlanItem[] = []
  let index = 0
  while (balanced.length < candidates.length) {
    for (const bucket of buckets.values()) {
      const item = bucket[index]
      if (item !== undefined) {
        balanced.push(item)
      }
    }
    index += 1
  }

  return balanced
}

function createPracticePlanId(
  input: Readonly<{
    installedPack: InstalledLearningPack
    scopeKey: string
    mode: PracticeMode
    strategy: PracticeSelectionStrategy
    seed: string | undefined
  }>,
): string {
  return [
    'practice',
    sanitizeStableId(input.installedPack.packId),
    sanitizeStableId(input.installedPack.packVersion),
    sanitizeStableId(input.scopeKey),
    input.mode,
    input.strategy,
    ...(input.seed === undefined ? [] : [sanitizeStableId(input.seed)]),
  ].join('-')
}

function defaultPracticeSeed(input: CreatePracticePlanInput): string {
  return `${input.request.mode}:${input.request.selectionStrategy}:${input.createdAt}`
}

function projectFlashcardActivity(
  activity: ActivityDefinition,
  item: PracticePlanItem,
): ActivityDefinition {
  return {
    ...activity,
    kind: 'recall',
    scaffoldLevel: 'guided',
    response: {
      kind: 'confidence',
      minimum: 1,
      maximum: 5,
      lowLabel: 'Again',
      highLabel: 'Easy',
    },
    evaluation: {
      kind: 'extension',
      evaluatorKey: ExtensionKeySchema.parse(FLASHCARD_EVALUATOR_KEY),
      payload: {
        sourceItemId: item.itemId,
        resolvedMode: item.resolvedMode,
        playMode: item.playMode,
      },
    },
    completionPolicy: { kind: 'submission' },
  }
}

function practiceSubjectExtensions(
  baseSubject: LearningSubject,
  selectedItems: readonly PracticePlanItem[],
) {
  const extensions = [...cloneDeep(baseSubject.extensions)]
  const needsFlashcardEvaluator = selectedItems.some(
    (item) =>
      item.resolvedMode === 'flashcard' ||
      item.playMode === 'self-grade-review',
  )
  const evaluatorKey = ExtensionKeySchema.parse(FLASHCARD_EVALUATOR_KEY)

  if (
    needsFlashcardEvaluator &&
    !extensions.some(
      (extension) =>
        extension.kind === 'evaluator' && extension.key === evaluatorKey,
    )
  ) {
    extensions.push({
      key: evaluatorKey,
      kind: 'evaluator',
    })
  }

  return extensions
}

function buildCurrentPracticeItem(
  input: Readonly<{
    activityId: ActivityId
    selectedItems: readonly PracticePlanItem[]
    subject: LearningSubject
    installedPack: InstalledLearningPack | null
  }>,
): PracticeSessionCurrentItem | null {
  const planItem = input.selectedItems.find(
    (item) => item.itemId === input.activityId,
  )
  const activity =
    input.subject.activities.find(
      (candidate) => candidate.id === input.activityId,
    ) ?? null

  if (planItem === undefined || activity === null) {
    return null
  }

  const sourceItem = input.installedPack?.documents.items.items.find(
    (item) => item.itemId === planItem.itemId,
  )

  return {
    itemId: planItem.itemId,
    title: planItem.title,
    resolvedMode: planItem.resolvedMode,
    playMode: planItem.playMode,
    frontBlocks: cloneDeep(activity.blocks),
    backBlocks:
      sourceItem === undefined
        ? []
        : sourceItem.reviewedSolutionBlocks.flatMap(mapPackContentBlock),
    selfGradeScale: ['again', 'hard', 'good', 'easy'],
  }
}

function summarizePracticeSession(
  flow: DeepReadonly<
    Extract<LearningFlowSessionState, { kind: 'practice-plan' }>
  >,
  record: LearningSessionRecord,
): PracticeSessionSummary {
  const selected = new Set(flow.selectedItems.map((item) => item.itemId))
  const practiceEvidence = record.evidenceEvents.filter((event) =>
    selected.has(event.activityId),
  )

  return {
    selfGradedFlashcards: practiceEvidence.filter(
      (event) => event.response.kind === 'confidence',
    ).length,
    evaluatedQuizResponses: practiceEvidence.filter(
      (event) => event.response.kind !== 'confidence',
    ).length,
    recentUnsuccessful: practiceEvidence.filter(
      (event) =>
        event.evaluation.status === 'retry' ||
        event.evaluation.status === 'partial' ||
        (event.response.kind === 'confidence' && event.response.value <= 2),
    ).length,
  }
}

function practicePlanItemsFromPlanOrFlow(
  subject: LearningSubject,
  plan:
    | PracticePlan
    | DeepReadonly<
        Extract<LearningFlowSessionState, { kind: 'practice-plan' }>
      >,
): readonly PracticePlanItem[] {
  if ('request' in plan) {
    return plan.selectedItems
  }

  return plan.selectedItems.map((item) => {
    const activity = subject.activities.find(
      (candidate) => candidate.id === item.itemId,
    )

    return {
      itemId: item.itemId,
      title: item.title,
      resolvedMode: item.resolvedMode,
      playMode: item.playMode,
      learningRevision: item.learningRevision,
      conceptIds: activity?.conceptIds ?? [],
      objectiveIds: activity?.objectiveIds ?? [],
    }
  })
}

function practicePlanTitle(
  plan:
    | PracticePlan
    | DeepReadonly<
        Extract<LearningFlowSessionState, { kind: 'practice-plan' }>
      >,
): string {
  return 'request' in plan ? plan.displaySummary.title : plan.title
}

function collectPracticeItems(
  input: RuntimePracticeInput & GetPracticeSummaryInput,
): readonly Readonly<{
  installedPack: InstalledLearningPack
  item: DeepReadonly<LearningItem>
}>[] {
  return input.installedPacks.flatMap((installedPack) => {
    if (input.packId !== undefined && installedPack.packId !== input.packId) {
      return []
    }

    const subjectItemIds =
      input.subjectId === undefined
        ? null
        : (installedPack.subjects.find(
            (subject) => subject.subjectId === input.subjectId,
          )?.itemIds ?? [])
    const subjectItemSet =
      subjectItemIds === null ? null : new Set(subjectItemIds)

    return installedPack.documents.items.items.flatMap((item) => {
      if (subjectItemSet !== null && !subjectItemSet.has(item.itemId)) {
        return []
      }

      return [{ installedPack, item }]
    })
  })
}

interface MutablePracticeItemMetrics {
  itemId: ActivityId
  title: string
  packId: string
  packVersion: string
  conceptIds: ConceptId[]
  objectiveIds: ObjectiveId[]
  attempts: number
  successes: number
  selfGrades: Record<PracticeSelfGrade, number>
  lastPracticedAt: string | null
  recentUnsuccessful: boolean
  modeAvailability: readonly PracticeModeAvailability[]
  deterministicAttempts: number
}

function freezePracticeItemMetric(
  metric: MutablePracticeItemMetrics,
): PracticeItemMetrics {
  return {
    itemId: metric.itemId,
    title: metric.title,
    packId: metric.packId,
    packVersion: metric.packVersion,
    conceptIds: metric.conceptIds,
    objectiveIds: metric.objectiveIds,
    attempts: metric.attempts,
    successes: metric.successes,
    successRate:
      metric.deterministicAttempts === 0
        ? null
        : metric.successes / metric.deterministicAttempts,
    selfGrades: metric.selfGrades,
    lastPracticedAt: metric.lastPracticedAt,
    recentUnsuccessful: metric.recentUnsuccessful,
    modeAvailability: metric.modeAvailability,
  }
}

function buildWeakConcepts(
  metrics: Record<string, PracticeItemMetrics>,
  installedPacks: readonly InstalledLearningPack[],
): readonly PracticeConceptWeakness[] {
  const conceptTitles = new Map<string, string>()

  for (const installedPack of installedPacks) {
    for (const concept of installedPack.documents.catalog.concepts) {
      conceptTitles.set(concept.conceptId, concept.title)
    }
  }

  const weak = new Map<string, PracticeConceptWeakness>()

  for (const metric of Object.values(metrics)) {
    if (!metric.recentUnsuccessful && !isWeakPracticeMetric(metric)) {
      continue
    }

    for (const conceptId of metric.conceptIds) {
      const previous = weak.get(conceptId)
      const lowSelfGrades = metric.selfGrades.again + metric.selfGrades.hard
      const unsuccessfulAttempts =
        metric.attempts - metric.successes + lowSelfGrades

      weak.set(conceptId, {
        conceptId,
        title: conceptTitles.get(conceptId) ?? conceptId,
        attempts: (previous?.attempts ?? 0) + metric.attempts,
        unsuccessfulAttempts:
          (previous?.unsuccessfulAttempts ?? 0) + unsuccessfulAttempts,
        weakItemIds: uniqueStrings([
          ...(previous?.weakItemIds ?? []),
          metric.itemId,
        ]).map(parseActivityId),
      })
    }
  }

  return [...weak.values()].sort((left, right) =>
    left.unsuccessfulAttempts === right.unsuccessfulAttempts
      ? left.conceptId.localeCompare(right.conceptId)
      : right.unsuccessfulAttempts - left.unsuccessfulAttempts,
  )
}

function isWeakPracticeMetric(metric: PracticeItemMetrics): boolean {
  if (metric.successRate !== null && metric.attempts >= 2) {
    return metric.successRate < 0.7
  }

  return metric.selfGrades.again + metric.selfGrades.hard > 0
}

function compareLastPracticedDescending(
  left: PracticeItemMetrics | undefined,
  right: PracticeItemMetrics | undefined,
): number {
  const leftTime = left?.lastPracticedAt ?? ''
  const rightTime = right?.lastPracticedAt ?? ''

  return leftTime === rightTime
    ? (left?.itemId ?? '').localeCompare(right?.itemId ?? '')
    : rightTime.localeCompare(leftTime)
}

function practiceSelfGradeFromConfidence(value: number): PracticeSelfGrade {
  if (value <= 1) {
    return 'again'
  }
  if (value <= 2) {
    return 'hard'
  }
  if (value >= 5) {
    return 'easy'
  }
  return 'good'
}

function maxIsoTimestamp(left: string | null, right: string): string {
  return left === null || right.localeCompare(left) > 0 ? right : left
}

function packItemIds(installedPack: InstalledLearningPack): readonly string[] {
  return uniqueStrings(
    installedPack.subjects.flatMap((subject) => subject.itemIds),
  )
}

function itemMap(
  installedPack: InstalledLearningPack,
): ReadonlyMap<string, DeepReadonly<LearningItem>> {
  return new Map(
    installedPack.documents.items.items.map((item) => [item.itemId, item]),
  )
}

function requireCourse(installedPack: InstalledLearningPack, courseId: string) {
  const course = installedPack.documents.courses.courses.find(
    (candidate) => candidate.courseId === courseId,
  )

  if (course === undefined) {
    throw new LearningApplicationError(
      'session-state-incompatible',
      'Practice course scope was not found in the installed pack.',
      { details: { packId: installedPack.packId, courseId } },
    )
  }

  return course
}

function findInstalledPackForSubject(
  installedPacks: readonly InstalledLearningPack[],
  scope: Extract<PracticeScope, { kind: 'subject' }>,
): InstalledLearningPack {
  if (scope.packId !== undefined) {
    return requireInstalledPack(installedPacks, scope.packId)
  }

  const installedPack = installedPacks.find((pack) =>
    pack.subjects.some((subject) => subject.subjectId === scope.subjectId),
  )

  if (installedPack === undefined) {
    throw new LearningApplicationError(
      'session-state-incompatible',
      'Practice subject scope was not found in installed packs.',
      { details: { scope } },
    )
  }

  return installedPack
}

function subjectOwnsItem(
  installedPacks: readonly InstalledLearningPack[],
  subjectId: string,
  itemId: string,
): boolean {
  return installedPacks.some((pack) =>
    pack.subjects.some(
      (subject) =>
        subject.subjectId === subjectId && subject.itemIds.includes(itemId),
    ),
  )
}

function itemsForConcept(
  installedPack: InstalledLearningPack,
  conceptId: string,
): readonly string[] {
  return packItemIds(installedPack).filter((itemId) =>
    itemMap(installedPack).get(itemId)?.conceptIds.includes(conceptId),
  )
}

function itemsForObjective(
  installedPack: InstalledLearningPack,
  objectiveId: string,
): readonly string[] {
  return packItemIds(installedPack).filter((itemId) =>
    itemMap(installedPack).get(itemId)?.objectiveIds.includes(objectiveId),
  )
}

function flattenCurriculumNodes(
  nodes: readonly DeepReadonly<CurriculumNode>[],
): DeepReadonly<CurriculumNode>[] {
  return nodes.flatMap((node) => [
    node,
    ...flattenCurriculumNodes(node.children),
  ])
}

function itemIdsFromNodes(
  pack: DeepReadonly<LearningPackDocuments>,
  nodes: readonly DeepReadonly<CurriculumNode>[],
  includeDescendants: boolean,
): readonly string[] {
  return uniqueStrings(
    nodes.flatMap((node) => itemIdsFromNode(pack, node, includeDescendants)),
  )
}

function itemIdsFromNode(
  pack: DeepReadonly<LearningPackDocuments>,
  node: DeepReadonly<CurriculumNode>,
  includeDescendants: boolean,
): readonly string[] {
  if (node.entries !== undefined) {
    return node.entries.flatMap((entry) =>
      itemIdsFromCurriculumEntry(pack, node, entry, includeDescendants),
    )
  }

  if (!includeDescendants) {
    return [...node.itemIds]
  }

  return flattenCurriculumNodes([node]).flatMap((candidate) => [
    ...candidate.itemIds,
  ])
}

function itemIdsFromCurriculumEntry(
  pack: DeepReadonly<LearningPackDocuments>,
  parentNode: DeepReadonly<CurriculumNode>,
  entry: DeepReadonly<CurriculumEntry>,
  includeDescendants: boolean,
): readonly string[] {
  switch (entry.kind) {
    case 'resource':
      return []
    case 'item':
      return [entry.itemId]
    case 'study-set':
      return itemIdsFromStudySetEntry(pack, entry.studySetId)
    case 'child-node': {
      if (!includeDescendants) {
        return []
      }

      const child = findCurriculumNodeById(parentNode.children, entry.nodeId)

      return child === null ? [] : itemIdsFromNode(pack, child, true)
    }
  }
}

function itemIdsFromStudySetEntry(
  pack: DeepReadonly<LearningPackDocuments>,
  studySetId: string,
): readonly string[] {
  const studySet = pack.sets.sets.find(
    (candidate) => candidate.setId === studySetId,
  )

  if (studySet === undefined) {
    return []
  }

  return resolveStudySetItemIds(
    cloneDeep(pack) as LearningPackDocuments,
    cloneDeep(studySet) as StudySet,
  )
}

function findCurriculumNodeById(
  nodes: readonly DeepReadonly<CurriculumNode>[],
  nodeId: string,
): DeepReadonly<CurriculumNode> | null {
  for (const node of nodes) {
    if (node.nodeId === nodeId) {
      return node
    }

    const child = findCurriculumNodeById(node.children, nodeId)

    if (child !== null) {
      return child
    }
  }

  return null
}

function stableShuffle<T>(
  values: readonly T[],
  seed: string,
  key: (value: T) => string,
): T[] {
  return [...values].sort((left, right) => {
    const leftHash = stableHash(`${seed}:${key(left)}`)
    const rightHash = stableHash(`${seed}:${key(right)}`)

    return leftHash === rightHash
      ? key(left).localeCompare(key(right))
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

function mapPackContentBlock(
  block: DeepReadonly<PackContentBlock>,
): ContentBlock[] {
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
): Extract<ContentBlock, { kind: 'callout' }>['purpose'] {
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

function practiceModeLabel(mode: PracticeMode): string {
  switch (mode) {
    case 'flashcard':
      return 'Flashcards'
    case 'quiz':
      return 'Quiz'
    case 'recall':
      return 'Recall'
    case 'mixed':
      return 'Mixed'
  }
}

function practiceStrategyLabel(strategy: PracticeSelectionStrategy): string {
  switch (strategy) {
    case 'authored-order':
      return 'Authored order'
    case 'random':
      return 'Random'
    case 'weakest-first':
      return 'Weakest first'
    case 'recent-mistakes':
      return 'Recent mistakes'
    case 'least-seen':
      return 'Least seen'
    case 'balanced-by-concept':
      return 'Balanced by concept'
    case 'due-or-weak':
      return 'Due or weak'
  }
}

function parseActivityId(value: string): ActivityId {
  return ActivityIdSchema.parse(value)
}

function parseConceptId(value: string) {
  return ConceptIdSchema.parse(value)
}

function parseObjectiveId(value: string) {
  return ObjectiveIdSchema.parse(value)
}

function parseModuleId(value: string) {
  return ModuleIdSchema.parse(value)
}

function sanitizeStableId(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'practice'
  )
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values)]
}

function uniqueById<T>(values: readonly T[], getId: (value: T) => string): T[] {
  const seen = new Set<string>()
  const unique: T[] = []

  for (const value of values) {
    const id = getId(value)
    if (seen.has(id)) {
      continue
    }
    seen.add(id)
    unique.push(value)
  }

  return unique
}
