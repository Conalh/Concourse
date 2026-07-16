import { describe, expect, it } from 'vitest'

import { TauriPackAssetDelivery } from './tauri-pack-asset-delivery'

describe('TauriPackAssetDelivery', () => {
  it('returns cancellation without invoking a native write', async () => {
    const bridge = new RecordingPackAssetBridge(null)
    const delivery = new TauriPackAssetDelivery(bridge)

    await expect(delivery.save(request())).resolves.toBe('cancelled')
    expect(bridge.writes).toEqual([])
  })

  it('writes exact bytes to the learner-selected destination', async () => {
    const bridge = new RecordingPackAssetBridge('C:\\Labs\\module-01-lab.ipynb')
    const delivery = new TauriPackAssetDelivery(bridge)

    await expect(delivery.save(request())).resolves.toBe('saved')
    expect(bridge.writes).toHaveLength(1)
    expect(bridge.writes[0]?.destinationPath).toBe(
      'C:\\Labs\\module-01-lab.ipynb',
    )
    expect([...(bridge.writes[0]?.bytes ?? [])]).toEqual([1, 2, 3, 255])
  })

  it('propagates native write failures instead of reporting success', async () => {
    const bridge = new RecordingPackAssetBridge('C:\\Labs\\module-01-lab.ipynb')
    bridge.writeError = new Error('native write failed')
    const delivery = new TauriPackAssetDelivery(bridge)

    await expect(delivery.save(request())).rejects.toThrow(
      'native write failed',
    )
  })
})

function request() {
  return {
    suggestedFileName: 'module-01-lab.ipynb',
    mediaType: 'application/x-ipynb+json' as const,
    bytes: new Uint8Array([1, 2, 3, 255]),
  }
}

class RecordingPackAssetBridge {
  readonly writes: {
    destinationPath: string
    bytes: Uint8Array
  }[] = []
  writeError: Error | null = null
  private readonly destination: string | null

  constructor(destination: string | null) {
    this.destination = destination
  }

  choosePackAssetDestination(): Promise<string | null> {
    return Promise.resolve(this.destination)
  }

  writePackAsset(destinationPath: string, bytes: Uint8Array): Promise<void> {
    this.writes.push({ destinationPath, bytes })
    return this.writeError === null
      ? Promise.resolve()
      : Promise.reject(this.writeError)
  }
}
