import {
  hasBlockingDiagnostics,
  type LearningPackDiagnostic,
} from '@learnt/learning-pack-contracts'
import { fileManifestDiagnostic } from './diagnostics.js'
import { sha256Hex } from './hash-browser.js'
import {
  createArchiveLimitAccumulator,
  DEFAULT_ARCHIVE_LIMITS,
  resolveArchiveLimits,
} from './limits.js'
import { stableJsonBytes } from './stable-json.js'
import { loadLearningPackFromFilesAsync } from './documents-browser.js'
import {
  createDeterministicZip,
  inspectZipCentralDirectory,
  readZipEntries,
} from './zip.js'
import type {
  InspectArchiveResult,
  LearningPackSdkOptions,
  LoadedLearningPack,
  PackFileRecord,
} from './types.js'
import {
  LEARNTPACK_EXTENSION,
  PUBLISHER_SIGNATURE_EXTENSION_POINT,
} from './types.js'

export {
  createArchiveLimitAccumulator,
  createDeterministicZip,
  DEFAULT_ARCHIVE_LIMITS,
  inspectZipCentralDirectory,
  readZipEntries,
  resolveArchiveLimits,
  stableJsonBytes,
  LEARNTPACK_EXTENSION,
  PUBLISHER_SIGNATURE_EXTENSION_POINT,
}
export { loadLearningPackFromFilesAsync } from './documents-browser.js'
export type { ArchiveLimitAccumulator } from './limits.js'

export async function loadLearningPackArchiveBytes(
  archiveBytes: Uint8Array,
  archiveFile = `archive${LEARNTPACK_EXTENSION}`,
  options: LearningPackSdkOptions = {},
): Promise<LoadedLearningPack | { diagnostics: LearningPackDiagnostic[] }> {
  const extensionDiagnostics = extensionDiagnosticsForArchiveFile(archiveFile)
  if (extensionDiagnostics.length > 0) {
    return { diagnostics: extensionDiagnostics }
  }

  try {
    const entries = readZipEntries(archiveBytes, resolveArchiveLimits(options))
    const files = await Promise.all(
      entries.files.map(
        async (entry): Promise<PackFileRecord> => ({
          ...entry,
          sha256: await sha256Hex(entry.bytes),
          size: entry.bytes.byteLength,
        }),
      ),
    )
    const loaded = await loadLearningPackFromFilesAsync(
      'archive',
      archiveFile,
      files,
      options,
    )

    if ('documents' in loaded) {
      loaded.diagnostics.unshift(...entries.diagnostics)
      if (hasBlockingDiagnostics(loaded.diagnostics)) {
        return { diagnostics: loaded.diagnostics }
      }
      return loaded
    }

    return { diagnostics: [...entries.diagnostics, ...loaded.diagnostics] }
  } catch (error) {
    return {
      diagnostics: [
        fileManifestDiagnostic(
          archiveFile,
          `Could not read learning pack archive: ${(error as Error).message}`,
        ),
      ],
    }
  }
}

export async function inspectArchiveBytes(
  archiveBytes: Uint8Array,
  archiveFile = `archive${LEARNTPACK_EXTENSION}`,
  options: LearningPackSdkOptions = {},
): Promise<InspectArchiveResult> {
  const loaded = await loadLearningPackArchiveBytes(
    archiveBytes,
    archiveFile,
    options,
  )

  if (!('documents' in loaded)) {
    return {
      ok: false,
      archiveFile,
      archiveBytes: archiveBytes.byteLength,
      signatures: PUBLISHER_SIGNATURE_EXTENSION_POINT,
      diagnostics: loaded.diagnostics,
    }
  }

  const totalFileBytes = loaded.files.reduce((sum, file) => sum + file.size, 0)

  return {
    ok: true,
    archiveFile,
    archiveSha256: await sha256Hex(archiveBytes),
    archiveBytes: archiveBytes.byteLength,
    contentHash: loaded.contentHash,
    manifest: {
      packId: loaded.documents.manifest.packId,
      version: loaded.documents.manifest.version,
      title: loaded.documents.manifest.title,
      summary: loaded.documents.manifest.summary,
      language: loaded.documents.manifest.language,
      releasedAt: loaded.documents.manifest.releasedAt,
    },
    counts: {
      subjects: loaded.documents.catalog.subjects.length,
      concepts: loaded.documents.catalog.concepts.length,
      objectives: loaded.documents.catalog.objectives.length,
      courses: loaded.documents.courses.courses.length,
      items: loaded.documents.items.items.length,
      resources: loaded.documents.resources?.resources.length ?? 0,
      studySets: loaded.documents.sets.sets.length,
      files: loaded.files.length,
      totalFileBytes,
    },
    capabilities: loaded.documents.manifest.capabilities,
    migrations: loaded.documents.migrations?.migrations ?? [],
    signatures: PUBLISHER_SIGNATURE_EXTENSION_POINT,
    diagnostics: loaded.diagnostics,
  }
}

function extensionDiagnosticsForArchiveFile(
  archiveFile: string,
): LearningPackDiagnostic[] {
  if (!archiveFile.toLowerCase().endsWith(LEARNTPACK_EXTENSION)) {
    return [
      fileManifestDiagnostic(
        archiveFile,
        `Learning pack archives must use the ${LEARNTPACK_EXTENSION} extension.`,
      ),
    ]
  }
  return []
}
