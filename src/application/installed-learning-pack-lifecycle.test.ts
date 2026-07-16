import { createLogicFoundationsRelease } from '@learnt/learning-pack-contracts'
import { describe, expect, it } from 'vitest'

import {
  activeInstalledLearningPackRelease,
  planInstalledPackChange,
  type ValidatedLearningPackCandidate,
} from './installed-learning-pack-lifecycle'

function candidate(
  version: Parameters<typeof createLogicFoundationsRelease>[0],
  contentHash: string,
): ValidatedLearningPackCandidate {
  const bytes = new TextEncoder().encode(version)
  return {
    contentHash,
    documents: createLogicFoundationsRelease(version),
    files: [
      {
        path: 'fixture.bin',
        bytes,
        sha256: contentHash,
        size: bytes.byteLength,
      },
    ],
  }
}

function installedV1Record() {
  const change = planInstalledPackChange({
    existing: null,
    candidate: candidate('1.0.0', 'hash-v1'),
  })

  if (change.kind !== 'install') {
    throw new Error('Expected an install plan.')
  }

  return change.record
}

describe('installed learning pack release lifecycle', () => {
  it('creates one active release for a first install', () => {
    const change = planInstalledPackChange({
      existing: null,
      candidate: candidate('1.0.0', 'hash-v1'),
    })

    expect(change).toMatchObject({
      kind: 'install',
      record: {
        packId: 'learnt.logic-foundations',
        activeReleaseId: 'hash-v1',
        rollbackReleaseId: null,
      },
    })
    if (change.kind === 'install') {
      expect(activeInstalledLearningPackRelease(change.record)).toMatchObject({
        packVersion: '1.0.0',
        contentHash: 'hash-v1',
        files: [expect.objectContaining({ path: 'fixture.bin' })],
      })
    }
  })

  it('treats an identical release as an idempotent reinstall', () => {
    const existing = installedV1Record()

    const change = planInstalledPackChange({
      existing,
      candidate: candidate('1.0.0', 'hash-v1'),
    })

    expect(change).toEqual({ kind: 'reinstall', record: existing })
  })

  it('activates a higher version and retains the prior release for rollback', () => {
    const change = planInstalledPackChange({
      existing: installedV1Record(),
      candidate: candidate('2.0.0', 'hash-v2'),
    })

    expect(change).toMatchObject({
      kind: 'upgrade',
      fromVersion: '1.0.0',
      record: {
        activeReleaseId: 'hash-v2',
        rollbackReleaseId: 'hash-v1',
      },
    })
    if (change.kind === 'upgrade') {
      expect(change.record.releases).toHaveLength(2)
      expect(activeInstalledLearningPackRelease(change.record)).toMatchObject({
        packVersion: '2.0.0',
        files: [expect.objectContaining({ path: 'fixture.bin' })],
      })
      expect(change.record.releases[1]).toMatchObject({
        packVersion: '1.0.0',
        files: [expect.objectContaining({ path: 'fixture.bin' })],
      })
    }
  })

  it('rejects a same-version content conflict without replacing v1', () => {
    const existing = installedV1Record()

    const change = planInstalledPackChange({
      existing,
      candidate: candidate('1.0.0', 'different-v1-content'),
    })

    expect(change).toEqual({
      kind: 'reject',
      reason: 'same-version-content-conflict',
      record: existing,
    })
    expect(activeInstalledLearningPackRelease(existing)).toMatchObject({
      packVersion: '1.0.0',
      contentHash: 'hash-v1',
    })
  })

  it('rejects a lower version without replacing the active release', () => {
    const initial = planInstalledPackChange({
      existing: installedV1Record(),
      candidate: candidate('2.0.0', 'hash-v2'),
    })
    if (initial.kind !== 'upgrade') {
      throw new Error('Expected an upgrade plan.')
    }

    const change = planInstalledPackChange({
      existing: initial.record,
      candidate: candidate('1.0.1', 'hash-v1.0.1'),
    })

    expect(change).toEqual({
      kind: 'reject',
      reason: 'downgrade-blocked',
      record: initial.record,
    })
  })
})
