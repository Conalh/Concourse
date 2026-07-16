import type { ActivityId, LearnerProfile, SubjectId } from '../core/contracts'
import type { LearningSubject } from '../core/engine'
import { cloneDeep, deepFreeze, type DeepReadonly } from '../core/foundation'
import { resolvePresentationPolicy } from '../core/presentation'
import type { LearningSessionRecord } from '../core/ports'
import type { SubjectRegistry } from '../subject-sdk'
import { LearningApplicationError } from './learning-application-error'
import type {
  ActivityNavigationOption,
  LearnerSummary,
  LearningSessionContext,
  ProgressSummary,
  SessionAvailability,
  SessionLibraryEntry,
  SessionLibrarySnapshot,
  SubjectSummary,
} from './learnt-application.types'
import { buildParkedPathReferences } from './session-concept-exploration'

export function buildLearnerSummary(
  profile: DeepReadonly<LearnerProfile>,
): LearnerSummary {
  return deepFreeze(
    cloneDeep({
      learnerId: profile.learnerId,
      profileId: profile.id,
      displayName: profile.displayName,
    }),
  )
}

export function buildSubjectSummary(subject: LearningSubject): SubjectSummary {
  return deepFreeze(
    cloneDeep({
      id: subject.id,
      version: subject.version,
      title: subject.title,
      summary: subject.summary,
      tags: subject.tags,
      moduleCount: subject.modules.length,
      conceptCount: subject.concepts.length,
      objectiveCount: subject.objectives.length,
      activityCount: subject.activities.length,
    }),
  )
}

export function buildSessionLibrarySnapshot(
  records: readonly LearningSessionRecord[],
  repositoryIssues: SessionLibrarySnapshot['repositoryIssues'],
  dependencies: Readonly<{
    profile: DeepReadonly<LearnerProfile>
    subjectRegistry: SubjectRegistry
  }>,
): SessionLibrarySnapshot {
  return deepFreeze(
    cloneDeep({
      sessions: records.map((record) =>
        buildSessionLibraryEntry(record, dependencies),
      ),
      repositoryIssues,
    }),
  )
}

export function buildSessionContext(
  record: LearningSessionRecord,
  dependencies: Readonly<{
    profile: DeepReadonly<LearnerProfile>
    subjectRegistry: SubjectRegistry
    subject?: LearningSubject
  }>,
): LearningSessionContext {
  assertLearnerCompatible(record, dependencies.profile)
  const subject =
    dependencies.subject ??
    resolveReadySubject(record, dependencies.subjectRegistry)
  const orderedModules = [...subject.modules].sort(
    (left, right) => left.order - right.order,
  )
  const currentActivity = resolveCurrentActivity(record, subject)
  const currentModule =
    currentActivity === null
      ? null
      : (subject.modules.find(
          (module) => module.id === currentActivity.moduleId,
        ) ?? null)
  const currentActivityProgress =
    currentActivity === null
      ? null
      : (record.session.activityProgress.find(
          (progress) => progress.activityId === currentActivity.id,
        ) ?? null)
  const currentActivityEvidence =
    currentActivity === null
      ? []
      : record.evidenceEvents.filter(
          (event) => event.activityId === currentActivity.id,
        )
  const latestCurrentActivityEvaluation =
    currentActivityEvidence[currentActivityEvidence.length - 1]?.evaluation ??
    null

  return deepFreeze(
    cloneDeep({
      record,
      learner: buildLearnerSummary(dependencies.profile),
      subject,
      orderedModules,
      currentModule,
      currentActivity,
      currentActivityProgress,
      presentationPolicy:
        currentActivity === null
          ? null
          : resolvePresentationPolicy({
              profile: dependencies.profile,
              interactionMode: record.session.interactionMode,
              activity: currentActivity,
            }),
      currentActivityEvidence,
      latestCurrentActivityEvaluation,
      nextActivities:
        currentActivity !== null &&
        currentActivityProgress?.status === 'completed'
          ? buildNextActivities(currentActivity.nextActivityIds, subject)
          : [],
      parkedPaths: buildParkedPathReferences(record, subject),
      progress: summarizeProgress(record),
    }),
  )
}

export function assertLearnerCompatible(
  record: LearningSessionRecord,
  profile: DeepReadonly<LearnerProfile>,
): void {
  if (
    record.session.learnerId !== profile.learnerId ||
    record.session.profileId !== profile.id
  ) {
    throw new LearningApplicationError(
      'learner-profile-mismatch',
      'Persisted session belongs to a different learner profile.',
      {
        details: {
          sessionId: record.session.id,
          persistedLearnerId: record.session.learnerId,
          persistedProfileId: record.session.profileId,
          configuredLearnerId: profile.learnerId,
          configuredProfileId: profile.id,
        },
      },
    )
  }
}

export function resolveReadySubject(
  record: LearningSessionRecord,
  subjectRegistry: SubjectRegistry,
): LearningSubject {
  const adapter = subjectRegistry.get(record.session.subjectId)

  if (adapter === undefined) {
    throw new LearningApplicationError(
      'subject-not-found',
      'Persisted session subject is not registered.',
      {
        details: {
          subjectId: record.session.subjectId,
          sessionId: record.session.id,
        },
      },
    )
  }

  if (record.subjectVersion !== adapter.subject.version) {
    throw new LearningApplicationError(
      'subject-version-mismatch',
      'Persisted session subject version does not match the registered subject.',
      {
        details: {
          sessionId: record.session.id,
          subjectId: record.session.subjectId,
          persistedVersion: record.subjectVersion,
          registeredVersion: adapter.subject.version,
        },
      },
    )
  }

  return adapter.subject
}

function buildSessionLibraryEntry(
  record: LearningSessionRecord,
  dependencies: Readonly<{
    profile: DeepReadonly<LearnerProfile>
    subjectRegistry: SubjectRegistry
  }>,
): SessionLibraryEntry {
  const adapter = dependencies.subjectRegistry.get(record.session.subjectId)
  const subject = adapter?.subject
  const currentModule =
    subject === undefined || record.session.currentModuleId === null
      ? null
      : (subject.modules.find(
          (module) => module.id === record.session.currentModuleId,
        ) ?? null)
  const currentActivity =
    subject === undefined || record.session.currentActivityId === null
      ? null
      : (subject.activities.find(
          (activity) => activity.id === record.session.currentActivityId,
        ) ?? null)

  return {
    sessionId: record.session.id,
    subjectId: record.session.subjectId,
    subjectTitle: subject?.title ?? null,
    persistedSubjectVersion: record.subjectVersion,
    registeredSubjectVersion: subject?.version ?? null,
    sessionStatus: record.session.status,
    interactionMode: record.session.interactionMode,
    availability: resolveAvailability(record, dependencies),
    currentModuleId: record.session.currentModuleId,
    currentModuleTitle: currentModule?.title ?? null,
    currentActivityId: record.session.currentActivityId,
    currentActivityTitle: currentActivity?.title ?? null,
    revision: record.revision,
    evidenceCount: record.evidenceEvents.length,
    startedAt: record.session.startedAt,
    lastActiveAt: record.session.lastActiveAt,
  }
}

function resolveAvailability(
  record: LearningSessionRecord,
  dependencies: Readonly<{
    profile: DeepReadonly<LearnerProfile>
    subjectRegistry: SubjectRegistry
  }>,
): SessionAvailability {
  if (
    record.session.learnerId !== dependencies.profile.learnerId ||
    record.session.profileId !== dependencies.profile.id
  ) {
    return 'learner-profile-mismatch'
  }

  const adapter = dependencies.subjectRegistry.get(record.session.subjectId)

  if (adapter === undefined) {
    return 'subject-not-registered'
  }

  if (adapter.subject.version !== record.subjectVersion) {
    return 'subject-version-mismatch'
  }

  return 'ready'
}

function resolveCurrentActivity(
  record: LearningSessionRecord,
  subject: LearningSubject,
): LearningSubject['activities'][number] | null {
  if (
    record.session.status !== 'active' ||
    record.session.currentActivityId === null
  ) {
    return null
  }

  return (
    subject.activities.find(
      (activity) => activity.id === record.session.currentActivityId,
    ) ?? null
  )
}

function buildNextActivities(
  activityIds: readonly ActivityId[],
  subject: LearningSubject,
): ActivityNavigationOption[] {
  return activityIds.flatMap((activityId) => {
    const activity = subject.activities.find(
      (candidate) => candidate.id === activityId,
    )

    if (activity === undefined) {
      return []
    }

    const module = subject.modules.find(
      (candidate) => candidate.id === activity.moduleId,
    )

    if (module === undefined) {
      return []
    }

    return [
      {
        activityId: activity.id,
        activityTitle: activity.title,
        moduleId: module.id,
        moduleTitle: module.title,
      },
    ]
  })
}

function summarizeProgress(record: LearningSessionRecord): ProgressSummary {
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

export function subjectNotFound(
  subjectId: SubjectId,
): LearningApplicationError {
  return new LearningApplicationError(
    'subject-not-found',
    'Subject is not registered.',
    {
      details: { subjectId },
    },
  )
}
