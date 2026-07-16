import { describe, expect, it } from 'vitest'

import {
  ActivityIdSchema,
  ConceptIdSchema,
  LearnerIdSchema,
  LearnerProfileIdSchema,
  SessionIdSchema,
} from '../core/contracts'
import { LearningEngine } from '../core/engine'
import { learningSubjectFixture } from '../core/engine/test-fixtures/learning-subject.fixture'
import type { Clock, LearningIdGenerator } from '../core/ports'
import type { LearningRepositoryError } from '../core/ports'
import {
  LocalStorageLearningRepository,
  type StorageLike,
} from '../infrastructure'
import type { LearningApplicationError } from './index'
import { PersistentLearningService } from './index'

const learnerId = LearnerIdSchema.parse('demo-learner')
const profileId = LearnerProfileIdSchema.parse('demo-learner')

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
}

class SequenceClock implements Clock {
  private readonly dates: readonly Date[]
  private index = 0

  constructor(dates: readonly Date[]) {
    this.dates = dates
  }

  now(): Date {
    const date = this.dates[this.index]

    if (date === undefined) {
      throw new Error('Missing fake clock date.')
    }

    this.index += 1
    return date
  }
}

class SequenceIds implements LearningIdGenerator {
  private readonly sessionIds: readonly string[]
  private readonly evidenceIds: readonly string[]
  private sessionIndex = 0
  private evidenceIndex = 0

  constructor(sessionIds: readonly string[], evidenceIds: readonly string[]) {
    this.sessionIds = sessionIds
    this.evidenceIds = evidenceIds
  }

  createSessionId(): string {
    const id = this.sessionIds[this.sessionIndex]

    if (id === undefined) {
      throw new Error('Missing fake session ID.')
    }

    this.sessionIndex += 1
    return id
  }

  createEvidenceId(): string {
    const id = this.evidenceIds[this.evidenceIndex]

    if (id === undefined) {
      throw new Error('Missing fake evidence ID.')
    }

    this.evidenceIndex += 1
    return id
  }
}

function makeEngine(): LearningEngine {
  return new LearningEngine({
    clock: new SequenceClock([
      new Date('2026-06-22T12:00:00.000Z'),
      new Date('2026-06-22T12:01:00.000Z'),
      new Date('2026-06-22T12:02:00.000Z'),
      new Date('2026-06-22T12:03:00.000Z'),
      new Date('2026-06-22T12:04:00.000Z'),
      new Date('2026-06-22T12:05:00.000Z'),
    ]),
    idGenerator: new SequenceIds(
      ['session-0'],
      ['evidence-0', 'evidence-1', 'evidence-2'],
    ),
  })
}

function makeService(storage = new FakeStorage()): PersistentLearningService {
  return new PersistentLearningService({
    engine: makeEngine(),
    repository: new LocalStorageLearningRepository(storage),
  })
}

describe('PersistentLearningService', () => {
  it('persists a full reload-safe session workflow without React', async () => {
    const storage = new FakeStorage()
    const subject = learningSubjectFixture()
    const service = makeService(storage)

    const started = await service.startSession({
      subject,
      learnerId,
      profileId,
    })
    expect(started.revision).toBe(0)
    expect(started.subjectVersion).toBe(subject.version)

    const incorrect = await service.submitEvidence({
      subject,
      sessionId: started.session.id,
      activityId: ActivityIdSchema.parse('activity-exact'),
      response: { kind: 'text', value: 'wrong answer' },
    })
    expect(incorrect.record.revision).toBe(1)
    expect(incorrect.evaluation.status).toBe('retry')

    const retry = await service.submitEvidence({
      subject,
      sessionId: started.session.id,
      activityId: ActivityIdSchema.parse('activity-exact'),
      response: { kind: 'text', value: 'correct answer' },
    })
    expect(retry.record.revision).toBe(2)
    expect(retry.record.evidenceEvents.map((event) => event.id)).toEqual([
      'evidence-0',
      'evidence-1',
    ])

    const advanced = await service.advanceSession({
      subject,
      sessionId: started.session.id,
    })
    expect(advanced.revision).toBe(3)
    expect(advanced.session.currentActivityId).toBe('activity-single')

    const restoredService = makeService(storage)
    const restored = await restoredService.getSession(started.session.id)

    expect(restored?.session.id).toBe(started.session.id)
    expect(restored?.revision).toBe(3)
    expect(restored?.session.currentActivityId).toBe('activity-single')
    expect(restored?.session.interactionMode).toBe('coach')
    expect(restored?.evidenceEvents.map((event) => event.id)).toEqual([
      'evidence-0',
      'evidence-1',
    ])
    expect(
      restored?.evidenceEvents.map((event) => event.evaluation.status),
    ).toEqual(['retry', 'passed'])
    expect(restored?.subjectVersion).toBe('0.1.0')
  })

  it('rejects missing sessions and subject-version mismatches before engine transitions', async () => {
    const subject = learningSubjectFixture()
    const service = makeService()

    await expect(
      service.submitEvidence({
        subject,
        sessionId: SessionIdSchema.parse('session-missing'),
        activityId: ActivityIdSchema.parse('activity-exact'),
        response: { kind: 'text', value: 'correct answer' },
      }),
    ).rejects.toMatchObject({ code: 'session-not-found' })

    const started = await service.startSession({
      subject,
      learnerId,
      profileId,
    })
    const incompatibleSubject = { ...subject, version: '0.2.0' }

    await expect(
      service.submitEvidence({
        subject: incompatibleSubject,
        sessionId: started.session.id,
        activityId: ActivityIdSchema.parse('activity-exact'),
        response: { kind: 'text', value: 'correct answer' },
      }),
    ).rejects.toMatchObject({
      code: 'subject-version-mismatch',
    } satisfies Partial<LearningApplicationError>)
  })

  it('persists mode changes and abandonment without requiring subject content', async () => {
    const subject = learningSubjectFixture()
    const service = makeService()
    const started = await service.startSession({
      subject,
      learnerId,
      profileId,
    })

    const modeChanged = await service.changeInteractionMode({
      sessionId: started.session.id,
      interactionMode: 'zoom',
    })
    expect(modeChanged.revision).toBe(1)
    expect(modeChanged.session.interactionMode).toBe('zoom')
    expect(modeChanged.evidenceEvents).toEqual([])

    const abandoned = await service.abandonSession({
      sessionId: started.session.id,
    })
    expect(abandoned.revision).toBe(2)
    expect(abandoned.session.status).toBe('abandoned')

    const listed = await service.listSessions()
    expect(listed.records.map((record) => record.session.id)).toEqual([
      started.session.id,
    ])
  })

  it('persists parked paths through saveSession without changing evidence history', async () => {
    const storage = new FakeStorage()
    const subject = learningSubjectFixture()
    const service = makeService(storage)
    const started = await service.startSession({
      subject,
      learnerId,
      profileId,
    })

    const parkedSignal = await service.parkConcept({
      subject,
      sessionId: started.session.id,
      conceptId: ConceptIdSchema.parse('concept-signal'),
    })
    const parkedChoice = await service.parkConcept({
      subject,
      sessionId: started.session.id,
      conceptId: ConceptIdSchema.parse('concept-choice'),
    })
    const unparkedSignal = await service.unparkConcept({
      subject,
      sessionId: started.session.id,
      conceptId: ConceptIdSchema.parse('concept-signal'),
    })

    expect(parkedSignal.revision).toBe(1)
    expect(parkedChoice.revision).toBe(2)
    expect(parkedChoice.session.exploration.parkedConceptIds).toEqual([
      'concept-signal',
      'concept-choice',
    ])
    expect(unparkedSignal.revision).toBe(3)
    expect(unparkedSignal.session.exploration.parkedConceptIds).toEqual([
      'concept-choice',
    ])
    expect(unparkedSignal.evidenceEvents).toEqual([])
    expect(unparkedSignal.session.evidenceEventIds).toEqual([])
    expect(unparkedSignal.subjectVersion).toBe(subject.version)

    const restored = await makeService(storage).getSession(started.session.id)
    expect(restored?.revision).toBe(3)
    expect(restored?.session.exploration.parkedConceptIds).toEqual([
      'concept-choice',
    ])
    expect(
      storage.raw(`learnt:learning-session:${started.session.id}`),
    ).toContain('"parkedConceptIds":["concept-choice"]')
  })

  it('surfaces repository revision conflicts without automatic retry', async () => {
    const storage = new FakeStorage()
    const repository = new LocalStorageLearningRepository(storage)
    const service = new PersistentLearningService({
      engine: makeEngine(),
      repository,
    })
    const subject = learningSubjectFixture()
    const started = await service.startSession({
      subject,
      learnerId,
      profileId,
    })
    const readerA = await repository.getSession(started.session.id)
    const readerB = await repository.getSession(started.session.id)

    if (readerA === null || readerB === null) {
      throw new Error('Expected both readers to load the session.')
    }

    const engine = makeEngine()
    const changedA = engine.changeInteractionMode({
      session: readerA.session,
      interactionMode: 'flow',
    })
    await repository.saveSession({
      expectedRevision: readerA.revision,
      session: changedA,
    })

    const changedB = engine.changeInteractionMode({
      session: readerB.session,
      interactionMode: 'zoom',
    })
    await expect(
      repository.saveSession({
        expectedRevision: readerB.revision,
        session: changedB,
      }),
    ).rejects.toMatchObject({
      code: 'revision-conflict',
      details: { expectedRevision: 0, actualRevision: 1 },
    } satisfies Partial<LearningRepositoryError>)

    const stored = await repository.getSession(started.session.id)
    expect(stored?.revision).toBe(1)
    expect(stored?.session.interactionMode).toBe('flow')
  })
})
