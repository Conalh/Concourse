import type { PackFileRecord } from '@learnt/learning-pack-sdk'
import { loadLearningPackFromFilesAsync } from '@learnt/learning-pack-sdk/browser'

import type {
  InstalledLearningPackRecord,
  InstalledLearningPackRelease,
  PersistedLearningPackRecordIssue,
} from '../../learning-packs/installed-learning-pack-ports'

export const INSTALLED_LEARNING_PACK_RECORD_VERSION = 2 as const
export const LEGACY_INSTALLED_PACK_MESSAGE =
  'Installed pack data uses a legacy format and must be re-synced. Learner progress was retained.'

export type PersistedBytesEncoder = (bytes: Uint8Array) => unknown
export type PersistedBytesDecoder = (value: unknown) => Uint8Array | null

export type DecodedInstalledLearningPackRecord =
  | Readonly<{ record: InstalledLearningPackRecord }>
  | Readonly<{ issue: PersistedLearningPackRecordIssue }>

type PersistedPackFileV2 = Readonly<{
  path: string
  bytes: unknown
  sha256: string
  size: number
}>

type PersistedReleaseV2 = Readonly<{
  releaseId: string
  packVersion: string
  contentHash: string
  files: readonly PersistedPackFileV2[]
}>

type PersistedRecordV2 = Readonly<{
  recordVersion: typeof INSTALLED_LEARNING_PACK_RECORD_VERSION
  packId: string
  activeReleaseId: string
  rollbackReleaseId: string | null
  releases: readonly PersistedReleaseV2[]
}>

export function encodeInstalledLearningPackRecord(
  record: InstalledLearningPackRecord,
  encodeBytes: PersistedBytesEncoder,
): PersistedRecordV2 {
  return {
    recordVersion: INSTALLED_LEARNING_PACK_RECORD_VERSION,
    packId: record.packId,
    activeReleaseId: record.activeReleaseId,
    rollbackReleaseId: record.rollbackReleaseId,
    releases: record.releases.map((release) => ({
      releaseId: release.releaseId,
      packVersion: release.packVersion,
      contentHash: release.contentHash,
      files: release.files.map((file) => ({
        path: file.path,
        bytes: encodeBytes(file.bytes),
        sha256: file.sha256,
        size: file.size,
      })),
    })),
  }
}

export async function decodeInstalledLearningPackRecord(
  value: unknown,
  decodeBytes: PersistedBytesDecoder,
): Promise<DecodedInstalledLearningPackRecord> {
  const packId = readPackId(value)
  if (isLegacyRecord(value)) {
    return { issue: { packId, message: LEGACY_INSTALLED_PACK_MESSAGE } }
  }
  if (!isPersistedRecordV2(value)) {
    return {
      issue: {
        packId,
        message: 'Stored installed-pack record has an invalid shape.',
      },
    }
  }
  if (value.releases.length < 1 || value.releases.length > 2) {
    return invalid(
      packId,
      'Stored installed-pack record has an invalid release count.',
    )
  }

  const releases: InstalledLearningPackRelease[] = []
  for (const persistedRelease of value.releases) {
    const decoded = await decodeRelease(
      value.packId,
      persistedRelease,
      decodeBytes,
    )
    if ('message' in decoded) {
      return invalid(packId, decoded.message)
    }
    releases.push(decoded.release)
  }

  const releaseIds = new Set(releases.map((release) => release.releaseId))
  if (releaseIds.size !== releases.length) {
    return invalid(
      packId,
      'Stored installed-pack record has duplicate release IDs.',
    )
  }
  if (!releaseIds.has(value.activeReleaseId)) {
    return invalid(
      packId,
      'Stored installed-pack record has no valid active release.',
    )
  }
  if (
    value.rollbackReleaseId !== null &&
    (value.rollbackReleaseId === value.activeReleaseId ||
      !releaseIds.has(value.rollbackReleaseId))
  ) {
    return invalid(
      packId,
      'Stored installed-pack record has an invalid rollback release.',
    )
  }
  const referencedReleaseCount = value.rollbackReleaseId === null ? 1 : 2
  if (referencedReleaseCount !== releases.length) {
    return invalid(
      packId,
      'Stored installed-pack record has an unreferenced release.',
    )
  }

  return {
    record: {
      packId: value.packId,
      activeReleaseId: value.activeReleaseId,
      rollbackReleaseId: value.rollbackReleaseId,
      releases,
    },
  }
}

async function decodeRelease(
  recordPackId: string,
  value: PersistedReleaseV2,
  decodeBytes: PersistedBytesDecoder,
): Promise<
  | Readonly<{ release: InstalledLearningPackRelease }>
  | Readonly<{ message: string }>
> {
  const files: PackFileRecord[] = []
  const paths = new Set<string>()
  for (const persistedFile of value.files) {
    if (paths.has(persistedFile.path)) {
      return {
        message: `Stored installed-pack release has duplicate file path ${persistedFile.path}.`,
      }
    }
    paths.add(persistedFile.path)
    const bytes = decodeBytes(persistedFile.bytes)
    if (bytes === null) {
      return {
        message: `Stored installed-pack file ${persistedFile.path} has invalid bytes.`,
      }
    }
    if (bytes.byteLength !== persistedFile.size) {
      return {
        message: `Stored installed-pack file ${persistedFile.path} has an invalid size.`,
      }
    }
    const actualHash = await sha256Hex(bytes)
    if (actualHash !== persistedFile.sha256) {
      return {
        message: `Stored installed-pack file ${persistedFile.path} has an invalid hash.`,
      }
    }
    files.push({
      path: persistedFile.path,
      bytes,
      sha256: actualHash,
      size: bytes.byteLength,
    })
  }

  const loaded = await loadLearningPackFromFilesAsync(
    'memory',
    recordPackId,
    files,
  )
  if (!('documents' in loaded)) {
    return {
      message: 'Stored installed-pack canonical files failed SDK validation.',
    }
  }
  if (loaded.contentHash !== value.contentHash) {
    return {
      message:
        'Stored installed-pack content hash does not match canonical files.',
    }
  }
  if (value.releaseId !== loaded.contentHash) {
    return {
      message:
        'Stored installed-pack release ID does not match canonical files.',
    }
  }
  if (loaded.documents.manifest.packId !== recordPackId) {
    return {
      message:
        'Stored installed-pack ID does not match its canonical manifest.',
    }
  }
  if (loaded.documents.manifest.version !== value.packVersion) {
    return {
      message:
        'Stored installed-pack version does not match its canonical manifest.',
    }
  }

  return {
    release: {
      releaseId: loaded.contentHash,
      packVersion: loaded.documents.manifest.version,
      contentHash: loaded.contentHash,
      documents: loaded.documents,
      files: loaded.files,
    },
  }
}

function isPersistedRecordV2(value: unknown): value is PersistedRecordV2 {
  return (
    isRecord(value) &&
    value.recordVersion === INSTALLED_LEARNING_PACK_RECORD_VERSION &&
    typeof value.packId === 'string' &&
    value.packId.length > 0 &&
    typeof value.activeReleaseId === 'string' &&
    value.activeReleaseId.length > 0 &&
    (value.rollbackReleaseId === null ||
      typeof value.rollbackReleaseId === 'string') &&
    Array.isArray(value.releases) &&
    value.releases.every(isPersistedReleaseV2)
  )
}

function isPersistedReleaseV2(value: unknown): value is PersistedReleaseV2 {
  return (
    isRecord(value) &&
    typeof value.releaseId === 'string' &&
    value.releaseId.length > 0 &&
    typeof value.packVersion === 'string' &&
    value.packVersion.length > 0 &&
    typeof value.contentHash === 'string' &&
    value.contentHash.length > 0 &&
    Array.isArray(value.files) &&
    value.files.every(isPersistedFileV2)
  )
}

function isPersistedFileV2(value: unknown): value is PersistedPackFileV2 {
  return (
    isRecord(value) &&
    typeof value.path === 'string' &&
    value.path.length > 0 &&
    'bytes' in value &&
    typeof value.sha256 === 'string' &&
    /^[a-f0-9]{64}$/.test(value.sha256) &&
    typeof value.size === 'number' &&
    Number.isSafeInteger(value.size) &&
    value.size >= 0
  )
}

function isLegacyRecord(value: unknown): boolean {
  return (
    isRecord(value) &&
    value.recordVersion === undefined &&
    typeof value.packId === 'string' &&
    Array.isArray(value.releases)
  )
}

function invalid(
  packId: string | null,
  detail: string,
): Readonly<{ issue: PersistedLearningPackRecordIssue }> {
  return {
    issue: {
      packId,
      message: `Installed pack record could not be restored: ${detail}`,
    },
  }
}

function readPackId(value: unknown): string | null {
  return isRecord(value) && typeof value.packId === 'string'
    ? value.packId
    : null
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const input = new Uint8Array(bytes.byteLength)
  input.set(bytes)
  const digest = await globalThis.crypto.subtle.digest('SHA-256', input.buffer)
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
