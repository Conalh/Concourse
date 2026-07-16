import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {
  hasBlockingDiagnostics,
  type LearningPackDiagnostic,
} from '@learnt/learning-pack-contracts'
import {
  loadLearningPackFromFiles,
  canonicalizePackFilesForPacking,
} from './documents.js'
import {
  readDirectoryFiles,
  readFileAtKnownSize,
  writeFilesToDirectory,
} from './filesystem.js'
import { sha256Hex } from './hash.js'
import { assertLearntPackExtension } from './paths.js'
import { createDeterministicZip, readZipEntries } from './zip.js'
import { resolveArchiveLimits } from './limits.js'
import type {
  InspectArchiveResult,
  LearningPackSdkOptions,
  LoadedLearningPack,
  PackArchiveResult,
  PackFileRecord,
  UnpackArchiveResult,
  ValidationSummary,
} from './types.js'
import { PUBLISHER_SIGNATURE_EXTENSION_POINT } from './types.js'
import { fileManifestDiagnostic, structureDiagnostic } from './diagnostics.js'

export async function validateLearningPackPath(
  targetPath: string,
  options: LearningPackSdkOptions = {},
): Promise<ValidationSummary> {
  const stat = await fs.stat(targetPath)
  const loaded = stat.isDirectory()
    ? await loadLearningPackDirectory(targetPath, options)
    : await loadLearningPackArchive(targetPath, options)

  if (isLoadedLearningPack(loaded)) {
    return {
      ok: true,
      sourceKind: stat.isDirectory() ? 'directory' : 'archive',
      path: targetPath,
      contentHash: loaded.contentHash,
      packId: loaded.documents.manifest.packId,
      version: loaded.documents.manifest.version,
      diagnostics: loaded.diagnostics,
    }
  }

  return {
    ok: false,
    sourceKind: stat.isDirectory() ? 'directory' : 'archive',
    path: targetPath,
    diagnostics: loaded.diagnostics,
  }
}

export async function packDirectory(
  inputDirectory: string,
  outFile: string,
  options: LearningPackSdkOptions = {},
): Promise<PackArchiveResult> {
  const extensionDiagnostics = assertLearntPackExtension(outFile)
  if (extensionDiagnostics.length > 0) {
    return {
      ok: false,
      inputDirectory,
      outFile,
      diagnostics: extensionDiagnostics,
    }
  }

  const scanned = await readDirectoryFiles(inputDirectory, options)
  const scanDiagnostics = scanned.diagnostics
  if (!('files' in scanned) || hasBlockingDiagnostics(scanDiagnostics)) {
    return { ok: false, inputDirectory, outFile, diagnostics: scanDiagnostics }
  }

  const canonical = canonicalizePackFilesForPacking(scanned.files, options)
  const diagnostics = [...scanDiagnostics, ...canonical.diagnostics]
  if (!isLoadedLearningPack(canonical) || hasBlockingDiagnostics(diagnostics)) {
    return { ok: false, inputDirectory, outFile, diagnostics }
  }

  const archiveBytes = createDeterministicZip(canonical.files)
  await fs.mkdir(path.dirname(path.resolve(outFile)), { recursive: true })
  await fs.writeFile(outFile, archiveBytes)

  return {
    ok: true,
    inputDirectory,
    outFile,
    archiveSha256: sha256Hex(archiveBytes),
    archiveBytes: archiveBytes.byteLength,
    packId: canonical.documents.manifest.packId,
    version: canonical.documents.manifest.version,
    diagnostics,
  }
}

export async function unpackArchive(
  archiveFile: string,
  outDirectory: string,
  options: LearningPackSdkOptions = {},
): Promise<UnpackArchiveResult> {
  const extensionDiagnostics = assertLearntPackExtension(archiveFile)
  if (extensionDiagnostics.length > 0) {
    return {
      ok: false,
      archiveFile,
      outDirectory,
      diagnostics: extensionDiagnostics,
    }
  }

  const loaded = await loadLearningPackArchive(archiveFile, options)
  if (!isLoadedLearningPack(loaded)) {
    return {
      ok: false,
      archiveFile,
      outDirectory,
      diagnostics: loaded.diagnostics,
    }
  }

  const absoluteOut = path.resolve(outDirectory)
  const parent = path.dirname(absoluteOut)
  await fs.mkdir(parent, { recursive: true })
  const tempDirectory = await fs.mkdtemp(path.join(parent, '.learntpack-tmp-'))

  try {
    await writeFilesToDirectory(tempDirectory, loaded.files)
    const unpackedValidation = await loadLearningPackDirectory(
      tempDirectory,
      options,
    )
    const diagnostics = [
      ...loaded.diagnostics,
      ...unpackedValidation.diagnostics,
    ]
    if (
      !isLoadedLearningPack(unpackedValidation) ||
      hasBlockingDiagnostics(diagnostics)
    ) {
      return { ok: false, archiveFile, outDirectory, diagnostics }
    }

    await fs.rename(tempDirectory, absoluteOut)
    return {
      ok: true,
      archiveFile,
      outDirectory,
      contentHash: unpackedValidation.contentHash,
      packId: loaded.documents.manifest.packId,
      version: loaded.documents.manifest.version,
      diagnostics,
    }
  } catch (error) {
    return {
      ok: false,
      archiveFile,
      outDirectory,
      diagnostics: [
        ...loaded.diagnostics,
        structureDiagnostic('unpack', (error as Error).message),
      ],
    }
  } finally {
    await fs.rm(tempDirectory, { recursive: true, force: true })
  }
}

export async function inspectArchive(
  archiveFile: string,
  options: LearningPackSdkOptions = {},
): Promise<InspectArchiveResult> {
  const extensionDiagnostics = assertLearntPackExtension(archiveFile)
  if (extensionDiagnostics.length > 0) {
    return {
      ok: false,
      archiveFile,
      signatures: PUBLISHER_SIGNATURE_EXTENSION_POINT,
      diagnostics: extensionDiagnostics,
    }
  }
  const snapshot = await loadLearningPackArchiveSnapshot(archiveFile, options)
  if (!('loaded' in snapshot)) {
    return {
      ok: false,
      archiveFile,
      signatures: PUBLISHER_SIGNATURE_EXTENSION_POINT,
      diagnostics: snapshot.diagnostics,
    }
  }
  const { archiveBytes, loaded } = snapshot

  const totalFileBytes = loaded.files.reduce((sum, file) => sum + file.size, 0)
  return {
    ok: true,
    archiveFile,
    archiveSha256: sha256Hex(archiveBytes),
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

export async function loadLearningPackDirectory(
  directory: string,
  options: LearningPackSdkOptions = {},
): Promise<LoadedLearningPack | { diagnostics: LearningPackDiagnostic[] }> {
  const scanned = await readDirectoryFiles(directory, options)
  if (!('files' in scanned)) {
    return { diagnostics: scanned.diagnostics }
  }
  const loaded = loadLearningPackFromFiles(
    'directory',
    directory,
    scanned.files,
    options,
  )
  if (isLoadedLearningPack(loaded)) {
    loaded.diagnostics.unshift(...scanned.diagnostics)
    if (hasBlockingDiagnostics(loaded.diagnostics)) {
      return { diagnostics: loaded.diagnostics }
    }
    return loaded
  }
  return { diagnostics: [...scanned.diagnostics, ...loaded.diagnostics] }
}

export async function loadLearningPackArchive(
  archiveFile: string,
  options: LearningPackSdkOptions = {},
): Promise<LoadedLearningPack | { diagnostics: LearningPackDiagnostic[] }> {
  const extensionDiagnostics = assertLearntPackExtension(archiveFile)
  if (extensionDiagnostics.length > 0) {
    return { diagnostics: extensionDiagnostics }
  }

  const snapshot = await loadLearningPackArchiveSnapshot(archiveFile, options)
  return 'loaded' in snapshot ? snapshot.loaded : snapshot
}

async function loadLearningPackArchiveSnapshot(
  archiveFile: string,
  options: LearningPackSdkOptions,
): Promise<
  | Readonly<{ archiveBytes: Uint8Array; loaded: LoadedLearningPack }>
  | { diagnostics: LearningPackDiagnostic[] }
> {
  try {
    const limits = resolveArchiveLimits(options)
    const archiveStat = await fs.stat(archiveFile)
    if (archiveStat.size > limits.maxTotalBytes) {
      return {
        diagnostics: [
          fileManifestDiagnostic(
            archiveFile,
            `Compressed archive bytes ${archiveStat.size} exceed limit ${limits.maxTotalBytes}.`,
          ),
        ],
      }
    }
    const archiveBytes = await readFileAtKnownSize(
      archiveFile,
      archiveStat.size,
    )
    if (archiveBytes.byteLength !== archiveStat.size) {
      return {
        diagnostics: [
          fileManifestDiagnostic(
            archiveFile,
            `Archive size changed while reading ${archiveFile}: expected ${archiveStat.size}, read ${archiveBytes.byteLength}.`,
          ),
        ],
      }
    }
    const entries = readZipEntries(archiveBytes, limits)
    const files: PackFileRecord[] = entries.files.map((entry) => ({
      ...entry,
      sha256: sha256Hex(entry.bytes),
      size: entry.bytes.byteLength,
    }))
    const loaded = loadLearningPackFromFiles(
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
      return { archiveBytes, loaded }
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

export async function installArchiveAtomically(
  archiveFile: string,
  outDirectory: string,
  options: LearningPackSdkOptions = {},
): Promise<UnpackArchiveResult> {
  return unpackArchive(archiveFile, outDirectory, options)
}

export async function createTemporaryInstallDirectory(
  prefix = 'learntpack-',
): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix))
}

function isLoadedLearningPack(
  value: LoadedLearningPack | { diagnostics: LearningPackDiagnostic[] },
): value is LoadedLearningPack {
  return 'documents' in value && 'files' in value && 'contentHash' in value
}
