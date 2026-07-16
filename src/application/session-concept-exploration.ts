import type {
  ActivityId,
  ActivityStatus,
  ConceptId,
  ModuleId,
} from '../core/contracts'
import type { LearningSubject } from '../core/engine'
import { cloneDeep, deepFreeze } from '../core/foundation'
import type { LearningSessionRecord } from '../core/ports'
import { LearningApplicationError } from './learning-application-error'
import type {
  ConceptExplorationReference,
  SessionConceptActivityReference,
  SessionConceptCurrentThread,
  SessionConceptExploration,
  SessionConceptObjective,
  SessionConceptReference,
  LearningResourceLinkReference,
} from './learnt-application.types'

type ConceptActivity = LearningSubject['activities'][number]
type ConceptReferenceSource = LearningSubject['concepts'][number]
type ConceptModule = LearningSubject['modules'][number]

export function buildSessionConceptExploration(
  record: LearningSessionRecord,
  subject: LearningSubject,
  conceptId: ConceptId,
  resources: readonly LearningResourceLinkReference[] = [],
): SessionConceptExploration {
  const concept = subject.concepts.find(
    (candidate) => candidate.id === conceptId,
  )

  if (concept === undefined) {
    throw new LearningApplicationError(
      'concept-not-found',
      'Concept was not found in the registered subject.',
      {
        details: {
          sessionId: record.session.id,
          subjectId: subject.id,
          conceptId,
        },
      },
    )
  }

  const activities = new Map(
    subject.activities.map((activity) => [activity.id, activity]),
  )
  const modules = new Map(subject.modules.map((module) => [module.id, module]))
  const progress = new Map(
    record.session.activityProgress.map((entry) => [
      entry.activityId,
      entry.status,
    ]),
  )
  const exploration = {
    sessionId: record.session.id,
    sessionStatus: record.session.status,
    interactionMode: record.session.interactionMode,
    subject: {
      id: subject.id,
      version: subject.version,
      title: subject.title,
    },
    concept: {
      conceptId: concept.id,
      title: concept.title,
      summary: concept.summary,
      tags: [...concept.tags],
    },
    prerequisiteConcepts: resolveConceptIds(
      concept.prerequisiteConceptIds,
      record,
      subject,
    ),
    dependentConcepts: subject.concepts
      .filter((candidate) =>
        candidate.prerequisiteConceptIds.includes(concept.id),
      )
      .map((candidate) => conceptReference(candidate)),
    relatedConcepts: resolveConceptIds(
      uniqueConceptIds(concept.relatedConceptIds),
      record,
      subject,
    ),
    objectives: subject.objectives
      .filter((objective) => objective.conceptIds.includes(concept.id))
      .map(
        (objective): SessionConceptObjective => ({
          objectiveId: objective.id,
          statement: objective.statement,
        }),
      ),
    resources: [...resources],
    activities: buildConceptActivities(record, subject, concept.id, {
      activities,
      modules,
      progress,
    }),
    currentThread: buildCurrentThread(record, {
      activities,
      modules,
      progress,
    }),
    parkedPaths: buildParkedPathReferences(record, subject),
    isParked: record.session.exploration.parkedConceptIds.includes(concept.id),
  } satisfies SessionConceptExploration

  return deepFreeze(cloneDeep(exploration))
}

export function buildParkedPathReferences(
  record: LearningSessionRecord,
  subject: LearningSubject,
): readonly ConceptExplorationReference[] {
  const references = record.session.exploration.parkedConceptIds.map(
    (conceptId) => {
      const concept = subject.concepts.find(
        (candidate) => candidate.id === conceptId,
      )

      if (concept === undefined) {
        throw invalidSessionState(record, subject, {
          parkedConceptId: conceptId,
        })
      }

      return conceptReference(concept)
    },
  )

  return deepFreeze(cloneDeep(references))
}

function resolveConceptIds(
  conceptIds: readonly ConceptId[],
  record: LearningSessionRecord,
  subject: LearningSubject,
): SessionConceptReference[] {
  return conceptIds.map((conceptId) => {
    const concept = subject.concepts.find(
      (candidate) => candidate.id === conceptId,
    )

    if (concept === undefined) {
      throw invalidSessionState(record, subject, { conceptId })
    }

    return conceptReference(concept)
  })
}

function conceptReference(
  concept: ConceptReferenceSource,
): ConceptExplorationReference {
  return {
    conceptId: concept.id,
    title: concept.title,
    summary: concept.summary,
  }
}

function buildConceptActivities(
  record: LearningSessionRecord,
  subject: LearningSubject,
  conceptId: ConceptId,
  indexes: Readonly<{
    activities: ReadonlyMap<ActivityId, ConceptActivity>
    modules: ReadonlyMap<ModuleId, ConceptModule>
    progress: ReadonlyMap<ActivityId, ActivityStatus>
  }>,
): SessionConceptActivityReference[] {
  return [...subject.modules]
    .sort((left, right) => left.order - right.order)
    .flatMap((module) =>
      module.activityIds.flatMap((activityId) => {
        const activity = indexes.activities.get(activityId)

        if (activity === undefined) {
          throw invalidSessionState(record, subject, { activityId })
        }

        if (!activity.conceptIds.includes(conceptId)) {
          return []
        }

        return [
          buildActivityReference(record, subject, activity, module, indexes),
        ]
      }),
    )
}

function buildActivityReference(
  record: LearningSessionRecord,
  subject: LearningSubject,
  activity: ConceptActivity,
  module: ConceptModule,
  indexes: Readonly<{
    progress: ReadonlyMap<ActivityId, ActivityStatus>
  }>,
): SessionConceptActivityReference {
  if (activity.moduleId !== module.id) {
    throw invalidSessionState(record, subject, {
      activityId: activity.id,
      moduleId: module.id,
    })
  }

  return {
    activityId: activity.id,
    activityTitle: activity.title,
    activityKind: activity.kind,
    moduleId: module.id,
    moduleTitle: module.title,
    status: indexes.progress.get(activity.id) ?? 'unseen',
    isCurrentThread: record.session.currentActivityId === activity.id,
  }
}

function buildCurrentThread(
  record: LearningSessionRecord,
  indexes: Readonly<{
    activities: ReadonlyMap<ActivityId, ConceptActivity>
    modules: ReadonlyMap<ModuleId, ConceptModule>
    progress: ReadonlyMap<ActivityId, ActivityStatus>
  }>,
): SessionConceptCurrentThread | null {
  if (
    record.session.status !== 'active' ||
    record.session.currentActivityId === null
  ) {
    return null
  }

  const activity = indexes.activities.get(record.session.currentActivityId)

  if (activity === undefined) {
    throw invalidSessionState(
      record,
      {
        id: record.session.subjectId,
        version: record.subjectVersion,
      },
      { activityId: record.session.currentActivityId },
    )
  }

  const module = indexes.modules.get(activity.moduleId)

  if (module === undefined) {
    throw invalidSessionState(
      record,
      {
        id: record.session.subjectId,
        version: record.subjectVersion,
      },
      { moduleId: activity.moduleId },
    )
  }

  const activityStatus = indexes.progress.get(activity.id) ?? 'unseen'

  return {
    activityId: activity.id,
    activityTitle: activity.title,
    activityKind: activity.kind,
    activityStatus,
    moduleId: module.id,
    moduleTitle: module.title,
    action:
      activityStatus === 'completed'
        ? 'continue-after-completion'
        : 'return-to-activity',
  }
}

function uniqueConceptIds(conceptIds: readonly ConceptId[]): ConceptId[] {
  const seen = new Set<ConceptId>()
  const unique: ConceptId[] = []

  for (const conceptId of conceptIds) {
    if (!seen.has(conceptId)) {
      seen.add(conceptId)
      unique.push(conceptId)
    }
  }

  return unique
}

function invalidSessionState(
  record: LearningSessionRecord,
  subject: Pick<LearningSubject, 'id' | 'version'>,
  details: Readonly<Record<string, unknown>>,
): LearningApplicationError {
  return new LearningApplicationError(
    'session-state-incompatible',
    'Saved session exploration cannot be reconstructed safely with the registered subject.',
    {
      details: {
        sessionId: record.session.id,
        subjectId: subject.id,
        registeredVersion: subject.version,
        persistedVersion: record.subjectVersion,
        ...details,
      },
    },
  )
}
