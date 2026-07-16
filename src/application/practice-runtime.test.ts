import {
  createLogicFoundationsRelease,
  type LearningPackDocuments,
} from '@learnt/learning-pack-contracts'
import { describe, expect, it } from 'vitest'

import { installLearningPackDocuments } from '../learning-packs/learnt-importer'
import type { LearningSessionRecord } from '../core/ports'
import {
  createPracticePlan,
  createPracticePreset,
  getAvailablePracticeScopes,
  getSupportedPracticeModes,
  summarizePracticeMetrics,
} from './practice-runtime'

function installGoldenPack() {
  return installLearningPackDocuments(createLogicFoundationsRelease('2.0.0'))
}

function planCreatedAt() {
  return '2026-06-23T12:00:00.000Z'
}

describe('Practice runtime', () => {
  it('resolves portable practice mode availability from canonical LearningItems', () => {
    const installedPack = installGoldenPack()
    const items = new Map(
      installedPack.documents.items.items.map((item) => [item.itemId, item]),
    )

    expect(
      getSupportedPracticeModes(
        requireItem(items, 'item-truth-values-flashcard'),
      ),
    ).toMatchObject([
      { mode: 'flashcard', available: true },
      { mode: 'quiz', available: false },
      { mode: 'recall', available: true },
    ])
    expect(
      getSupportedPracticeModes(
        requireItem(items, 'item-negation-single-choice'),
      ),
    ).toMatchObject([
      { mode: 'flashcard', available: true },
      { mode: 'quiz', available: true },
      { mode: 'recall', available: false },
    ])

    const missingSolutionPack = withoutReviewedSolution(
      createLogicFoundationsRelease('2.0.0'),
      'item-negation-single-choice',
    )
    const missingSolutionItem = requireItem(
      new Map(
        missingSolutionPack.items.items.map((item) => [item.itemId, item]),
      ),
      'item-negation-single-choice',
    )
    const flashcard = getSupportedPracticeModes(missingSolutionItem).find(
      (mode) => mode.mode === 'flashcard',
    )

    expect(flashcard).toMatchObject({
      available: false,
      reasons: ['missing-reviewed-solution'],
    })
  })

  it('creates a StudySet-scoped flashcard plan with stable item identity and exclusions', () => {
    const installedPack = installGoldenPack()

    const plan = createPracticePlan({
      installedPacks: [installedPack],
      evidenceRecords: [],
      createdAt: planCreatedAt(),
      request: {
        scope: {
          kind: 'study-set',
          packId: 'learnt.logic-foundations',
          studySetId: 'set-logic-flashcards',
        },
        mode: 'flashcard',
        selectionStrategy: 'authored-order',
        origin: { kind: 'library', returnRoute: '#/' },
      },
    })

    expect(plan).toMatchObject({
      packId: 'learnt.logic-foundations',
      packVersion: '2.0.0',
      mode: 'flashcard',
      selectionStrategy: 'authored-order',
      origin: { kind: 'library' },
      createdAt: planCreatedAt(),
      displaySummary: {
        title: 'Logic Flashcards',
        scopeLabel: 'StudySet: Logic Flashcards',
        itemCount: 4,
      },
    })
    expect(plan.planId).toBe(
      'practice-learnt-logic-foundations-2-0-0-set-logic-flashcards-flashcard-authored-order',
    )
    expect(plan.selectedItemIds).toEqual([
      'item-truth-values-flashcard',
      'item-negation-single-choice',
      'item-validity-text-recall',
      'item-validity-flashcard',
    ])
    expect(
      plan.selectedItems.map((item) => [
        item.itemId,
        item.resolvedMode,
        item.playMode,
      ]),
    ).toEqual([
      ['item-truth-values-flashcard', 'flashcard', 'flashcard'],
      ['item-negation-single-choice', 'flashcard', 'flashcard'],
      ['item-validity-text-recall', 'flashcard', 'flashcard'],
      ['item-validity-flashcard', 'flashcard', 'flashcard'],
    ])
    expect(plan.coverage).toMatchObject({
      candidateCount: 4,
      selectedCount: 4,
      conceptCount: 3,
      objectiveCount: 3,
    })
    expect(plan.exclusions).toEqual([])
  })

  it('uses CurriculumNode.entries as the authored route practice sequence', () => {
    const installedPack = installGoldenPack()

    const plan = createPracticePlan({
      installedPacks: [installedPack],
      evidenceRecords: [],
      createdAt: planCreatedAt(),
      request: {
        scope: {
          kind: 'curriculum-node',
          packId: 'learnt.logic-foundations',
          courseId: 'course-logic-core',
          nodeId: 'node-core-truth-values-lesson',
        },
        mode: 'mixed',
        selectionStrategy: 'authored-order',
        origin: { kind: 'library', returnRoute: '#/transfer' },
      },
    })

    expect(plan.selectedItemIds).toEqual([
      'item-truth-values-flashcard',
      'item-connectives-multiple-choice',
      'item-conditional-single-choice',
      'item-negation-single-choice',
    ])
    expect(
      plan.selectedItems.map((item) => [
        item.itemId,
        item.resolvedMode,
        item.playMode,
      ]),
    ).toEqual([
      ['item-truth-values-flashcard', 'recall', 'self-grade-review'],
      ['item-connectives-multiple-choice', 'quiz', 'multiple-choice-quiz'],
      ['item-conditional-single-choice', 'quiz', 'single-choice-quiz'],
      ['item-negation-single-choice', 'quiz', 'single-choice-quiz'],
    ])
    expect(plan.coverage).toMatchObject({
      candidateCount: 4,
      selectedCount: 4,
    })
  })

  it('resolves scope chips, presets, and selection strategies without learner state in pack content', () => {
    const installedPack = installGoldenPack()

    const scopes = getAvailablePracticeScopes({
      installedPacks: [installedPack],
      evidenceRecords: [],
    })

    expect(scopes.map((scope) => [scope.kind, scope.label])).toContainEqual([
      'study-set',
      'Logic Flashcards',
    ])
    expect(scopes.map((scope) => [scope.kind, scope.label])).toContainEqual([
      'concept',
      'Truth Values',
    ])

    const preset = createPracticePreset({
      kind: 'study-set-practice',
      packId: 'learnt.logic-foundations',
      studySetId: 'set-logic-flashcards',
      origin: { kind: 'library' },
    })
    expect(preset).toMatchObject({
      mode: 'flashcard',
      selectionStrategy: 'authored-order',
      scope: {
        kind: 'study-set',
        studySetId: 'set-logic-flashcards',
      },
    })

    const authored = createPracticePlan({
      installedPacks: [installedPack],
      evidenceRecords: [],
      createdAt: planCreatedAt(),
      request: {
        scope: {
          kind: 'concepts',
          packId: 'learnt.logic-foundations',
          conceptIds: ['concept-truth-values'],
        },
        mode: 'mixed',
        selectionStrategy: 'authored-order',
        count: 3,
        origin: { kind: 'library' },
      },
    })
    const shuffledA = createPracticePlan({
      installedPacks: [installedPack],
      evidenceRecords: [],
      createdAt: planCreatedAt(),
      request: {
        ...authored.request,
        selectionStrategy: 'random',
        seed: 'seed-1',
      },
    })
    const shuffledB = createPracticePlan({
      installedPacks: [installedPack],
      evidenceRecords: [],
      createdAt: planCreatedAt(),
      request: {
        ...authored.request,
        selectionStrategy: 'random',
        seed: 'seed-1',
      },
    })

    expect(authored.selectedItemIds).toEqual([
      'item-truth-values-flashcard',
      'item-negation-single-choice',
      'item-truth-table-row-count',
    ])
    expect(shuffledA.selectedItemIds).toEqual(shuffledB.selectedItemIds)
    expect(shuffledA.selectedItemIds).not.toEqual(authored.selectedItemIds)
  })

  it('derives private practice metrics from evidence records without mutating installed packs', () => {
    const installedPack = installGoldenPack()
    const metrics = summarizePracticeMetrics({
      installedPacks: [installedPack],
      evidenceRecords: [
        {
          revision: 1,
          subjectVersion: '2.0.0',
          session: {
            schemaVersion: '0.1',
            id: 'session-0',
            learnerId: 'demo-learner',
            profileId: 'demo-learner-v1',
            subjectId: 'subject-propositional-logic',
            status: 'active',
            interactionMode: 'rescue',
            currentModuleId: 'node-core-truth-values-lesson',
            currentActivityId: 'item-negation-single-choice',
            startedAt: '2026-06-23T12:00:00.000Z',
            lastActiveAt: '2026-06-23T12:01:00.000Z',
            activityProgress: [],
            evidenceEventIds: ['evidence-0', 'evidence-1'],
            exploration: { parkedConceptIds: [] },
          },
          evidenceEvents: [
            {
              schemaVersion: '0.1',
              id: 'evidence-0',
              timestamp: '2026-06-23T12:00:00.000Z',
              learnerId: 'demo-learner',
              profileId: 'demo-learner-v1',
              sessionId: 'session-0',
              subjectId: 'subject-propositional-logic',
              moduleId: 'node-core-truth-values-lesson',
              activityId: 'item-negation-single-choice',
              objectiveIds: ['objective-evaluate-negation'],
              activityKind: 'predict',
              response: { kind: 'single-choice', optionId: 'option-false' },
              hintsUsed: 0,
              evaluation: {
                status: 'retry',
                score: 0,
                matchedCriteria: [],
                missingCriteria: ['option-true'],
              },
            },
            {
              schemaVersion: '0.1',
              id: 'evidence-1',
              timestamp: '2026-06-23T12:01:00.000Z',
              learnerId: 'demo-learner',
              profileId: 'demo-learner-v1',
              sessionId: 'session-0',
              subjectId: 'subject-propositional-logic',
              moduleId: 'node-core-truth-values-lesson',
              activityId: 'item-truth-values-flashcard',
              objectiveIds: ['objective-recognize-truth-values'],
              activityKind: 'recall',
              response: { kind: 'confidence', value: 2 },
              confidence: 2,
              hintsUsed: 0,
              evaluation: {
                status: 'ungraded',
                matchedCriteria: [],
                missingCriteria: [],
              },
            },
          ],
        },
      ] as unknown as readonly LearningSessionRecord[],
    })

    expect(metrics.items['item-negation-single-choice']).toMatchObject({
      attempts: 1,
      successes: 0,
      recentUnsuccessful: true,
    })
    expect(metrics.items['item-truth-values-flashcard']).toMatchObject({
      attempts: 1,
      selfGrades: { again: 0, hard: 1, good: 0, easy: 0 },
    })
    expect(metrics.weakConcepts.map((concept) => concept.conceptId)).toContain(
      'concept-logical-connectives',
    )
  })
})

function requireItem<T>(items: ReadonlyMap<string, T>, itemId: string): T {
  const item = items.get(itemId)

  if (item === undefined) {
    throw new Error(`Missing test item ${itemId}.`)
  }

  return item
}

function withoutReviewedSolution(
  pack: LearningPackDocuments,
  itemId: string,
): LearningPackDocuments {
  return {
    ...pack,
    items: {
      ...pack.items,
      items: pack.items.items.map((item) =>
        item.itemId === itemId ? { ...item, reviewedSolutionBlocks: [] } : item,
      ),
    },
  }
}
