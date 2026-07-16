import type { PackAssetMediaType } from '@learnt/learning-pack-contracts'
import { sha256Hex } from '@learnt/learning-pack-sdk/browser'

import type { InstalledLearningPackRelease } from '../learning-packs/installed-learning-pack-ports'
import type { InstalledLearningPack } from '../learning-packs/learnt-importer'
import { LearningApplicationError } from './learning-application-error'

export type PackAssetDownload = Readonly<{
  suggestedFileName: string
  mediaType: PackAssetMediaType
  bytes: Uint8Array
}>

export type ResolvePackAssetDownloadInput = Readonly<{
  installedPack: InstalledLearningPack
  activeRelease: InstalledLearningPackRelease
  resourceId: string
}>

export async function resolvePackAssetDownload(
  input: ResolvePackAssetDownloadInput,
): Promise<PackAssetDownload> {
  const resource = input.installedPack.documents.resources?.resources.find(
    (candidate) => candidate.id === input.resourceId,
  )
  if (resource === undefined || resource.source.kind !== 'pack-asset') {
    throw new LearningApplicationError(
      'session-state-incompatible',
      'Pack asset resource was not found in the installed pack.',
      {
        details: {
          packId: input.installedPack.packId,
          resourceId: input.resourceId,
        },
      },
    )
  }

  const releaseManifest = input.activeRelease.documents.manifest
  if (
    input.activeRelease.packVersion !== input.installedPack.packVersion ||
    releaseManifest.version !== input.activeRelease.packVersion ||
    releaseManifest.packId !== input.installedPack.packId
  ) {
    throw packAssetIntegrityError(
      input,
      'The active installed release does not match the runtime pack identity.',
    )
  }

  const releaseResource =
    input.activeRelease.documents.resources?.resources.find(
      (candidate) => candidate.id === input.resourceId,
    )
  if (
    releaseResource === undefined ||
    releaseResource.source.kind !== 'pack-asset' ||
    releaseResource.source.assetId !== resource.source.assetId ||
    releaseResource.source.mediaType !== resource.source.mediaType ||
    releaseResource.source.suggestedFileName !==
      resource.source.suggestedFileName
  ) {
    throw packAssetIntegrityError(
      input,
      'The active installed release resource does not match the runtime resource.',
    )
  }
  const releaseSource = releaseResource.source

  const manifestEntry = releaseManifest.files.find(
    (candidate) => candidate.assetId === releaseSource.assetId,
  )
  if (
    manifestEntry === undefined ||
    manifestEntry.role !== 'asset' ||
    manifestEntry.mediaType !== releaseSource.mediaType
  ) {
    throw packAssetIntegrityError(
      input,
      'The active installed release manifest does not match the pack asset resource.',
    )
  }

  const file = input.activeRelease.files.find(
    (candidate) => candidate.path === manifestEntry.path,
  )
  if (file === undefined) {
    throw packAssetIntegrityError(
      input,
      'The active installed release is missing the canonical pack asset file.',
    )
  }

  if (
    file.size !== file.bytes.byteLength ||
    manifestEntry.bytes !== file.bytes.byteLength ||
    file.sha256 !== manifestEntry.sha256
  ) {
    throw packAssetIntegrityError(
      input,
      'The canonical pack asset metadata does not match its manifest entry.',
    )
  }

  const actualSha256 = await sha256Hex(file.bytes)
  if (actualSha256 !== manifestEntry.sha256) {
    throw packAssetIntegrityError(
      input,
      'The canonical pack asset bytes do not match the manifest SHA-256.',
    )
  }

  return {
    suggestedFileName: releaseSource.suggestedFileName,
    mediaType: releaseSource.mediaType,
    bytes: new Uint8Array(file.bytes),
  }
}

function packAssetIntegrityError(
  input: ResolvePackAssetDownloadInput,
  message: string,
): LearningApplicationError {
  return new LearningApplicationError('pack-asset-integrity-failed', message, {
    details: {
      packId: input.installedPack.packId,
      packVersion: input.installedPack.packVersion,
      resourceId: input.resourceId,
      activeReleaseId: input.activeRelease.releaseId,
    },
  })
}
