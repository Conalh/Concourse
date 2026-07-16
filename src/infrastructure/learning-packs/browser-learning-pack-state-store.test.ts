import { createValidLearningPackFixture } from '@learnt/learning-pack-contracts'
import {
  canonicalizePackFilesForPacking,
  stableJsonBytes,
  type PackFileRecord,
} from '@learnt/learning-pack-sdk'
import { loadLearningPackFromFilesAsync } from '@learnt/learning-pack-sdk/browser'
import { IDBFactory } from 'fake-indexeddb'
import { describe, expect, it } from 'vitest'

import {
  planInstalledPackChange,
  type InstalledLearningPackRecord,
  type ValidatedLearningPackCandidate,
} from '../../application'
import {
  BrowserLearningPackSourceStore,
  BrowserLearningPackStateStore,
} from './browser-learning-pack-state-store'

const databaseName = 'concourse-learning-packs-v1-test'

async function v1Record(): Promise<InstalledLearningPackRecord> {
  const change = planInstalledPackChange({
    existing: null,
    candidate: await candidate(),
  })
  if (change.kind !== 'install') {
    throw new Error('Expected an install record.')
  }
  return change.record
}

async function candidate(): Promise<ValidatedLearningPackCandidate> {
  const pack = createValidLearningPackFixture()
  const canonical = canonicalizePackFilesForPacking([
    file('pack.json', stableJsonBytes(pack.manifest)),
    file('catalog.json', stableJsonBytes(pack.catalog)),
    file('courses.json', stableJsonBytes(pack.courses)),
    file('items.json', stableJsonBytes(pack.items)),
    file('sets.json', stableJsonBytes(pack.sets)),
    file('assets/cover.png', new Uint8Array([137, 80, 78, 71])),
  ])
  if (!('documents' in canonical)) throw new Error('Invalid test fixture.')
  const loaded = await loadLearningPackFromFilesAsync(
    'memory',
    pack.manifest.packId,
    canonical.files,
  )
  if (!('documents' in loaded)) throw new Error('Invalid loaded fixture.')
  return {
    contentHash: loaded.contentHash,
    documents: loaded.documents,
    files: loaded.files,
  }
}

function file(path: string, bytes: Uint8Array): PackFileRecord {
  return { path, bytes, sha256: '', size: bytes.byteLength }
}

describe('BrowserLearningPackStateStore', () => {
  it('persists installed pack records across store instances', async () => {
    const indexedDB = new IDBFactory()
    const record = await v1Record()
    const first = new BrowserLearningPackStateStore({
      indexedDB,
      databaseName,
    })

    await first.write(record)

    const raw = await readRawRecord(indexedDB, databaseName, record.packId)
    expect(raw).toMatchObject({
      recordVersion: 2,
      packId: record.packId,
    })
    const rawRelease = (
      raw as {
        releases: readonly Readonly<{
          documents?: unknown
          files: readonly Readonly<{ bytes: unknown }>[]
        }>[]
      }
    ).releases[0]
    expect(rawRelease?.files.length).toBeGreaterThan(0)
    expect(rawRelease).not.toHaveProperty('documents')
    expect(ArrayBuffer.isView(rawRelease?.files[0]?.bytes)).toBe(true)

    const reloaded = new BrowserLearningPackStateStore({
      indexedDB,
      databaseName,
    })
    const snapshot = await reloaded.readSnapshot()
    expect(snapshot.issues).toEqual([])
    expect(snapshot.records).toHaveLength(1)
    expect(snapshot.records[0]).toMatchObject({
      packId: record.packId,
      activeReleaseId: record.activeReleaseId,
    })
  })

  it('persists the selected directory handle across store instances', async () => {
    const indexedDB = new IDBFactory()
    const directoryHandle = { name: 'Courses' }
    const first = new BrowserLearningPackSourceStore({
      indexedDB,
      databaseName,
    })

    await first.saveSelectedDirectory(directoryHandle)

    const reloaded = new BrowserLearningPackSourceStore({
      indexedDB,
      databaseName,
    })
    await expect(reloaded.loadSelectedDirectory()).resolves.toEqual(
      directoryHandle,
    )
  })

  it('reports a corrupt stored record without hiding valid records', async () => {
    const indexedDB = new IDBFactory()
    const record = await v1Record()
    const store = new BrowserLearningPackStateStore({
      indexedDB,
      databaseName,
    })
    await store.write(record)
    await writeRawRecord(indexedDB, databaseName, {
      packId: 'corrupt-pack',
      releases: 'not-an-array',
    })

    const readSnapshot = Reflect.get(store, 'readSnapshot')
    expect(typeof readSnapshot).toBe('function')
    const snapshot = await (
      readSnapshot as () => Promise<
        Readonly<{
          records: readonly InstalledLearningPackRecord[]
          issues: readonly Readonly<{ packId: string | null }>[]
        }>
      >
    ).call(store)
    expect(snapshot.records).toHaveLength(1)
    expect(snapshot.records[0]).toMatchObject({
      packId: record.packId,
      activeReleaseId: record.activeReleaseId,
    })
    expect(snapshot.issues).toEqual([
      expect.objectContaining({ packId: 'corrupt-pack' }),
    ])
  })

  it('fails closed on a legacy record and replaces it after a validated re-sync', async () => {
    const indexedDB = new IDBFactory()
    const record = await v1Record()
    const store = new BrowserLearningPackStateStore({ indexedDB, databaseName })
    await store.readSnapshot()
    await writeRawRecord(indexedDB, databaseName, record)

    await expect(store.readSnapshot()).resolves.toEqual({
      records: [],
      issues: [
        {
          packId: record.packId,
          message:
            'Installed pack data uses a legacy format and must be re-synced. Learner progress was retained.',
        },
      ],
    })

    await store.write(record)

    const restored = await store.readSnapshot()
    expect(restored.issues).toEqual([])
    expect(restored.records[0]).toMatchObject({
      packId: record.packId,
      activeReleaseId: record.activeReleaseId,
    })
  })
})

async function writeRawRecord(
  indexedDB: IDBFactory,
  name: string,
  value: unknown,
): Promise<void> {
  const database = await requestAsPromise(indexedDB.open(name))
  const transaction = database.transaction(
    'installed-pack-records',
    'readwrite',
  )
  transaction.objectStore('installed-pack-records').put(value)
  await transactionAsPromise(transaction)
  database.close()
}

async function readRawRecord(
  indexedDB: IDBFactory,
  name: string,
  packId: string,
): Promise<unknown> {
  const database = await requestAsPromise(indexedDB.open(name))
  const transaction = database.transaction('installed-pack-records', 'readonly')
  const value: unknown = await requestAsPromise(
    transaction.objectStore('installed-pack-records').get(packId),
  )
  await transactionAsPromise(transaction)
  database.close()
  return value
}

function requestAsPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.addEventListener('success', () => {
      resolve(request.result)
    })
    request.addEventListener('error', () => {
      reject(request.error ?? new Error('IndexedDB request failed.'))
    })
  })
}

function transactionAsPromise(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.addEventListener('complete', () => {
      resolve()
    })
    transaction.addEventListener('error', () => {
      reject(transaction.error ?? new Error('IndexedDB transaction failed.'))
    })
    transaction.addEventListener('abort', () => {
      reject(transaction.error ?? new Error('IndexedDB transaction aborted.'))
    })
  })
}
