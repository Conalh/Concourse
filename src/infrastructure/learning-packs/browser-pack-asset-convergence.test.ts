import { describe, expect, it } from 'vitest'

import { BrowserPackAssetDelivery } from './browser-pack-asset-delivery'

describe('browser pack-asset convergence', () => {
  it('downloads verified bytes and always revokes the object URL', async () => {
    const calls: string[] = []
    const delivery = new BrowserPackAssetDelivery({
      createObjectUrl(blob) {
        calls.push(`create:${blob.type}:${blob.size}`)
        return 'blob:verified-asset'
      },
      clickDownload(url, fileName) {
        calls.push(`click:${url}:${fileName}`)
      },
      revokeObjectUrl(url) {
        calls.push(`revoke:${url}`)
      },
    })

    await expect(
      delivery.save({
        suggestedFileName: 'lab.ipynb',
        mediaType: 'application/x-ipynb+json',
        bytes: new Uint8Array([1, 2, 3]),
      }),
    ).resolves.toBe('saved')
    expect(calls).toEqual([
      'create:application/x-ipynb+json:3',
      'click:blob:verified-asset:lab.ipynb',
      'revoke:blob:verified-asset',
    ])
  })
})
