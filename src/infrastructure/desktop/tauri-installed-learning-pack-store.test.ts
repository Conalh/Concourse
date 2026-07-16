import { createValidLearningPackFixture } from '@learnt/learning-pack-contracts'
import {
  canonicalizePackFilesForPacking,
  stableJsonBytes,
  type PackFileRecord,
} from '@learnt/learning-pack-sdk'
import { loadLearningPackFromFilesAsync } from '@learnt/learning-pack-sdk/browser'
import { describe, expect, it } from 'vitest'

import { planInstalledPackChange } from '../../application'
import type { InstalledLearningPackRecord } from '../../learning-packs/installed-learning-pack-ports'
import { encodeInstalledLearningPackRecord } from '../learning-packs/installed-learning-pack-record-codec'
import {
  TauriInstalledLearningPackStore,
  type TauriInstalledLearningPackStoreBridge,
} from './tauri-installed-learning-pack-store'

class InMemoryTauriInstalledPackBridge implements TauriInstalledLearningPackStoreBridge {
  records: unknown = []
  written: unknown[] = []

  readInstalledPackRecords(): Promise<unknown> {
    return Promise.resolve(this.records)
  }

  writeInstalledPackRecord(record: unknown): Promise<void> {
    this.written.push(record)
    return Promise.resolve()
  }
}

describe('TauriInstalledLearningPackStore', () => {
  it('reconstructs valid native records for the shared installed-pack lifecycle', async () => {
    const record = await installedRecord()
    const bridge = new InMemoryTauriInstalledPackBridge()
    bridge.records = [
      encodeInstalledLearningPackRecord(record, (bytes) => encodeBase64(bytes)),
    ]

    const snapshot = await new TauriInstalledLearningPackStore(
      bridge,
    ).readSnapshot()

    expect(snapshot.issues).toEqual([])
    expect(snapshot.records).toHaveLength(1)
    expect(snapshot.records[0]).toMatchObject({
      packId: record.packId,
      activeReleaseId: record.activeReleaseId,
    })
  })

  it('reports malformed native records without returning them to the lifecycle', async () => {
    const bridge = new InMemoryTauriInstalledPackBridge()
    bridge.records = [{ packId: 'corrupt-pack', releases: 'not-an-array' }]
    const store = new TauriInstalledLearningPackStore(bridge)

    const readSnapshot = Reflect.get(store, 'readSnapshot')
    expect(typeof readSnapshot).toBe('function')
    await expect(
      (readSnapshot as () => Promise<unknown>).call(store),
    ).resolves.toEqual({
      records: [],
      issues: [
        {
          packId: 'corrupt-pack',
          message: 'Stored installed-pack record has an invalid shape.',
        },
      ],
    })
  })

  it('returns a native read failure as an issue in the same snapshot', async () => {
    const bridge = new InMemoryTauriInstalledPackBridge()
    bridge.readInstalledPackRecords = () =>
      Promise.reject(new Error('native read failed'))
    const store = new TauriInstalledLearningPackStore(bridge)
    const readSnapshot = Reflect.get(store, 'readSnapshot')

    expect(typeof readSnapshot).toBe('function')
    await expect(
      (readSnapshot as () => Promise<unknown>).call(store),
    ).resolves.toEqual({
      records: [],
      issues: [{ packId: null, message: 'native read failed' }],
    })
  })

  it('writes the lifecycle record unchanged through the native bridge', async () => {
    const record = await installedRecord()
    const bridge = new InMemoryTauriInstalledPackBridge()
    const store = new TauriInstalledLearningPackStore(bridge)

    await store.write(record)

    expect(bridge.written).toHaveLength(1)
    const written = bridge.written[0] as {
      recordVersion: number
      packId: string
      releases: readonly Readonly<{
        documents?: unknown
        files: readonly Readonly<{ bytes: unknown }>[]
      }>[]
    }
    expect(written).toMatchObject({
      recordVersion: 2,
      packId: record.packId,
    })
    expect(written.releases[0]).not.toHaveProperty('documents')
    expect(written.releases[0]?.files.length).toBeGreaterThan(0)
    expect(
      written.releases[0]?.files.every(
        (file) => typeof file.bytes === 'string',
      ),
    ).toBe(true)
  })
})

async function installedRecord(): Promise<InstalledLearningPackRecord> {
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
  const candidate = await loadLearningPackFromFilesAsync(
    'memory',
    pack.manifest.packId,
    canonical.files,
  )
  if (!('documents' in candidate)) throw new Error('Invalid loaded fixture.')
  const planned = planInstalledPackChange({
    existing: null,
    candidate: {
      contentHash: candidate.contentHash,
      documents: candidate.documents,
      files: candidate.files,
    },
  })
  if (planned.kind !== 'install') {
    throw new Error('Expected a new installed-pack record.')
  }
  return planned.record
}

function file(path: string, bytes: Uint8Array): PackFileRecord {
  return { path, bytes, sha256: '', size: bytes.byteLength }
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}
