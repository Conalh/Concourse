import { createValidLearningPackFixture } from '@learnt/learning-pack-contracts'
import {
  canonicalizePackFilesForPacking,
  stableJsonBytes,
  type PackFileRecord,
} from '@learnt/learning-pack-sdk'
import { loadLearningPackFromFilesAsync } from '@learnt/learning-pack-sdk/browser'
import { describe, expect, it } from 'vitest'

import {
  planInstalledPackChange,
  type InstalledLearningPackRecord,
  type ValidatedLearningPackCandidate,
} from '../../application'
import {
  decodeInstalledLearningPackRecord,
  encodeInstalledLearningPackRecord,
} from './installed-learning-pack-record-codec'

const identityBytes = (value: unknown): Uint8Array | null => {
  if (
    !ArrayBuffer.isView(value) ||
    Object.prototype.toString.call(value) !== '[object Uint8Array]'
  ) {
    return null
  }
  const view = value as Uint8Array
  const bytes = new Uint8Array(view.byteLength)
  bytes.set(view)
  return bytes
}

describe('installed learning pack record codec', () => {
  it('round-trips a valid byte-backed active and rollback pair', async () => {
    const v1 = await candidate('1.0.0')
    const installed = planInstalledPackChange({ existing: null, candidate: v1 })
    if (installed.kind !== 'install') throw new Error('Expected install.')
    const v2 = await candidate('2.0.0')
    const upgraded = planInstalledPackChange({
      existing: installed.record,
      candidate: v2,
    })
    if (upgraded.kind !== 'upgrade') throw new Error('Expected upgrade.')

    const decoded = await decodeInstalledLearningPackRecord(
      encodeInstalledLearningPackRecord(upgraded.record, (bytes) => bytes),
      identityBytes,
    )

    if ('issue' in decoded) throw new Error(decoded.issue.message)
    expect(decoded.record).toMatchObject({
      packId: upgraded.record.packId,
      activeReleaseId: upgraded.record.activeReleaseId,
      rollbackReleaseId: upgraded.record.rollbackReleaseId,
    })
    expect(decoded.record.releases).toHaveLength(2)
    for (const [index, release] of upgraded.record.releases.entries()) {
      const restored = decoded.record.releases[index]
      expect(restored).toMatchObject({
        releaseId: release.releaseId,
        packVersion: release.packVersion,
        contentHash: release.contentHash,
        documents: release.documents,
      })
      expect(
        restored?.files.map((file) => ({
          path: file.path,
          sha256: file.sha256,
          size: file.size,
          bytes: [...file.bytes],
        })),
      ).toEqual(
        release.files.map((file) => ({
          path: file.path,
          sha256: file.sha256,
          size: file.size,
          bytes: [...file.bytes],
        })),
      )
    }
  })

  it('fails closed on a legacy document-only record with the re-sync message', async () => {
    const legacy = await installedRecord('1.0.0')
    const decoded = await decodeInstalledLearningPackRecord(
      legacy,
      identityBytes,
    )

    expect(decoded).toEqual({
      issue: {
        packId: legacy.packId,
        message:
          'Installed pack data uses a legacy format and must be re-synced. Learner progress was retained.',
      },
    })
  })

  for (const [name, mutate] of [
    [
      'canonical bytes',
      (record: MutablePersistedRecord) => {
        firstFile(record).bytes = new Uint8Array([1, 2, 3])
      },
    ],
    [
      'stored content hash',
      (record: MutablePersistedRecord) => {
        firstRelease(record).contentHash = '0'.repeat(64)
      },
    ],
    [
      'release ID',
      (record: MutablePersistedRecord) => {
        firstRelease(record).releaseId = '0'.repeat(64)
      },
    ],
    [
      'pack ID',
      (record: MutablePersistedRecord) => {
        record.packId = 'tampered.pack'
      },
    ],
    [
      'manifest version projection',
      (record: MutablePersistedRecord) => {
        firstRelease(record).packVersion = '9.9.9'
      },
    ],
    [
      'file size',
      (record: MutablePersistedRecord) => {
        firstFile(record).size += 1
      },
    ],
    [
      'file hash',
      (record: MutablePersistedRecord) => {
        firstFile(record).sha256 = 'f'.repeat(64)
      },
    ],
  ] as const) {
    it(`rejects a record with tampered ${name}`, async () => {
      const persisted = mutablePersistedRecord(await installedRecord('1.0.0'))
      mutate(persisted)

      const decoded = await decodeInstalledLearningPackRecord(
        persisted,
        identityBytes,
      )

      expect(decoded).toMatchObject({
        issue: {
          packId:
            name === 'pack ID' ? 'tampered.pack' : 'learnt.logic-basics-core',
        },
      })
      if (!('issue' in decoded)) throw new Error('Expected a decode issue.')
      expect(decoded.issue.message).toContain('could not be restored')
    })
  }

  it('rejects missing and duplicate canonical files', async () => {
    const missing = mutablePersistedRecord(await installedRecord('1.0.0'))
    firstRelease(missing).files.shift()
    const duplicate = mutablePersistedRecord(await installedRecord('1.0.0'))
    firstRelease(duplicate).files.push({ ...firstFile(duplicate) })

    const missingResult = await decodeInstalledLearningPackRecord(
      missing,
      identityBytes,
    )
    expect(missingResult).toMatchObject({
      issue: { packId: 'learnt.logic-basics-core' },
    })
    if (!('issue' in missingResult)) throw new Error('Expected missing issue.')
    expect(missingResult.issue.message).toContain('could not be restored')

    const duplicateResult = await decodeInstalledLearningPackRecord(
      duplicate,
      identityBytes,
    )
    expect(duplicateResult).toMatchObject({
      issue: { packId: 'learnt.logic-basics-core' },
    })
    if (!('issue' in duplicateResult)) {
      throw new Error('Expected duplicate issue.')
    }
    expect(duplicateResult.issue.message).toContain('duplicate')
  })
})

async function installedRecord(
  version: string,
): Promise<InstalledLearningPackRecord> {
  const planned = planInstalledPackChange({
    existing: null,
    candidate: await candidate(version),
  })
  if (planned.kind !== 'install') throw new Error('Expected install.')
  return planned.record
}

async function candidate(
  version: string,
): Promise<ValidatedLearningPackCandidate> {
  const pack = createValidLearningPackFixture()
  pack.manifest.version = version
  const sourceFiles = [
    file('pack.json', stableJsonBytes(pack.manifest)),
    file('catalog.json', stableJsonBytes(pack.catalog)),
    file('courses.json', stableJsonBytes(pack.courses)),
    file('items.json', stableJsonBytes(pack.items)),
    file('sets.json', stableJsonBytes(pack.sets)),
    file('assets/cover.png', new Uint8Array([137, 80, 78, 71])),
  ]
  const canonical = canonicalizePackFilesForPacking(sourceFiles)
  if (!('documents' in canonical)) {
    throw new Error('Could not canonicalize pack fixture.')
  }
  const loaded = await loadLearningPackFromFilesAsync(
    'memory',
    pack.manifest.packId,
    canonical.files,
  )
  if (!('documents' in loaded)) {
    throw new Error('Could not load pack fixture.')
  }
  return {
    contentHash: loaded.contentHash,
    documents: loaded.documents,
    files: loaded.files,
  }
}

function file(path: string, bytes: Uint8Array): PackFileRecord {
  return { path, bytes, sha256: '', size: bytes.byteLength }
}

interface MutablePersistedFile {
  path: string
  bytes: unknown
  sha256: string
  size: number
}

interface MutablePersistedRelease {
  releaseId: string
  packVersion: string
  contentHash: string
  files: MutablePersistedFile[]
}

interface MutablePersistedRecord {
  recordVersion: number
  packId: string
  activeReleaseId: string
  rollbackReleaseId: string | null
  releases: MutablePersistedRelease[]
}

function firstRelease(record: MutablePersistedRecord): MutablePersistedRelease {
  const release = record.releases[0]
  if (release === undefined) throw new Error('Expected a persisted release.')
  return release
}

function firstFile(record: MutablePersistedRecord): MutablePersistedFile {
  const file = firstRelease(record).files[0]
  if (file === undefined) throw new Error('Expected a persisted file.')
  return file
}

function mutablePersistedRecord(
  record: InstalledLearningPackRecord,
): MutablePersistedRecord {
  return encodeInstalledLearningPackRecord(
    record,
    (bytes) => bytes,
  ) as MutablePersistedRecord
}
