import { describe, expect, it } from 'vitest'

import {
  ActivityIdSchema,
  LearnerIdSchema,
  LearnerProfileIdSchema,
  type ActivityId,
} from '../../core/contracts'
import { LearningEngine, type LearningSubject } from '../../core/engine'
import type { Clock, LearningIdGenerator } from '../../core/ports'
import { machineLearningFoundationsSubject } from './index'

const learnerId = LearnerIdSchema.parse('demo-learner')
const profileId = LearnerProfileIdSchema.parse('demo-learner')

class SequenceClock implements Clock {
  private index = 0

  now(): Date {
    const date = new Date(Date.UTC(2026, 5, 22, 12, 0, 0) + this.index * 60_000)
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

function activity(activityId: string): LearningSubject['activities'][number] {
  const found = machineLearningFoundationsSubject.activities.find(
    (candidate) => candidate.id === activityId,
  )

  if (found === undefined) {
    throw new Error(`Missing activity ${activityId}.`)
  }

  return found
}

function responseFor(activityId: ActivityId): unknown {
  switch (activityId) {
    case 'orient-learning-loop':
    case 'orient-linear-prediction':
    case 'orient-loss-and-gradient':
    case 'orient-classification-scores':
    case 'orient-generalization':
    case 'orient-deep-learning-bridge':
      return { kind: 'manual', completed: true }
    case 'predict-serving-update':
      return { kind: 'single-choice', optionId: 'option-inference-no-update' }
    case 'classify-system-parts':
      return {
        kind: 'multiple-choice',
        optionIds: ['option-practice-minutes', 'option-gear-score'],
      }
    case 'debug-vague-ml-task':
      return {
        kind: 'multiple-choice',
        optionIds: [
          'option-example-unit',
          'option-target',
          'option-evaluation',
        ],
      }
    case 'transfer-build-risk-frame':
      return {
        kind: 'text',
        value:
          'Each pull request is an example. Features include changed files and recent failed tests. Target is build passed, checked by validation accuracy.',
      }
    case 'calculate-linear-prediction':
      return { kind: 'number', value: 7 }
    case 'predict-weight-change':
      return { kind: 'single-choice', optionId: 'option-increases-three' }
    case 'calculate-residual':
      return { kind: 'number', value: -2 }
    case 'transfer-jump-linear-model':
      return {
        kind: 'text',
        value:
          'x is training sessions, 1.5 is the weight, 10 is the bias, y_hat is predicted jump height, and residual is prediction minus measured target.',
      }
    case 'calculate-mse':
      return { kind: 'number', value: 1 }
    case 'choose-gradient-direction':
      return { kind: 'single-choice', optionId: 'option-decrease-theta' }
    case 'apply-gradient-step':
      return { kind: 'number', value: 1.7 }
    case 'diagnose-large-learning-rate':
      return {
        kind: 'single-choice',
        optionId: 'option-learning-rate-too-large',
      }
    case 'debug-training-loop-order':
      return {
        kind: 'single-choice',
        optionId: 'option-step-before-backward',
      }
    case 'recall-batch-epoch':
      return {
        kind: 'multiple-choice',
        optionIds: ['option-batch-subset', 'option-epoch-pass'],
      }
    case 'predict-positive-logit':
      return { kind: 'single-choice', optionId: 'option-above-half' }
    case 'predict-threshold-lowering':
      return { kind: 'single-choice', optionId: 'option-more-positives' }
    case 'debug-probability-confusion':
      return { kind: 'single-choice', optionId: 'option-not-proof' }
    case 'explain-bce-penalty':
      return {
        kind: 'text',
        value:
          'The prediction is confidently wrong, so the classification loss should penalize it strongly even before final metric reporting.',
      }
    case 'diagnose-overfitting':
      return { kind: 'single-choice', optionId: 'option-overfitting' }
    case 'diagnose-underfitting':
      return { kind: 'single-choice', optionId: 'option-underfitting' }
    case 'identify-leakage':
      return { kind: 'single-choice', optionId: 'option-leakage' }
    case 'select-recall-metric':
      return { kind: 'single-choice', optionId: 'option-recall' }
    case 'transfer-evaluation-plan':
      return {
        kind: 'text',
        value:
          'Use a simple majority baseline, tune on validation, reserve test for final reporting, track recall, and reject post-outcome features as leakage.',
      }
    case 'predict-stacked-linear-functions':
      return { kind: 'single-choice', optionId: 'option-still-linear' }
    case 'trace-computational-graph':
      return {
        kind: 'multiple-choice',
        optionIds: ['option-z-depends', 'option-loss-depends'],
      }
    case 'explain-autograd-training-code':
      return {
        kind: 'code',
        language: 'python',
        source:
          '# Forward pass computes predictions and loss.\n# loss.backward computes gradients through dependencies.\n# optimizer.step updates parameters.',
      }
    case 'transfer-loop-to-transformer':
      return {
        kind: 'text',
        value:
          'Data becomes representations, the transformer is the parameterized model, predictions are compared to an objective, gradients update parameters, and evaluation checks behavior. Recipes vary.',
      }
    default:
      throw new Error(`No test response for ${activityId}.`)
  }
}

function reachTarget(targetActivityId: string) {
  const engine = makeEngine()
  let session = engine.startSession({
    subject: machineLearningFoundationsSubject,
    learnerId,
    profileId,
  })

  while (session.currentActivityId !== targetActivityId) {
    if (session.currentActivityId === null) {
      throw new Error(`Session completed before ${targetActivityId}.`)
    }

    const submitted = engine.submitEvidence({
      subject: machineLearningFoundationsSubject,
      session,
      activityId: session.currentActivityId,
      response: responseFor(session.currentActivityId),
    })
    session = engine.advanceSession({
      subject: machineLearningFoundationsSubject,
      session: submitted.session,
    })
  }

  return { engine, session }
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

function countOf<T extends string>(values: readonly T[], target: T): number {
  return values.filter((value) => value === target).length
}

describe('Machine Learning Foundations subject package', () => {
  it('defines the expected production package shape and stable ordering', () => {
    expect(machineLearningFoundationsSubject).toMatchObject({
      schemaVersion: '0.1',
      id: 'machine-learning-foundations',
      version: '0.1.0',
      title: 'Machine Learning Foundations',
      extensions: [],
    })
    expect(Object.isFrozen(machineLearningFoundationsSubject)).toBe(true)
    expect(
      Object.isFrozen(machineLearningFoundationsSubject.activities[0]),
    ).toBe(true)
    expect(
      machineLearningFoundationsSubject.modules.map((module) => module.id),
    ).toEqual([
      'the-learning-system',
      'linear-models-as-functions',
      'loss-gradients-and-optimization',
      'classification-scores-and-probability',
      'generalization-and-evaluation',
      'bridge-to-deep-learning',
    ])
    expect(
      machineLearningFoundationsSubject.modules.map((module) => module.order),
    ).toEqual([0, 10, 20, 30, 40, 50])
    expect(machineLearningFoundationsSubject.activities).toHaveLength(33)
    expect(machineLearningFoundationsSubject.objectives).toHaveLength(18)
  })

  it('covers the required concepts and observable objectives', () => {
    const conceptIds = new Set<string>(
      machineLearningFoundationsSubject.concepts.map((concept) => concept.id),
    )
    for (const conceptId of [
      'learning-problem',
      'example',
      'feature',
      'target',
      'dataset',
      'representation',
      'model',
      'parameter',
      'hyperparameter',
      'training',
      'inference',
      'linear-model',
      'prediction',
      'residual',
      'mean-squared-error',
      'gradient',
      'gradient-descent',
      'learning-rate',
      'binary-classification',
      'logit',
      'sigmoid',
      'probability',
      'decision-threshold',
      'binary-cross-entropy',
      'generalization',
      'underfitting',
      'overfitting',
      'data-leakage',
      'regularization',
      'baseline',
      'precision',
      'recall',
      'computational-graph',
      'backpropagation',
      'automatic-differentiation',
      'neural-network',
    ]) {
      expect(conceptIds.has(conceptId)).toBe(true)
    }
    expect(machineLearningFoundationsSubject.concepts.length).toBeGreaterThan(
      55,
    )
    expect(
      machineLearningFoundationsSubject.objectives.every(
        (objective) => objective.conceptIds.length > 0,
      ),
    ).toBe(true)
    expect(
      machineLearningFoundationsSubject.activities.every(
        (candidate) => candidate.objectiveIds.length > 0,
      ),
    ).toBe(true)

    const vagueObjectives = machineLearningFoundationsSubject.objectives.filter(
      (objective) =>
        /^(understand|learn|know)\b/i.test(objective.statement.trim()),
    )
    expect(vagueObjectives).toEqual([])
  })

  it('keeps authored references, module ownership, and activity sequencing complete', () => {
    const moduleActivityIds = machineLearningFoundationsSubject.modules.flatMap(
      (module) => module.activityIds,
    )
    const activityIds = machineLearningFoundationsSubject.activities.map(
      (candidate) => candidate.id,
    )
    const reachable = reachableActivityIds(machineLearningFoundationsSubject)

    expect(moduleActivityIds).toEqual(activityIds)
    expect([...new Set(moduleActivityIds)]).toHaveLength(
      moduleActivityIds.length,
    )
    expect([...reachable].sort()).toEqual([...activityIds].sort())
    expect(
      machineLearningFoundationsSubject.activities.some(
        (candidate) => candidate.nextActivityIds.length === 0,
      ),
    ).toBe(true)
    expect(
      machineLearningFoundationsSubject.modules.every(
        (module) => module.activityIds.length > 0,
      ),
    ).toBe(true)
  })

  it('meets the curriculum activity and response distribution requirements', () => {
    const activityKinds = machineLearningFoundationsSubject.activities.map(
      (candidate) => candidate.kind,
    )
    const scaffoldLevels = machineLearningFoundationsSubject.activities.map(
      (candidate) => candidate.scaffoldLevel,
    )
    const responseKinds = machineLearningFoundationsSubject.activities.map(
      (candidate) => candidate.response?.kind ?? 'manual',
    )
    const evaluationKinds = machineLearningFoundationsSubject.activities.map(
      (candidate) => candidate.evaluation.kind,
    )

    expect(countOf(activityKinds, 'predict')).toBeGreaterThanOrEqual(6)
    expect(countOf(activityKinds, 'debug')).toBeGreaterThanOrEqual(4)
    expect(countOf(activityKinds, 'recall')).toBeGreaterThanOrEqual(4)
    expect(countOf(activityKinds, 'transfer')).toBeGreaterThanOrEqual(4)
    expect(countOf(responseKinds, 'number')).toBeGreaterThanOrEqual(4)
    expect(countOf(responseKinds, 'multiple-choice')).toBeGreaterThanOrEqual(2)
    expect(
      countOf(evaluationKinds, 'rubric-assisted-text'),
    ).toBeGreaterThanOrEqual(2)
    expect(
      countOf(evaluationKinds, 'manual-completion'),
    ).toBeGreaterThanOrEqual(2)
    expect(countOf(scaffoldLevels, 'worked')).toBeGreaterThan(0)
    expect(countOf(scaffoldLevels, 'completion')).toBeGreaterThan(0)
    expect(countOf(scaffoldLevels, 'guided')).toBeGreaterThan(0)
    expect(countOf(scaffoldLevels, 'independent')).toBeGreaterThan(0)
    expect(countOf(scaffoldLevels, 'transfer')).toBeGreaterThan(0)
  })

  it('keeps activities compact, generic, and learner-agnostic', () => {
    const serializedSubject = JSON.stringify(
      machineLearningFoundationsSubject,
    ).toLowerCase()
    expect(serializedSubject).not.toContain('demo-learner')
    expect(serializedSubject).not.toContain('audhd')
    expect(serializedSubject).not.toContain('profile')
    expect(serializedSubject).not.toContain('custom')
    expect(serializedSubject).not.toContain('pytorch runtime')
    expect(serializedSubject).not.toContain('answer key')

    const emptyBlockActivities = machineLearningFoundationsSubject.activities
      .filter((candidate) =>
        candidate.blocks.some((block) =>
          Object.values(block).some(
            (value) => typeof value === 'string' && value.trim().length === 0,
          ),
        ),
      )
      .map((candidate) => candidate.id)
    expect(emptyBlockActivities).toEqual([])
  })
})

describe('Machine Learning Foundations answer-key smoke tests', () => {
  it.each([
    ['calculate-linear-prediction', { kind: 'number', value: 7 }],
    ['calculate-mse', { kind: 'number', value: 1 }],
    ['apply-gradient-step', { kind: 'number', value: 1.7 }],
  ] as const)(
    'accepts the numeric checkpoint for %s',
    (activityId, response) => {
      const { engine, session } = reachTarget(activityId)
      const result = engine.submitEvidence({
        subject: machineLearningFoundationsSubject,
        session,
        activityId: ActivityIdSchema.parse(activityId),
        response,
      })

      expect(result.evaluation.status).toBe('passed')
      expect(result.activityCompleted).toBe(true)
    },
  )

  it('persists retry then passed evidence for training versus inference', () => {
    const { engine, session } = reachTarget('predict-serving-update')

    const retry = engine.submitEvidence({
      subject: machineLearningFoundationsSubject,
      session,
      activityId: ActivityIdSchema.parse('predict-serving-update'),
      response: { kind: 'single-choice', optionId: 'option-update-weights' },
    })
    const passed = engine.submitEvidence({
      subject: machineLearningFoundationsSubject,
      session: retry.session,
      activityId: ActivityIdSchema.parse('predict-serving-update'),
      response: responseFor(ActivityIdSchema.parse('predict-serving-update')),
    })

    expect(retry.evaluation.status).toBe('retry')
    expect(passed.evaluation.status).toBe('passed')
    expect(passed.session.evidenceEventIds).toEqual([
      'evidence-0',
      'evidence-1',
      'evidence-2',
    ])
  })

  it.each([
    ['diagnose-large-learning-rate', 'option-learning-rate-too-large'],
    ['diagnose-overfitting', 'option-overfitting'],
    ['identify-leakage', 'option-leakage'],
    ['predict-threshold-lowering', 'option-more-positives'],
    ['predict-stacked-linear-functions', 'option-still-linear'],
  ] as const)(
    'authors the intended deterministic answer for %s',
    (activityId, optionId) => {
      expect(activity(activityId).evaluation).toMatchObject({
        kind: 'choice-selection',
        correctOptionIds: [optionId],
      })

      const { engine, session } = reachTarget(activityId)
      const result = engine.submitEvidence({
        subject: machineLearningFoundationsSubject,
        session,
        activityId: ActivityIdSchema.parse(activityId),
        response: { kind: 'single-choice', optionId },
      })
      expect(result.evaluation.status).toBe('passed')
    },
  )

  it('records the neural-network bridge as ungraded evidence while preserving the loop criteria', () => {
    const bridge = activity('transfer-loop-to-transformer')
    expect(bridge.evaluation.kind).toBe('rubric-assisted-text')

    if (bridge.evaluation.kind !== 'rubric-assisted-text') {
      throw new Error('Expected rubric-assisted bridge evaluation.')
    }

    expect(bridge.evaluation.criteria).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'maps-loop-parts', required: true }),
        expect.objectContaining({ id: 'preserves-foundation', required: true }),
        expect.objectContaining({ id: 'avoids-overclaim', required: true }),
      ]),
    )

    const { engine, session } = reachTarget('transfer-loop-to-transformer')
    const result = engine.submitEvidence({
      subject: machineLearningFoundationsSubject,
      session,
      activityId: ActivityIdSchema.parse('transfer-loop-to-transformer'),
      response: responseFor(
        ActivityIdSchema.parse('transfer-loop-to-transformer'),
      ),
    })

    expect(result.evaluation.status).toBe('ungraded')
    expect(result.activityCompleted).toBe(true)
  })
})
