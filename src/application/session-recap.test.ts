import { describe, expect, it } from 'vitest'

import {
  ActivityIdSchema,
  ConceptIdSchema,
  LearnerIdSchema,
  LearnerProfileIdSchema,
  LearningSessionSchema,
  SessionIdSchema,
  SubjectIdSchema,
  type SessionId,
} from '../core/contracts'
import { LearningEngine } from '../core/engine'
import { cloneDeep, deepFreeze } from '../core/foundation'
import type { Clock, LearningIdGenerator } from '../core/ports'
import { createProductionSubjectRegistry } from '../app/subject-registry'
import {
  InMemoryResourceEngagementStore,
  LocalStorageLearningRepository,
  type StorageLike,
} from '../infrastructure'
import { demoLearnerProfile } from '../profiles'
import type {
  RecapMultipleChoiceResponse,
  RecapSingleChoiceResponse,
  SessionAttemptRecap,
  SessionRecap,
} from './index'
import {
  LearntApplication,
  LearningApplicationError,
  PersistentLearningService,
  type LearningSessionContext,
} from './index'

class FakeStorage implements StorageLike {
  private readonly values = new Map<string, string>()

  get length(): number {
    return this.values.size
  }

  key(index: number): string | null {
    return [...this.values.keys()].sort()[index] ?? null
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }

  raw(key: string): string | null {
    return this.values.get(key) ?? null
  }

  setRaw(key: string, value: string): void {
    this.values.set(key, value)
  }
}

class SequenceClock implements Clock {
  private index = 0

  now(): Date {
    const value = new Date(
      `2026-06-22T12:${String(this.index).padStart(2, '0')}:00.000Z`,
    )
    this.index += 1
    return value
  }
}

class SequenceIds implements LearningIdGenerator {
  private sessionIndex = 0
  private evidenceIndex = 0

  createSessionId(): string {
    const id = `session-${String(this.sessionIndex)}`
    this.sessionIndex += 1
    return id
  }

  createEvidenceId(): string {
    const id = `evidence-${String(this.evidenceIndex)}`
    this.evidenceIndex += 1
    return id
  }
}

function createTestApplication(storage = new FakeStorage()): LearntApplication {
  const clock = new SequenceClock()
  const engine = new LearningEngine({
    clock,
    idGenerator: new SequenceIds(),
  })
  const repository = new LocalStorageLearningRepository(storage)

  return new LearntApplication({
    clock,
    profile: demoLearnerProfile,
    subjectRegistry: createProductionSubjectRegistry(),
    persistentLearningService: new PersistentLearningService({
      engine,
      repository,
    }),
    resourceEngagementStore: new InMemoryResourceEngagementStore(),
  })
}

function firstProductionSubject() {
  const adapter = createProductionSubjectRegistry().list()[0]

  if (adapter === undefined) {
    throw new Error('Expected at least one production subject adapter.')
  }

  return adapter.subject
}

function storageKey(sessionId: SessionId | string = 'session-0'): string {
  return `learnt:learning-session:${sessionId}`
}

async function completeCurrentManual(
  application: LearntApplication,
  context: LearningSessionContext,
): Promise<LearningSessionContext> {
  const activityId = context.currentActivity?.id

  if (activityId === undefined) {
    throw new Error('Expected a current manual activity.')
  }

  const submitted = await application.submitEvidence({
    sessionId: context.record.session.id,
    activityId,
    response: { kind: 'manual', completed: true },
  })

  return application.advanceSession({
    sessionId: context.record.session.id,
    ...(submitted.context.nextActivities[0]?.activityId === undefined
      ? {}
      : { nextActivityId: submitted.context.nextActivities[0].activityId }),
  })
}

async function submitAndAdvance(
  application: LearntApplication,
  context: LearningSessionContext,
  activityId: string,
  response: unknown,
): Promise<LearningSessionContext> {
  const submitted = await application.submitEvidence({
    sessionId: context.record.session.id,
    activityId: ActivityIdSchema.parse(activityId),
    response,
  })

  return application.advanceSession({
    sessionId: context.record.session.id,
    ...(submitted.context.nextActivities[0]?.activityId === undefined
      ? {}
      : { nextActivityId: submitted.context.nextActivities[0].activityId }),
  })
}

async function buildActiveRecapFixture(
  application: LearntApplication,
): Promise<LearningSessionContext> {
  let context = await application.startSession({
    subjectId: SubjectIdSchema.parse('logic-basics'),
  })
  context = await completeCurrentManual(application, context)

  await application.submitEvidence({
    sessionId: context.record.session.id,
    activityId: ActivityIdSchema.parse('predict-negation'),
    response: { kind: 'single-choice', optionId: 'option-true' },
    confidence: 2,
    hintsUsed: 1,
  })
  const negationPassed = await application.submitEvidence({
    sessionId: context.record.session.id,
    activityId: ActivityIdSchema.parse('predict-negation'),
    response: { kind: 'single-choice', optionId: 'option-false' },
    confidence: 4,
  })
  const nextActivityId = negationPassed.context.nextActivities[0]?.activityId
  context = await application.advanceSession({
    sessionId: context.record.session.id,
    ...(nextActivityId === undefined ? {} : { nextActivityId }),
  })

  await application.submitEvidence({
    sessionId: context.record.session.id,
    activityId: ActivityIdSchema.parse('recall-boolean-values'),
    response: {
      kind: 'multiple-choice',
      optionIds: ['option-true', 'option-false'],
    },
    confidence: 3,
    hintsUsed: 2,
  })

  return application.getSessionContext(context.record.session.id)
}

async function completeLogicSessionThroughTransfer(
  application: LearntApplication,
  options: Readonly<{ parkedConceptId?: string }> = {},
): Promise<LearningSessionContext> {
  let context = await application.startSession({
    subjectId: SubjectIdSchema.parse('logic-basics'),
  })

  if (options.parkedConceptId !== undefined) {
    await application.parkConcept({
      sessionId: context.record.session.id,
      conceptId: ConceptIdSchema.parse(options.parkedConceptId),
    })
  }

  context = await completeCurrentManual(application, context)
  context = await submitAndAdvance(application, context, 'predict-negation', {
    kind: 'single-choice',
    optionId: 'option-false',
  })
  context = await submitAndAdvance(
    application,
    context,
    'recall-boolean-values',
    {
      kind: 'multiple-choice',
      optionIds: ['option-true', 'option-false'],
    },
  )
  context = await completeCurrentManual(application, context)
  context = await submitAndAdvance(
    application,
    context,
    'predict-conjunction',
    {
      kind: 'single-choice',
      optionId: 'option-false',
    },
  )

  const disjunctionPassed = await application.submitEvidence({
    sessionId: context.record.session.id,
    activityId: ActivityIdSchema.parse('predict-disjunction'),
    response: { kind: 'single-choice', optionId: 'option-true' },
  })
  context = await application.advanceSession({
    sessionId: context.record.session.id,
    nextActivityId: ActivityIdSchema.parse('transfer-release-gate'),
  })

  expect(
    disjunctionPassed.context.nextActivities.map((next) => next.activityId),
  ).toContain('transfer-release-gate')

  return submitAndAdvance(application, context, 'transfer-release-gate', {
    kind: 'text',
    value: 'do not release',
  })
}

function activityRecap(recap: SessionRecap, activityId: string) {
  const found = recap.modules
    .flatMap((module) => module.activities)
    .find((activity) => activity.activityId === activityId)

  if (found === undefined) {
    throw new Error(`Expected activity recap for ${activityId}.`)
  }

  return found
}

function rewriteStoredRecord(
  storage: FakeStorage,
  sessionId: SessionId,
  mutate: (record: Record<string, unknown>) => void,
): void {
  const raw = storage.raw(storageKey(sessionId))

  if (raw === null) {
    throw new Error('Expected stored session JSON.')
  }

  const parsed = JSON.parse(raw) as Record<string, unknown>
  mutate(parsed)
  storage.setRaw(storageKey(sessionId), JSON.stringify(parsed))
}

describe('LearntApplication session recap', () => {
  it('derives an immutable retrieval-first recap from persisted evidence and registered subject metadata', async () => {
    const storage = new FakeStorage()
    const application = createTestApplication(storage)
    const context = await buildActiveRecapFixture(application)
    await application.parkConcept({
      sessionId: context.record.session.id,
      conceptId: ConceptIdSchema.parse('compound-conditions'),
    })
    const rawBefore = storage.raw(storageKey(context.record.session.id))

    const recap = await application.getSessionRecap(context.record.session.id)
    const repeated = await application.getSessionRecap(
      context.record.session.id,
    )

    expect(repeated).toEqual(recap)
    expect(storage.raw(storageKey(context.record.session.id))).toBe(rawBefore)
    expect(recap).toMatchObject({
      sessionId: 'session-0',
      subject: {
        id: 'logic-basics',
        version: '0.1.0',
        title: 'Logic Basics',
      },
      sessionStatus: 'active',
      interactionMode: 'coach',
      evidenceCount: 4,
      totalHintsUsed: 3,
      parkedPaths: [
        {
          conceptId: 'compound-conditions',
          title: 'Compound conditions',
          summary: 'A decision rule that combines smaller Boolean conditions.',
        },
      ],
      progress: {
        unseen: 5,
        active: 0,
        attempted: 0,
        completed: 3,
        total: 8,
      },
    })
    expect(recap.currentThread).toEqual({
      moduleId: 'boolean-foundations',
      moduleTitle: 'Boolean Foundations',
      activityId: 'recall-boolean-values',
      activityTitle: 'Recall Boolean values',
      activityKind: 'recall',
      activityStatus: 'completed',
      action: 'continue-after-completion',
    })
    expect(recap.modules.map((module) => module.moduleId)).toEqual([
      'boolean-foundations',
      'combining-conditions',
    ])

    const allActivities = recap.modules.flatMap((module) => module.activities)
    expect(allActivities).toHaveLength(8)
    expect(activityRecap(recap, 'predict-conjunction')).toMatchObject({
      status: 'unseen',
      attemptCount: 0,
      attempts: [],
      latestEvaluation: null,
    })

    const negation = activityRecap(recap, 'predict-negation')
    expect(negation.attemptCount).toBe(2)
    expect(negation.attempts.map((attempt) => attempt.attemptNumber)).toEqual([
      1, 2,
    ])
    expect(negation.attempts[0]).toMatchObject({
      evidenceId: 'evidence-1',
      confidence: 2,
      hintsUsed: 1,
      evaluation: { status: 'retry', score: 0 },
    })
    expect(negation.attempts[0]?.response).toEqual({
      kind: 'single-choice',
      optionId: 'option-true',
      optionLabel: 'true',
    })
    expect(negation.attempts[1]).toMatchObject({
      evidenceId: 'evidence-2',
      confidence: 4,
      hintsUsed: 0,
      evaluation: { status: 'passed', score: 1 },
    })
    expect(negation.attempts[1]?.response).toEqual({
      kind: 'single-choice',
      optionId: 'option-false',
      optionLabel: 'false',
    })

    const recall = activityRecap(recap, 'recall-boolean-values')
    expect(recall.attempts[0]?.response).toEqual({
      kind: 'multiple-choice',
      options: [
        { optionId: 'option-true', optionLabel: 'true' },
        { optionId: 'option-false', optionLabel: 'false' },
      ],
    })
    expect(Object.keys(recall.latestEvaluation ?? {})).toEqual([
      'status',
      'score',
      'feedback',
    ])
    expect(JSON.stringify(recap)).not.toContain('correctOptionIds')
    expect(JSON.stringify(recap)).not.toContain('acceptedAnswers')
    expect(JSON.stringify(recap)).not.toContain('absoluteTolerance')
    expect(JSON.stringify(recap)).not.toContain('matchedCriteria')
    expect(JSON.stringify(recap)).not.toContain('missingCriteria')

    expect(recap.timeline.map((entry) => entry.attemptNumber)).toEqual([
      1, 1, 2, 1,
    ])
    expect(recap.conceptEncounters).toEqual([
      {
        conceptId: 'boolean-values',
        title: 'Boolean values',
        activityIds: [
          'orient-boolean-values',
          'predict-negation',
          'recall-boolean-values',
        ],
        evidenceCount: 4,
        firstEncounterAt: '2026-06-22T12:01:00.000Z',
        latestEncounterAt: '2026-06-22T12:06:00.000Z',
      },
      {
        conceptId: 'logical-negation',
        title: 'Logical negation',
        activityIds: ['predict-negation'],
        evidenceCount: 2,
        firstEncounterAt: '2026-06-22T12:03:00.000Z',
        latestEncounterAt: '2026-06-22T12:04:00.000Z',
      },
    ])
    expect(Object.isFrozen(recap)).toBe(true)
    expect(Object.isFrozen(recap.modules)).toBe(true)
    expect(Object.isFrozen(recap.modules[0]?.activities)).toBe(true)
    expect(Object.isFrozen(negation.attempts)).toBe(true)
    expect(Object.isFrozen(negation.attempts[0]?.evaluation)).toBe(true)

    const publicRecapTypes: [
      SessionRecap | null,
      SessionAttemptRecap | null,
      RecapSingleChoiceResponse | null,
      RecapMultipleChoiceResponse | null,
    ] = [null, null, null, null]
    expect(publicRecapTypes).toEqual([null, null, null, null])
  })

  it('returns terminal recaps without a current thread for abandoned and completed sessions', async () => {
    const abandonedApplication = createTestApplication()
    const abandonedContext = await buildActiveRecapFixture(abandonedApplication)
    await abandonedApplication.parkConcept({
      sessionId: abandonedContext.record.session.id,
      conceptId: ConceptIdSchema.parse('compound-conditions'),
    })
    await abandonedApplication.abandonSession({
      sessionId: abandonedContext.record.session.id,
    })
    const abandoned = await abandonedApplication.getSessionRecap(
      abandonedContext.record.session.id,
    )

    expect(abandoned.sessionStatus).toBe('abandoned')
    expect(abandoned.currentThread).toBeNull()
    expect(abandoned.evidenceCount).toBe(4)
    expect(abandoned.parkedPaths.map((concept) => concept.conceptId)).toEqual([
      'compound-conditions',
    ])

    const completedApplication = createTestApplication()
    const completedContext = await completeLogicSessionThroughTransfer(
      completedApplication,
      { parkedConceptId: 'compound-conditions' },
    )
    const completed = await completedApplication.getSessionRecap(
      completedContext.record.session.id,
    )

    expect(completed.sessionStatus).toBe('completed')
    expect(completed.currentThread).toBeNull()
    expect(completed.parkedPaths.map((concept) => concept.conceptId)).toEqual([
      'compound-conditions',
    ])
    expect(completed.progress.completed).toBe(7)
    expect(activityRecap(completed, 'transfer-release-gate')).toMatchObject({
      status: 'completed',
      attemptCount: 1,
      latestEvaluation: { status: 'passed', score: 1 },
    })
  })

  it('uses the same structured compatibility errors as session context retrieval', async () => {
    const storage = new FakeStorage()
    const application = createTestApplication(storage)
    const repository = new LocalStorageLearningRepository(storage)
    const engine = new LearningEngine({
      clock: new SequenceClock(),
      idGenerator: new SequenceIds(),
    })
    const started = engine.startSession({
      subject: firstProductionSubject(),
      learnerId: LearnerIdSchema.parse('demo-learner'),
      profileId: LearnerProfileIdSchema.parse('demo-learner-v1'),
    })

    await repository.createSession({
      subjectVersion: '9.9.9',
      session: started,
    })

    const missingSubject = deepFreeze(
      LearningSessionSchema.parse({
        ...cloneDeep(started),
        id: SessionIdSchema.parse('session-1'),
        subjectId: SubjectIdSchema.parse('missing-subject'),
      }),
    )
    await repository.createSession({
      subjectVersion: '0.1.0',
      session: missingSubject,
    })

    const wrongLearner = deepFreeze(
      LearningSessionSchema.parse({
        ...cloneDeep(started),
        id: SessionIdSchema.parse('session-2'),
        learnerId: LearnerIdSchema.parse('other-learner'),
        profileId: LearnerProfileIdSchema.parse('other-profile'),
      }),
    )
    await repository.createSession({
      subjectVersion: '0.1.0',
      session: wrongLearner,
    })

    await expect(
      application.getSessionRecap(SessionIdSchema.parse('missing-session')),
    ).rejects.toMatchObject({
      code: 'session-not-found',
    })
    await expect(application.getSessionRecap(started.id)).rejects.toMatchObject(
      {
        code: 'subject-version-mismatch',
      },
    )
    await expect(
      application.getSessionRecap(missingSubject.id),
    ).rejects.toMatchObject({
      code: 'subject-not-found',
    })
    await expect(
      application.getSessionRecap(wrongLearner.id),
    ).rejects.toMatchObject({
      code: 'learner-profile-mismatch',
    })
  })

  it('fails closed when stored choice evidence cannot be reconstructed against the registered subject', async () => {
    const storage = new FakeStorage()
    const application = createTestApplication(storage)
    let context = await application.startSession({
      subjectId: SubjectIdSchema.parse('logic-basics'),
    })
    context = await completeCurrentManual(application, context)
    await application.submitEvidence({
      sessionId: context.record.session.id,
      activityId: ActivityIdSchema.parse('predict-negation'),
      response: { kind: 'single-choice', optionId: 'option-false' },
    })

    rewriteStoredRecord(storage, context.record.session.id, (record) => {
      const evidenceEvents = record.evidenceEvents as {
        response: { kind: string; optionId?: string }
      }[]
      evidenceEvents[1] = {
        ...evidenceEvents[1],
        response: { kind: 'single-choice', optionId: 'option-missing' },
      }
    })

    await expect(
      createTestApplication(storage).getSessionRecap(context.record.session.id),
    ).rejects.toMatchObject({
      code: 'subject-version-mismatch',
    })
    await expect(
      createTestApplication(storage).getSessionRecap(context.record.session.id),
    ).rejects.toBeInstanceOf(LearningApplicationError)
  })
})
