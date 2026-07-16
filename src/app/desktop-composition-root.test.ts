import {
  createLogicFoundationsRelease,
  type LearningPackDocuments,
} from '@learnt/learning-pack-contracts'
import {
  canonicalizePackFilesForPacking,
  stableJsonBytes,
  type PackFileRecord,
} from '@learnt/learning-pack-sdk'
import { describe, expect, it } from 'vitest'

import type {
  InstalledLearningPackRecord,
  InstalledLearningPackStore,
  LearningPackSourcePort,
  LearningPackSourceReadResult,
} from '../application'
import {
  createDesktopLearntApplication,
  createTauriDesktopLearntApplication,
} from './desktop-composition-root'
import type { TauriInstalledLearningPackStoreBridge } from '../infrastructure/desktop/tauri-installed-learning-pack-store'
import type { TauriLearningPackSourceBridge } from '../infrastructure/desktop/tauri-learning-pack-source'

class InMemoryInstalledLearningPackStore implements InstalledLearningPackStore {
  private readonly records = new Map<string, InstalledLearningPackRecord>()

  readSnapshot(): Promise<
    Readonly<{
      records: readonly InstalledLearningPackRecord[]
      issues: readonly []
    }>
  > {
    return Promise.resolve({
      records: [...this.records.values()],
      issues: [],
    })
  }

  write(record: InstalledLearningPackRecord): Promise<void> {
    this.records.set(record.packId, record)
    return Promise.resolve()
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

class FixedTauriDesktopBridge
  implements
    TauriLearningPackSourceBridge,
    TauriInstalledLearningPackStoreBridge
{
  private readonly result: unknown
  private readonly records: unknown[] = []

  constructor(result: unknown) {
    this.result = result
  }

  chooseCourseFolder(): Promise<string | null> {
    return Promise.resolve('C:\\Courses')
  }

  loadSelectedCourseFolder(): Promise<string | null> {
    return Promise.resolve('C:\\Courses')
  }

  saveSelectedCourseFolder(): Promise<void> {
    return Promise.resolve()
  }

  readCourseFolderCandidates(): Promise<unknown> {
    return Promise.resolve(this.result)
  }

  readInstalledPackRecords(): Promise<unknown> {
    return Promise.resolve(this.records)
  }

  writeInstalledPackRecord(record: unknown): Promise<void> {
    const packId =
      typeof record === 'object' &&
      record !== null &&
      typeof (record as Readonly<{ packId?: unknown }>).packId === 'string'
        ? (record as Readonly<{ packId: string }>).packId
        : null
    const index = this.records.findIndex(
      (value) =>
        typeof value === 'object' &&
        value !== null &&
        (value as Readonly<{ packId?: unknown }>).packId === packId,
    )
    if (index >= 0) {
      this.records[index] = record
    } else {
      this.records.push(record)
    }
    return Promise.resolve()
  }
}

describe('createDesktopLearntApplication', () => {
  it('syncs a native source through the shared installed-pack lifecycle', async () => {
    const sourcePort = new FixedLearningPackSource({
      sourceName: 'Courses',
      scannedDirectoryCount: 1,
      candidates: [
        {
          directoryName: 'logic',
          packId: 'learnt.logic-foundations',
          packVersion: '2.0.0',
          title: 'Logic Foundations',
          diagnostics: [],
          candidate: {
            contentHash: 'logic-v2',
            documents: createLogicFoundationsRelease('2.0.0'),
            files: [],
          },
        },
      ],
      rejectedCandidates: [],
    })
    const installedPackStore = new InMemoryInstalledLearningPackStore()

    const application = await createDesktopLearntApplication({
      sourcePort,
      installedPackStore,
    })
    const result = await application.syncSelectedLearningPackDirectory()

    expect(result).toMatchObject({
      sourceName: 'Courses',
      outcomes: [
        expect.objectContaining({
          status: 'installed',
          packId: 'learnt.logic-foundations',
        }),
      ],
    })
    expect((await application.getLearningPackLibrary()).packs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          packId: 'learnt.logic-foundations',
          packVersion: '2.0.0',
        }),
      ]),
    )
    expect((await installedPackStore.readSnapshot()).records).toEqual([
      expect.objectContaining({
        packId: 'learnt.logic-foundations',
      }),
    ])
  })

  it('rehydrates persisted active releases before the first desktop sync', async () => {
    const sourcePort = new FixedLearningPackSource(null)
    const installedPackStore = new InMemoryInstalledLearningPackStore()
    const first = await createDesktopLearntApplication({
      sourcePort,
      installedPackStore,
    })
    await first.installValidatedLearningPack({
      contentHash: 'logic-v1',
      documents: createLogicFoundationsRelease('1.0.0'),
      files: [],
    })

    const reloaded = await createDesktopLearntApplication({
      sourcePort,
      installedPackStore,
    })

    expect((await reloaded.getLearningPackLibrary()).packs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          packId: 'learnt.logic-foundations',
          packVersion: '1.0.0',
        }),
      ]),
    )
  })

  it('builds Tauri source and store adapters around one native bridge', async () => {
    const bridge = new FixedTauriDesktopBridge({
      sourceName: 'Courses',
      scannedDirectoryCount: 1,
      candidates: [
        {
          directoryName: 'logic',
          files: nativePackFiles(createLogicFoundationsRelease('2.0.0')),
        },
      ],
      diagnostics: [],
    })

    const application = await createTauriDesktopLearntApplication({ bridge })
    await application.syncSelectedLearningPackDirectory()

    expect(await bridge.readInstalledPackRecords()).toEqual([
      expect.objectContaining({
        packId: 'learnt.logic-foundations',
      }),
    ])
  })
})

function nativePackFiles(pack: LearningPackDocuments) {
  const canonical = canonicalizePackFilesForPacking([
    file('pack.json', stableJsonBytes(pack.manifest)),
    file('catalog.json', stableJsonBytes(pack.catalog)),
    file('courses.json', stableJsonBytes(pack.courses)),
    file('items.json', stableJsonBytes(pack.items)),
    file('sets.json', stableJsonBytes(pack.sets)),
    ...(pack.resources === undefined
      ? []
      : [file('resources.json', stableJsonBytes(pack.resources))]),
    ...(pack.theme === undefined
      ? []
      : [file('theme.json', stableJsonBytes(pack.theme))]),
    ...(pack.migrations === undefined
      ? []
      : [file('migrations.json', stableJsonBytes(pack.migrations))]),
    ...pack.manifest.files
      .filter((entry) => entry.role === 'asset')
      .map((entry) =>
        file(entry.path, new TextEncoder().encode(`asset:${entry.path}`)),
      ),
  ])
  if (!('documents' in canonical)) {
    throw new Error('Could not create pack fixture.')
  }
  return canonical.files.map((entry) => ({
    relativePath: entry.path,
    bytes: [...entry.bytes],
  }))
}

function file(path: string, bytes: Uint8Array): PackFileRecord {
  return {
    path,
    bytes,
    sha256: '',
    size: bytes.byteLength,
  }
}
