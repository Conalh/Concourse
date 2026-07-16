import type {
  ActivityId,
  ConceptId,
  EvidenceEvent,
  EvaluationResult,
  InteractionMode,
  LearnerId,
  LearnerProfileId,
  LearningFlowSessionState,
  SessionId,
} from '../core/contracts'
import type {
  DefinedLearningSession,
  LearningEngine,
  LearningSubject,
} from '../core/engine'
import type { DeepReadonly } from '../core/foundation'
import { cloneDeep, deepFreeze } from '../core/foundation'
import type {
  LearningRepository,
  LearningRepositoryScanResult,
  LearningSessionRecord,
} from '../core/ports'
import { LearningApplicationError } from './learning-application-error'

export type PersistentLearningServiceDependencies = Readonly<{
  engine: LearningEngine
  repository: LearningRepository
}>

export type StartPersistentSessionInput = Readonly<{
  subject: LearningSubject
  learnerId: LearnerId
  profileId: LearnerProfileId
  interactionMode?: InteractionMode
  learningFlow?: LearningFlowSessionState
}>

export type SubmitPersistentEvidenceInput = Readonly<{
  subject: LearningSubject
  sessionId: SessionId
  activityId: ActivityId
  response: unknown
  confidence?: number
  hintsUsed?: number
}>

export type PersistedSubmissionResult = DeepReadonly<{
  record: LearningSessionRecord
  evidenceEvent: EvidenceEvent
  evaluation: EvaluationResult
  activityCompleted: boolean
}>

export type AdvancePersistentSessionInput = Readonly<{
  subject: LearningSubject
  sessionId: SessionId
  nextActivityId?: ActivityId
}>

export type ChangePersistentModeInput = Readonly<{
  sessionId: SessionId
  interactionMode: InteractionMode
}>

export type AbandonPersistentSessionInput = Readonly<{
  sessionId: SessionId
}>

export type ParkPersistentConceptInput = Readonly<{
  subject: LearningSubject
  sessionId: SessionId
  conceptId: ConceptId
}>

export type UnparkPersistentConceptInput = Readonly<{
  subject: LearningSubject
  sessionId: SessionId
  conceptId: ConceptId
}>

export class PersistentLearningService {
  private readonly engine: LearningEngine
  private readonly repository: LearningRepository

  constructor(dependencies: PersistentLearningServiceDependencies) {
    this.engine = dependencies.engine
    this.repository = dependencies.repository
  }

  async startSession(
    input: StartPersistentSessionInput,
  ): Promise<LearningSessionRecord> {
    const session = this.engine.startSession({
      subject: input.subject,
      learnerId: input.learnerId,
      profileId: input.profileId,
      ...(input.interactionMode === undefined
        ? {}
        : { interactionMode: input.interactionMode }),
      ...(input.learningFlow === undefined
        ? {}
        : { learningFlow: input.learningFlow }),
    })

    return this.repository.createSession({
      subjectVersion: input.subject.version,
      session,
    })
  }

  async getSession(
    sessionId: SessionId,
  ): Promise<LearningSessionRecord | null> {
    return this.repository.getSession(sessionId)
  }

  async listSessions(): Promise<LearningRepositoryScanResult> {
    return this.repository.listSessions()
  }

  async submitEvidence(
    input: SubmitPersistentEvidenceInput,
  ): Promise<PersistedSubmissionResult> {
    const record = await this.requireRecord(input.sessionId)
    this.assertSubjectCompatible(record, input.subject)

    const submission = this.engine.submitEvidence({
      subject: input.subject,
      session: record.session,
      activityId: input.activityId,
      response: input.response,
      ...(input.confidence === undefined
        ? {}
        : { confidence: input.confidence }),
      ...(input.hintsUsed === undefined ? {} : { hintsUsed: input.hintsUsed }),
    })
    const committedRecord = await this.repository.commitSubmission({
      expectedRevision: record.revision,
      session: submission.session,
      evidenceEvent: submission.evidenceEvent,
    })
    const committedEvent =
      committedRecord.evidenceEvents[committedRecord.evidenceEvents.length - 1]

    if (committedEvent === undefined) {
      throw new LearningApplicationError(
        'session-not-found',
        'Committed submission did not include an evidence event.',
      )
    }

    return deepFreeze(
      cloneDeep({
        record: committedRecord,
        evidenceEvent: committedEvent,
        evaluation: committedEvent.evaluation,
        activityCompleted: submission.activityCompleted,
      }),
    )
  }

  async advanceSession(
    input: AdvancePersistentSessionInput,
  ): Promise<LearningSessionRecord> {
    const record = await this.requireRecord(input.sessionId)
    this.assertSubjectCompatible(record, input.subject)

    const session = this.engine.advanceSession({
      subject: input.subject,
      session: record.session,
      ...(input.nextActivityId === undefined
        ? {}
        : { nextActivityId: input.nextActivityId }),
    })

    return this.saveTransition(record, session)
  }

  async changeInteractionMode(
    input: ChangePersistentModeInput,
  ): Promise<LearningSessionRecord> {
    const record = await this.requireRecord(input.sessionId)
    const session = this.engine.changeInteractionMode({
      session: record.session,
      interactionMode: input.interactionMode,
    })

    return this.saveTransition(record, session)
  }

  async abandonSession(
    input: AbandonPersistentSessionInput,
  ): Promise<LearningSessionRecord> {
    const record = await this.requireRecord(input.sessionId)
    const session = this.engine.abandonSession({ session: record.session })

    return this.saveTransition(record, session)
  }

  async parkConcept(
    input: ParkPersistentConceptInput,
  ): Promise<LearningSessionRecord> {
    const record = await this.requireRecord(input.sessionId)
    this.assertSubjectCompatible(record, input.subject)
    const session = this.engine.parkConcept({
      subject: input.subject,
      session: record.session,
      conceptId: input.conceptId,
    })

    return this.saveTransition(record, session)
  }

  async unparkConcept(
    input: UnparkPersistentConceptInput,
  ): Promise<LearningSessionRecord> {
    const record = await this.requireRecord(input.sessionId)
    this.assertSubjectCompatible(record, input.subject)
    const session = this.engine.unparkConcept({
      subject: input.subject,
      session: record.session,
      conceptId: input.conceptId,
    })

    return this.saveTransition(record, session)
  }

  private async requireRecord(
    sessionId: SessionId,
  ): Promise<LearningSessionRecord> {
    const record = await this.repository.getSession(sessionId)

    if (record === null) {
      throw new LearningApplicationError(
        'session-not-found',
        'Session was not found.',
        { details: { sessionId } },
      )
    }

    return record
  }

  private assertSubjectCompatible(
    record: LearningSessionRecord,
    subject: LearningSubject,
  ): void {
    if (
      record.session.subjectId !== subject.id ||
      record.subjectVersion !== subject.version
    ) {
      throw new LearningApplicationError(
        'subject-version-mismatch',
        'Persisted session subject version does not match supplied subject.',
        {
          details: {
            sessionId: record.session.id,
            subjectId: record.session.subjectId,
            suppliedSubjectId: subject.id,
            persistedVersion: record.subjectVersion,
            suppliedVersion: subject.version,
          },
        },
      )
    }
  }

  private saveTransition(
    record: LearningSessionRecord,
    session: DefinedLearningSession,
  ): Promise<LearningSessionRecord> {
    return this.repository.saveSession({
      expectedRevision: record.revision,
      session,
    })
  }
}
