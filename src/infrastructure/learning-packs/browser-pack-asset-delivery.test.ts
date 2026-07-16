import { describe, expect, it } from 'vitest'

import { BrowserPackAssetDelivery } from './browser-pack-asset-delivery'

describe('BrowserPackAssetDelivery', () => {
  it('dispatches exact Blob bytes with the proposed filename and revokes the URL', async () => {
    const host = new RecordingBrowserDownloadHost()
    const delivery = new BrowserPackAssetDelivery(host)
    const bytes = new Uint8Array([0, 1, 2, 127, 255])

    const result = await delivery.save({
      suggestedFileName: 'module-01-lab.ipynb',
      mediaType: 'application/x-ipynb+json',
      bytes,
    })

    expect(result).toBe('saved')
    expect(host.createdBlobs).toHaveLength(1)
    expect(host.createdBlobs[0]?.type).toBe('application/x-ipynb+json')
    expect([
      ...new Uint8Array(await host.createdBlobs[0]!.arrayBuffer()),
    ]).toEqual([...bytes])
    expect(host.clicks).toEqual([
      { url: 'blob:pack-asset-1', fileName: 'module-01-lab.ipynb' },
    ])
    expect(host.revokedUrls).toEqual(['blob:pack-asset-1'])
  })

  it('revokes the object URL when download dispatch fails', async () => {
    const host = new RecordingBrowserDownloadHost()
    host.clickError = new Error('browser rejected download')
    const delivery = new BrowserPackAssetDelivery(host)

    await expect(
      delivery.save({
        suggestedFileName: 'module-01-lab.py',
        mediaType: 'text/x-python',
        bytes: new Uint8Array([112, 114, 105, 110, 116]),
      }),
    ).rejects.toThrow('browser rejected download')
    expect(host.revokedUrls).toEqual(['blob:pack-asset-1'])
  })
})

class RecordingBrowserDownloadHost {
  readonly createdBlobs: Blob[] = []
  readonly clicks: Array<{ url: string; fileName: string }> = []
  readonly revokedUrls: string[] = []
  clickError: Error | null = null

  createObjectUrl(blob: Blob): string {
    this.createdBlobs.push(blob)
    return `blob:pack-asset-${String(this.createdBlobs.length)}`
  }

  clickDownload(url: string, fileName: string): void {
    this.clicks.push({ url, fileName })
    if (this.clickError !== null) {
      throw this.clickError
    }
  }

  revokeObjectUrl(url: string): void {
    this.revokedUrls.push(url)
  }
}
