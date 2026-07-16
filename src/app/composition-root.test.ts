import { describe, expect, it, vi } from 'vitest'

import { SubjectIdSchema } from '../core/contracts'
import type { Clock, LearningIdGenerator } from '../core/ports'
import {
  LocalStorageLearningRepository,
  type StorageLike,
} from '../infrastructure'
import { composeLearntApplication } from './index'

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

describe('composeLearntApplication', () => {
  it('creates a usable facade with production subjects and demo learner profile', async () => {
    const repository = new LocalStorageLearningRepository(new FakeStorage())
    const application = composeLearntApplication({
      clock: new SequenceClock(),
      idGenerator: new SequenceIds(),
      repository,
    })

    expect(application.getLearner()).toMatchObject({
      learnerId: 'demo-learner',
      profileId: 'demo-learner-v1',
    })
    expect(application.listSubjects().map((subject) => subject.id)).toEqual([
      'logic-basics',
      'movement-planes',
      'machine-learning-foundations',
    ])

    const context = await application.startSession({
      subjectId: SubjectIdSchema.parse('logic-basics'),
    })
    const recomposed = composeLearntApplication({
      clock: new SequenceClock(),
      idGenerator: new SequenceIds(),
      repository,
    })

    expect(
      await recomposed.getSessionContext(context.record.session.id),
    ).toMatchObject({
      subject: { id: 'logic-basics' },
      learner: { learnerId: 'demo-learner' },
    })
  })

  it('returns separate facade instances and does not access browser globals', () => {
    vi.stubGlobal('crypto', undefined)
    vi.stubGlobal('localStorage', undefined)
    try {
      const first = composeLearntApplication({
        clock: new SequenceClock(),
        idGenerator: new SequenceIds(),
        repository: new LocalStorageLearningRepository(new FakeStorage()),
      })
      const second = composeLearntApplication({
        clock: new SequenceClock(),
        idGenerator: new SequenceIds(),
        repository: new LocalStorageLearningRepository(new FakeStorage()),
      })

      expect(first).not.toBe(second)
      expect(first.listSubjects()).toHaveLength(3)
      expect(second.listSubjects()).toHaveLength(3)
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
