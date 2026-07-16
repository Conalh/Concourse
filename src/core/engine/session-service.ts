import type {
  ActivityDefinition,
  ActivityProgress,
  EvidenceEvent,
  EvidenceId,
  InteractionMode,
  LearningSession,
  ModuleDefinition,
  SessionId,
  SubjectPackage,
} from '../contracts'
import {
  EvidenceEventSchema,
  EvidenceIdSchema,
  InteractionModeSchema,
  LearningSessionSchema,
  SessionIdSchema,
} from '../contracts'
import { cloneDeep, deepFreeze, type DeepReadonly } from '../foundation'
import type { Clock } from '../ports'
import { findActivity, findModuleByCurrentId } from './activity-sequencer'
import { LearningEngineError } from './learning-engine-error'

type ReadonlySubject = DeepReadonly<SubjectPackage>
type ReadonlyActivity = DeepReadonly<ActivityDefinition>
type ReadonlyModule = DeepReadonly<ModuleDefinition>

export interface CurrentActivityContext {
  readonly session: LearningSession
  readonly activity: ReadonlyActivity
  readonly module: ReadonlyModule
  readonly progress: ActivityProgress
}

export function readClockTimestamp(clock: Clock, startedAt?: string): string {
  const value = clock.now()

  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new LearningEngineError(
      'invalid-clock-value',
      'Clock returned an invalid Date.',
      { path: ['lastActiveAt'] },
    )
  }

  const timestamp = value.toISOString()

  if (
    startedAt !== undefined &&
    Date.parse(timestamp) < Date.parse(startedAt)
  ) {
    throw new LearningEngineError(
      'invalid-clock-value',
      'Clock returned a timestamp before the session start.',
      { path: ['lastActiveAt'] },
    )
  }

  return timestamp
}

export function validateGeneratedSessionId(value: string): SessionId {
  const parsed = SessionIdSchema.safeParse(value)

  if (!parsed.success) {
    throw new LearningEngineError(
      'invalid-generated-id',
      'Generated session ID did not match the session ID contract.',
      {
        path: ['id'],
        details: { idKind: 'session' },
        cause: parsed.error,
      },
    )
  }

  return parsed.data
}

export function validateGeneratedEvidenceId(value: string): EvidenceId {
  const parsed = EvidenceIdSchema.safeParse(value)

  if (!parsed.success) {
    throw new LearningEngineError(
      'invalid-generated-id',
      'Generated evidence ID did not match the evidence ID contract.',
      {
        path: ['id'],
        details: { idKind: 'evidence' },
        cause: parsed.error,
      },
    )
  }

  return parsed.data
}

export function assertEvidenceIdIsNew(
  session: LearningSession,
  evidenceId: EvidenceId,
): void {
  if (session.evidenceEventIds.includes(evidenceId)) {
    throw new LearningEngineError(
      'duplicate-generated-id',
      'Generated evidence ID already exists in the session.',
      {
        path: ['evidenceEventIds'],
        details: { evidenceId },
      },
    )
  }
}

export function validateEvidenceMetadata(
  confidence: number | undefined,
  hintsUsed: number,
): void {
  if (
    confidence !== undefined &&
    (!Number.isInteger(confidence) || confidence < 1 || confidence > 5)
  ) {
    throw new LearningEngineError(
      'invalid-evidence',
      'Evidence confidence metadata must be an integer from 1 to 5.',
      { path: ['confidence'] },
    )
  }

  if (!Number.isInteger(hintsUsed) || hintsUsed < 0) {
    throw new LearningEngineError(
      'invalid-evidence',
      'Hints used must be a nonnegative integer.',
      { path: ['hintsUsed'] },
    )
  }
}

export function validateInteractionMode(value: unknown): InteractionMode {
  const parsed = InteractionModeSchema.safeParse(value)

  if (!parsed.success) {
    throw new LearningEngineError(
      'invalid-session-state',
      'Interaction mode did not match the session contract.',
      { path: ['interactionMode'], cause: parsed.error },
    )
  }

  return parsed.data
}

export function parseSession(
  session: DeepReadonly<LearningSession>,
): LearningSession {
  const parsed = LearningSessionSchema.safeParse(session)

  if (!parsed.success) {
    throw new LearningEngineError(
      'invalid-session-state',
      'Session did not match the learning session contract.',
      { cause: parsed.error },
    )
  }

  return cloneDeep(parsed.data)
}

export function requireActiveSession(
  session: DeepReadonly<LearningSession>,
): LearningSession {
  const parsedSession = parseSession(session)

  if (parsedSession.status !== 'active') {
    throw new LearningEngineError(
      'session-not-active',
      'Only active sessions can be changed by this operation.',
      { path: ['status'], details: { status: parsedSession.status } },
    )
  }

  return parsedSession
}

export function requireActiveCurrentActivity(
  subject: ReadonlySubject,
  session: DeepReadonly<LearningSession>,
): CurrentActivityContext {
  const parsedSession = requireActiveSession(session)

  if (parsedSession.subjectId !== subject.id) {
    throw new LearningEngineError(
      'session-subject-mismatch',
      'Session subject does not match the trusted subject.',
      {
        path: ['subjectId'],
        details: {
          sessionSubjectId: parsedSession.subjectId,
          subjectId: subject.id,
        },
      },
    )
  }

  assertProgressReferencesKnownActivities(subject, parsedSession)

  const currentActivityId = parsedSession.currentActivityId
  const currentModuleId = parsedSession.currentModuleId

  if (currentActivityId === null || currentModuleId === null) {
    throw new LearningEngineError(
      'invalid-session-state',
      'Active sessions must have a current module and activity.',
      { path: ['currentActivityId'] },
    )
  }

  const activity = findActivity(subject, currentActivityId)

  if (activity === undefined) {
    throw new LearningEngineError(
      'activity-not-found',
      'Current activity was not found in the trusted subject.',
      {
        path: ['currentActivityId'],
        details: { activityId: currentActivityId },
      },
    )
  }

  const module = findModuleByCurrentId(subject, currentModuleId)

  if (
    module?.activityIds.includes(activity.id) !== true ||
    activity.moduleId !== module.id
  ) {
    throw new LearningEngineError(
      'module-activity-mismatch',
      'Current activity does not belong to the current module.',
      {
        path: ['currentModuleId'],
        details: {
          moduleId: currentModuleId,
          activityId: currentActivityId,
        },
      },
    )
  }

  const progress = parsedSession.activityProgress.find(
    (entry) => entry.activityId === currentActivityId,
  )

  if (progress === undefined) {
    throw new LearningEngineError(
      'invalid-session-state',
      'Current activity is missing from activity progress.',
      {
        path: ['activityProgress'],
        details: { activityId: currentActivityId },
      },
    )
  }

  return {
    session: parsedSession,
    activity,
    module,
    progress,
  }
}

export function defineSession(
  session: LearningSession,
): DeepReadonly<LearningSession> {
  const parsed = LearningSessionSchema.safeParse(session)

  if (!parsed.success) {
    throw new LearningEngineError(
      'invalid-session-state',
      'Engine produced an invalid learning session.',
      { cause: parsed.error },
    )
  }

  return deepFreeze(cloneDeep(parsed.data))
}

export function defineEvidenceEvent(
  event: EvidenceEvent,
): DeepReadonly<EvidenceEvent> {
  const parsed = EvidenceEventSchema.safeParse(event)

  if (!parsed.success) {
    throw new LearningEngineError(
      'invalid-evidence',
      'Engine produced an invalid evidence event.',
      { cause: parsed.error },
    )
  }

  return deepFreeze(cloneDeep(parsed.data))
}

export function freezeEngineOutput<T>(value: T): DeepReadonly<T> {
  return deepFreeze(cloneDeep(value))
}

function assertProgressReferencesKnownActivities(
  subject: ReadonlySubject,
  session: LearningSession,
): void {
  const activityIds = new Set<string>(
    subject.activities.map((activity) => activity.id),
  )
  const unknownProgress = session.activityProgress.find(
    (progress) => !activityIds.has(progress.activityId),
  )

  if (unknownProgress !== undefined) {
    throw new LearningEngineError(
      'invalid-session-state',
      'Activity progress referenced an unknown activity.',
      {
        path: ['activityProgress'],
        details: { activityId: unknownProgress.activityId },
      },
    )
  }
}
