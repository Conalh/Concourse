import type {
  PackAssetDeliveryPort,
  PackAssetSaveRequest,
  PackAssetSaveResult,
} from '../../learning-packs/pack-asset-delivery-port'

export interface TauriPackAssetDeliveryBridge {
  choosePackAssetDestination(
    input: Readonly<{
      suggestedFileName: string
      mediaType: string
    }>,
  ): Promise<string | null>
  writePackAsset(destinationPath: string, bytes: Uint8Array): Promise<void>
}

export class TauriPackAssetDelivery implements PackAssetDeliveryPort {
  private readonly bridge: TauriPackAssetDeliveryBridge

  constructor(bridge: TauriPackAssetDeliveryBridge) {
    this.bridge = bridge
  }

  async save(request: PackAssetSaveRequest): Promise<PackAssetSaveResult> {
    const destinationPath = await this.bridge.choosePackAssetDestination({
      suggestedFileName: request.suggestedFileName,
      mediaType: request.mediaType,
    })
    if (destinationPath === null) {
      return 'cancelled'
    }

    await this.bridge.writePackAsset(
      destinationPath,
      new Uint8Array(request.bytes),
    )
    return 'saved'
  }
}
