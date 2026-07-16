import { IDBFactory } from 'fake-indexeddb'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'

import { composeLearntApplication } from '../../app'
import type {
  InstalledLearningPackStore,
  PackAssetSaveRequest,
  PackAssetSaveResult,
} from '../../application'
import type { Clock, LearningIdGenerator } from '../../core/ports'
import {
  BrowserLearningPackStateStore,
  InMemoryResourceEngagementStore,
  LocalStorageLearningRepository,
  type StorageLike,
} from '../../infrastructure'
import type {
  InstalledLearningPackRecord,
  InstalledLearningPackStoreSnapshot,
} from '../../learning-packs/installed-learning-pack-ports'
import {
  createPersistedPackAssetTestFixture,
  packAssetBytes,
  packAssetCsvBytes,
} from '../../test/pack-asset-fixture'
import { App } from './App'
import { LearntApplicationProvider } from './LearntApplicationProvider'

describe('pack asset delivery product boundary', () => {
  beforeEach(() => {
    clockSequence = 0
    window.location.hash = '#/'
  })

  it('restores, saves exact notebook bytes, reloads, and cancels a CSV save without learner-state changes', async () => {
    const fixture = await createPersistedPackAssetTestFixture()
    const indexedDB = new IDBFactory()
    const databaseName = 'pack-asset-product-save-cancel'
    const learningStorage = new FakeStorage()
    const engagementStore = new InMemoryResourceEngagementStore()
    const firstStore = new BrowserLearningPackStateStore({
      indexedDB,
      databaseName,
    })
    await firstStore.write(installedRecord(fixture.activeRelease))
    const delivery = new RecordingDelivery()
    const first = createApplication({
      learningStorage,
      engagementStore,
      packStore: firstStore,
      delivery,
    })
    const restored = await first.restoreInstalledLearningPacks(firstStore)
    expect(restored.states).toEqual([])
    expect(restored.installed).toHaveLength(1)
    await expect(
      first.getLearningResource({
        packId: fixture.installedPack.packId,
        resourceId: 'resource-lab-01-notebook',
      }),
    ).resolves.toMatchObject({ title: 'Module 1 learner notebook' })
    window.location.hash = resourceHash('resource-lab-01-notebook')
    const rendered = renderProduct(first)
    const user = userEvent.setup()

    expect(
      await screen.findByRole('heading', {
        name: 'Module 1 learner notebook',
      }),
    ).toBeInTheDocument()
    const beforeSave = await snapshotLearnerAndPackState({
      application: first,
      learningStorage,
      engagementStore,
      packStore: firstStore,
    })

    await user.click(
      screen.getByRole('button', { name: 'Download module-01-lab.ipynb' }),
    )

    expect(
      await screen.findByText('Save request completed.'),
    ).toBeInTheDocument()
    expect(delivery.requests).toHaveLength(1)
    expect(delivery.requests[0]).toMatchObject({
      suggestedFileName: 'module-01-lab.ipynb',
      mediaType: 'application/x-ipynb+json',
    })
    expect([...(delivery.requests[0]?.bytes ?? [])]).toEqual([
      ...packAssetBytes,
    ])
    expect(
      await snapshotLearnerAndPackState({
        application: first,
        learningStorage,
        engagementStore,
        packStore: firstStore,
      }),
    ).toEqual(beforeSave)

    rendered.unmount()
    const reloadedStore = new BrowserLearningPackStateStore({
      indexedDB,
      databaseName,
    })
    const reloaded = createApplication({
      learningStorage,
      engagementStore,
      packStore: reloadedStore,
      delivery,
    })
    await reloaded.restoreInstalledLearningPacks(reloadedStore)
    await expect(
      reloaded.getLearningResource({
        packId: fixture.installedPack.packId,
        resourceId: 'resource-lab-01-data',
      }),
    ).resolves.toMatchObject({ title: 'Module 1 sample data' })
    window.location.hash = resourceHash('resource-lab-01-data')
    renderProduct(reloaded)

    expect(
      await screen.findByRole('heading', { name: 'Module 1 sample data' }),
    ).toBeInTheDocument()
    const beforeCancellation = await snapshotLearnerAndPackState({
      application: reloaded,
      learningStorage,
      engagementStore,
      packStore: reloadedStore,
    })
    delivery.result = 'cancelled'

    await user.click(
      screen.getByRole('button', { name: 'Download module-01-data.csv' }),
    )

    expect(await screen.findByText(/Save cancelled/i)).toBeInTheDocument()
    expect(delivery.requests).toHaveLength(2)
    expect(delivery.requests[1]).toMatchObject({
      suggestedFileName: 'module-01-data.csv',
      mediaType: 'text/csv',
    })
    expect([...(delivery.requests[1]?.bytes ?? [])]).toEqual([
      ...packAssetCsvBytes,
    ])
    expect(
      await snapshotLearnerAndPackState({
        application: reloaded,
        learningStorage,
        engagementStore,
        packStore: reloadedStore,
      }),
    ).toEqual(beforeCancellation)
  })

  it('rejects tampered persisted bytes before calling the delivery adapter and preserves the active release', async () => {
    const fixture = await createPersistedPackAssetTestFixture()
    const tamperedRelease = {
      ...fixture.activeRelease,
      files: fixture.activeRelease.files.map((file) =>
        file.path === 'assets/labs/module-01-lab.ipynb'
          ? { ...file, bytes: new Uint8Array([...file.bytes, 1]) }
          : file,
      ),
    }
    const goodRecord = installedRecord(fixture.activeRelease)
    const packStore = new MutableInstalledPackStore(goodRecord)
    const learningStorage = new FakeStorage()
    const engagementStore = new InMemoryResourceEngagementStore()
    const delivery = new RecordingDelivery()
    const application = createApplication({
      learningStorage,
      engagementStore,
      packStore,
      delivery,
    })
    await application.restoreInstalledLearningPacks(packStore)
    packStore.record = installedRecord(tamperedRelease)
    const setup = {
      application,
      learningStorage,
      engagementStore,
      packStore,
      delivery,
      record: goodRecord,
    }
    window.location.hash = resourceHash('resource-lab-01-notebook')
    renderProduct(setup.application)
    const user = userEvent.setup()

    await screen.findByRole('heading', { name: 'Module 1 learner notebook' })
    const beforeFailure = await snapshotLearnerAndPackState(setup)
    await user.click(
      screen.getByRole('button', { name: 'Download module-01-lab.ipynb' }),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'pack-asset-integrity-failed',
    )
    expect(setup.delivery.requests).toEqual([])
    expect(await snapshotLearnerAndPackState(setup)).toEqual(beforeFailure)
    expect(activeReleaseIds(await setup.packStore.readSnapshot())).toEqual({
      activeReleaseId: setup.record.activeReleaseId,
      rollbackReleaseId: null,
    })
  })

  it('shows a write failure after one delivery attempt without changing learner or release state', async () => {
    const fixture = await createPersistedPackAssetTestFixture()
    const setup = await createRestoredSetup(
      'pack-asset-product-write-failure',
      installedRecord(fixture.activeRelease),
    )
    setup.delivery.error = new Error('injected disk write failure')
    window.location.hash = resourceHash('resource-lab-01-notebook')
    renderProduct(setup.application)
    const user = userEvent.setup()

    await screen.findByRole('heading', { name: 'Module 1 learner notebook' })
    const beforeFailure = await snapshotLearnerAndPackState(setup)
    await user.click(
      screen.getByRole('button', { name: 'Download module-01-lab.ipynb' }),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unexpected application error',
    )
    expect(setup.delivery.requests).toHaveLength(1)
    expect([...(setup.delivery.requests[0]?.bytes ?? [])]).toEqual([
      ...packAssetBytes,
    ])
    expect(await snapshotLearnerAndPackState(setup)).toEqual(beforeFailure)
    expect(activeReleaseIds(await setup.packStore.readSnapshot())).toEqual({
      activeReleaseId: setup.record.activeReleaseId,
      rollbackReleaseId: null,
    })
  })
})

class RecordingDelivery {
  readonly requests: PackAssetSaveRequest[] = []
  result: PackAssetSaveResult = 'saved'
  error: Error | null = null

  save(request: PackAssetSaveRequest): Promise<PackAssetSaveResult> {
    this.requests.push(request)
    return this.error === null
      ? Promise.resolve(this.result)
      : Promise.reject(this.error)
  }
}

class MutableInstalledPackStore implements InstalledLearningPackStore {
  record: InstalledLearningPackRecord

  constructor(record: InstalledLearningPackRecord) {
    this.record = record
  }

  readSnapshot(): Promise<InstalledLearningPackStoreSnapshot> {
    return Promise.resolve({ records: [this.record], issues: [] })
  }

  write(record: InstalledLearningPackRecord): Promise<void> {
    this.record = record
    return Promise.resolve()
  }
}

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

  snapshot(): readonly (readonly [string, string])[] {
    return [...this.values.entries()].sort(([left], [right]) =>
      left.localeCompare(right),
    )
  }
}

let clockSequence = 0

class SequenceClock implements Clock {
  now(): Date {
    const value = new Date(
      `2026-07-11T12:${String(clockSequence).padStart(2, '0')}:00.000Z`,
    )
    clockSequence += 1
    return value
  }
}

class FixedIds implements LearningIdGenerator {
  createSessionId(): string {
    return 'session-pack-asset-product'
  }

  createEvidenceId(): string {
    return 'evidence-pack-asset-product'
  }
}

function createApplication(input: {
  learningStorage: FakeStorage
  engagementStore: InMemoryResourceEngagementStore
  packStore: InstalledLearningPackStore
  delivery: RecordingDelivery
}) {
  return composeLearntApplication({
    clock: new SequenceClock(),
    idGenerator: new FixedIds(),
    repository: new LocalStorageLearningRepository(input.learningStorage),
    resourceEngagementStore: input.engagementStore,
    installedLearningPackStore: input.packStore,
    packAssetDelivery: input.delivery,
  })
}

function renderProduct(application: ReturnType<typeof createApplication>) {
  return render(
    <LearntApplicationProvider application={application}>
      <App />
    </LearntApplicationProvider>,
  )
}

async function createRestoredSetup(
  databaseName: string,
  record: InstalledLearningPackRecord,
) {
  const indexedDB = new IDBFactory()
  const learningStorage = new FakeStorage()
  const engagementStore = new InMemoryResourceEngagementStore()
  const packStore = new BrowserLearningPackStateStore({
    indexedDB,
    databaseName,
  })
  const delivery = new RecordingDelivery()
  await packStore.write(record)
  const application = createApplication({
    learningStorage,
    engagementStore,
    packStore,
    delivery,
  })
  const restored = await application.restoreInstalledLearningPacks(packStore)
  expect(restored.states).toEqual([])
  expect(restored.installed).toHaveLength(1)
  return {
    application,
    learningStorage,
    engagementStore,
    packStore,
    delivery,
    record,
  }
}

async function snapshotLearnerAndPackState(input: {
  application: ReturnType<typeof createApplication>
  learningStorage: FakeStorage
  engagementStore: InMemoryResourceEngagementStore
  packStore: InstalledLearningPackStore
}) {
  return {
    sessionsEvidenceAndProgress: input.learningStorage.snapshot(),
    sessionLibrary: await input.application.listSessions(),
    resourceEngagement:
      await input.engagementStore.listResourceEngagementEvents(),
    installedPackSnapshot: await input.packStore.readSnapshot(),
  }
}

function installedRecord(
  activeRelease: Awaited<
    ReturnType<typeof createPersistedPackAssetTestFixture>
  >['activeRelease'],
): InstalledLearningPackRecord {
  return {
    packId: activeRelease.documents.manifest.packId,
    activeReleaseId: activeRelease.releaseId,
    rollbackReleaseId: null,
    releases: [activeRelease],
  }
}

function resourceHash(resourceId: string): string {
  return `#/packs/learnt.pack-asset-fixture/resources/${resourceId}`
}

function activeReleaseIds(snapshot: InstalledLearningPackStoreSnapshot) {
  return {
    activeReleaseId: snapshot.records[0]?.activeReleaseId,
    rollbackReleaseId: snapshot.records[0]?.rollbackReleaseId,
  }
}
