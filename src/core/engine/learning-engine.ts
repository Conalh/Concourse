import type {
  ActivityId,
  ActivityProgress,
  ConceptId,
  EvidenceEvent,
  EvaluationResult,
  InteractionMode,
  LearnerId,
  LearnerProfileId,
  LearningFlowSessionState,
  LearningSession,
  SubjectPackage,
} from '../contracts'
import type { DeepReadonly } from '../foundation'
import type { Clock, LearningIdGenerator } from '../ports'
import { getCanonicalActivityOrder, findActivity } from './activity-sequencer'
import {
  evaluateActivityEvidence,
  isActivityCompletedByPolicy,
} from './evaluation-service'
import { LearningEngineError } from './learning-engine-error'
import { parseAndValidateEvidencePayload } from './response-validation'
import {
  assertEvidenceIdIsNew,
  defineEvidenceEvent,
  defineSession,
  freezeEngineOutput,
  readClockTimestamp,
  requireActiveCurrentActivity,
  requireActiveSession,
  validateEvidenceMetadata,
  validateGeneratedEvidenceId,
  validateGeneratedSessionId,
  validateInteractionMode,
} from './session-service'

export type LearningSubject = DeepReadonly<SubjectPackage>
export type DefinedLearningSession = DeepReadonly<LearningSession>
export type DefinedEvidenceEvent = DeepReadonly<EvidenceEvent>

export type LearningEngineDependencies = Readonly<{
  clock: Clock
  idGenerator: LearningIdGenerator
}>

export type StartSessionInput = Readonly<{
  subject: LearningSubject
  learnerId: LearnerId
  profileId: LearnerProfileId
  interactionMode?: InteractionMode
  learningFlow?: LearningFlowSessionState
}>

export type SubmitEvidenceInput = Readonly<{
  subject: LearningSubject
  session: DefinedLearningSession
  activityId: ActivityId
  response: unknown
  confidence?: number
  hintsUsed?: number
}>

export type SubmissionResult = DeepReadonly<{
  session: LearningSession
  evidenceEvent: EvidenceEvent
  evaluation: EvaluationResult
  activityCompleted: boolean
}>

export type GetNextActivityIdsInput = Readonly<{
  subject: LearningSubject
  session: DefinedLearningSession
}>

export type AdvanceSessionInput = Readonly<{
  subject: LearningSubject
  session: DefinedLearningSession
  nextActivityId?: ActivityId
}>

export type ChangeInteractionModeInput = Readonly<{
  session: DefinedLearningSession
  interactionMode: InteractionMode
}>

export type AbandonSessionInput = Readonly<{
  session: DefinedLearningSession
}>

export type ParkConceptInput = Readonly<{
  subject: LearningSubject
  session: DefinedLearningSession
  conceptId: ConceptId
}>

export type UnparkConceptInput = Readonly<{
  subject: LearningSubject
  session: DefinedLearningSession
  conceptId: ConceptId
}>

export class LearningEngine {
  private readonly dependencies: LearningEngineDependencies

  constructor(dependencies: LearningEngineDependencies) {
    this.dependencies = dependencies
  }

  startSession(input: StartSessionInput): DefinedLearningSession {
    const sessionId = validateGeneratedSessionId(
      this.dependencies.idGenerator.createSessionId(),
    )
    const initialActivity = getCanonicalActivityOrder(input.subject)[0]

    if (initialActivity === undefined) {
      throw new LearningEngineError(
        'subject-has-no-activities',
        'Trusted subject does not contain any authored activities.',
        { details: { subjectId: input.subject.id } },
      )
    }

    const timestamp = readClockTimestamp(this.dependencies.clock)
    const interactionMode = validateInteractionMode(
      input.interactionMode ?? 'coach',
    )
    const session: LearningSession = {
      schemaVersion: '0.1',
      id: sessionId,
      learnerId: input.learnerId,
      profileId: input.profileId,
      subjectId: input.subject.id,
      status: 'active',
      interactionMode,
      currentModuleId: initialActivity.moduleId,
      currentActivityId: initialActivity.id,
      startedAt: timestamp,
      lastActiveAt: timestamp,
      activityProgress: getCanonicalActivityOrder(input.subject).map(
        (activity): ActivityProgress => ({
          activityId: activity.id,
          status: activity.id === initialActivity.id ? 'active' : 'unseen',
        }),
      ),
      evidenceEventIds: [],
      exploration: {
        parkedConceptIds: [],
        ...(input.learningFlow === undefined
          ? {}
          : { learningFlow: input.learningFlow }),
      },
    }

    return defineSession(session)
  }

  submitEvidence(input: SubmitEvidenceInput): SubmissionResult {
    const context = requireActiveCurrentActivity(input.subject, input.session)

    if (input.activityId !== context.activity.id) {
      throw new LearningEngineError(
        'activity-not-current',
        'Submitted activity ID must match the session current activity.',
        {
          path: ['activityId'],
          details: {
            activityId: input.activityId,
            currentActivityId: context.activity.id,
          },
        },
      )
    }

    if (context.progress.status === 'completed') {
      throw new LearningEngineError(
        'activity-already-completed',
        'Completed activities do not accept more submissions.',
        {
          path: ['activityProgress'],
          details: { activityId: context.activity.id },
        },
      )
    }

    if (
      context.progress.status !== 'active' &&
      context.progress.status !== 'attempted'
    ) {
      throw new LearningEngineError(
        'invalid-session-state',
        'Current activity progress must be active or attempted for submission.',
        {
          path: ['activityProgress'],
          details: {
            activityId: context.activity.id,
            status: context.progress.status,
          },
        },
      )
    }

    const response = parseAndValidateEvidencePayload(
      context.activity,
      input.response,
    )
    const hintsUsed = input.hintsUsed ?? 0
    validateEvidenceMetadata(input.confidence, hintsUsed)

    const evaluation = evaluateActivityEvidence(context.activity, response)
    const activityCompleted = isActivityCompletedByPolicy(
      context.activity,
      response,
      evaluation,
    )
    const evidenceId = validateGeneratedEvidenceId(
      this.dependencies.idGenerator.createEvidenceId(),
    )
    assertEvidenceIdIsNew(context.session, evidenceId)

    const timestamp = readClockTimestamp(
      this.dependencies.clock,
      context.session.startedAt,
    )
    const evidenceEvent = defineEvidenceEvent({
      schemaVersion: '0.1',
      id: evidenceId,
      timestamp,
      learnerId: context.session.learnerId,
      profileId: context.session.profileId,
      sessionId: context.session.id,
      subjectId: context.session.subjectId,
      moduleId: context.module.id,
      activityId: context.activity.id,
      objectiveIds: [...context.activity.objectiveIds],
      activityKind: context.activity.kind,
      response,
      ...(input.confidence === undefined
        ? {}
        : { confidence: input.confidence }),
      hintsUsed,
      evaluation,
    })
    const session = defineSession({
      ...context.session,
      lastActiveAt: timestamp,
      activityProgress: updateActivityProgress(
        context.session.activityProgress,
        context.activity.id,
        activityCompleted ? 'completed' : 'attempted',
      ),
      evidenceEventIds: [...context.session.evidenceEventIds, evidenceEvent.id],
    })

    return freezeEngineOutput({
      session,
      evidenceEvent,
      evaluation: evidenceEvent.evaluation,
      activityCompleted,
    })
  }

  getNextActivityIds(input: GetNextActivityIdsInput): readonly ActivityId[] {
    const context = requireActiveCurrentActivity(input.subject, input.session)

    if (context.progress.status !== 'completed') {
      throw new LearningEngineError(
        'activity-not-completed',
        'Current activity must be completed before next activities are available.',
        {
          path: ['activityProgress'],
          details: { activityId: context.activity.id },
        },
      )
    }

    return freezeEngineOutput([...context.activity.nextActivityIds])
  }

  advanceSession(input: AdvanceSessionInput): DefinedLearningSession {
    const context = requireActiveCurrentActivity(input.subject, input.session)

    if (context.progress.status !== 'completed') {
      throw new LearningEngineError(
        'activity-not-completed',
        'Current activity must be completed before advancement.',
        {
          path: ['activityProgress'],
          details: { activityId: context.activity.id },
        },
      )
    }

    const candidates = [...context.activity.nextActivityIds]

    if (candidates.length === 0) {
      const timestamp = readClockTimestamp(
        this.dependencies.clock,
        context.session.startedAt,
      )

      return defineSession({
        ...context.session,
        status: 'completed',
        currentModuleId: null,
        currentActivityId: null,
        lastActiveAt: timestamp,
      })
    }

    const selectedActivityId = selectNextActivity(
      candidates,
      input.nextActivityId,
    )
    const selectedActivity = findActivity(input.subject, selectedActivityId)

    if (selectedActivity === undefined) {
      throw new LearningEngineError(
        'invalid-next-activity',
        'Selected next activity does not exist in the trusted subject.',
        {
          path: ['nextActivityId'],
          details: {
            nextActivityId: selectedActivityId,
            candidateActivityIds: candidates,
          },
        },
      )
    }

    const selectedModule = input.subject.modules.find(
      (module) => module.id === selectedActivity.moduleId,
    )

    if (selectedModule?.activityIds.includes(selectedActivity.id) !== true) {
      throw new LearningEngineError(
        'module-activity-mismatch',
        'Selected next activity does not belong to its authored module.',
        {
          path: ['nextActivityId'],
          details: { nextActivityId: selectedActivityId },
        },
      )
    }

    const selectedProgress = context.session.activityProgress.find(
      (progress) => progress.activityId === selectedActivityId,
    )

    if (selectedProgress === undefined) {
      throw new LearningEngineError(
        'invalid-session-state',
        'Selected next activity is missing from activity progress.',
        {
          path: ['activityProgress'],
          details: { nextActivityId: selectedActivityId },
        },
      )
    }

    if (selectedProgress.status !== 'unseen') {
      throw new LearningEngineError(
        'next-activity-not-available',
        'Selected next activity must be unseen before activation.',
        {
          path: ['activityProgress'],
          details: {
            nextActivityId: selectedActivityId,
            status: selectedProgress.status,
          },
        },
      )
    }

    const timestamp = readClockTimestamp(
      this.dependencies.clock,
      context.session.startedAt,
    )

    return defineSession({
      ...context.session,
      currentModuleId: selectedActivity.moduleId,
      currentActivityId: selectedActivity.id,
      lastActiveAt: timestamp,
      activityProgress: updateActivityProgress(
        context.session.activityProgress,
        selectedActivity.id,
        'active',
      ),
    })
  }

  changeInteractionMode(
    input: ChangeInteractionModeInput,
  ): DefinedLearningSession {
    const session = requireActiveSession(input.session)
    const interactionMode = validateInteractionMode(input.interactionMode)
    const timestamp = readClockTimestamp(
      this.dependencies.clock,
      session.startedAt,
    )

    return defineSession({
      ...session,
      interactionMode,
      lastActiveAt: timestamp,
    })
  }

  abandonSession(input: AbandonSessionInput): DefinedLearningSession {
    const session = requireActiveSession(input.session)
    const timestamp = readClockTimestamp(
      this.dependencies.clock,
      session.startedAt,
    )

    return defineSession({
      ...session,
      status: 'abandoned',
      currentModuleId: null,
      currentActivityId: null,
      lastActiveAt: timestamp,
      activityProgress: session.activityProgress.map((progress) => ({
        ...progress,
        status: progress.status === 'active' ? 'unseen' : progress.status,
      })),
    })
  }

  parkConcept(input: ParkConceptInput): DefinedLearningSession {
    const session = requireActiveSession(input.session)
    assertSessionSubjectMatches(input.subject, session)
    assertConceptExists(input.subject, input.conceptId)

    if (session.exploration.parkedConceptIds.includes(input.conceptId)) {
      throw new LearningEngineError(
        'concept-already-parked',
        'Concept is already parked in this session.',
        {
          path: ['exploration', 'parkedConceptIds'],
          details: { conceptId: input.conceptId },
        },
      )
    }

    const timestamp = readClockTimestamp(
      this.dependencies.clock,
      session.startedAt,
    )

    return defineSession({
      ...session,
      lastActiveAt: timestamp,
      exploration: {
        parkedConceptIds: [
          ...session.exploration.parkedConceptIds,
          input.conceptId,
        ],
      },
    })
  }

  unparkConcept(input: UnparkConceptInput): DefinedLearningSession {
    const session = requireActiveSession(input.session)
    assertSessionSubjectMatches(input.subject, session)
    assertConceptExists(input.subject, input.conceptId)

    if (!session.exploration.parkedConceptIds.includes(input.conceptId)) {
      throw new LearningEngineError(
        'concept-not-parked',
        'Concept is not parked in this session.',
        {
          path: ['exploration', 'parkedConceptIds'],
          details: { conceptId: input.conceptId },
        },
      )
    }

    const timestamp = readClockTimestamp(
      this.dependencies.clock,
      session.startedAt,
    )

    return defineSession({
      ...session,
      lastActiveAt: timestamp,
      exploration: {
        parkedConceptIds: session.exploration.parkedConceptIds.filter(
          (conceptId) => conceptId !== input.conceptId,
        ),
      },
    })
  }
}

function assertSessionSubjectMatches(
  subject: LearningSubject,
  session: LearningSession,
): void {
  if (session.subjectId !== subject.id) {
    throw new LearningEngineError(
      'session-subject-mismatch',
      'Session subject does not match the trusted subject.',
      {
        path: ['subjectId'],
        details: {
          sessionSubjectId: session.subjectId,
          subjectId: subject.id,
        },
      },
    )
  }
}

function assertConceptExists(
  subject: LearningSubject,
  conceptId: ConceptId,
): void {
  if (!subject.concepts.some((concept) => concept.id === conceptId)) {
    throw new LearningEngineError(
      'concept-not-found',
      'Concept was not found in the trusted subject.',
      {
        path: ['conceptId'],
        details: { conceptId },
      },
    )
  }
}

function selectNextActivity(
  candidates: readonly ActivityId[],
  requested: ActivityId | undefined,
): ActivityId {
  if (candidates.length === 1) {
    const onlyCandidate = candidates[0]

    if (onlyCandidate === undefined) {
      throw new LearningEngineError(
        'invalid-session-state',
        'Expected one next-activity candidate.',
      )
    }

    if (requested !== undefined && requested !== onlyCandidate) {
      throw new LearningEngineError(
        'invalid-next-activity',
        'Requested next activity is not an authored candidate.',
        {
          path: ['nextActivityId'],
          details: {
            nextActivityId: requested,
            candidateActivityIds: candidates,
          },
        },
      )
    }

    return onlyCandidate
  }

  if (requested === undefined) {
    throw new LearningEngineError(
      'next-activity-selection-required',
      'Multiple next activities require an explicit selection.',
      {
        path: ['nextActivityId'],
        details: { candidateActivityIds: candidates },
      },
    )
  }

  if (!candidates.includes(requested)) {
    throw new LearningEngineError(
      'invalid-next-activity',
      'Requested next activity is not an authored candidate.',
      {
        path: ['nextActivityId'],
        details: {
          nextActivityId: requested,
          candidateActivityIds: candidates,
        },
      },
    )
  }

  return requested
}

function updateActivityProgress(
  progress: readonly ActivityProgress[],
  activityId: ActivityId,
  status: ActivityProgress['status'],
): ActivityProgress[] {
  return progress.map((entry) =>
    entry.activityId === activityId ? { ...entry, status } : { ...entry },
  )
}
