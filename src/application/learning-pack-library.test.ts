import {
  LearningPackErrorCode,
  createLogicFoundationsRelease,
  makeDiagnostic,
} from '@learnt/learning-pack-contracts'
import { describe, expect, it } from 'vitest'

import { composeLearntApplication } from '../app'
import { ActivityIdSchema, SubjectIdSchema } from '../core/contracts'
import type { Clock, LearningIdGenerator } from '../core/ports'
import {
  LocalStorageLearningRepository,
  type StorageLike,
} from '../infrastructure'
import { installLearningPackDocuments } from '../learning-packs/learnt-importer'
import type {
  LearningPackLibraryFilters,
  LearningPackLibraryItem,
  LearningPackLibraryNode,
  LearningPackLibrarySnapshot,
  LearningPackLibraryStateEntry,
} from './learnt-application.types'

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

function createLibraryApplication(
  input: Readonly<{
    installedLearningPacks?: Parameters<
      typeof composeLearntApplication
    >[0]['installedLearningPacks']
    learningPackLibraryStates?: readonly LearningPackLibraryStateEntry[]
  }> = {},
) {
  return composeLearntApplication({
    clock: new SequenceClock(),
    idGenerator: new SequenceIds(),
    repository: new LocalStorageLearningRepository(new FakeStorage()),
    ...(input.installedLearningPacks === undefined
      ? {}
      : { installedLearningPacks: input.installedLearningPacks }),
    ...(input.learningPackLibraryStates === undefined
      ? {}
      : { learningPackLibraryStates: input.learningPackLibraryStates }),
  })
}

function installGoldenPack() {
  return installLearningPackDocuments(createLogicFoundationsRelease('2.0.0'))
}

describe('Learning Pack library projection', () => {
  it('preserves the canonical pack, subject, course, curriculum-node, study-set, and item hierarchy', async () => {
    const application = createLibraryApplication({
      installedLearningPacks: [installGoldenPack()],
    })

    const library = await application.getLearningPackLibrary()
    const pack = library.packs[0]
    const subject = pack?.subjects.find(
      (candidate) => candidate.subjectId === 'subject-propositional-logic',
    )
    const course = subject?.courses[0]
    const rootNode = course?.rootNodes[0]
    const lesson = rootNode?.children[0]?.children[0]

    expect(library.isEmpty).toBe(false)
    expect(pack).toMatchObject({
      packId: 'learnt.logic-foundations',
      packVersion: '2.0.0',
      title: 'Logic Foundations',
      state: 'ready',
      subjectCount: 2,
      courseCount: 2,
      itemCount: 8,
      visualToken: 'logic',
      visualLabel: 'Logic Foundations',
    })
    expect(pack?.subjects.map((entry) => entry.subjectId)).toEqual([
      'subject-propositional-logic',
      'subject-proof-strategies',
    ])
    expect(subject).toMatchObject({
      subjectId: 'subject-propositional-logic',
      title: 'Propositional Logic',
      conceptIds: [
        'concept-truth-values',
        'concept-propositions',
        'concept-logical-connectives',
        'concept-truth-tables',
      ],
    })
    expect(course).toMatchObject({
      courseId: 'course-logic-core',
      title: 'Logic Core',
    })
    expect(rootNode).toMatchObject({
      nodeId: 'node-core-module',
      kind: 'module',
      title: 'Core Logic Module',
    })
    expect(lesson).toMatchObject({
      nodeId: 'node-core-truth-values-lesson',
      kindLabel: 'lesson',
    })
    expect(lesson?.items.map((item) => item.itemId)).toEqual([
      'item-truth-values-flashcard',
      'item-negation-single-choice',
    ])
    expect(
      course?.rootNodes.flatMap((node) =>
        node.studySets.map((set) => set.setId),
      ),
    ).toContain('set-logic-flashcards')
    expect(library.summary).toMatchObject({
      packCount: 1,
      subjectCount: 2,
      courseCount: 2,
      visibleItemCount: 8,
    })
    expect(JSON.stringify(library)).not.toContain('learnerId')
    expect(JSON.stringify(library)).not.toContain('evidenceEvents')
    expect(JSON.stringify(library)).not.toContain('presentationPolicy')
  })

  it('filters across the canonical hierarchy without flattening stored pack content', async () => {
    const application = createLibraryApplication({
      installedLearningPacks: [installGoldenPack()],
    })

    await expectVisibleItems(
      application,
      { itemMode: 'multiple-choice-quiz' },
      ['item-connectives-multiple-choice'],
    )
    await expectVisibleItems(application, { conceptId: 'concept-validity' }, [
      'item-validity-text-recall',
      'item-validity-flashcard',
      'item-soundness-manual-read',
    ])
    await expectVisibleItems(
      application,
      { objectiveId: 'objective-build-truth-table' },
      [
        'item-connectives-multiple-choice',
        'item-truth-table-row-count',
        'item-conditional-single-choice',
      ],
    )
    await expectVisibleItems(application, { authoredTag: 'proofs' }, [
      'item-validity-text-recall',
      'item-validity-flashcard',
      'item-soundness-manual-read',
    ])
    await expectVisibleItems(
      application,
      { courseId: 'course-proof-practice' },
      [
        'item-validity-text-recall',
        'item-validity-flashcard',
        'item-soundness-manual-read',
      ],
    )
    await expectVisibleItems(
      application,
      { installedPackId: 'learnt.logic-foundations' },
      [
        'item-truth-values-flashcard',
        'item-negation-single-choice',
        'item-connectives-multiple-choice',
        'item-truth-table-row-count',
        'item-conditional-single-choice',
        'item-validity-text-recall',
        'item-validity-flashcard',
        'item-soundness-manual-read',
      ],
    )

    const filtered = await application.getLearningPackLibrary({
      subjectId: 'subject-proof-strategies',
    })
    expect(
      filtered.packs[0]?.subjects.map((subject) => subject.subjectId),
    ).toEqual(['subject-proof-strategies'])
    const rootNode = filtered.packs[0]?.subjects[0]?.courses[0]?.rootNodes[0]
    expect(rootNode).toMatchObject({ nodeId: 'node-proof-module' })
    expect(Array.isArray(rootNode?.children)).toBe(true)
  })

  it('derives learning status from Learnt sessions outside installed pack content', async () => {
    const application = createLibraryApplication({
      installedLearningPacks: [installGoldenPack()],
    })

    const context = await application.startSession({
      subjectId: SubjectIdSchema.parse('subject-propositional-logic'),
    })
    await expectVisibleItems(application, { learningStatus: 'active' }, [
      'item-truth-values-flashcard',
    ])

    const submitted = await application.submitEvidence({
      sessionId: context.record.session.id,
      activityId: ActivityIdSchema.parse('item-truth-values-flashcard'),
      response: { kind: 'manual', completed: true },
    })
    await application.advanceSession({
      sessionId: context.record.session.id,
      ...(submitted.context.nextActivities[0]?.activityId === undefined
        ? {}
        : { nextActivityId: submitted.context.nextActivities[0].activityId }),
    })

    await expectVisibleItems(application, { learningStatus: 'completed' }, [
      'item-truth-values-flashcard',
    ])
    await expectVisibleItems(application, { learningStatus: 'active' }, [
      'item-negation-single-choice',
    ])

    const library = await application.getLearningPackLibrary()
    expect(JSON.stringify(library.packs[0]?.subjects)).not.toContain(
      context.record.session.id,
    )
  })

  it('exposes empty, invalid-pack, unsupported-capability, update-available, and partially-supported app-owned states', async () => {
    const empty = await createLibraryApplication().getLearningPackLibrary()

    expect(empty.isEmpty).toBe(true)
    expect(empty.packs).toEqual([])

    const states: readonly LearningPackLibraryStateEntry[] = [
      {
        packId: 'broken-pack',
        packVersion: '0.0.1',
        title: 'Broken Pack',
        state: 'invalid-pack',
        message: 'Required canonical files are missing.',
        diagnostics: [
          makeDiagnostic(
            LearningPackErrorCode.REQUIRED_FILE_MISSING,
            'error',
            'catalog.json',
            'catalog.json is required.',
          ),
        ],
      },
      {
        packId: 'required-capability-pack',
        title: 'Required Capability Pack',
        state: 'unsupported-capability',
        message: 'The pack requires a capability this build does not support.',
      },
      {
        packId: 'update-pack',
        title: 'Update Pack',
        state: 'update-available',
        message: 'A newer release is ready to install.',
      },
      {
        packId: 'partial-pack',
        title: 'Partial Pack',
        state: 'partially-supported',
        message: 'Optional capabilities are unavailable.',
      },
    ]

    const library = await createLibraryApplication({
      learningPackLibraryStates: states,
    }).getLearningPackLibrary()

    expect(library.isEmpty).toBe(false)
    expect(library.packs.map((pack) => pack.state).sort()).toEqual([
      'invalid-pack',
      'partially-supported',
      'unsupported-capability',
      'update-available',
    ])
    expect(library.summary).toMatchObject({
      invalidPackCount: 1,
      unsupportedCapabilityCount: 1,
      updateAvailableCount: 1,
      partiallySupportedCount: 1,
    })
    expect(
      library.packs.find((pack) => pack.packId === 'broken-pack'),
    ).toMatchObject({
      diagnostics: [
        expect.objectContaining({
          code: LearningPackErrorCode.REQUIRED_FILE_MISSING,
        }),
      ],
    })
  })
})

async function expectVisibleItems(
  application: ReturnType<typeof createLibraryApplication>,
  filters: LearningPackLibraryFilters,
  expectedItemIds: readonly string[],
): Promise<void> {
  const library = await application.getLearningPackLibrary(filters)

  expect(visibleItemIds(library)).toEqual(expectedItemIds)
}

function visibleItemIds(library: LearningPackLibrarySnapshot): string[] {
  return library.packs.flatMap((pack) =>
    pack.subjects.flatMap((subject) =>
      subject.courses.flatMap((course) =>
        course.rootNodes.flatMap((node) =>
          collectItems(node).map((item) => item.itemId),
        ),
      ),
    ),
  )
}

function collectItems(
  node: LearningPackLibraryNode,
): readonly LearningPackLibraryItem[] {
  return [
    ...node.items,
    ...node.children.flatMap((child) => collectItems(child)),
  ]
}
