import type { PackAssetMediaType } from '@learnt/learning-pack-contracts'

export type PackAssetSaveRequest = Readonly<{
  suggestedFileName: string
  mediaType: PackAssetMediaType
  bytes: Uint8Array
}>

export type PackAssetSaveResult = 'saved' | 'cancelled'

export interface PackAssetDeliveryPort {
  save(request: PackAssetSaveRequest): Promise<PackAssetSaveResult>
}
