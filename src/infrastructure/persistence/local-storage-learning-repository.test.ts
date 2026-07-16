import { describe, expect, it } from 'vitest'

import {
  ActivityIdSchema,
  ConceptIdSchema,
  EvidenceIdSchema,
  LearnerIdSchema,
  LearnerProfileIdSchema,
  LearningSessionSchema,
  type EvidenceEvent,
  type LearningSession,
} from '../../core/contracts'
import { LearningEngine } from '../../core/engine'
import { learningSubjectFixture } from '../../core/engine/test-fixtures/learning-subject.fixture'
import type { Clock, LearningIdGenerator } from '../../core/ports'
import { LearningRepositoryError } from '../../core/ports'
import { cloneDeep, deepFreeze } from '../../core/foundation'
import {
  LocalStorageLearningRepository,
  type StorageLike,
} from '../persistence'

const learnerId = LearnerIdSchema.parse('demo-learner')
const profileId = LearnerProfileIdSchema.parse('demo-learner')

class FakeStorage implements StorageLike {
  private readonly values = new Map<string, string>()

  failReads = false
  failWrites = false
  failQuota = false

  get length(): number {
    if (this.failReads) {
      throw new Error('read failed')
    }

    return this.values.size
  }

  key(index: number): string | null {
    if (this.failReads) {
      throw new Error('read failed')
    }

    return [...this.values.keys()].sort()[index] ?? null
  }

  getItem(key: string): string | null {
    if (this.failReads) {
      throw new Error('read failed')
    }

    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    if (this.failQuota) {
      throw new DOMException('quota', 'QuotaExceededError')
    }

    if (this.failWrites) {
      throw new Error('write failed')
    }

    this.values.set(key, value)
  }

  setRaw(key: string, value: string): void {
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
    ]),
    idGenerator: new SequenceIds(
      ['session-0'],
      ['evidence-0', 'evidence-1', 'evidence-2'],
    ),
  })
}

function startSession(engine = makeEngine()): LearningSession {
  return cloneDeep(
    engine.startSession({
      subject: learningSubjectFixture(),
      learnerId,
      profileId,
    }),
  ) as LearningSession
}

function storageKey(sessionId = 'session-0'): string {
  return `learnt:learning-session:${sessionId}`
}

function expectRepositoryCode(
  action: () => Promise<unknown>,
  code: LearningRepositoryError['code'],
): Promise<LearningRepositoryError> {
  return action().then(
    () => {
      throw new Error(`Expected repository error ${code}.`)
    },
    (error: unknown) => {
      expect(error).toBeInstanceOf(LearningRepositoryError)
      const repositoryError = error as LearningRepositoryError
      expect(repositoryError.code).toBe(code)
      return repositoryError
    },
  )
}

describe('LocalStorageLearningRepository session records', () => {
  it('creates, stores, restores, and freezes a revision-zero aggregate', async () => {
    const storage = new FakeStorage()
    const repository = new LocalStorageLearningRepository(storage)
    const session = startSession()
    const sourceSession = cloneDeep(session)

    const record = await repository.createSession({
      subjectVersion: '0.1.0',
      session,
    })

    expect(record.revision).toBe(0)
    expect(record.subjectVersion).toBe('0.1.0')
    expect(record.session.id).toBe('session-0')
    expect(record.evidenceEvents).toEqual([])
    expect(Object.isFrozen(record)).toBe(true)
    expect(Object.isFrozen(record.session.activityProgress)).toBe(true)
    expect(session).toEqual(sourceSession)

    const raw = storage.raw(storageKey())
    expect(raw).not.toBeNull()
    expect(JSON.parse(raw ?? '{}')).toMatchObject({
      storageSchemaVersion: '0.1',
      revision: 0,
      subjectVersion: '0.1.0',
      session: { exploration: { parkedConceptIds: [] } },
    })

    const restored = await new LocalStorageLearningRepository(
      storage,
    ).getSession(record.session.id)
    expect(restored).toEqual(record)
    expect(Object.isFrozen(restored?.session.activityProgress[0])).toBe(true)

    await expectRepositoryCode(
      () =>
        repository.createSession({
          subjectVersion: '0.1.0',
          session,
        }),
      'record-already-exists',
    )
  })

  it('loads legacy records with empty exploration and does not rewrite them until the next save', async () => {
    const storage = new FakeStorage()
    const repository = new LocalStorageLearningRepository(storage)
    const subject = learningSubjectFixture()
    const engine = makeEngine()
    const created = await repository.createSession({
      subjectVersion: '0.1.0',
      session: startSession(engine),
    })
    const raw = storage.raw(storageKey())

    if (raw === null) {
      throw new Error('Expected stored session JSON.')
    }

    const legacyRecord = JSON.parse(raw) as {
      session: { exploration?: unknown }
    }
    delete legacyRecord.session.exploration
    storage.setRaw(storageKey(), JSON.stringify(legacyRecord))
    const rawLegacy = storage.raw(storageKey())

    const restored = await repository.getSession(created.session.id)

    expect(restored?.session.exploration.parkedConceptIds).toEqual([])
    expect(storage.raw(storageKey())).toBe(rawLegacy)

    if (restored === null) {
      throw new Error('Expected restored legacy session.')
    }

    const parked = engine.parkConcept({
      subject,
      session: restored.session,
      conceptId: ConceptIdSchema.parse('concept-choice'),
    })
    const saved = await repository.saveSession({
      expectedRevision: restored.revision,
      session: parked,
    })

    expect(saved.revision).toBe(1)
    expect(saved.session.exploration.parkedConceptIds).toEqual([
      'concept-choice',
    ])
    expect(JSON.parse(storage.raw(storageKey()) ?? '{}')).toMatchObject({
      revision: 1,
      session: {
        exploration: { parkedConceptIds: ['concept-choice'] },
      },
    })
    expect(storage.length).toBe(1)
  })

  it('rejects invalid creates and maps write failures without overwriting existing data', async () => {
    const session = startSession()
    const repository = new LocalStorageLearningRepository(new FakeStorage())

    await expectRepositoryCode(
      () => repository.createSession({ subjectVersion: ' ', session }),
      'invalid-record',
    )

    const withEvidenceIds = deepFreeze(
      LearningSessionSchema.parse({
        ...cloneDeep(session),
        evidenceEventIds: [EvidenceIdSchema.parse('evidence-0')],
      }),
    )
    await expectRepositoryCode(
      () =>
        repository.createSession({
          subjectVersion: '0.1.0',
          session: withEvidenceIds,
        }),
      'invalid-record',
    )

    const writeFailureStorage = new FakeStorage()
    const failingRepository = new LocalStorageLearningRepository(
      writeFailureStorage,
    )
    writeFailureStorage.failWrites = true
    await expectRepositoryCode(
      () =>
        failingRepository.createSession({
          subjectVersion: '0.1.0',
          session,
        }),
      'write-failed',
    )
    expect(writeFailureStorage.raw(storageKey())).toBeNull()

    const quotaStorage = new FakeStorage()
    const quotaRepository = new LocalStorageLearningRepository(quotaStorage)
    quotaStorage.failQuota = true
    await expectRepositoryCode(
      () =>
        quotaRepository.createSession({
          subjectVersion: '0.1.0',
          session,
        }),
      'quota-exceeded',
    )
  })

  it('saves non-evidence transitions and rejects stale or identity-changing writes', async () => {
    const storage = new FakeStorage()
    const repository = new LocalStorageLearningRepository(storage)
    const engine = makeEngine()
    const created = await repository.createSession({
      subjectVersion: '0.1.0',
      session: startSession(engine),
    })
    const changedMode = engine.changeInteractionMode({
      session: created.session,
      interactionMode: 'zoom',
    })

    const saved = await repository.saveSession({
      expectedRevision: 0,
      session: changedMode,
    })

    expect(saved.revision).toBe(1)
    expect(saved.subjectVersion).toBe('0.1.0')
    expect(saved.evidenceEvents).toEqual([])
    expect(saved.session.interactionMode).toBe('zoom')

    const staleError = await expectRepositoryCode(
      () =>
        repository.saveSession({
          expectedRevision: 0,
          session: changedMode,
        }),
      'revision-conflict',
    )
    expect(staleError.details).toMatchObject({
      expectedRevision: 0,
      actualRevision: 1,
    })

    const changedIdentity = deepFreeze(
      LearningSessionSchema.parse({
        ...cloneDeep(saved.session),
        learnerId: LearnerIdSchema.parse('other-learner'),
      }),
    )
    await expectRepositoryCode(
      () =>
        repository.saveSession({
          expectedRevision: 1,
          session: changedIdentity,
        }),
      'transaction-invariant-violation',
    )
  })

  it('commits one submission atomically and rejects malformed evidence history changes', async () => {
    const storage = new FakeStorage()
    const repository = new LocalStorageLearningRepository(storage)
    const engine = makeEngine()
    const created = await repository.createSession({
      subjectVersion: '0.1.0',
      session: startSession(engine),
    })
    const submitted = engine.submitEvidence({
      subject: learningSubjectFixture(),
      session: created.session,
      activityId: ActivityIdSchema.parse('activity-exact'),
      response: { kind: 'text', value: 'wrong answer' },
    })

    const committed = await repository.commitSubmission({
      expectedRevision: 0,
      session: submitted.session,
      evidenceEvent: submitted.evidenceEvent,
    })

    expect(committed.revision).toBe(1)
    expect(committed.session.evidenceEventIds).toEqual(['evidence-0'])
    expect(committed.evidenceEvents.map((event) => event.id)).toEqual([
      'evidence-0',
    ])
    expect(committed.evidenceEvents[0]?.timestamp).toBe(
      committed.session.lastActiveAt,
    )
    expect(Object.isFrozen(committed.evidenceEvents[0]?.evaluation)).toBe(true)

    await expectRepositoryCode(
      () =>
        repository.commitSubmission({
          expectedRevision: 1,
          session: submitted.session,
          evidenceEvent: submitted.evidenceEvent,
        }),
      'transaction-invariant-violation',
    )

    const mismatchedEvent = {
      ...cloneDeep(submitted.evidenceEvent),
      learnerId: LearnerIdSchema.parse('other-learner'),
    } as EvidenceEvent
    await expectRepositoryCode(
      () =>
        repository.commitSubmission({
          expectedRevision: 1,
          session: submitted.session,
          evidenceEvent: mismatchedEvent,
        }),
      'transaction-invariant-violation',
    )
  })

  it('reports corrupt records without deleting them and keeps valid records listable', async () => {
    const storage = new FakeStorage()
    const repository = new LocalStorageLearningRepository(storage)
    const session = startSession()
    await repository.createSession({ subjectVersion: '0.1.0', session })
    storage.setRaw('unrelated:key', '{bad')
    storage.setRaw('learnt:learning-session:not valid', '{}')
    storage.setRaw('learnt:learning-session:session-corrupt', '{bad')
    storage.setRaw(
      'learnt:learning-session:session-newer',
      JSON.stringify({ storageSchemaVersion: '9.9' }),
    )

    const scan = await repository.listSessions()

    expect(scan.records.map((record) => record.session.id)).toEqual([
      'session-0',
    ])
    expect(scan.issues.map((issue) => issue.code)).toEqual([
      'invalid-storage-key',
      'corrupt-record',
      'unsupported-storage-version',
    ])
    expect(storage.raw('learnt:learning-session:session-corrupt')).toBe('{bad')
    expect(Object.isFrozen(scan.records)).toBe(true)
    expect(Object.isFrozen(scan.issues)).toBe(true)

    await expectRepositoryCode(
      () =>
        new LocalStorageLearningRepository(
          Object.assign(storage, { failReads: true }),
        ).listSessions(),
      'read-failed',
    )
  })
})
