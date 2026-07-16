import type {
  PackAssetDeliveryPort,
  PackAssetSaveRequest,
  PackAssetSaveResult,
} from '../../learning-packs/pack-asset-delivery-port'

export type BrowserDownloadHost = Readonly<{
  createObjectUrl(blob: Blob): string
  clickDownload(url: string, fileName: string): void
  revokeObjectUrl(url: string): void
}>

export class BrowserPackAssetDelivery implements PackAssetDeliveryPort {
  private readonly host: BrowserDownloadHost

  constructor(host: BrowserDownloadHost = browserDownloadHost) {
    this.host = host
  }

  async save(request: PackAssetSaveRequest): Promise<PackAssetSaveResult> {
    await Promise.resolve()
    const bytes = new Uint8Array(request.bytes)
    const blob = new Blob([bytes.buffer], {
      type: request.mediaType,
    })
    const url = this.host.createObjectUrl(blob)

    try {
      this.host.clickDownload(url, request.suggestedFileName)
      return 'saved'
    } finally {
      this.host.revokeObjectUrl(url)
    }
  }
}

const browserDownloadHost: BrowserDownloadHost = {
  createObjectUrl(blob) {
    return URL.createObjectURL(blob)
  },
  clickDownload(url, fileName) {
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = fileName
    anchor.click()
  },
  revokeObjectUrl(url) {
    URL.revokeObjectURL(url)
  },
}
