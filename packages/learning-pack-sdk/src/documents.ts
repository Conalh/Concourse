import {
  PUBLIC_JSON_FILE_PATHS,
  hasBlockingDiagnostics,
  type LearningPackDiagnostic,
  type LearningPackDocuments,
} from '@learnt/learning-pack-contracts'
import {
  parseLearningPackDocuments,
  validateNormalizedPackFiles,
  validatePackFilePaths,
} from './documents-common.js'
import { contentHash, sha256Hex, stableJsonBytes } from './hash.js'
import { enforceArchiveLimits, resolveArchiveLimits } from './limits.js'
import { compareArchivePaths } from './paths.js'
import type {
  LearningPackSdkOptions,
  LoadedLearningPack,
  PackFileRecord,
} from './types.js'
import {
  fileManifestDiagnostic,
  requiredFileDiagnostic,
} from './diagnostics.js'

export { verifyManifestFileHashes } from './documents-common.js'

const decoder = new TextDecoder('utf-8', { fatal: true })
const publicJsonPathSet = new Set<string>(PUBLIC_JSON_FILE_PATHS)

export function loadLearningPackFromFiles(
  sourceKind: LoadedLearningPack['sourceKind'],
  sourcePath: string,
  inputFiles: readonly PackFileRecord[],
  options: LearningPackSdkOptions = {},
): LoadedLearningPack | { diagnostics: LearningPackDiagnostic[] } {
  const normalizedFiles = normalizeFileRecords(inputFiles)
  const validation = validateNormalizedPackFiles(normalizedFiles, options)

  if (validation.documents) {
    return {
      sourceKind,
      sourcePath,
      documents: validation.documents,
      files: normalizedFiles,
      contentHash: contentHash(normalizedFiles),
      diagnostics: validation.diagnostics,
    }
  }

  return { diagnostics: validation.diagnostics }
}

export function canonicalizePackFilesForPacking(
  inputFiles: readonly PackFileRecord[],
  options: LearningPackSdkOptions = {},
): LoadedLearningPack | { diagnostics: LearningPackDiagnostic[] } {
  const normalizedFiles = normalizeFileRecords(inputFiles)
  const diagnostics: LearningPackDiagnostic[] = [
    ...validatePackFilePaths(normalizedFiles),
    ...enforceArchiveLimits(normalizedFiles, resolveArchiveLimits(options)),
  ]
  const parsedDocuments = parseLearningPackDocuments(normalizedFiles)
  diagnostics.push(...parsedDocuments.diagnostics)

  if (!parsedDocuments.value || hasBlockingDiagnostics(diagnostics)) {
    return { diagnostics }
  }

  const documents = cloneJson(
    parsedDocuments.value,
  ) as Partial<LearningPackDocuments>
  if (!documents.manifest) {
    return { diagnostics }
  }

  const canonicalByPath = new Map<string, Uint8Array>()

  for (const path of PUBLIC_JSON_FILE_PATHS) {
    if (path === 'pack.json') {
      continue
    }
    const value = documentValueForPath(documents, path)
    if (value !== undefined) {
      canonicalByPath.set(path, stableJsonBytes(value))
    }
  }

  for (const file of normalizedFiles) {
    if (!publicJsonPathSet.has(file.path)) {
      canonicalByPath.set(file.path, file.bytes)
    }
  }

  const declaredPaths = new Set(
    documents.manifest.files.map((file) => file.path),
  )
  for (const file of normalizedFiles) {
    if (file.path !== 'pack.json' && !declaredPaths.has(file.path)) {
      diagnostics.push(
        fileManifestDiagnostic(
          file.path,
          `File ${file.path} is present but is not declared in pack.json.files.`,
        ),
      )
    }
  }

  for (const entry of documents.manifest.files) {
    const bytes = canonicalByPath.get(entry.path)
    if (!bytes) {
      diagnostics.push(
        requiredFileDiagnostic(
          entry.path,
          `Manifest declares ${entry.path}, but the file is missing.`,
        ),
      )
      continue
    }
    entry.bytes = bytes.byteLength
    entry.sha256 = sha256Hex(bytes)
  }
  documents.manifest.files.sort((left, right) =>
    compareArchivePaths(left.path, right.path),
  )

  const packBytes = stableJsonBytes(documents.manifest)
  canonicalByPath.set('pack.json', packBytes)

  const canonicalFiles = [...canonicalByPath.entries()]
    .map(([path, bytes]) => ({
      path,
      bytes,
      sha256: sha256Hex(bytes),
      size: bytes.byteLength,
    }))
    .sort((left, right) => compareArchivePaths(left.path, right.path))

  const loaded = loadLearningPackFromFiles(
    'memory',
    'canonical-pack',
    canonicalFiles,
    options,
  )
  if ('documents' in loaded) {
    return loaded
  }

  return { diagnostics: [...diagnostics, ...loaded.diagnostics] }
}

function normalizeFileRecords(
  files: readonly PackFileRecord[],
): PackFileRecord[] {
  return files
    .map((file) => ({
      ...file,
      sha256: file.sha256 || sha256Hex(file.bytes),
      size: file.size || file.bytes.byteLength,
    }))
    .sort((left, right) => compareArchivePaths(left.path, right.path))
}

function documentValueForPath(
  documents: Partial<LearningPackDocuments>,
  path: string,
): unknown {
  switch (path) {
    case 'catalog.json':
      return documents.catalog
    case 'courses.json':
      return documents.courses
    case 'items.json':
      return documents.items
    case 'sets.json':
      return documents.sets
    case 'resources.json':
      return documents.resources
    case 'theme.json':
      return documents.theme
    case 'migrations.json':
      return documents.migrations
    default:
      return undefined
  }
}

function cloneJson(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value))
}
