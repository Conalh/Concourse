import { describe, expect, it } from 'vitest'

import { TauriPackAssetDelivery } from './tauri-pack-asset-delivery'

describe('Tauri pack asset delivery convergence', () => {
  it('does not issue a native write when the learner cancels the destination picker', async () => {
    const bridge = {
      choosePackAssetDestination: () => Promise.resolve(null),
      writePackAsset: () => Promise.reject(new Error('must not write')),
    }
    const delivery = new TauriPackAssetDelivery(bridge)

    await expect(
      delivery.save({
        suggestedFileName: 'module-01-lab.ipynb',
        mediaType: 'application/x-ipynb+json',
        bytes: new Uint8Array([1, 2, 3]),
      }),
    ).resolves.toBe('cancelled')
  })
})
