import { describe, expect, it } from 'vitest'
import { createLogicFoundationsRelease } from '@learnt/learning-pack-contracts'

import {
  ActivityIdSchema,
  ConceptIdSchema,
  LearnerIdSchema,
  LearnerProfileIdSchema,
  LearningSessionSchema,
  SessionIdSchema,
  SubjectIdSchema,
  type SessionId,
} from '../core/contracts'
import { LearningEngine } from '../core/engine'
import { cloneDeep, deepFreeze } from '../core/foundation'
import type { Clock, LearningIdGenerator } from '../core/ports'
import { PersistentLearningService } from './persistent-learning-service'
import {
  InMemoryResourceEngagementStore,
  LocalStorageLearningRepository,
  type StorageLike,
} from '../infrastructure'
import { demoLearnerProfile } from '../profiles'
import { createProductionSubjectRegistry } from '../app/subject-registry'
import {
  createPackAssetTestFixture,
  packAssetBytes,
} from '../test/pack-asset-fixture'
import {
  LearntApplication,
  LearningApplicationError,
  type LearningPackDirectoryInstallResult,
  type LearningPackSourcePort,
  type LearningPackSourceReadResult,
  type InstalledLearningPackRecord,
  type InstalledLearningPackRelease,
  type InstalledLearningPackStore,
  type LearningSessionContext,
  type ValidatedLearningPackCandidate,
} from './index'

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

  setRaw(key: string, value: string): void {
    this.values.set(key, value)
  }

  snapshot(): readonly (readonly [string, string])[] {
    return [...this.values.entries()].sort(([left], [right]) =>
      left.localeCompare(right),
    )
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

class InMemoryInstalledLearningPackStore implements InstalledLearningPackStore {
  private readonly records = new Map<string, InstalledLearningPackRecord>()
  private readonly issues: readonly Readonly<{
    packId: string | null
    message: string
  }>[]
  snapshotReads = 0

  constructor(
    issues: readonly Readonly<{
      packId: string | null
      message: string
    }>[] = [],
  ) {
    this.issues = issues
  }

  write(record: InstalledLearningPackRecord): Promise<void> {
    this.records.set(record.packId, record)
    return Promise.resolve()
  }

  readSnapshot(): Promise<
    Readonly<{
      records: readonly InstalledLearningPackRecord[]
      issues: readonly Readonly<{ packId: string | null; message: string }>[]
    }>
  > {
    this.snapshotReads += 1
    return Promise.resolve({
      records: [...this.records.values()],
      issues: this.issues,
    })
  }
}

class FixedLearningPackSource implements LearningPackSourcePort {
  private readonly result: LearningPackSourceReadResult | null

  constructor(result: LearningPackSourceReadResult | null) {
    this.result = result
  }

  chooseDirectory(): Promise<LearningPackSourceReadResult | null> {
    return Promise.resolve(this.result)
  }

  readSelectedDirectory(): Promise<LearningPackSourceReadResult | null> {
    return Promise.resolve(this.result)
  }
}

type RecordedPackAssetSaveRequest = Readonly<{
  suggestedFileName: string
  mediaType: string
  bytes: Uint8Array
}>

class RecordingPackAssetDelivery {
  readonly requests: RecordedPackAssetSaveRequest[] = []
  result: 'saved' | 'cancelled' = 'saved'

  save(request: RecordedPackAssetSaveRequest): Promise<'saved' | 'cancelled'> {
    this.requests.push(request)
    return Promise.resolve(this.result)
  }
}

function candidate(
  version: Parameters<typeof createLogicFoundationsRelease>[0],
  contentHash: string,
): ValidatedLearningPackCandidate {
  return {
    contentHash,
    documents: createLogicFoundationsRelease(version),
    files: [],
  }
}

function createTestApplication(storage = new FakeStorage()): LearntApplication {
  const clock = new SequenceClock()
  const engine = new LearningEngine({
    clock,
    idGenerator: new SequenceIds(),
  })
  const repository = new LocalStorageLearningRepository(storage)

  return new LearntApplication({
    clock,
    profile: demoLearnerProfile,
    subjectRegistry: createProductionSubjectRegistry(),
    persistentLearningService: new PersistentLearningService({
      engine,
      repository,
    }),
    resourceEngagementStore: new InMemoryResourceEngagementStore(),
  })
}

function createTestApplicationWithPackStore(
  store: InstalledLearningPackStore,
  source?: LearningPackSourcePort,
  storage = new FakeStorage(),
): LearntApplication {
  const clock = new SequenceClock()
  const engine = new LearningEngine({
    clock,
    idGenerator: new SequenceIds(),
  })

  return new LearntApplication({
    clock,
    profile: demoLearnerProfile,
    subjectRegistry: createProductionSubjectRegistry(),
    persistentLearningService: new PersistentLearningService({
      engine,
      repository: new LocalStorageLearningRepository(storage),
    }),
    resourceEngagementStore: new InMemoryResourceEngagementStore(),
    installedLearningPackStore: store,
    ...(source === undefined ? {} : { learningPackSource: source }),
  })
}

type PackAssetTestFixture = ReturnType<typeof createPackAssetTestFixture>

async function createPackAssetApplication(
  options: Readonly<{
    fixture?: PackAssetTestFixture
    activeRelease?: InstalledLearningPackRelease
  }> = {},
) {
  const fixture = options.fixture ?? createPackAssetTestFixture()
  const activeRelease = options.activeRelease ?? fixture.activeRelease
  const store = new InMemoryInstalledLearningPackStore()
  const delivery = new RecordingPackAssetDelivery()
  const resourceEngagementStore = new InMemoryResourceEngagementStore()
  await store.write(installedRecord(activeRelease))

  const clock = new SequenceClock()
  const engine = new LearningEngine({
    clock,
    idGenerator: new SequenceIds(),
  })
  const application = new LearntApplication({
    clock,
    profile: demoLearnerProfile,
    subjectRegistry: createProductionSubjectRegistry(),
    persistentLearningService: new PersistentLearningService({
      engine,
      repository: new LocalStorageLearningRepository(new FakeStorage()),
    }),
    resourceEngagementStore,
    installedLearningPacks: [fixture.installedPack],
    installedLearningPackStore: store,
    packAssetDelivery: delivery,
  })

  return {
    application,
    fixture,
    store,
    delivery,
    resourceEngagementStore,
  }
}

function installedRecord(
  activeRelease: InstalledLearningPackRelease,
): InstalledLearningPackRecord {
  return {
    packId: activeRelease.documents.manifest.packId,
    activeReleaseId: activeRelease.releaseId,
    rollbackReleaseId: null,
    releases: [activeRelease],
  }
}

function firstProductionSubject() {
  const adapter = createProductionSubjectRegistry().list()[0]

  if (adapter === undefined) {
    throw new Error('Expected at least one production subject adapter.')
  }

  return adapter.subject
}

function storageKey(sessionId: SessionId | string = 'session-0'): string {
  return `learnt:learning-session:${sessionId}`
}

async function completeCurrentManual(
  application: LearntApplication,
  context: LearningSessionContext,
): Promise<LearningSessionContext> {
  const activityId = context.currentActivity?.id

  if (activityId === undefined) {
    throw new Error('Expected a current manual activity.')
  }

  const submitted = await application.submitEvidence({
    sessionId: context.record.session.id,
    activityId,
    response: { kind: 'manual', completed: true },
  })

  return application.advanceSession({
    sessionId: context.record.session.id,
    ...(submitted.context.nextActivities[0]?.activityId === undefined
      ? {}
      : { nextActivityId: submitted.context.nextActivities[0].activityId }),
  })
}

async function moveLogicSessionToConjunction(
  application: LearntApplication,
): Promise<LearningSessionContext> {
  let context = await application.startSession({
    subjectId: SubjectIdSchema.parse('logic-basics'),
  })
  context = await completeCurrentManual(application, context)

  for (const [activityId, response] of [
    ['predict-negation', { kind: 'single-choice', optionId: 'option-false' }],
    [
      'recall-boolean-values',
      { kind: 'multiple-choice', optionIds: ['option-true', 'option-false'] },
    ],
  ] as const) {
    const submitted = await application.submitEvidence({
      sessionId: context.record.session.id,
      activityId: ActivityIdSchema.parse(activityId),
      response,
    })
    const nextActivityId = submitted.context.nextActivities[0]?.activityId
    context = await application.advanceSession({
      sessionId: context.record.session.id,
      ...(nextActivityId === undefined ? {} : { nextActivityId }),
    })
  }

  return completeCurrentManual(application, context)
}

describe('LearntApplication catalog', () => {
  it('returns immutable learner, subject summaries, and deterministic overview relationships', () => {
    const application = createTestApplication()

    expect(application.getLearner()).toEqual({
      learnerId: 'demo-learner',
      profileId: 'demo-learner-v1',
      displayName: 'Demo learner',
    })
    expect('reportedTraits' in application.getLearner()).toBe(false)

    const subjects = application.listSubjects()
    expect(subjects.map((subject) => subject.title)).toEqual([
      'Logic Basics',
      'Movement Planes',
      'Machine Learning Foundations',
    ])
    expect(subjects[0]).toMatchObject({
      id: 'logic-basics',
      version: '0.1.0',
      moduleCount: 2,
      conceptCount: 5,
      objectiveCount: 5,
      activityCount: 8,
    })
    expect(subjects[2]).toMatchObject({
      id: 'machine-learning-foundations',
      version: '0.1.0',
      moduleCount: 6,
      conceptCount: 65,
      objectiveCount: 18,
      activityCount: 33,
    })
    expect(Object.isFrozen(subjects)).toBe(true)
    expect(Object.isFrozen(subjects[0]?.tags)).toBe(true)

    const overview = application.getSubjectOverview(
      SubjectIdSchema.parse('logic-basics'),
    )
    expect(overview.orderedModules.map((module) => module.id)).toEqual([
      'boolean-foundations',
      'combining-conditions',
    ])
    expect(overview.conceptRelationships).toContainEqual({
      fromConceptId: 'boolean-values',
      toConceptId: 'logical-negation',
      kind: 'prerequisite',
    })

    expect(() =>
      application.getSubjectOverview(SubjectIdSchema.parse('missing-subject')),
    ).toThrow(LearningApplicationError)
  })
})

describe('LearntApplication installed pack lifecycle', () => {
  it('rehydrates an installed active release in a fresh application instance', async () => {
    const store = new InMemoryInstalledLearningPackStore()
    const first = createTestApplicationWithPackStore(store)

    await first.installValidatedLearningPack(candidate('1.0.0', 'hash-v1'))

    const reloaded = createTestApplicationWithPackStore(store)
    const restored = await reloaded.restoreInstalledLearningPacks(store)

    expect(restored.installed).toEqual([
      expect.objectContaining({
        packId: 'learnt.logic-foundations',
        packVersion: '1.0.0',
      }),
    ])
    expect((await reloaded.getLearningPackLibrary()).packs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          packId: 'learnt.logic-foundations',
          packVersion: '1.0.0',
        }),
      ]),
    )
  })

  it('installs validated directory candidates through the application lifecycle', async () => {
    const store = new InMemoryInstalledLearningPackStore()
    const source = new FixedLearningPackSource({
      sourceName: 'Courses',
      scannedDirectoryCount: 1,
      candidates: [
        {
          directoryName: 'logic',
          packId: 'learnt.logic-foundations',
          packVersion: '1.0.0',
          title: 'Logic Foundations',
          diagnostics: [],
          candidate: candidate('1.0.0', 'hash-v1'),
        },
      ],
      rejectedCandidates: [],
    })
    const application = createTestApplicationWithPackStore(store, source)
    const facade = application as LearntApplication & {
      chooseAndInstallLearningPackDirectory: () => Promise<LearningPackDirectoryInstallResult | null>
    }

    const result = await facade.chooseAndInstallLearningPackDirectory()

    expect(result).toMatchObject({
      sourceName: 'Courses',
      outcomes: [
        expect.objectContaining({
          status: 'installed',
          packId: 'learnt.logic-foundations',
        }),
      ],
    })
    expect((await store.readSnapshot()).records[0]).toMatchObject({
      packId: 'learnt.logic-foundations',
      activeReleaseId: 'hash-v1',
    })
  })

  it('surfaces corrupt persisted records as invalid pack states', async () => {
    const store = new InMemoryInstalledLearningPackStore([
      {
        packId: 'corrupt-pack',
        message: 'Stored installed-pack record has an invalid shape.',
      },
    ])
    const application = createTestApplicationWithPackStore(store)

    await application.restoreInstalledLearningPacks(store)

    expect(store.snapshotReads).toBe(1)

    expect((await application.getLearningPackLibrary()).packs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          packId: 'corrupt-pack',
          state: 'invalid-pack',
        }),
      ]),
    )
  })

  it('activates v2, retains v1 for rollback, and preserves v2 on a rejected update', async () => {
    const store = new InMemoryInstalledLearningPackStore()
    const application = createTestApplicationWithPackStore(store)

    await application.installValidatedLearningPack(
      candidate('1.0.0', 'hash-v1'),
    )
    const upgraded = await application.installValidatedLearningPack(
      candidate('2.0.0', 'hash-v2'),
    )
    const rejected = await application.installValidatedLearningPack(
      candidate('2.0.0', 'different-v2-content'),
    )

    expect(upgraded).toMatchObject({
      kind: 'upgrade',
      record: { rollbackReleaseId: 'hash-v1' },
    })
    expect(rejected).toMatchObject({
      kind: 'reject',
      reason: 'same-version-content-conflict',
    })
    expect(application.getInstalledLearningPacksForRuntime()).toEqual([
      expect.objectContaining({ packVersion: '2.0.0' }),
    ])
  })

  it('retains learner session and evidence state when a legacy pack is re-synced', async () => {
    const storage = new FakeStorage()
    const store = new InMemoryInstalledLearningPackStore([
      {
        packId: 'learnt.logic-foundations',
        message:
          'Installed pack data uses a legacy format and must be re-synced. Learner progress was retained.',
      },
    ])
    const application = createTestApplicationWithPackStore(
      store,
      undefined,
      storage,
    )
    const started = await application.startSession({
      subjectId: SubjectIdSchema.parse('logic-basics'),
    })
    await completeCurrentManual(application, started)
    await application.restoreInstalledLearningPacks(store)
    const learnerStateBeforeSync = storage.snapshot()

    await application.installValidatedLearningPack(
      candidate('1.0.0', 'hash-v1'),
    )

    expect(storage.snapshot()).toEqual(learnerStateBeforeSync)
  })
})

describe('LearntApplication pack asset delivery', () => {
  it('delivers a fresh copy of active-release bytes through the configured port', async () => {
    const setup = await createPackAssetApplication()

    const result = await setup.application.downloadLearningPackAsset({
      packId: setup.fixture.installedPack.packId,
      resourceId: 'resource-lab-01-notebook',
    })

    expect(result).toBe('saved')
    expect(setup.delivery.requests).toHaveLength(1)
    expect(setup.delivery.requests[0]).toMatchObject({
      suggestedFileName: 'module-01-lab.ipynb',
      mediaType: 'application/x-ipynb+json',
    })
    expect([...(setup.delivery.requests[0]?.bytes ?? [])]).toEqual([
      ...packAssetBytes,
    ])
    expect(setup.delivery.requests[0]?.bytes).not.toBe(
      setup.fixture.activeRelease.files[0]?.bytes,
    )
  })

  it('treats delivery cancellation as a side-effect-free result', async () => {
    const setup = await createPackAssetApplication()
    setup.delivery.result = 'cancelled'

    const result = await setup.application.downloadLearningPackAsset({
      packId: setup.fixture.installedPack.packId,
      resourceId: 'resource-lab-01-notebook',
    })

    expect(result).toBe('cancelled')
    expect(
      await setup.resourceEngagementStore.listResourceEngagementEvents(),
    ).toEqual([])
  })

  it('does not call the delivery port when canonical byte resolution fails', async () => {
    const fixture = createPackAssetTestFixture()
    const activeFile = fixture.activeRelease.files[0]
    if (activeFile === undefined) {
      throw new Error('Expected the pack-asset fixture file.')
    }
    const tamperedRelease = {
      ...fixture.activeRelease,
      files: [
        {
          ...activeFile,
          sha256: 'f'.repeat(64),
        },
      ],
    }
    const setup = await createPackAssetApplication({
      fixture,
      activeRelease: tamperedRelease,
    })

    await expect(
      setup.application.downloadLearningPackAsset({
        packId: fixture.installedPack.packId,
        resourceId: 'resource-lab-01-notebook',
      }),
    ).rejects.toMatchObject({ code: 'pack-asset-integrity-failed' })
    expect(setup.delivery.requests).toEqual([])
  })

  it('reports a visible application error when delivery is not configured', async () => {
    const fixture = createPackAssetTestFixture()
    const store = new InMemoryInstalledLearningPackStore()
    await store.write(installedRecord(fixture.activeRelease))
    const application = createTestApplicationWithPackStore(store)

    await expect(
      application.downloadLearningPackAsset({
        packId: fixture.installedPack.packId,
        resourceId: 'resource-lab-01-notebook',
      }),
    ).rejects.toMatchObject({
      name: 'LearningApplicationError',
      code: 'pack-asset-delivery-unavailable',
    })
  })

  it('reports a visible application error when installed release storage is not configured', async () => {
    const fixture = createPackAssetTestFixture()
    const delivery = new RecordingPackAssetDelivery()
    const clock = new SequenceClock()
    const engine = new LearningEngine({
      clock,
      idGenerator: new SequenceIds(),
    })
    const application = new LearntApplication({
      clock,
      profile: demoLearnerProfile,
      subjectRegistry: createProductionSubjectRegistry(),
      persistentLearningService: new PersistentLearningService({
        engine,
        repository: new LocalStorageLearningRepository(new FakeStorage()),
      }),
      resourceEngagementStore: new InMemoryResourceEngagementStore(),
      installedLearningPacks: [fixture.installedPack],
      packAssetDelivery: delivery,
    })

    await expect(
      application.downloadLearningPackAsset({
        packId: fixture.installedPack.packId,
        resourceId: 'resource-lab-01-notebook',
      }),
    ).rejects.toMatchObject({
      name: 'LearningApplicationError',
      code: 'pack-asset-delivery-unavailable',
    })
    expect(delivery.requests).toEqual([])
  })
})

describe('LearntApplication sessions', () => {
  it('starts a session by subject ID and derives active context from profile, subject, and persisted state', async () => {
    const application = createTestApplication()

    const context = await application.startSession({
      subjectId: SubjectIdSchema.parse('logic-basics'),
      interactionMode: 'coach',
    })

    expect(context.record.revision).toBe(0)
    expect(context.record.subjectVersion).toBe('0.1.0')
    expect(context.learner.learnerId).toBe('demo-learner')
    expect(context.subject.id).toBe('logic-basics')
    expect(context.currentModule?.id).toBe('boolean-foundations')
    expect(context.currentActivity?.id).toBe('orient-boolean-values')
    expect(context.currentActivityProgress?.status).toBe('active')
    expect(context.presentationPolicy?.solutionReveal).toBe('immediate')
    expect(context.progress).toEqual({
      unseen: 7,
      active: 1,
      attempted: 0,
      completed: 0,
      total: 8,
    })
    expect(Object.isFrozen(context)).toBe(true)

    const library = await application.listSessions()
    expect(library.sessions).toHaveLength(1)
    expect(library.sessions[0]).toMatchObject({
      sessionId: 'session-0',
      subjectTitle: 'Logic Basics',
      sessionStatus: 'active',
      availability: 'ready',
      currentModuleTitle: 'Boolean Foundations',
      currentActivityTitle: 'Orient to Boolean values',
    })
  })

  it('persists incorrect attempts, successful retries, advancement, mode change, and reload context', async () => {
    const storage = new FakeStorage()
    const application = createTestApplication(storage)
    let context = await moveLogicSessionToConjunction(application)

    expect(context.currentActivity?.id).toBe('predict-conjunction')

    const retry = await application.submitEvidence({
      sessionId: context.record.session.id,
      activityId: ActivityIdSchema.parse('predict-conjunction'),
      response: { kind: 'single-choice', optionId: 'option-true' },
    })
    expect(retry.evaluation.status).toBe('retry')
    expect(retry.context.currentActivityProgress?.status).toBe('attempted')
    expect(retry.context.record.evidenceEvents).toHaveLength(5)

    const passed = await application.submitEvidence({
      sessionId: context.record.session.id,
      activityId: ActivityIdSchema.parse('predict-conjunction'),
      response: { kind: 'single-choice', optionId: 'option-false' },
    })
    expect(passed.evaluation.status).toBe('passed')
    expect(passed.context.currentActivityProgress?.status).toBe('completed')
    expect(passed.context.latestCurrentActivityEvaluation?.status).toBe(
      'passed',
    )

    context = await application.advanceSession({
      sessionId: context.record.session.id,
    })
    expect(context.currentActivity?.id).toBe('predict-disjunction')

    const flowContext = await application.changeInteractionMode({
      sessionId: context.record.session.id,
      interactionMode: 'flow',
    })
    expect(flowContext.record.session.interactionMode).toBe('flow')
    expect(flowContext.presentationPolicy?.hintAccess).toBe('on-request')

    const reloaded = createTestApplication(storage)
    const restored = await reloaded.getSessionContext(context.record.session.id)
    expect(restored.record.session.id).toBe('session-0')
    expect(restored.record.session.interactionMode).toBe('flow')
    expect(restored.currentActivity?.id).toBe('predict-disjunction')
    expect(restored.record.evidenceEvents.map((event) => event.id)).toEqual([
      'evidence-0',
      'evidence-1',
      'evidence-2',
      'evidence-3',
      'evidence-4',
      'evidence-5',
    ])
    expect(restored.latestCurrentActivityEvaluation).toBeNull()
  })

  it('runs Machine Learning Foundations through the facade, persistence, retry, reload, and recap', async () => {
    const storage = new FakeStorage()
    const application = createTestApplication(storage)
    const subjectId = SubjectIdSchema.parse('machine-learning-foundations')
    const listed = application
      .listSubjects()
      .find((subject) => subject.id === subjectId)
    const overview = application.getSubjectOverview(subjectId)

    expect(listed).toMatchObject({
      id: 'machine-learning-foundations',
      title: 'Machine Learning Foundations',
      version: '0.1.0',
    })
    expect(overview.orderedModules.map((module) => module.id)).toEqual([
      'the-learning-system',
      'linear-models-as-functions',
      'loss-gradients-and-optimization',
      'classification-scores-and-probability',
      'generalization-and-evaluation',
      'bridge-to-deep-learning',
    ])

    let context = await application.startSession({ subjectId })
    expect(context.currentActivity?.id).toBe('orient-learning-loop')
    expect(context.record.subjectVersion).toBe('0.1.0')
    expect(context.presentationPolicy).not.toBeNull()

    const manual = await application.submitEvidence({
      sessionId: context.record.session.id,
      activityId: ActivityIdSchema.parse('orient-learning-loop'),
      response: { kind: 'manual', completed: true },
    })
    expect(manual.evaluation.status).toBe('passed')
    context = await application.advanceSession({
      sessionId: context.record.session.id,
    })
    expect(context.currentActivity?.id).toBe('predict-serving-update')

    const retry = await application.submitEvidence({
      sessionId: context.record.session.id,
      activityId: ActivityIdSchema.parse('predict-serving-update'),
      response: {
        kind: 'single-choice',
        optionId: 'option-update-weights',
      },
    })
    expect(retry.evaluation.status).toBe('retry')
    expect(retry.context.record.evidenceEvents).toHaveLength(2)

    const passed = await application.submitEvidence({
      sessionId: context.record.session.id,
      activityId: ActivityIdSchema.parse('predict-serving-update'),
      response: {
        kind: 'single-choice',
        optionId: 'option-inference-no-update',
      },
    })
    expect(passed.evaluation.status).toBe('passed')
    expect(passed.context.record.evidenceEvents).toHaveLength(3)
    expect(passed.context.record.session.subjectId).toBe(subjectId)

    context = await application.advanceSession({
      sessionId: context.record.session.id,
    })
    expect(context.currentActivity?.id).toBe('classify-system-parts')

    const reloaded = createTestApplication(storage)
    const restored = await reloaded.getSessionContext(context.record.session.id)
    const recap = await reloaded.getSessionRecap(context.record.session.id)
    const predictionRecap = recap.modules
      .flatMap((module) => module.activities)
      .find((activity) => activity.activityId === 'predict-serving-update')

    expect(restored.subject.id).toBe(subjectId)
    expect(restored.subject.version).toBe('0.1.0')
    expect(restored.currentActivity?.id).toBe('classify-system-parts')
    expect(restored.record.evidenceEvents).toHaveLength(3)
    expect(recap.subject.id).toBe(subjectId)
    expect(recap.currentThread?.activityId).toBe('classify-system-parts')
    expect(predictionRecap?.attemptCount).toBe(2)
    expect(
      predictionRecap?.attempts.map((attempt) => attempt.evaluation.status),
    ).toEqual(['retry', 'passed'])
  })

  it('derives session-bound concept exploration without changing persisted session state', async () => {
    const storage = new FakeStorage()
    const application = createTestApplication(storage)
    const context = await application.startSession({
      subjectId: SubjectIdSchema.parse('logic-basics'),
    })
    const rawBefore = storage.raw(storageKey(context.record.session.id))

    const exploration = await application.getSessionConceptExploration(
      context.record.session.id,
      ConceptIdSchema.parse('boolean-values'),
    )
    const repeated = await application.getSessionConceptExploration(
      context.record.session.id,
      ConceptIdSchema.parse('boolean-values'),
    )
    const contextAfterRead = await application.getSessionContext(
      context.record.session.id,
    )

    expect(repeated).toEqual(exploration)
    expect(storage.raw(storageKey(context.record.session.id))).toBe(rawBefore)
    expect(contextAfterRead.record.revision).toBe(context.record.revision)
    expect(contextAfterRead.record.session.lastActiveAt).toBe(
      context.record.session.lastActiveAt,
    )
    expect(contextAfterRead.record.evidenceEvents).toEqual([])
    expect(exploration).toMatchObject({
      sessionId: context.record.session.id,
      sessionStatus: 'active',
      interactionMode: 'coach',
      subject: {
        id: 'logic-basics',
        version: '0.1.0',
        title: 'Logic Basics',
      },
      concept: {
        conceptId: 'boolean-values',
        title: 'Boolean values',
      },
      currentThread: {
        activityId: 'orient-boolean-values',
        activityStatus: 'active',
        action: 'return-to-activity',
      },
      isParked: false,
      parkedPaths: [],
    })
    expect(exploration.prerequisiteConcepts).toEqual([])
    expect(
      exploration.dependentConcepts.map((concept) => concept.conceptId),
    ).toEqual([
      'logical-negation',
      'logical-conjunction',
      'logical-disjunction',
    ])
    expect(
      exploration.relatedConcepts.map((concept) => concept.conceptId),
    ).toEqual([
      'logical-negation',
      'logical-conjunction',
      'logical-disjunction',
    ])
    expect(
      exploration.objectives.map((objective) => objective.objectiveId),
    ).toEqual(['identify-boolean-values', 'predict-negation'])
    expect(
      exploration.activities.map((activity) => [
        activity.activityId,
        activity.status,
        activity.isCurrentThread,
      ]),
    ).toEqual([
      ['orient-boolean-values', 'active', true],
      ['predict-negation', 'unseen', false],
      ['recall-boolean-values', 'unseen', false],
    ])
    expect(Object.isFrozen(exploration)).toBe(true)
    expect(Object.isFrozen(exploration.relatedConcepts)).toBe(true)

    await expect(
      application.getSessionConceptExploration(
        context.record.session.id,
        ConceptIdSchema.parse('missing-concept'),
      ),
    ).rejects.toMatchObject({ code: 'concept-not-found' })
  })

  it('parks and unparks concepts through the facade using committed records only', async () => {
    const application = createTestApplication()
    const context = await application.startSession({
      subjectId: SubjectIdSchema.parse('logic-basics'),
    })

    const parked = await application.parkConcept({
      sessionId: context.record.session.id,
      conceptId: ConceptIdSchema.parse('logical-conjunction'),
    })
    const afterPark = await application.getSessionContext(
      context.record.session.id,
    )
    const unparked = await application.unparkConcept({
      sessionId: context.record.session.id,
      conceptId: ConceptIdSchema.parse('logical-conjunction'),
    })

    expect(parked.isParked).toBe(true)
    expect(parked.parkedPaths.map((concept) => concept.conceptId)).toEqual([
      'logical-conjunction',
    ])
    expect(afterPark.record.revision).toBe(1)
    expect(afterPark.record.evidenceEvents).toEqual([])
    expect(afterPark.record.session.currentActivityId).toBe(
      context.record.session.currentActivityId,
    )
    expect(afterPark.parkedPaths.map((concept) => concept.conceptId)).toEqual([
      'logical-conjunction',
    ])
    expect(unparked.isParked).toBe(false)
    expect(unparked.parkedPaths).toEqual([])
  })

  it('allows read-only concept exploration for terminal sessions and rejects terminal parked-path mutation', async () => {
    const application = createTestApplication()
    const context = await application.startSession({
      subjectId: SubjectIdSchema.parse('logic-basics'),
    })
    const abandoned = await application.abandonSession({
      sessionId: context.record.session.id,
    })

    const exploration = await application.getSessionConceptExploration(
      abandoned.record.session.id,
      ConceptIdSchema.parse('boolean-values'),
    )

    expect(exploration.sessionStatus).toBe('abandoned')
    expect(exploration.currentThread).toBeNull()
    await expect(
      application.parkConcept({
        sessionId: abandoned.record.session.id,
        conceptId: ConceptIdSchema.parse('logical-conjunction'),
      }),
    ).rejects.toMatchObject({ code: 'session-state-incompatible' })
  })

  it('fails closed when parked paths cannot be resolved against the registered subject', async () => {
    const storage = new FakeStorage()
    const application = createTestApplication(storage)
    const context = await application.startSession({
      subjectId: SubjectIdSchema.parse('logic-basics'),
    })
    const raw = storage.raw(storageKey(context.record.session.id))

    if (raw === null) {
      throw new Error('Expected stored session JSON.')
    }

    const stored = JSON.parse(raw) as {
      session: { exploration: { parkedConceptIds: string[] } }
    }
    stored.session.exploration.parkedConceptIds = ['missing-concept']
    storage.setRaw(
      storageKey(context.record.session.id),
      JSON.stringify(stored),
    )

    await expect(
      application.getSessionConceptExploration(
        context.record.session.id,
        ConceptIdSchema.parse('boolean-values'),
      ),
    ).rejects.toMatchObject({ code: 'session-state-incompatible' })
    await expect(
      application.getSessionContext(context.record.session.id),
    ).rejects.toMatchObject({ code: 'session-state-incompatible' })
  })

  it('keeps unavailable sessions visible in the library and throws structured errors when opened', async () => {
    const storage = new FakeStorage()
    const application = createTestApplication(storage)
    const repository = new LocalStorageLearningRepository(storage)
    const engine = new LearningEngine({
      clock: new SequenceClock(),
      idGenerator: new SequenceIds(),
    })
    const started = engine.startSession({
      subject: firstProductionSubject(),
      learnerId: LearnerIdSchema.parse('demo-learner'),
      profileId: LearnerProfileIdSchema.parse('demo-learner-v1'),
    })

    await repository.createSession({
      subjectVersion: '9.9.9',
      session: started,
    })

    const missingSubject = deepFreeze(
      LearningSessionSchema.parse({
        ...cloneDeep(started),
        id: SessionIdSchema.parse('session-1'),
        subjectId: SubjectIdSchema.parse('missing-subject'),
      }),
    )
    await repository.createSession({
      subjectVersion: '0.1.0',
      session: missingSubject,
    })

    const wrongLearner = deepFreeze(
      LearningSessionSchema.parse({
        ...cloneDeep(started),
        id: SessionIdSchema.parse('session-2'),
        learnerId: LearnerIdSchema.parse('other-learner'),
        profileId: LearnerProfileIdSchema.parse('other-profile'),
      }),
    )
    await repository.createSession({
      subjectVersion: '0.1.0',
      session: wrongLearner,
    })

    const library = await application.listSessions()
    expect(
      library.sessions.map((session) => session.availability).sort(),
    ).toEqual([
      'learner-profile-mismatch',
      'subject-not-registered',
      'subject-version-mismatch',
    ])

    await expect(
      application.getSessionContext(started.id),
    ).rejects.toMatchObject({
      code: 'subject-version-mismatch',
    })
    await expect(
      application.getSessionContext(missingSubject.id),
    ).rejects.toMatchObject({
      code: 'subject-not-found',
    })
    await expect(
      application.getSessionContext(wrongLearner.id),
    ).rejects.toMatchObject({
      code: 'learner-profile-mismatch',
    })
  })

  it('preserves branch behavior and returns abandoned contexts without current activity', async () => {
    const application = createTestApplication()
    let context = await moveLogicSessionToConjunction(application)
    const passed = await application.submitEvidence({
      sessionId: context.record.session.id,
      activityId: ActivityIdSchema.parse('predict-conjunction'),
      response: { kind: 'single-choice', optionId: 'option-false' },
    })
    context = await application.advanceSession({
      sessionId: context.record.session.id,
    })
    const disjunctionPassed = await application.submitEvidence({
      sessionId: context.record.session.id,
      activityId: ActivityIdSchema.parse('predict-disjunction'),
      response: { kind: 'single-choice', optionId: 'option-true' },
    })

    expect(
      disjunctionPassed.context.nextActivities.map(
        (option) => option.activityId,
      ),
    ).toEqual(['debug-access-rule', 'transfer-release-gate'])
    await expect(
      application.advanceSession({ sessionId: context.record.session.id }),
    ).rejects.toMatchObject({ code: 'next-activity-selection-required' })

    const abandoned = await application.abandonSession({
      sessionId: passed.context.record.session.id,
    })
    expect(abandoned.record.session.status).toBe('abandoned')
    expect(abandoned.currentActivity).toBeNull()
    expect(abandoned.presentationPolicy).toBeNull()
    expect(abandoned.record.evidenceEvents.length).toBeGreaterThan(0)
  })
})
