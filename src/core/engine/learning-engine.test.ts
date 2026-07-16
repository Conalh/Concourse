import { describe, expect, it, vi } from 'vitest'

import {
  ActivityIdSchema,
  ConceptIdSchema,
  EvidenceIdSchema,
  LearnerIdSchema,
  LearnerProfileIdSchema,
  LearningSessionSchema,
  SubjectIdSchema,
  SubjectPackageSchema,
  type ActivityId,
  type ActivityStatus,
  type ConceptId,
  type EvidenceId,
  type InteractionMode,
  type LearningSession,
  type SubjectPackage,
} from '../contracts'
import { cloneDeep, deepFreeze } from '../foundation'
import type { Clock, LearningIdGenerator } from '../ports'
import {
  LearningEngine,
  LearningEngineError,
  type DefinedLearningSession,
  type LearningEngineErrorCode,
  type LearningSubject,
} from './index'
import { learningSubjectFixture } from './test-fixtures/learning-subject.fixture'

const learnerId = LearnerIdSchema.parse('demo-learner')
const profileId = LearnerProfileIdSchema.parse('demo-learner')

class SequenceClock implements Clock {
  private index = 0
  private readonly readings: readonly Date[]

  constructor(readings: readonly Date[]) {
    this.readings = readings
  }

  now(): Date {
    const reading = this.readings[this.index]

    if (reading === undefined) {
      throw new Error(`No fake clock reading at index ${String(this.index)}.`)
    }

    this.index += 1
    return reading
  }

  get readingsUsed(): number {
    return this.index
  }
}

class SequenceIdGenerator implements LearningIdGenerator {
  private sessionIndex = 0
  private evidenceIndex = 0
  private readonly sessionIds: readonly string[]
  private readonly evidenceIds: readonly string[]

  constructor(sessionIds: readonly string[], evidenceIds: readonly string[]) {
    this.sessionIds = sessionIds
    this.evidenceIds = evidenceIds
  }

  createSessionId(): string {
    const id = this.sessionIds[this.sessionIndex]

    if (id === undefined) {
      throw new Error(
        `No fake session ID at index ${String(this.sessionIndex)}.`,
      )
    }

    this.sessionIndex += 1
    return id
  }

  createEvidenceId(): string {
    const id = this.evidenceIds[this.evidenceIndex]

    if (id === undefined) {
      throw new Error(
        `No fake evidence ID at index ${String(this.evidenceIndex)}.`,
      )
    }

    this.evidenceIndex += 1
    return id
  }
}

interface EngineHarness {
  readonly engine: LearningEngine
  readonly clock: SequenceClock
  readonly idGenerator: SequenceIdGenerator
}

function makeEngineHarness(
  options: Readonly<{
    clockReadings?: readonly Date[]
    sessionIds?: readonly string[]
    evidenceIds?: readonly string[]
  }> = {},
): EngineHarness {
  const clock = new SequenceClock(
    options.clockReadings ?? defaultClockReadings(),
  )
  const idGenerator = new SequenceIdGenerator(
    options.sessionIds ?? stableIds('session', 30),
    options.evidenceIds ?? stableIds('evidence', 30),
  )
  const engine = new LearningEngine({ clock, idGenerator })

  return { engine, clock, idGenerator }
}

function defaultClockReadings(): readonly Date[] {
  return Array.from(
    { length: 30 },
    (_, index) =>
      new Date(`2026-06-22T12:${String(index).padStart(2, '0')}:00.000Z`),
  )
}

function stableIds(prefix: string, count: number): readonly string[] {
  return Array.from(
    { length: count },
    (_, index) => `${prefix}-${String(index)}`,
  )
}

function activityId(value: string): ActivityId {
  return ActivityIdSchema.parse(value)
}

function conceptId(value: string): ConceptId {
  return ConceptIdSchema.parse(value)
}

function evidenceId(value: string): EvidenceId {
  return EvidenceIdSchema.parse(value)
}

function startSession(
  engine: LearningEngine,
  subject: LearningSubject = learningSubjectFixture(),
  interactionMode?: InteractionMode,
): DefinedLearningSession {
  return engine.startSession({
    subject,
    learnerId,
    profileId,
    ...(interactionMode === undefined ? {} : { interactionMode }),
  })
}

function sessionAtActivity(
  engine: LearningEngine,
  subject: LearningSubject,
  targetActivityId: ActivityId,
  targetStatus: ActivityStatus = 'active',
): DefinedLearningSession {
  const session = startSession(engine, subject)
  return moveSessionToActivity(session, subject, targetActivityId, targetStatus)
}

function moveSessionToActivity(
  session: DefinedLearningSession,
  subject: LearningSubject,
  targetActivityId: ActivityId,
  targetStatus: ActivityStatus,
): DefinedLearningSession {
  const activity = subject.activities.find(
    (candidate) => candidate.id === targetActivityId,
  )

  if (activity === undefined) {
    throw new Error(`Missing fixture activity ${targetActivityId}.`)
  }

  const mutable = cloneDeep(session) as LearningSession
  mutable.status = 'active'
  mutable.currentActivityId = activity.id
  mutable.currentModuleId = activity.moduleId
  mutable.activityProgress = mutable.activityProgress.map((entry) => ({
    activityId: entry.activityId,
    status:
      entry.activityId === targetActivityId
        ? targetStatus
        : entry.status === 'completed'
          ? 'completed'
          : 'unseen',
  }))

  return deepFreeze(LearningSessionSchema.parse(mutable))
}

function progressStatus(
  session: DefinedLearningSession,
  targetActivityId: ActivityId,
): ActivityStatus {
  const progress = session.activityProgress.find(
    (entry) => entry.activityId === targetActivityId,
  )

  if (progress === undefined) {
    throw new Error(`Missing progress for ${targetActivityId}.`)
  }

  return progress.status
}

function freezeSubject(input: SubjectPackage): LearningSubject {
  return deepFreeze(SubjectPackageSchema.parse(input))
}

function cloneSubject(subject: LearningSubject): SubjectPackage {
  return cloneDeep(subject) as SubjectPackage
}

function expectEngineCode(
  action: () => unknown,
  code: LearningEngineErrorCode,
): LearningEngineError {
  try {
    action()
  } catch (error) {
    expect(error).toBeInstanceOf(LearningEngineError)
    const engineError = error as LearningEngineError
    expect(engineError.code).toBe(code)
    return engineError
  }

  throw new Error(`Expected LearningEngineError code ${code}.`)
}

describe('LearningEngine.startSession', () => {
  it('starts an immutable active session at the earliest nonempty authored activity', () => {
    const subject = learningSubjectFixture()
    const subjectBefore = cloneDeep(subject)
    const { engine, clock } = makeEngineHarness()

    const session = startSession(engine, subject)

    expect(session.id).toBe('session-0')
    expect(session.learnerId).toBe(learnerId)
    expect(session.profileId).toBe(profileId)
    expect(session.subjectId).toBe('engine-subject')
    expect(session.status).toBe('active')
    expect(session.interactionMode).toBe('coach')
    expect(session.currentModuleId).toBe('module-foundations')
    expect(session.currentActivityId).toBe('activity-exact')
    expect(session.startedAt).toBe('2026-06-22T12:00:00.000Z')
    expect(session.lastActiveAt).toBe(session.startedAt)
    expect(session.evidenceEventIds).toEqual([])
    expect(session.exploration).toEqual({ parkedConceptIds: [] })
    expect(clock.readingsUsed).toBe(1)

    expect(session.activityProgress.map((entry) => entry.activityId)).toEqual([
      'activity-exact',
      'activity-single',
      'activity-multiple',
      'activity-number',
      'activity-confidence',
      'activity-code',
      'activity-rubric',
      'activity-extension',
      'activity-manual',
    ])
    expect(progressStatus(session, activityId('activity-exact'))).toBe('active')
    expect(
      session.activityProgress
        .filter((entry) => entry.activityId !== 'activity-exact')
        .every((entry) => entry.status === 'unseen'),
    ).toBe(true)

    expect(Object.isFrozen(session)).toBe(true)
    expect(Object.isFrozen(session.activityProgress)).toBe(true)
    expect(Object.isFrozen(session.activityProgress[0])).toBe(true)
    expect(Object.isFrozen(session.exploration)).toBe(true)
    expect(Object.isFrozen(session.exploration.parkedConceptIds)).toBe(true)
    expect(subject).toEqual(subjectBefore)
  })

  it('preserves explicit interaction mode and is deterministic with deterministic ports', () => {
    const subject = learningSubjectFixture()
    const first = makeEngineHarness()
    const second = makeEngineHarness()

    const firstSession = startSession(first.engine, subject, 'rescue')
    const secondSession = startSession(second.engine, subject, 'rescue')

    expect(firstSession.interactionMode).toBe('rescue')
    expect(secondSession).toEqual(firstSession)
  })

  it('rejects subjects with no authored activities, invalid generated IDs, and invalid clocks', () => {
    const subjectWithoutActivitiesInput = cloneSubject(learningSubjectFixture())
    subjectWithoutActivitiesInput.modules =
      subjectWithoutActivitiesInput.modules.map((module) => ({
        ...module,
        activityIds: [],
      }))
    subjectWithoutActivitiesInput.activities = []
    const subjectWithoutActivities = freezeSubject(
      subjectWithoutActivitiesInput,
    )

    expectEngineCode(
      () => startSession(makeEngineHarness().engine, subjectWithoutActivities),
      'subject-has-no-activities',
    )

    expectEngineCode(
      () =>
        startSession(
          makeEngineHarness({ sessionIds: ['Invalid Session ID'] }).engine,
        ),
      'invalid-generated-id',
    )

    expectEngineCode(
      () =>
        startSession(
          makeEngineHarness({
            clockReadings: [new Date(Number.NaN)],
          }).engine,
        ),
      'invalid-clock-value',
    )
  })
})

describe('LearningEngine.submitEvidence', () => {
  it('creates a frozen evidence event and updates only session progress/evidence metadata', () => {
    const subject = learningSubjectFixture()
    const { engine } = makeEngineHarness()
    const session = startSession(engine, subject)
    const originalSession = cloneDeep(session)

    const result = engine.submitEvidence({
      subject,
      session,
      activityId: activityId('activity-exact'),
      response: { kind: 'text', value: ' Correct Answer ' },
      confidence: 4,
      hintsUsed: 2,
    })

    expect(result.evaluation.status).toBe('passed')
    expect(result.evaluation.score).toBe(1)
    expect(result.evaluation.feedback).not.toContain('backup answer')
    expect(result.activityCompleted).toBe(true)
    expect(result.evidenceEvent).toMatchObject({
      id: 'evidence-0',
      timestamp: '2026-06-22T12:01:00.000Z',
      learnerId,
      profileId,
      sessionId: 'session-0',
      subjectId: 'engine-subject',
      moduleId: 'module-foundations',
      activityId: 'activity-exact',
      objectiveIds: ['objective-answer'],
      activityKind: 'predict',
      response: { kind: 'text', value: ' Correct Answer ' },
      confidence: 4,
      hintsUsed: 2,
    })
    expect(result.evidenceEvent.evaluation).toEqual(result.evaluation)
    expect(result.session.evidenceEventIds).toEqual(['evidence-0'])
    expect(result.session.lastActiveAt).toBe(result.evidenceEvent.timestamp)
    expect(result.session.currentActivityId).toBe('activity-exact')
    expect(result.session.currentModuleId).toBe('module-foundations')
    expect(progressStatus(result.session, activityId('activity-exact'))).toBe(
      'completed',
    )
    expect(session).toEqual(originalSession)
    expect(Object.isFrozen(result)).toBe(true)
    expect(Object.isFrozen(result.session)).toBe(true)
    expect(Object.isFrozen(result.evidenceEvent)).toBe(true)
    expect(Object.isFrozen(result.evaluation)).toBe(true)
  })

  it('keeps failed attempts current, appends retry evidence, and rejects submissions after completion', () => {
    const subject = learningSubjectFixture()
    const { engine } = makeEngineHarness()
    const session = startSession(engine, subject)

    const failed = engine.submitEvidence({
      subject,
      session,
      activityId: activityId('activity-exact'),
      response: { kind: 'text', value: 'wrong answer' },
    })

    expect(failed.evaluation.status).toBe('retry')
    expect(failed.activityCompleted).toBe(false)
    expect(progressStatus(failed.session, activityId('activity-exact'))).toBe(
      'attempted',
    )
    expect(failed.session.currentActivityId).toBe('activity-exact')
    expect(failed.session.status).toBe('active')

    const passed = engine.submitEvidence({
      subject,
      session: failed.session,
      activityId: activityId('activity-exact'),
      response: { kind: 'text', value: 'correct answer' },
    })

    expect(passed.evaluation.status).toBe('passed')
    expect(passed.session.evidenceEventIds).toEqual([
      'evidence-0',
      'evidence-1',
    ])
    expect(progressStatus(passed.session, activityId('activity-exact'))).toBe(
      'completed',
    )
    expect(passed.session.currentActivityId).toBe('activity-exact')

    expectEngineCode(
      () =>
        engine.submitEvidence({
          subject,
          session: passed.session,
          activityId: activityId('activity-exact'),
          response: { kind: 'text', value: 'correct answer' },
        }),
      'activity-already-completed',
    )
  })

  it('validates response kind and authored response constraints before creating evidence', () => {
    const subject = learningSubjectFixture()

    expectEngineCode(() => {
      const { engine } = makeEngineHarness()
      const session = startSession(engine, subject)
      engine.submitEvidence({
        subject,
        session,
        activityId: activityId('activity-exact'),
        response: { kind: 'number', value: 5 },
      })
    }, 'response-kind-mismatch')

    for (const value of ['no', 'x'.repeat(21)]) {
      expectEngineCode(() => {
        const { engine } = makeEngineHarness()
        const session = startSession(engine, subject)
        engine.submitEvidence({
          subject,
          session,
          activityId: activityId('activity-exact'),
          response: { kind: 'text', value },
        })
      }, 'response-constraint-violation')
    }

    for (const value of [-1, 11, 5.25]) {
      expectEngineCode(() => {
        const { engine } = makeEngineHarness()
        const session = sessionAtActivity(
          engine,
          subject,
          activityId('activity-number'),
        )
        engine.submitEvidence({
          subject,
          session,
          activityId: activityId('activity-number'),
          response: { kind: 'number', value },
        })
      }, 'response-constraint-violation')
    }

    expectEngineCode(() => {
      const { engine } = makeEngineHarness()
      const session = sessionAtActivity(
        engine,
        subject,
        activityId('activity-single'),
      )
      engine.submitEvidence({
        subject,
        session,
        activityId: activityId('activity-single'),
        response: { kind: 'single-choice', optionId: 'option-missing' },
      })
    }, 'response-constraint-violation')

    expectEngineCode(() => {
      const { engine } = makeEngineHarness()
      const session = sessionAtActivity(
        engine,
        subject,
        activityId('activity-multiple'),
      )
      engine.submitEvidence({
        subject,
        session,
        activityId: activityId('activity-multiple'),
        response: {
          kind: 'multiple-choice',
          optionIds: ['option-alpha', 'option-beta', 'option-gamma'],
        },
      })
    }, 'response-constraint-violation')

    expectEngineCode(() => {
      const { engine } = makeEngineHarness()
      const session = sessionAtActivity(
        engine,
        subject,
        activityId('activity-confidence'),
      )
      engine.submitEvidence({
        subject,
        session,
        activityId: activityId('activity-confidence'),
        response: { kind: 'confidence', value: 5 },
      })
    }, 'response-constraint-violation')

    expectEngineCode(() => {
      const { engine } = makeEngineHarness()
      const session = sessionAtActivity(
        engine,
        subject,
        activityId('activity-code'),
      )
      engine.submitEvidence({
        subject,
        session,
        activityId: activityId('activity-code'),
        response: {
          kind: 'code',
          language: 'javascript',
          source: 'export const value = 1',
        },
      })
    }, 'response-constraint-violation')

    expectEngineCode(() => {
      const { engine } = makeEngineHarness()
      const session = sessionAtActivity(
        engine,
        subject,
        activityId('activity-manual'),
      )
      engine.submitEvidence({
        subject,
        session,
        activityId: activityId('activity-manual'),
        response: { kind: 'text', value: 'normal evidence' },
      })
    }, 'response-kind-mismatch')

    expectEngineCode(() => {
      const { engine } = makeEngineHarness()
      const session = startSession(engine, subject)
      engine.submitEvidence({
        subject,
        session,
        activityId: activityId('activity-exact'),
        response: { kind: 'manual', completed: true },
      })
    }, 'response-kind-mismatch')
  })

  it('evaluates deterministic built-in evaluators and leaves assisted evaluators ungraded', () => {
    const subject = learningSubjectFixture()

    const singlePassedHarness = makeEngineHarness()
    const singlePassedSession = sessionAtActivity(
      singlePassedHarness.engine,
      subject,
      activityId('activity-single'),
    )
    const singlePassed = singlePassedHarness.engine.submitEvidence({
      subject,
      session: singlePassedSession,
      activityId: activityId('activity-single'),
      response: { kind: 'single-choice', optionId: 'option-yes' },
    })
    expect(singlePassed.evaluation.status).toBe('passed')
    expect(singlePassed.evaluation.score).toBe(1)

    const singleRetryHarness = makeEngineHarness()
    const singleRetrySession = sessionAtActivity(
      singleRetryHarness.engine,
      subject,
      activityId('activity-single'),
    )
    const singleRetry = singleRetryHarness.engine.submitEvidence({
      subject,
      session: singleRetrySession,
      activityId: activityId('activity-single'),
      response: { kind: 'single-choice', optionId: 'option-no' },
    })
    expect(singleRetry.evaluation.status).toBe('retry')
    expect(singleRetry.evaluation.score).toBe(0)

    const multiplePassedHarness = makeEngineHarness()
    const multiplePassedSession = sessionAtActivity(
      multiplePassedHarness.engine,
      subject,
      activityId('activity-multiple'),
    )
    const multiplePassed = multiplePassedHarness.engine.submitEvidence({
      subject,
      session: multiplePassedSession,
      activityId: activityId('activity-multiple'),
      response: {
        kind: 'multiple-choice',
        optionIds: ['option-beta', 'option-alpha'],
      },
    })
    expect(multiplePassed.evaluation.status).toBe('passed')
    expect(multiplePassed.evaluation.score).toBe(1)

    const partialHarness = makeEngineHarness()
    const partialSession = sessionAtActivity(
      partialHarness.engine,
      subject,
      activityId('activity-multiple'),
    )
    const partial = partialHarness.engine.submitEvidence({
      subject,
      session: partialSession,
      activityId: activityId('activity-multiple'),
      response: {
        kind: 'multiple-choice',
        optionIds: ['option-alpha', 'option-gamma'],
      },
    })
    expect(partial.evaluation.status).toBe('partial')
    expect(partial.evaluation.score).toBeCloseTo(1 / 3)
    expect(partial.evaluation.matchedCriteria).toEqual(['option-alpha'])
    expect(partial.evaluation.missingCriteria).toEqual(['option-beta'])
    expect(partial.activityCompleted).toBe(false)

    const noOverlapHarness = makeEngineHarness()
    const noOverlapSession = sessionAtActivity(
      noOverlapHarness.engine,
      subject,
      activityId('activity-multiple'),
    )
    const noOverlap = noOverlapHarness.engine.submitEvidence({
      subject,
      session: noOverlapSession,
      activityId: activityId('activity-multiple'),
      response: { kind: 'multiple-choice', optionIds: ['option-gamma'] },
    })
    expect(noOverlap.evaluation.status).toBe('retry')
    expect(noOverlap.evaluation.score).toBe(0)

    for (const value of [5, 5.5]) {
      const { engine } = makeEngineHarness()
      const numberSession = sessionAtActivity(
        engine,
        subject,
        activityId('activity-number'),
      )
      const result = engine.submitEvidence({
        subject,
        session: numberSession,
        activityId: activityId('activity-number'),
        response: { kind: 'number', value },
      })
      expect(result.evaluation.status).toBe('passed')
    }

    const numberRetryHarness = makeEngineHarness()
    const numberRetrySession = sessionAtActivity(
      numberRetryHarness.engine,
      subject,
      activityId('activity-number'),
    )
    const numberRetry = numberRetryHarness.engine.submitEvidence({
      subject,
      session: numberRetrySession,
      activityId: activityId('activity-number'),
      response: { kind: 'number', value: 6 },
    })
    expect(numberRetry.evaluation.status).toBe('retry')

    const rubricHarness = makeEngineHarness()
    const rubricSession = sessionAtActivity(
      rubricHarness.engine,
      subject,
      activityId('activity-rubric'),
    )
    const rubric = rubricHarness.engine.submitEvidence({
      subject,
      session: rubricSession,
      activityId: activityId('activity-rubric'),
      response: { kind: 'text', value: 'feature' },
    })
    expect(rubric.evaluation.status).toBe('ungraded')
    expect(rubric.evaluation.matchedCriteria).toEqual([])
    expect(rubric.evaluation.missingCriteria).toEqual([])
    expect(rubric.activityCompleted).toBe(false)

    const extensionHarness = makeEngineHarness()
    const extensionSession = sessionAtActivity(
      extensionHarness.engine,
      subject,
      activityId('activity-extension'),
    )
    const extension = extensionHarness.engine.submitEvidence({
      subject,
      session: extensionSession,
      activityId: activityId('activity-extension'),
      response: { kind: 'text', value: 'opaque' },
    })
    expect(extension.evaluation.status).toBe('ungraded')
    expect(extension.evaluation.missingCriteria).toEqual([])
    expect(extension.activityCompleted).toBe(true)
  })

  it('accepts manual completion only for manual completion activities', () => {
    const subject = learningSubjectFixture()
    const { engine } = makeEngineHarness()
    const session = sessionAtActivity(
      engine,
      subject,
      activityId('activity-manual'),
    )

    const result = engine.submitEvidence({
      subject,
      session,
      activityId: activityId('activity-manual'),
      response: { kind: 'manual', completed: true },
    })

    expect(result.evaluation.status).toBe('passed')
    expect(result.activityCompleted).toBe(true)
    expect(progressStatus(result.session, activityId('activity-manual'))).toBe(
      'completed',
    )
  })

  it('rejects invalid evidence IDs, duplicate evidence IDs, inactive sessions, and wrong activities', () => {
    const subject = learningSubjectFixture()

    expectEngineCode(() => {
      const { engine } = makeEngineHarness({ evidenceIds: ['Invalid ID'] })
      const session = startSession(engine, subject)
      engine.submitEvidence({
        subject,
        session,
        activityId: activityId('activity-exact'),
        response: { kind: 'text', value: 'correct answer' },
      })
    }, 'invalid-generated-id')

    expectEngineCode(() => {
      const { engine } = makeEngineHarness({ evidenceIds: ['evidence-0'] })
      const session = startSession(engine, subject)
      const mutable = cloneDeep(session) as LearningSession
      mutable.evidenceEventIds = [evidenceId('evidence-0')]
      const sessionWithDuplicateTarget = deepFreeze(
        LearningSessionSchema.parse(mutable),
      )

      engine.submitEvidence({
        subject,
        session: sessionWithDuplicateTarget,
        activityId: activityId('activity-exact'),
        response: { kind: 'text', value: 'correct answer' },
      })
    }, 'duplicate-generated-id')

    expectEngineCode(() => {
      const { engine } = makeEngineHarness()
      const session = startSession(engine, subject)
      engine.submitEvidence({
        subject,
        session,
        activityId: activityId('activity-single'),
        response: { kind: 'single-choice', optionId: 'option-yes' },
      })
    }, 'activity-not-current')

    expectEngineCode(() => {
      const { engine } = makeEngineHarness()
      const abandoned = engine.abandonSession({
        session: startSession(engine, subject),
      })
      engine.submitEvidence({
        subject,
        session: abandoned,
        activityId: activityId('activity-exact'),
        response: { kind: 'text', value: 'correct answer' },
      })
    }, 'session-not-active')
  })
})

describe('LearningEngine advancement', () => {
  it('rejects advancement before completion and advances a linear completed activity automatically', () => {
    const subject = learningSubjectFixture()
    const { engine } = makeEngineHarness()
    const session = startSession(engine, subject)

    expectEngineCode(
      () => engine.advanceSession({ subject, session }),
      'activity-not-completed',
    )

    const submitted = engine.submitEvidence({
      subject,
      session,
      activityId: activityId('activity-exact'),
      response: { kind: 'text', value: 'correct answer' },
    })

    const nextIds = engine.getNextActivityIds({
      subject,
      session: submitted.session,
    })
    expect(nextIds).toEqual(['activity-single'])
    expect(Object.isFrozen(nextIds)).toBe(true)

    const advanced = engine.advanceSession({
      subject,
      session: submitted.session,
    })
    expect(advanced.currentActivityId).toBe('activity-single')
    expect(advanced.currentModuleId).toBe('module-foundations')
    expect(progressStatus(advanced, activityId('activity-exact'))).toBe(
      'completed',
    )
    expect(progressStatus(advanced, activityId('activity-single'))).toBe(
      'active',
    )
  })

  it('requires explicit authored branch selection and preserves unselected branches', () => {
    const subject = learningSubjectFixture()
    const { engine } = makeEngineHarness()
    const session = sessionAtActivity(
      engine,
      subject,
      activityId('activity-single'),
    )
    const submitted = engine.submitEvidence({
      subject,
      session,
      activityId: activityId('activity-single'),
      response: { kind: 'single-choice', optionId: 'option-yes' },
    })

    const branchChoices = engine.getNextActivityIds({
      subject,
      session: submitted.session,
    })
    expect(branchChoices).toEqual(['activity-multiple', 'activity-number'])

    const error = expectEngineCode(
      () => engine.advanceSession({ subject, session: submitted.session }),
      'next-activity-selection-required',
    )
    expect(error.details?.candidateActivityIds).toEqual([
      'activity-multiple',
      'activity-number',
    ])

    expectEngineCode(
      () =>
        engine.advanceSession({
          subject,
          session: submitted.session,
          nextActivityId: activityId('activity-rubric'),
        }),
      'invalid-next-activity',
    )

    const advanced = engine.advanceSession({
      subject,
      session: submitted.session,
      nextActivityId: activityId('activity-number'),
    })
    expect(advanced.currentActivityId).toBe('activity-number')
    expect(progressStatus(advanced, activityId('activity-number'))).toBe(
      'active',
    )
    expect(progressStatus(advanced, activityId('activity-multiple'))).toBe(
      'unseen',
    )
  })

  it('updates modules across edges, completes terminal paths, and rejects invalid targets', () => {
    const subject = learningSubjectFixture()
    const crossModuleHarness = makeEngineHarness()
    const multipleSession = sessionAtActivity(
      crossModuleHarness.engine,
      subject,
      activityId('activity-multiple'),
    )
    const multipleSubmitted = crossModuleHarness.engine.submitEvidence({
      subject,
      session: multipleSession,
      activityId: activityId('activity-multiple'),
      response: {
        kind: 'multiple-choice',
        optionIds: ['option-alpha', 'option-beta'],
      },
    })
    const crossModuleAdvanced = crossModuleHarness.engine.advanceSession({
      subject,
      session: multipleSubmitted.session,
    })
    expect(crossModuleAdvanced.currentActivityId).toBe('activity-manual')
    expect(crossModuleAdvanced.currentModuleId).toBe('module-transfer')
    expect(
      progressStatus(crossModuleAdvanced, activityId('activity-multiple')),
    ).toBe('completed')

    const terminalHarness = makeEngineHarness()
    const manualSession = sessionAtActivity(
      terminalHarness.engine,
      subject,
      activityId('activity-manual'),
    )
    const manualSubmitted = terminalHarness.engine.submitEvidence({
      subject,
      session: manualSession,
      activityId: activityId('activity-manual'),
      response: { kind: 'manual', completed: true },
    })
    const completed = terminalHarness.engine.advanceSession({
      subject,
      session: manualSubmitted.session,
    })
    expect(completed.status).toBe('completed')
    expect(completed.currentActivityId).toBeNull()
    expect(completed.currentModuleId).toBeNull()

    expectEngineCode(
      () =>
        terminalHarness.engine.advanceSession({ subject, session: completed }),
      'session-not-active',
    )

    const targetHarness = makeEngineHarness()
    const singleSession = sessionAtActivity(
      targetHarness.engine,
      subject,
      activityId('activity-single'),
    )
    const singleSubmitted = targetHarness.engine.submitEvidence({
      subject,
      session: singleSession,
      activityId: activityId('activity-single'),
      response: { kind: 'single-choice', optionId: 'option-yes' },
    })
    const mutable = cloneDeep(singleSubmitted.session) as LearningSession
    mutable.activityProgress = mutable.activityProgress.map((entry) =>
      entry.activityId === 'activity-number'
        ? { ...entry, status: 'completed' }
        : entry,
    )
    const targetAlreadyCompleted = deepFreeze(
      LearningSessionSchema.parse(mutable),
    )

    expectEngineCode(
      () =>
        targetHarness.engine.advanceSession({
          subject,
          session: targetAlreadyCompleted,
          nextActivityId: activityId('activity-number'),
        }),
      'next-activity-not-available',
    )
  })
})

describe('LearningEngine mode changes and abandonment', () => {
  it('changes active interaction mode without changing profile, progress, evidence, or current activity', () => {
    const subject = learningSubjectFixture()
    const { engine } = makeEngineHarness()
    const session = startSession(engine, subject)
    const progressBefore = cloneDeep(session.activityProgress)

    const updated = engine.changeInteractionMode({
      session,
      interactionMode: 'zoom',
    })

    expect(updated.interactionMode).toBe('zoom')
    expect(updated.lastActiveAt).toBe('2026-06-22T12:01:00.000Z')
    expect(updated.profileId).toBe(session.profileId)
    expect(updated.currentActivityId).toBe(session.currentActivityId)
    expect(updated.currentModuleId).toBe(session.currentModuleId)
    expect(updated.activityProgress).toEqual(progressBefore)
    expect(updated.evidenceEventIds).toEqual([])

    const abandoned = engine.abandonSession({ session: updated })
    expectEngineCode(
      () =>
        engine.changeInteractionMode({
          session: abandoned,
          interactionMode: 'coach',
        }),
      'session-not-active',
    )
  })

  it('abandons only active sessions, clears current IDs, preserves evidence, and keeps attempted/completed progress', () => {
    const subject = learningSubjectFixture()
    const activeHarness = makeEngineHarness()
    const active = startSession(activeHarness.engine, subject)
    const abandonedActive = activeHarness.engine.abandonSession({
      session: active,
    })
    expect(abandonedActive.status).toBe('abandoned')
    expect(abandonedActive.currentActivityId).toBeNull()
    expect(abandonedActive.currentModuleId).toBeNull()
    expect(progressStatus(abandonedActive, activityId('activity-exact'))).toBe(
      'unseen',
    )

    const evidenceHarness = makeEngineHarness()
    const failed = evidenceHarness.engine.submitEvidence({
      subject,
      session: startSession(evidenceHarness.engine, subject),
      activityId: activityId('activity-exact'),
      response: { kind: 'text', value: 'wrong answer' },
    })
    const abandonedAttempt = evidenceHarness.engine.abandonSession({
      session: failed.session,
    })
    expect(progressStatus(abandonedAttempt, activityId('activity-exact'))).toBe(
      'attempted',
    )
    expect(abandonedAttempt.evidenceEventIds).toEqual(['evidence-0'])

    expectEngineCode(
      () =>
        evidenceHarness.engine.submitEvidence({
          subject,
          session: abandonedAttempt,
          activityId: activityId('activity-exact'),
          response: { kind: 'text', value: 'correct answer' },
        }),
      'session-not-active',
    )
    expectEngineCode(
      () =>
        evidenceHarness.engine.advanceSession({
          subject,
          session: abandonedAttempt,
        }),
      'session-not-active',
    )
  })
})

describe('LearningEngine concept exploration', () => {
  it('parks a valid concept without changing evidence, progress, or the current activity', () => {
    const subject = learningSubjectFixture()
    const { engine } = makeEngineHarness()
    const session = startSession(engine, subject)
    const originalSession = cloneDeep(session)
    const subjectBefore = cloneDeep(subject)

    const parked = engine.parkConcept({
      subject,
      session,
      conceptId: conceptId('concept-choice'),
    })

    expect(parked.exploration.parkedConceptIds).toEqual(['concept-choice'])
    expect(parked.lastActiveAt).toBe('2026-06-22T12:01:00.000Z')
    expect(parked.evidenceEventIds).toEqual(session.evidenceEventIds)
    expect(parked.activityProgress).toEqual(session.activityProgress)
    expect(parked.currentActivityId).toBe(session.currentActivityId)
    expect(parked.currentModuleId).toBe(session.currentModuleId)
    expect(parked.interactionMode).toBe(session.interactionMode)
    expect(parked.status).toBe('active')
    expect(session).toEqual(originalSession)
    expect(subject).toEqual(subjectBefore)
    expect(Object.isFrozen(parked)).toBe(true)
    expect(Object.isFrozen(parked.exploration)).toBe(true)
    expect(Object.isFrozen(parked.exploration.parkedConceptIds)).toBe(true)
  })

  it('unparks a concept and preserves the remaining parked order', () => {
    const subject = learningSubjectFixture()
    const { engine } = makeEngineHarness()
    const session = startSession(engine, subject)
    const firstParked = engine.parkConcept({
      subject,
      session,
      conceptId: conceptId('concept-signal'),
    })
    const secondParked = engine.parkConcept({
      subject,
      session: firstParked,
      conceptId: conceptId('concept-choice'),
    })

    const unparked = engine.unparkConcept({
      subject,
      session: secondParked,
      conceptId: conceptId('concept-signal'),
    })

    expect(secondParked.exploration.parkedConceptIds).toEqual([
      'concept-signal',
      'concept-choice',
    ])
    expect(unparked.exploration.parkedConceptIds).toEqual(['concept-choice'])
    expect(unparked.lastActiveAt).toBe('2026-06-22T12:03:00.000Z')
    expect(unparked.evidenceEventIds).toEqual([])
    expect(unparked.activityProgress).toEqual(session.activityProgress)
    expect(unparked.currentActivityId).toBe(session.currentActivityId)
  })

  it('rejects unknown, duplicate, unparked, terminal, mismatched, and invalid-clock cases', () => {
    const subject = learningSubjectFixture()

    expectEngineCode(() => {
      const { engine } = makeEngineHarness()
      const session = startSession(engine, subject)
      engine.parkConcept({
        subject,
        session,
        conceptId: conceptId('concept-missing'),
      })
    }, 'concept-not-found')

    expectEngineCode(() => {
      const { engine } = makeEngineHarness()
      const session = startSession(engine, subject)
      const parked = engine.parkConcept({
        subject,
        session,
        conceptId: conceptId('concept-choice'),
      })
      engine.parkConcept({
        subject,
        session: parked,
        conceptId: conceptId('concept-choice'),
      })
    }, 'concept-already-parked')

    expectEngineCode(() => {
      const { engine } = makeEngineHarness()
      const session = startSession(engine, subject)
      engine.unparkConcept({
        subject,
        session,
        conceptId: conceptId('concept-choice'),
      })
    }, 'concept-not-parked')

    expectEngineCode(() => {
      const { engine } = makeEngineHarness()
      const session = startSession(engine, subject)
      const completed = moveSessionToActivity(
        session,
        subject,
        activityId('activity-manual'),
        'completed',
      )
      engine.parkConcept({
        subject,
        session: deepFreeze(
          LearningSessionSchema.parse({
            ...completed,
            status: 'completed',
            currentActivityId: null,
            currentModuleId: null,
          }),
        ),
        conceptId: conceptId('concept-choice'),
      })
    }, 'session-not-active')

    expectEngineCode(() => {
      const { engine } = makeEngineHarness()
      const abandoned = engine.abandonSession({
        session: startSession(engine, subject),
      })
      engine.parkConcept({
        subject,
        session: abandoned,
        conceptId: conceptId('concept-choice'),
      })
    }, 'session-not-active')

    expectEngineCode(() => {
      const { engine } = makeEngineHarness()
      const session = startSession(engine, subject)
      const mismatchedSubjectInput = cloneSubject(subject)
      mismatchedSubjectInput.id = SubjectIdSchema.parse('other-subject')
      engine.parkConcept({
        subject: freezeSubject(mismatchedSubjectInput),
        session,
        conceptId: conceptId('concept-choice'),
      })
    }, 'session-subject-mismatch')

    expectEngineCode(() => {
      const { engine } = makeEngineHarness({
        clockReadings: [
          new Date('2026-06-22T12:00:00.000Z'),
          new Date('2026-06-22T11:59:00.000Z'),
        ],
      })
      const session = startSession(engine, subject)
      engine.parkConcept({
        subject,
        session,
        conceptId: conceptId('concept-choice'),
      })
    }, 'invalid-clock-value')
  })

  it('preserves parked paths across completion and abandonment', () => {
    const subject = learningSubjectFixture()

    const completeHarness = makeEngineHarness()
    const manualSession = sessionAtActivity(
      completeHarness.engine,
      subject,
      activityId('activity-manual'),
    )
    const parked = completeHarness.engine.parkConcept({
      subject,
      session: manualSession,
      conceptId: conceptId('concept-choice'),
    })
    const submitted = completeHarness.engine.submitEvidence({
      subject,
      session: parked,
      activityId: activityId('activity-manual'),
      response: { kind: 'manual', completed: true },
    })
    const completed = completeHarness.engine.advanceSession({
      subject,
      session: submitted.session,
    })

    expect(completed.status).toBe('completed')
    expect(completed.exploration.parkedConceptIds).toEqual(['concept-choice'])

    const abandonHarness = makeEngineHarness()
    const abandonedParked = abandonHarness.engine.parkConcept({
      subject,
      session: startSession(abandonHarness.engine, subject),
      conceptId: conceptId('concept-signal'),
    })
    const abandoned = abandonHarness.engine.abandonSession({
      session: abandonedParked,
    })

    expect(abandoned.status).toBe('abandoned')
    expect(abandoned.exploration.parkedConceptIds).toEqual(['concept-signal'])
  })
})

describe('LearningEngine determinism and immutable outputs', () => {
  it('does not use global time or randomness when ports provide deterministic values', () => {
    const nowSpy = vi.spyOn(Date, 'now').mockImplementation(() => {
      throw new Error('Date.now must not be used by the engine.')
    })
    const randomSpy = vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('Math.random must not be used by the engine.')
    })

    try {
      const subject = learningSubjectFixture()
      const { engine } = makeEngineHarness()
      const session = startSession(engine, subject)
      const submitted = engine.submitEvidence({
        subject,
        session,
        activityId: activityId('activity-exact'),
        response: { kind: 'text', value: 'correct answer' },
      })
      const advanced = engine.advanceSession({
        subject,
        session: submitted.session,
      })

      expect(advanced.currentActivityId).toBe('activity-single')
    } finally {
      nowSpy.mockRestore()
      randomSpy.mockRestore()
    }
  })

  it('freezes sessions, evidence events, evaluations, and next-activity arrays at runtime', () => {
    const subject = learningSubjectFixture()
    const { engine } = makeEngineHarness()
    const session = startSession(engine, subject)
    const submitted = engine.submitEvidence({
      subject,
      session,
      activityId: activityId('activity-exact'),
      response: { kind: 'text', value: 'correct answer' },
    })
    const nextIds = engine.getNextActivityIds({
      subject,
      session: submitted.session,
    })

    expect(() => {
      const progress = submitted.session
        .activityProgress as unknown as unknown[]
      progress.push({ activityId: 'new-activity', status: 'active' })
    }).toThrow(TypeError)
    expect(() => {
      const response = submitted.evidenceEvent.response as unknown as {
        value: string
      }
      response.value = 'mutated'
    }).toThrow(TypeError)
    expect(() => {
      const criteria = submitted.evaluation
        .matchedCriteria as unknown as string[]
      criteria.push('mutated')
    }).toThrow(TypeError)
    expect(() => {
      const mutableNextIds = nextIds as unknown as string[]
      mutableNextIds.push('activity-number')
    }).toThrow(TypeError)
  })
})
