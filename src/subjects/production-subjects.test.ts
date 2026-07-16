import { describe, expect, it } from 'vitest'

import {
  ActivityIdSchema,
  LearnerIdSchema,
  LearnerProfileIdSchema,
} from '../core/contracts'
import { LearningEngine, type LearningSubject } from '../core/engine'
import type { Clock, LearningIdGenerator } from '../core/ports'
import { createProductionSubjectRegistry } from '../app/subject-registry'
import {
  logicBasicsSubject,
  machineLearningFoundationsSubject,
  movementPlanesSubject,
  productionSubjectAdapters,
} from './index'

const learnerId = LearnerIdSchema.parse('demo-learner')
const profileId = LearnerProfileIdSchema.parse('demo-learner')

class SequenceClock implements Clock {
  private index = 0

  now(): Date {
    const date = new Date(
      `2026-06-22T12:${String(this.index).padStart(2, '0')}:00.000Z`,
    )
    this.index += 1
    return date
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

function makeEngine(): LearningEngine {
  return new LearningEngine({
    clock: new SequenceClock(),
    idGenerator: new SequenceIds(),
  })
}

function activity(
  subject: LearningSubject,
  activityId: string,
): LearningSubject['activities'][number] {
  const found = subject.activities.find(
    (candidate) => candidate.id === activityId,
  )

  if (found === undefined) {
    throw new Error(`Missing activity ${activityId}.`)
  }

  return found
}

function reachableActivityIds(subject: LearningSubject): Set<string> {
  const byId = new Map(
    subject.activities.map((candidate) => [candidate.id, candidate]),
  )
  const orderedModules = [...subject.modules].sort(
    (left, right) => left.order - right.order,
  )
  const firstId = orderedModules.flatMap((module) => module.activityIds)[0]
  const reachable = new Set<string>()
  const queue = firstId === undefined ? [] : [firstId]

  while (queue.length > 0) {
    const nextId = queue.shift()

    if (nextId === undefined || reachable.has(nextId)) {
      continue
    }

    reachable.add(nextId)
    queue.push(...(byId.get(nextId)?.nextActivityIds ?? []))
  }

  return reachable
}

describe('production subjects', () => {
  it('registers production subjects in product order', () => {
    const registry = createProductionSubjectRegistry()
    const listed = registry.list()

    expect(listed.map((adapter) => adapter.subject.id)).toEqual([
      'logic-basics',
      'movement-planes',
      'machine-learning-foundations',
    ])
    expect(
      productionSubjectAdapters.map((adapter) => adapter.subject.title),
    ).toEqual([
      'Logic Basics',
      'Movement Planes',
      'Machine Learning Foundations',
    ])
    expect(Object.isFrozen(productionSubjectAdapters)).toBe(true)
    expect(createProductionSubjectRegistry()).not.toBe(registry)
  })

  it.each([
    [logicBasicsSubject, [0, 10], 5, 4, 8],
    [movementPlanesSubject, [0, 10], 5, 4, 8],
    [machineLearningFoundationsSubject, [0, 10, 20, 30, 40, 50], 60, 18, 33],
  ] as const)(
    'keeps %s authored package valid, immutable, reachable, and extension-free',
    (
      subject,
      expectedModuleOrders,
      minimumConcepts,
      minimumObjectives,
      minimumActivities,
    ) => {
      expect(subject.schemaVersion).toBe('0.1')
      expect(subject.version).toBe('0.1.0')
      expect(subject.modules.map((module) => module.order)).toEqual(
        expectedModuleOrders,
      )
      expect(subject.concepts.length).toBeGreaterThanOrEqual(minimumConcepts)
      expect(subject.objectives.length).toBeGreaterThanOrEqual(
        minimumObjectives,
      )
      expect(subject.activities.length).toBeGreaterThanOrEqual(
        minimumActivities,
      )
      expect(subject.extensions).toEqual([])
      expect(Object.isFrozen(subject)).toBe(true)
      expect(Object.isFrozen(subject.activities[0])).toBe(true)
      expect(
        subject.activities.some(
          (candidate) => candidate.nextActivityIds.length === 0,
        ),
      ).toBe(true)

      const reachable = reachableActivityIds(subject)
      expect([...reachable].sort()).toEqual(
        subject.activities.map((candidate) => candidate.id).sort(),
      )
      expect(
        subject.objectives.every(
          (objective) => objective.conceptIds.length > 0,
        ),
      ).toBe(true)
      expect(
        subject.activities.every(
          (candidate) => candidate.objectiveIds.length > 0,
        ),
      ).toBe(true)
    },
  )

  it('runs the Logic Basics branch path through the shared engine', () => {
    const engine = makeEngine()
    let session = engine.startSession({
      subject: logicBasicsSubject,
      learnerId,
      profileId,
    })

    const negation = activity(logicBasicsSubject, 'predict-negation')
    expect(negation.evaluation).toMatchObject({
      kind: 'choice-selection',
      correctOptionIds: ['option-false'],
    })
    const conjunction = activity(logicBasicsSubject, 'predict-conjunction')
    expect(conjunction.evaluation).toMatchObject({
      kind: 'choice-selection',
      correctOptionIds: ['option-false'],
    })
    const disjunction = activity(logicBasicsSubject, 'predict-disjunction')
    expect(disjunction.evaluation).toMatchObject({
      kind: 'choice-selection',
      correctOptionIds: ['option-true'],
    })

    session = engine.submitEvidence({
      subject: logicBasicsSubject,
      session,
      activityId: ActivityIdSchema.parse('orient-boolean-values'),
      response: { kind: 'manual', completed: true },
    }).session
    session = engine.advanceSession({ subject: logicBasicsSubject, session })
    session = engine.submitEvidence({
      subject: logicBasicsSubject,
      session,
      activityId: ActivityIdSchema.parse('predict-negation'),
      response: { kind: 'single-choice', optionId: 'option-false' },
    }).session
    session = engine.advanceSession({ subject: logicBasicsSubject, session })
    session = engine.submitEvidence({
      subject: logicBasicsSubject,
      session,
      activityId: ActivityIdSchema.parse('recall-boolean-values'),
      response: {
        kind: 'multiple-choice',
        optionIds: ['option-true', 'option-false'],
      },
    }).session
    session = engine.advanceSession({ subject: logicBasicsSubject, session })
    session = engine.submitEvidence({
      subject: logicBasicsSubject,
      session,
      activityId: ActivityIdSchema.parse('orient-compound-conditions'),
      response: { kind: 'manual', completed: true },
    }).session
    session = engine.advanceSession({ subject: logicBasicsSubject, session })
    session = engine.submitEvidence({
      subject: logicBasicsSubject,
      session,
      activityId: ActivityIdSchema.parse('predict-conjunction'),
      response: { kind: 'single-choice', optionId: 'option-false' },
    }).session
    session = engine.advanceSession({ subject: logicBasicsSubject, session })
    session = engine.submitEvidence({
      subject: logicBasicsSubject,
      session,
      activityId: ActivityIdSchema.parse('predict-disjunction'),
      response: { kind: 'single-choice', optionId: 'option-true' },
    }).session

    expect(
      engine.getNextActivityIds({ subject: logicBasicsSubject, session }),
    ).toEqual(['debug-access-rule', 'transfer-release-gate'])
  })

  it('runs Movement Planes deterministic and ungraded transfer behavior through the shared engine', () => {
    const engine = makeEngine()
    let session = engine.startSession({
      subject: movementPlanesSubject,
      learnerId,
      profileId,
    })

    expect(
      activity(movementPlanesSubject, 'predict-squat-plane').evaluation,
    ).toMatchObject({
      correctOptionIds: ['option-sagittal'],
    })
    expect(
      activity(movementPlanesSubject, 'predict-jumping-jack-plane').evaluation,
    ).toMatchObject({ correctOptionIds: ['option-frontal'] })
    expect(
      activity(movementPlanesSubject, 'predict-trunk-rotation-plane')
        .evaluation,
    ).toMatchObject({ correctOptionIds: ['option-transverse'] })

    const path = [
      ['orient-anatomical-planes', { kind: 'manual', completed: true }],
      [
        'predict-squat-plane',
        { kind: 'single-choice', optionId: 'option-sagittal' },
      ],
      [
        'predict-jumping-jack-plane',
        { kind: 'single-choice', optionId: 'option-frontal' },
      ],
      [
        'predict-trunk-rotation-plane',
        { kind: 'single-choice', optionId: 'option-transverse' },
      ],
      ['orient-primary-plane', { kind: 'manual', completed: true }],
      [
        'classify-forward-lunge',
        { kind: 'single-choice', optionId: 'option-sagittal' },
      ],
      [
        'debug-plane-classification',
        {
          kind: 'multiple-choice',
          optionIds: ['option-transverse-component', 'option-not-exclusive'],
        },
      ],
    ] as const

    for (const [activityId, response] of path) {
      session = engine.submitEvidence({
        subject: movementPlanesSubject,
        session,
        activityId: ActivityIdSchema.parse(activityId),
        response,
      }).session
      session = engine.advanceSession({
        subject: movementPlanesSubject,
        session,
      })
    }

    const transfer = engine.submitEvidence({
      subject: movementPlanesSubject,
      session,
      activityId: ActivityIdSchema.parse('transfer-lunge-with-rotation'),
      response: {
        kind: 'text',
        value: 'The lunge is sagittal and the trunk rotation is transverse.',
      },
    })

    expect(transfer.evaluation.status).toBe('ungraded')
    expect(transfer.activityCompleted).toBe(true)
  })
})
