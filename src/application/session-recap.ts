import type {
  ActivityId,
  ActivityStatus,
  ConceptId,
  ModuleId,
  OptionId,
} from '../core/contracts'
import type { LearningSubject } from '../core/engine'
import { cloneDeep, deepFreeze } from '../core/foundation'
import type { LearningSessionRecord } from '../core/ports'
import { LearningApplicationError } from './learning-application-error'
import { buildParkedPathReferences } from './session-concept-exploration'
import type {
  ConceptEncounterRecap,
  RecapConceptReference,
  RecapEvaluation,
  RecapObjectiveReference,
  RecapResponse,
  SessionActivityRecap,
  SessionAttemptRecap,
  SessionCurrentThread,
  SessionModuleRecap,
  SessionRecap,
  SessionTimelineEntry,
} from './session-recap.types'

type RecapActivityDefinition = LearningSubject['activities'][number]
type RecapModuleDefinition = LearningSubject['modules'][number]
type RecapEvidenceEvent = LearningSessionRecord['evidenceEvents'][number]
type RecapResponseDefinition = RecapActivityDefinition['response']

export function buildSessionRecap(
  record: LearningSessionRecord,
  subject: LearningSubject,
): SessionRecap {
  const activities = new Map(
    subject.activities.map((activity) => [activity.id, activity]),
  )
  const modules = new Map(subject.modules.map((module) => [module.id, module]))
  const concepts = new Map(
    subject.concepts.map((concept) => [concept.id, concept]),
  )
  const objectives = new Map(
    subject.objectives.map((objective) => [objective.id, objective]),
  )
  const progress = new Map(
    record.session.activityProgress.map((entry) => [
      entry.activityId,
      entry.status,
    ]),
  )
  const eventsByActivity = groupEventsByActivity(record.evidenceEvents)
  const attemptNumbers = new Map<ActivityId, number>()

  const recap = {
    sessionId: record.session.id,
    revision: record.revision,
    subject: {
      id: subject.id,
      version: subject.version,
      title: subject.title,
      summary: subject.summary,
    },
    sessionStatus: record.session.status,
    interactionMode: record.session.interactionMode,
    startedAt: record.session.startedAt,
    lastActiveAt: record.session.lastActiveAt,
    progress: summarizeProgress(record),
    evidenceCount: record.evidenceEvents.length,
    totalHintsUsed: record.evidenceEvents.reduce(
      (total, event) => total + event.hintsUsed,
      0,
    ),
    currentThread: buildCurrentThread(record, activities, modules, progress),
    parkedPaths: buildParkedPathReferences(record, subject),
    modules: [...subject.modules]
      .sort((left, right) => left.order - right.order)
      .map((module): SessionModuleRecap => {
        return {
          moduleId: module.id,
          title: module.title,
          summary: module.summary,
          order: module.order,
          activities: module.activityIds.map((activityId) => {
            const activity = requireActivity(
              activities,
              activityId,
              record,
              subject,
            )
            const attempts = (eventsByActivity.get(activity.id) ?? []).map(
              (event, index) =>
                buildAttemptRecap(event, activity, index + 1, record, subject),
            )

            return {
              activityId: activity.id,
              moduleId: activity.moduleId,
              title: activity.title,
              kind: activity.kind,
              scaffoldLevel: activity.scaffoldLevel,
              status: progress.get(activity.id) ?? 'unseen',
              concepts: activity.conceptIds.map((conceptId) => {
                const concept = concepts.get(conceptId)

                if (concept === undefined) {
                  throw invalidRecapState(record, subject, {
                    missingConceptId: conceptId,
                    activityId: activity.id,
                  })
                }

                return {
                  conceptId: concept.id,
                  title: concept.title,
                  summary: concept.summary,
                } satisfies RecapConceptReference
              }),
              objectives: activity.objectiveIds.map((objectiveId) => {
                const objective = objectives.get(objectiveId)

                if (objective === undefined) {
                  throw invalidRecapState(record, subject, {
                    missingObjectiveId: objectiveId,
                    activityId: activity.id,
                  })
                }

                return {
                  objectiveId: objective.id,
                  statement: objective.statement,
                } satisfies RecapObjectiveReference
              }),
              attemptCount: attempts.length,
              totalHintsUsed: attempts.reduce(
                (total, attempt) => total + attempt.hintsUsed,
                0,
              ),
              firstAttemptAt: attempts[0]?.timestamp ?? null,
              latestAttemptAt: attempts[attempts.length - 1]?.timestamp ?? null,
              latestEvaluation:
                attempts[attempts.length - 1]?.evaluation ?? null,
              attempts,
            } satisfies SessionActivityRecap
          }),
        }
      }),
    timeline: record.evidenceEvents.map((event): SessionTimelineEntry => {
      const attemptNumber = (attemptNumbers.get(event.activityId) ?? 0) + 1
      attemptNumbers.set(event.activityId, attemptNumber)
      const activity = requireActivity(
        activities,
        event.activityId,
        record,
        subject,
      )
      const module = requireModule(modules, activity.moduleId, record, subject)

      return {
        evidenceId: event.id,
        timestamp: event.timestamp,
        moduleId: module.id,
        moduleTitle: module.title,
        activityId: activity.id,
        activityTitle: activity.title,
        activityKind: activity.kind,
        attemptNumber,
        evaluationStatus: event.evaluation.status,
      }
    }),
    conceptEncounters: buildConceptEncounters(record, subject, activities),
  } satisfies SessionRecap

  return deepFreeze(cloneDeep(recap))
}

function buildCurrentThread(
  record: LearningSessionRecord,
  activities: ReadonlyMap<ActivityId, RecapActivityDefinition>,
  modules: ReadonlyMap<ModuleId, RecapModuleDefinition>,
  progress: ReadonlyMap<ActivityId, ActivityStatus>,
): SessionCurrentThread | null {
  if (
    record.session.status !== 'active' ||
    record.session.currentActivityId === null
  ) {
    return null
  }

  const activity = requireActivity(
    activities,
    record.session.currentActivityId,
    record,
    {
      id: record.session.subjectId,
      version: record.subjectVersion,
    },
  )
  const module = requireModule(modules, activity.moduleId, record, {
    id: record.session.subjectId,
    version: record.subjectVersion,
  })
  const activityStatus = progress.get(activity.id) ?? 'unseen'

  return {
    moduleId: module.id,
    moduleTitle: module.title,
    activityId: activity.id,
    activityTitle: activity.title,
    activityKind: activity.kind,
    activityStatus,
    action: currentThreadAction(activityStatus),
  }
}

function currentThreadAction(
  status: ActivityStatus,
): SessionCurrentThread['action'] {
  switch (status) {
    case 'attempted':
      return 'resume-attempt'
    case 'completed':
      return 'continue-after-completion'
    case 'active':
    case 'unseen':
      return 'begin-current-activity'
  }
}

function groupEventsByActivity(
  events: readonly RecapEvidenceEvent[],
): Map<ActivityId, RecapEvidenceEvent[]> {
  const grouped = new Map<ActivityId, RecapEvidenceEvent[]>()

  for (const event of events) {
    grouped.set(event.activityId, [
      ...(grouped.get(event.activityId) ?? []),
      event,
    ])
  }

  return grouped
}

function buildAttemptRecap(
  event: RecapEvidenceEvent,
  activity: RecapActivityDefinition,
  attemptNumber: number,
  record: LearningSessionRecord,
  subject: Pick<LearningSubject, 'id' | 'version'>,
): SessionAttemptRecap {
  return {
    evidenceId: event.id,
    attemptNumber,
    timestamp: event.timestamp,
    response: buildRecapResponse(event.response, activity, record, subject),
    confidence: event.confidence ?? null,
    hintsUsed: event.hintsUsed,
    evaluation: buildRecapEvaluation(event),
  }
}

function buildRecapEvaluation(event: RecapEvidenceEvent): RecapEvaluation {
  return {
    status: event.evaluation.status,
    score: event.evaluation.score ?? null,
    feedback: event.evaluation.feedback ?? null,
  }
}

function buildRecapResponse(
  response: RecapEvidenceEvent['response'],
  activity: RecapActivityDefinition,
  record: LearningSessionRecord,
  subject: Pick<LearningSubject, 'id' | 'version'>,
): RecapResponse {
  switch (response.kind) {
    case 'text':
      return { kind: 'text', value: response.value }
    case 'number':
      return { kind: 'number', value: response.value }
    case 'single-choice':
      return {
        kind: 'single-choice',
        optionId: response.optionId,
        optionLabel: resolveChoiceLabel(
          activity.response,
          response.optionId,
          record,
          subject,
          activity.id,
        ),
      }
    case 'multiple-choice':
      return {
        kind: 'multiple-choice',
        options: response.optionIds.map((optionId) => ({
          optionId,
          optionLabel: resolveChoiceLabel(
            activity.response,
            optionId,
            record,
            subject,
            activity.id,
          ),
        })),
      }
    case 'confidence':
      return { kind: 'confidence', value: response.value }
    case 'code':
      return {
        kind: 'code',
        language: response.language,
        source: response.source,
      }
    case 'manual':
      return { kind: 'manual', completed: true }
  }
}

function resolveChoiceLabel(
  response: RecapResponseDefinition,
  optionId: OptionId,
  record: LearningSessionRecord,
  subject: Pick<LearningSubject, 'id' | 'version'>,
  activityId: ActivityId,
): string {
  if (
    response?.kind !== 'single-choice' &&
    response?.kind !== 'multiple-choice'
  ) {
    throw invalidRecapState(record, subject, { activityId, optionId })
  }

  const option = response.options.find((candidate) => candidate.id === optionId)

  if (option === undefined) {
    throw invalidRecapState(record, subject, { activityId, optionId })
  }

  return option.label
}

function buildConceptEncounters(
  record: LearningSessionRecord,
  subject: LearningSubject,
  activities: ReadonlyMap<ActivityId, RecapActivityDefinition>,
): ConceptEncounterRecap[] {
  const encounters = new Map<
    ConceptId,
    {
      activityIds: ActivityId[]
      seenActivityIds: Set<ActivityId>
      evidenceCount: number
      firstEncounterAt: string
      latestEncounterAt: string
    }
  >()

  for (const event of record.evidenceEvents) {
    const activity = requireActivity(
      activities,
      event.activityId,
      record,
      subject,
    )

    for (const conceptId of activity.conceptIds) {
      const existing = encounters.get(conceptId)

      if (existing === undefined) {
        encounters.set(conceptId, {
          activityIds: [activity.id],
          seenActivityIds: new Set([activity.id]),
          evidenceCount: 1,
          firstEncounterAt: event.timestamp,
          latestEncounterAt: event.timestamp,
        })
        continue
      }

      if (!existing.seenActivityIds.has(activity.id)) {
        existing.activityIds.push(activity.id)
        existing.seenActivityIds.add(activity.id)
      }

      existing.evidenceCount += 1
      existing.latestEncounterAt = event.timestamp
    }
  }

  return subject.concepts.flatMap((concept) => {
    const encounter = encounters.get(concept.id)

    if (encounter === undefined) {
      return []
    }

    return [
      {
        conceptId: concept.id,
        title: concept.title,
        activityIds: encounter.activityIds,
        evidenceCount: encounter.evidenceCount,
        firstEncounterAt: encounter.firstEncounterAt,
        latestEncounterAt: encounter.latestEncounterAt,
      },
    ]
  })
}

function summarizeProgress(record: LearningSessionRecord) {
  const summary = {
    unseen: 0,
    active: 0,
    attempted: 0,
    completed: 0,
    total: record.session.activityProgress.length,
  }

  for (const progress of record.session.activityProgress) {
    summary[progress.status] += 1
  }

  return summary
}

function requireActivity(
  activities: ReadonlyMap<ActivityId, RecapActivityDefinition>,
  activityId: ActivityId,
  record: LearningSessionRecord,
  subject: Pick<LearningSubject, 'id' | 'version'>,
): RecapActivityDefinition {
  const activity = activities.get(activityId)

  if (activity === undefined) {
    throw invalidRecapState(record, subject, { activityId })
  }

  return activity
}

function requireModule(
  modules: ReadonlyMap<ModuleId, RecapModuleDefinition>,
  moduleId: ModuleId,
  record: LearningSessionRecord,
  subject: Pick<LearningSubject, 'id' | 'version'>,
): RecapModuleDefinition {
  const module = modules.get(moduleId)

  if (module === undefined) {
    throw invalidRecapState(record, subject, { moduleId })
  }

  return module
}

function invalidRecapState(
  record: LearningSessionRecord,
  subject: Pick<LearningSubject, 'id' | 'version'>,
  details: Readonly<Record<string, unknown>>,
): LearningApplicationError {
  return new LearningApplicationError(
    'subject-version-mismatch',
    'Saved session evidence cannot be reconstructed safely with the registered subject version.',
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
