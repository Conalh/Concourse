import { createLogicFoundationsRelease } from '@learnt/learning-pack-contracts'
import { describe, expect, it } from 'vitest'

import { composeLearntApplication } from '../app'
import { ActivityIdSchema } from '../core/contracts'
import type { Clock, LearningIdGenerator } from '../core/ports'
import {
  LocalStorageLearningRepository,
  type StorageLike,
} from '../infrastructure'
import { installLearningPackDocuments } from '../learning-packs/learnt-importer'

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
      `2026-06-23T12:${String(this.index).padStart(2, '0')}:00.000Z`,
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

function createPracticeApplication() {
  return composeLearntApplication({
    clock: new SequenceClock(),
    idGenerator: new SequenceIds(),
    repository: new LocalStorageLearningRepository(new FakeStorage()),
    installedLearningPacks: [
      installLearningPackDocuments(createLogicFoundationsRelease('2.0.0')),
    ],
  })
}

describe('LearntApplication practice sessions', () => {
  it('starts a flashcard practice session as native Learnt evidence without deterministic correctness', async () => {
    const application = createPracticeApplication()
    const plan = await application.createPracticePlan({
      scope: {
        kind: 'study-set',
        packId: 'learnt.logic-foundations',
        studySetId: 'set-logic-flashcards',
      },
      mode: 'flashcard',
      selectionStrategy: 'authored-order',
      count: 1,
      origin: { kind: 'library', returnRoute: '#/practice' },
    })

    expect(plan.selectedItemIds).toEqual(['item-truth-values-flashcard'])

    const started = await application.startPracticeSession(plan.request)

    expect(started.plan.planId).toBe(plan.planId)
    expect(
      started.context.record.session.exploration.learningFlow,
    ).toMatchObject({
      kind: 'practice-plan',
      packId: 'learnt.logic-foundations',
      packVersion: '2.0.0',
      planId: plan.planId,
      title: 'Logic Flashcards',
      origin: { kind: 'library', returnRoute: '#/practice' },
    })
    expect(started.context.practice).toMatchObject({
      planId: plan.planId,
      currentItem: {
        itemId: 'item-truth-values-flashcard',
        resolvedMode: 'flashcard',
        selfGradeScale: ['again', 'hard', 'good', 'easy'],
      },
    })
    expect(started.context.practice?.currentItem?.backBlocks.length).toBe(2)
    expect(started.context.currentActivity).toMatchObject({
      id: 'item-truth-values-flashcard',
      response: {
        kind: 'confidence',
        lowLabel: 'Again',
        highLabel: 'Easy',
      },
      evaluation: {
        kind: 'extension',
        evaluatorKey: 'learnt.practice-flashcard-self-grade',
      },
      completionPolicy: { kind: 'submission' },
    })

    const submitted = await application.submitEvidence({
      sessionId: started.context.record.session.id,
      activityId: ActivityIdSchema.parse('item-truth-values-flashcard'),
      response: { kind: 'confidence', value: 4 },
      hintsUsed: 0,
    })

    expect(submitted.evaluation.status).toBe('ungraded')
    expect(submitted.activityCompleted).toBe(true)
    expect(submitted.evidenceEvent.response).toEqual({
      kind: 'confidence',
      value: 4,
    })
    expect(submitted.context.currentActivityProgress?.status).toBe('completed')

    const summary = await application.getPracticeSummary({
      packId: 'learnt.logic-foundations',
    })
    expect(summary.items['item-truth-values-flashcard']).toMatchObject({
      attempts: 1,
      selfGrades: { again: 0, hard: 0, good: 1, easy: 0 },
    })
  })

  it('starts quiz practice through the existing activity player and derives recent mistakes', async () => {
    const application = createPracticeApplication()

    const started = await application.startPracticeSession({
      scope: {
        kind: 'items',
        packId: 'learnt.logic-foundations',
        itemIds: ['item-negation-single-choice'],
      },
      mode: 'quiz',
      selectionStrategy: 'authored-order',
      origin: { kind: 'library' },
    })

    expect(started.context.practice).toMatchObject({
      currentItem: {
        itemId: 'item-negation-single-choice',
        resolvedMode: 'quiz',
      },
    })
    expect(started.context.currentActivity).toMatchObject({
      id: 'item-negation-single-choice',
      response: { kind: 'single-choice' },
      evaluation: { kind: 'choice-selection' },
      completionPolicy: { kind: 'passing-evaluation' },
    })

    const retry = await application.submitEvidence({
      sessionId: started.context.record.session.id,
      activityId: ActivityIdSchema.parse('item-negation-single-choice'),
      response: { kind: 'single-choice', optionId: 'option-false' },
    })

    expect(retry.evaluation.status).toBe('retry')
    expect(retry.activityCompleted).toBe(false)

    const recentMistakes = await application.getRecentMistakes({
      packId: 'learnt.logic-foundations',
    })
    expect(recentMistakes.map((item) => item.itemId)).toEqual([
      'item-negation-single-choice',
    ])

    const weakest = await application.getWeakConcepts({
      packId: 'learnt.logic-foundations',
    })
    expect(weakest.map((concept) => concept.conceptId)).toContain(
      'concept-logical-connectives',
    )
  })
})
