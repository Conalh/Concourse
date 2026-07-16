import { describe, expect, it } from 'vitest'

import {
  createPackAssetTestFixture,
  packAssetBytes,
} from '../test/pack-asset-fixture'
import { resolvePackAssetDownload } from './pack-asset-runtime'

describe('pack-asset application convergence', () => {
  it('resolves a defensive copy of the active release bytes', async () => {
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
    expect(download.bytes).not.toBe(fixture.activeRelease.files[0]?.bytes)
  })
})
