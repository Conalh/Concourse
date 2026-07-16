import { createLogicFoundationsRelease } from '@learnt/learning-pack-contracts'
import { describe, expect, it } from 'vitest'

import { composeLearntApplication } from '../app'
import { ActivityIdSchema, SubjectIdSchema } from '../core/contracts'
import type { Clock, LearningIdGenerator } from '../core/ports'
import {
  InMemoryResourceEngagementStore,
  LocalStorageLearningRepository,
  type StorageLike,
} from '../infrastructure'
import { installLearningPackDocuments } from '../learning-packs/learnt-importer'
import { createPackAssetTestFixture } from '../test/pack-asset-fixture'

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

function createResourceApplication() {
  const resourceEngagementStore = new InMemoryResourceEngagementStore()
  const application = composeLearntApplication({
    clock: new SequenceClock(),
    idGenerator: new SequenceIds(),
    repository: new LocalStorageLearningRepository(new FakeStorage()),
    resourceEngagementStore,
    installedLearningPacks: [
      installLearningPackDocuments(createLogicFoundationsRelease('2.0.0')),
    ],
  })

  return { application, resourceEngagementStore }
}

describe('Learning resource runtime', () => {
  it('exposes a validated pack asset resource as supported', async () => {
    const fixture = createPackAssetTestFixture()
    const application = composeLearntApplication({
      clock: new SequenceClock(),
      idGenerator: new SequenceIds(),
      repository: new LocalStorageLearningRepository(new FakeStorage()),
      resourceEngagementStore: new InMemoryResourceEngagementStore(),
      installedLearningPacks: [fixture.installedPack],
    })

    const resource = await application.getLearningResource({
      packId: fixture.installedPack.packId,
      resourceId: 'resource-lab-01-notebook',
    })

    expect(resource).toMatchObject({
      sourceKind: 'pack-asset',
      supported: true,
      supportMessage: null,
    })
  })

  it('looks up canonical resources by pack ID and resource ID without mutating pack content', async () => {
    const { application } = createResourceApplication()

    const resource = await application.getLearningResource({
      packId: 'learnt.logic-foundations',
      resourceId: 'resource-logic-reading',
    })

    expect(resource).toMatchObject({
      packId: 'learnt.logic-foundations',
      packVersion: '2.0.0',
      resourceId: 'resource-logic-reading',
      contentRevision: 2,
      title: 'Five-Minute Logic Reading',
      sourceKind: 'embedded-content',
      progressState: 'unseen',
      supported: true,
    })
    expect(resource.checkpoints.map((checkpoint) => checkpoint.setId)).toEqual([
      'set-core-quiz',
    ])
    expect(resource.segments.map((segment) => segment.segmentId)).toEqual([
      'segment-reading-intro',
    ])

    const packResources = await application.listResourcesForPack({
      packId: 'learnt.logic-foundations',
    })
    expect(
      packResources.map((packResource) => packResource.resourceId),
    ).toEqual([
      'resource-logic-reading',
      'resource-logic-article',
      'resource-negation-video',
      'resource-logic-podcast',
      'resource-logic-book-chapter',
      'resource-truth-table-demo',
    ])

    const installedPack = application
      .getInstalledLearningPacksForRuntime()
      .find((pack) => pack.packId === 'learnt.logic-foundations')

    expect(installedPack?.documents.resources?.resources[0]?.source.kind).toBe(
      'embedded-content',
    )
  })

  it('resolves concept, objective, item support, segment, and checkpoint resource links', async () => {
    const { application } = createResourceApplication()

    await expect(
      application.listResourcesForConcept({
        packId: 'learnt.logic-foundations',
        conceptId: 'concept-truth-values',
      }),
    ).resolves.toMatchObject([
      {
        resourceId: 'resource-logic-reading',
        segmentId: 'segment-reading-intro',
        linkRole: 'primary',
      },
      {
        resourceId: 'resource-logic-article',
        linkRole: 'alternative-explanation',
      },
      {
        resourceId: 'resource-negation-video',
        segmentId: 'segment-video-worked-example',
        linkRole: 'worked-example',
      },
    ])

    await expect(
      application.listResourcesForObjective({
        packId: 'learnt.logic-foundations',
        objectiveId: 'objective-recognize-truth-values',
      }),
    ).resolves.toMatchObject([
      {
        resourceId: 'resource-logic-reading',
        linkRole: 'explanation',
      },
    ])

    await expect(
      application.listSupportResourcesForLearningItem({
        packId: 'learnt.logic-foundations',
        itemId: 'item-negation-single-choice',
        recommendedUse: 'after-incorrect',
      }),
    ).resolves.toMatchObject([
      {
        resourceId: 'resource-logic-reading',
        segmentId: 'segment-reading-intro',
        linkRole: 'remediation',
      },
    ])

    const segment = await application.getLearningResource({
      packId: 'learnt.logic-foundations',
      resourceId: 'resource-negation-video',
      segmentId: 'segment-video-worked-example',
    })
    expect(segment.selectedSegment).toMatchObject({
      segmentId: 'segment-video-worked-example',
      title: 'Worked NOT example',
    })
    expect(
      segment.selectedSegment?.checkpoints.map(
        (checkpoint) => checkpoint.setId,
      ),
    ).toEqual(['set-core-quiz'])
  })

  it('preserves authored CurriculumNode.entries order across resources, items, and StudySets', async () => {
    const { application } = createResourceApplication()

    const entries = await application.listCurriculumEntries({
      packId: 'learnt.logic-foundations',
      courseId: 'course-logic-core',
      nodeId: 'node-core-truth-values-lesson',
    })

    expect(entries.map((entry) => entry.kind)).toEqual([
      'resource',
      'item',
      'resource',
      'study-set',
      'item',
    ])
    expect(entries.map((entry) => entry.title)).toEqual([
      'Five-Minute Logic Reading',
      'Truth Values',
      'Negation Walkthrough Video',
      'Core Logic Quiz',
      'Evaluate NOT false',
    ])
    expect(entries[2]).toMatchObject({
      kind: 'resource',
      resourceId: 'resource-negation-video',
      segmentId: 'segment-video-worked-example',
    })
  })

  it('persists resource engagement outside sessions and derives stale completion from contentRevision', async () => {
    const { application, resourceEngagementStore } = createResourceApplication()

    await application.recordResourceEngagement({
      packId: 'learnt.logic-foundations',
      resourceId: 'resource-logic-reading',
      action: 'opened',
      measurement: 'reader-observed',
    })
    await application.recordResourceEngagement({
      packId: 'learnt.logic-foundations',
      resourceId: 'resource-logic-reading',
      action: 'marked-complete',
      measurement: 'self-reported',
    })

    const resource = await application.getLearningResource({
      packId: 'learnt.logic-foundations',
      resourceId: 'resource-logic-reading',
    })
    expect(resource.progressState).toBe('completed')

    const staleStore = new InMemoryResourceEngagementStore()
    await staleStore.appendResourceEngagementEvent({
      schemaVersion: '0.1',
      eventType: 'resource-engagement',
      eventId: 'resource-engagement-old-completion',
      packId: 'learnt.logic-foundations',
      packVersion: '1.0.0',
      resourceId: 'resource-logic-reading',
      contentRevision: 1,
      segmentId: null,
      action: 'marked-complete',
      progressRatio: null,
      positionSeconds: null,
      measurement: 'self-reported',
      occurredAt: '2026-06-22T12:00:00.000Z',
      sourceInstanceId: 'learnt-test',
      metadata: null,
    })

    const revisedOnly = composeLearntApplication({
      clock: new SequenceClock(),
      idGenerator: new SequenceIds(),
      repository: new LocalStorageLearningRepository(new FakeStorage()),
      resourceEngagementStore: staleStore,
      installedLearningPacks: [
        installLearningPackDocuments(createLogicFoundationsRelease('2.0.0')),
      ],
    })

    const oldProgress = await revisedOnly.getLearningResource({
      packId: 'learnt.logic-foundations',
      resourceId: 'resource-logic-reading',
    })
    expect(oldProgress.progressState).toBe('completion-stale')

    expect(
      await resourceEngagementStore.listResourceEngagementEvents(),
    ).toHaveLength(2)
    expect((await application.listSessions()).sessions).toEqual([])
  })

  it('deduplicates replayed resource engagement events by source instance and event ID', async () => {
    const { resourceEngagementStore } = createResourceApplication()
    const event = {
      schemaVersion: '0.1' as const,
      eventType: 'resource-engagement' as const,
      eventId: 'resource-engagement-replay',
      packId: 'learnt.logic-foundations',
      packVersion: '2.0.0',
      resourceId: 'resource-logic-reading',
      contentRevision: 2,
      segmentId: null,
      action: 'opened' as const,
      progressRatio: null,
      positionSeconds: null,
      measurement: 'reader-observed' as const,
      occurredAt: '2026-06-23T12:00:00.000Z',
      sourceInstanceId: 'learnt-test',
      metadata: null,
    }

    await resourceEngagementStore.appendResourceEngagementEvent(event)
    await resourceEngagementStore.appendResourceEngagementEvent(event)

    expect(
      await resourceEngagementStore.listResourceEngagementEvents(),
    ).toEqual([event])
  })

  it('launches a StudySet-scoped checkpoint session with native evidence and a resource return origin', async () => {
    const { application } = createResourceApplication()

    const checkpoint = await application.resolveStudySet({
      packId: 'learnt.logic-foundations',
      studySetId: 'set-core-quiz',
      seed: 'resource-checkpoint-test',
    })
    const started = await application.startStudySetSession({
      packId: 'learnt.logic-foundations',
      studySetId: 'set-core-quiz',
      seed: 'resource-checkpoint-test',
      origin: {
        kind: 'learning-resource',
        packId: 'learnt.logic-foundations',
        resourceId: 'resource-logic-reading',
        returnRoute:
          '#/packs/learnt.logic-foundations/resources/resource-logic-reading',
      },
    })

    expect(checkpoint.itemIds).toHaveLength(2)
    expect(started.studySet.itemIds).toEqual(checkpoint.itemIds)
    expect(started.context.progress.total).toBe(2)
    expect(
      started.context.subject.activities.map((activity) => activity.id),
    ).toEqual(checkpoint.itemIds)
    expect(started.context.currentActivity?.id).toBe(checkpoint.itemIds[0])
    expect(
      started.context.record.session.exploration.learningFlow,
    ).toMatchObject({
      kind: 'study-set-checkpoint',
      packId: 'learnt.logic-foundations',
      packVersion: '2.0.0',
      studySetId: 'set-core-quiz',
      origin: {
        kind: 'learning-resource',
        resourceId: 'resource-logic-reading',
      },
    })

    const firstActivity = started.context.currentActivity
    if (firstActivity === null) {
      throw new Error('Expected checkpoint to start on a current activity.')
    }

    const submitted = await application.submitEvidence({
      sessionId: started.context.record.session.id,
      activityId: firstActivity.id,
      response: correctResponseFor(firstActivity.id),
    })
    expect(submitted.evidenceEvent.sessionId).toBe(
      started.context.record.session.id,
    )
    expect(submitted.evidenceEvent.activityId).toBe(firstActivity.id)
    expect(submitted.evaluation.status).toBe('passed')

    const advanced = await application.advanceSession({
      sessionId: started.context.record.session.id,
    })
    expect(advanced.currentActivity?.id).toBe(checkpoint.itemIds[1])
  })

  it('uses supportResourceLinks to expose Learn the Why only after eligible attempts', async () => {
    const { application } = createResourceApplication()
    let context = await application.startSession({
      subjectId: SubjectIdSchema.parse('subject-propositional-logic'),
    })

    const manual = await application.submitEvidence({
      sessionId: context.record.session.id,
      activityId: ActivityIdSchema.parse('item-truth-values-flashcard'),
      response: { kind: 'manual', completed: true },
    })
    context = await application.advanceSession({
      sessionId: context.record.session.id,
      ...(manual.context.nextActivities[0]?.activityId === undefined
        ? {}
        : { nextActivityId: manual.context.nextActivities[0].activityId }),
    })
    expect(context.currentActivity?.id).toBe('item-negation-single-choice')
    await expect(
      application.getEligibleSupportResources({
        sessionId: context.record.session.id,
      }),
    ).resolves.toEqual([])

    const incorrect = await application.submitEvidence({
      sessionId: context.record.session.id,
      activityId: ActivityIdSchema.parse('item-negation-single-choice'),
      response: { kind: 'single-choice', optionId: 'option-false' },
    })
    expect(incorrect.evaluation.status).toBe('retry')

    const support = await application.getEligibleSupportResources({
      sessionId: context.record.session.id,
    })
    expect(support).toMatchObject([
      {
        resourceId: 'resource-logic-reading',
        segmentId: 'segment-reading-intro',
        linkRole: 'remediation',
        recommendedUse: 'after-incorrect',
      },
    ])

    const correct = await application.submitEvidence({
      sessionId: context.record.session.id,
      activityId: ActivityIdSchema.parse('item-negation-single-choice'),
      response: { kind: 'single-choice', optionId: 'option-true' },
    })
    expect(correct.evaluation.status).toBe('passed')
    await expect(
      application.getEligibleSupportResources({
        sessionId: context.record.session.id,
      }),
    ).resolves.toEqual([])
  })
})

function correctResponseFor(activityId: string) {
  switch (activityId) {
    case 'item-connectives-multiple-choice':
      return {
        kind: 'multiple-choice',
        optionIds: ['option-and', 'option-or', 'option-if-then'],
      }
    case 'item-conditional-single-choice':
      return {
        kind: 'single-choice',
        optionId: 'option-p-true-q-false',
      }
    default:
      throw new Error(`No test response configured for ${activityId}.`)
  }
}
