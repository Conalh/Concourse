import type { LearningPackDocuments } from '@learnt/learning-pack-contracts'
import { describe, expect, it } from 'vitest'

import { cloneDeep } from '../core/foundation'
import type { InstalledLearningPack } from '../learning-packs/learnt-importer'
import {
  createPackAssetTestFixture,
  packAssetBytes,
} from '../test/pack-asset-fixture'
import { resolvePackAssetDownload } from './pack-asset-runtime'

describe('pack asset runtime', () => {
  it('returns a fresh copy of canonical active-release bytes', async () => {
    const fixture = createPackAssetTestFixture()

    const download = await resolvePackAssetDownload({
      installedPack: fixture.installedPack,
      activeRelease: fixture.activeRelease,
      resourceId: 'resource-lab-01-notebook',
    })

    expect(download).toMatchObject({
      suggestedFileName: 'module-01-lab.ipynb',
      mediaType: 'application/x-ipynb+json',
    })
    expect([...download.bytes]).toEqual([...packAssetBytes])
    expect(download.bytes).not.toBe(firstPackAssetFile(fixture).bytes)
  })

  it('rejects a missing runtime resource', async () => {
    const fixture = createPackAssetTestFixture()

    await expectResolutionFailure(
      {
        ...fixture,
        resourceId: 'missing-resource',
      },
      'session-state-incompatible',
    )
  })

  it('rejects a runtime resource that is not a pack asset', async () => {
    const fixture = createPackAssetTestFixture()
    const documents = cloneDeep(
      fixture.installedPack.documents,
    ) as LearningPackDocuments
    const resource = documents.resources?.resources[0]
    if (resource === undefined) {
      throw new Error('Expected the pack-asset fixture resource.')
    }
    resource.source = {
      kind: 'embedded-content',
      content: [],
    }
    const installedPack = {
      ...fixture.installedPack,
      documents,
    } as InstalledLearningPack

    await expectResolutionFailure(
      { ...fixture, installedPack },
      'session-state-incompatible',
    )
  })

  it('rejects an active release whose version differs from the runtime pack', async () => {
    const fixture = createPackAssetTestFixture()
    const activeRelease = {
      ...fixture.activeRelease,
      packVersion: '2.0.0',
    }

    await expectResolutionFailure({ ...fixture, activeRelease })
  })

  it('rejects an active release whose pack identity differs from the runtime pack', async () => {
    const fixture = createPackAssetTestFixture()
    const documents = cloneDeep(fixture.activeRelease.documents)
    documents.manifest.packId = 'learnt.different-pack'
    const activeRelease = { ...fixture.activeRelease, documents }

    await expectResolutionFailure({ ...fixture, activeRelease })
  })

  it('rejects a missing canonical file record', async () => {
    const fixture = createPackAssetTestFixture()
    const activeRelease = { ...fixture.activeRelease, files: [] }

    await expectResolutionFailure({ ...fixture, activeRelease })
  })

  it('rejects a canonical file whose path does not match the manifest', async () => {
    const fixture = createPackAssetTestFixture()
    const activeRelease = {
      ...fixture.activeRelease,
      files: [
        {
          ...firstPackAssetFile(fixture),
          path: 'assets/labs/different.ipynb',
        },
      ],
    }

    await expectResolutionFailure({ ...fixture, activeRelease })
  })

  it('rejects a canonical file whose recorded hash does not match the manifest', async () => {
    const fixture = createPackAssetTestFixture()
    const activeRelease = {
      ...fixture.activeRelease,
      files: [
        {
          ...firstPackAssetFile(fixture),
          sha256: 'f'.repeat(64),
        },
      ],
    }

    await expectResolutionFailure({ ...fixture, activeRelease })
  })

  it('rejects a canonical file whose recorded size does not match its bytes', async () => {
    const fixture = createPackAssetTestFixture()
    const activeRelease = {
      ...fixture.activeRelease,
      files: [
        {
          ...firstPackAssetFile(fixture),
          size: packAssetBytes.byteLength + 1,
        },
      ],
    }

    await expectResolutionFailure({ ...fixture, activeRelease })
  })

  it('rejects canonical bytes whose recalculated hash does not match the manifest', async () => {
    const fixture = createPackAssetTestFixture()
    const tamperedBytes = new TextEncoder().encode('tampered notebook')
    const activeRelease = {
      ...fixture.activeRelease,
      files: [
        {
          ...firstPackAssetFile(fixture),
          bytes: tamperedBytes,
          size: tamperedBytes.byteLength,
        },
      ],
    }

    await expectResolutionFailure({ ...fixture, activeRelease })
  })

  it('rejects an active manifest media type that differs from the resource', async () => {
    const fixture = createPackAssetTestFixture()
    const documents = cloneDeep(fixture.activeRelease.documents)
    const manifestEntry = documents.manifest.files.find(
      (file) => file.assetId === 'lab-01-notebook',
    )
    if (manifestEntry === undefined) {
      throw new Error('Expected the pack-asset fixture manifest entry.')
    }
    manifestEntry.mediaType = 'text/x-python'
    const activeRelease = { ...fixture.activeRelease, documents }

    await expectResolutionFailure({ ...fixture, activeRelease })
  })
})

type PackAssetFixture = ReturnType<typeof createPackAssetTestFixture>

function firstPackAssetFile(fixture: PackAssetFixture) {
  const file = fixture.activeRelease.files.find(
    (candidate) => candidate.path === 'assets/labs/module-01-lab.ipynb',
  )
  if (file === undefined) {
    throw new Error('Expected the pack-asset fixture notebook file.')
  }
  return file
}

async function expectResolutionFailure(
  fixture: Pick<PackAssetFixture, 'installedPack' | 'activeRelease'> & {
    resourceId?: string
  },
  code = 'pack-asset-integrity-failed',
): Promise<void> {
  await expect(
    resolvePackAssetDownload({
      installedPack: fixture.installedPack,
      activeRelease: fixture.activeRelease,
      resourceId: fixture.resourceId ?? 'resource-lab-01-notebook',
    }),
  ).rejects.toMatchObject({
    name: 'LearningApplicationError',
    code,
  })
}
