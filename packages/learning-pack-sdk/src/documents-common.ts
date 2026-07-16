import {
  LearningPackErrorCode,
  PUBLIC_JSON_FILE_PATHS,
  hasBlockingDiagnostics,
  makeDiagnostic,
  validateLearningPackDocuments,
  type LearningPackDiagnostic,
  type LearningPackDocuments,
} from '@learnt/learning-pack-contracts'
import {
  fileManifestDiagnostic,
  requiredFileDiagnostic,
} from './diagnostics.js'
import { enforceArchiveLimits, resolveArchiveLimits } from './limits.js'
import { validateArchivePath } from './paths.js'
import type { LearningPackSdkOptions, PackFileRecord } from './types.js'

const decoder = new TextDecoder('utf-8', { fatal: true })

export interface ValidatedPackFiles {
  documents?: LearningPackDocuments
  diagnostics: LearningPackDiagnostic[]
}

export function validateNormalizedPackFiles(
  files: readonly PackFileRecord[],
  options: LearningPackSdkOptions = {},
): ValidatedPackFiles {
  const diagnostics: LearningPackDiagnostic[] = [
    ...validatePackFilePaths(files),
    ...enforceArchiveLimits(files, resolveArchiveLimits(options)),
  ]
  const parsedDocuments = parseLearningPackDocuments(files)
  diagnostics.push(...parsedDocuments.diagnostics)

  if (parsedDocuments.value) {
    const validation = validateLearningPackDocuments(parsedDocuments.value, {
      supportedCapabilities: options.supportedCapabilities,
    })
    diagnostics.push(...validation.diagnostics)

    if (validation.value) {
      diagnostics.push(...verifyManifestFileHashes(validation.value, files))
      if (!hasBlockingDiagnostics(diagnostics)) {
        return { documents: validation.value, diagnostics }
      }
    }
  }

  return { diagnostics }
}

export function validatePackFilePaths(
  files: readonly PackFileRecord[],
): LearningPackDiagnostic[] {
  const diagnostics: LearningPackDiagnostic[] = []
  const seen = new Set<string>()
  for (const file of files) {
    diagnostics.push(...validateArchivePath(file.path))
    if (seen.has(file.path)) {
      diagnostics.push(
        fileManifestDiagnostic(
          file.path,
          `Archive path ${file.path} is duplicated.`,
        ),
      )
    }
    seen.add(file.path)
  }
  return diagnostics
}

export function parseLearningPackDocuments(files: readonly PackFileRecord[]): {
  value?: Partial<LearningPackDocuments>
  diagnostics: LearningPackDiagnostic[]
} {
  const diagnostics: LearningPackDiagnostic[] = []
  const byPath = new Map(files.map((file) => [file.path, file.bytes]))
  const documents: Partial<LearningPackDocuments> = {}

  for (const path of PUBLIC_JSON_FILE_PATHS) {
    const bytes = byPath.get(path)
    if (!bytes) {
      continue
    }
    try {
      assignDocument(documents, path, JSON.parse(decoder.decode(bytes)))
    } catch (error) {
      diagnostics.push(
        makeDiagnostic(
          LearningPackErrorCode.STRUCTURE_INVALID,
          'error',
          path,
          `Could not parse ${path} as UTF-8 JSON: ${(error as Error).message}`,
        ),
      )
    }
  }

  if (!byPath.has('pack.json')) {
    diagnostics.push(
      requiredFileDiagnostic('pack.json', 'pack.json is required.'),
    )
  }

  if (hasBlockingDiagnostics(diagnostics)) {
    return { diagnostics }
  }

  return { value: documents, diagnostics }
}

export function verifyManifestFileHashes(
  documents: LearningPackDocuments,
  files: readonly PackFileRecord[],
): LearningPackDiagnostic[] {
  const diagnostics: LearningPackDiagnostic[] = []
  const fileByPath = new Map(files.map((file) => [file.path, file]))
  const manifestPaths = new Set(
    documents.manifest.files.map((file) => file.path),
  )

  if (!fileByPath.has('pack.json')) {
    diagnostics.push(
      requiredFileDiagnostic('pack.json', 'pack.json is required.'),
    )
  }

  for (const manifestFile of documents.manifest.files) {
    const file = fileByPath.get(manifestFile.path)
    if (!file) {
      diagnostics.push(
        requiredFileDiagnostic(
          manifestFile.path,
          `Manifest declares ${manifestFile.path}, but the file is missing.`,
        ),
      )
      continue
    }
    if (file.size !== manifestFile.bytes) {
      diagnostics.push(
        fileManifestDiagnostic(
          `pack.json.files.${manifestFile.path}.bytes`,
          `Manifest bytes ${manifestFile.bytes} do not match actual bytes ${file.size} for ${manifestFile.path}.`,
        ),
      )
    }
    if (file.sha256 !== manifestFile.sha256) {
      diagnostics.push(
        fileManifestDiagnostic(
          `pack.json.files.${manifestFile.path}.sha256`,
          `Manifest sha256 ${manifestFile.sha256} does not match actual sha256 ${file.sha256} for ${manifestFile.path}.`,
        ),
      )
    }
  }

  for (const file of files) {
    if (file.path !== 'pack.json' && !manifestPaths.has(file.path)) {
      diagnostics.push(
        fileManifestDiagnostic(
          file.path,
          `File ${file.path} is present but is not declared in pack.json.files.`,
        ),
      )
    }
  }

  return diagnostics
}

function assignDocument(
  documents: Partial<LearningPackDocuments>,
  path: string,
  parsed: unknown,
): void {
  switch (path) {
    case 'pack.json':
      documents.manifest = parsed as LearningPackDocuments['manifest']
      break
    case 'catalog.json':
      documents.catalog = parsed as LearningPackDocuments['catalog']
      break
    case 'courses.json':
      documents.courses = parsed as LearningPackDocuments['courses']
      break
    case 'items.json':
      documents.items = parsed as LearningPackDocuments['items']
      break
    case 'sets.json':
      documents.sets = parsed as LearningPackDocuments['sets']
      break
    case 'resources.json':
      documents.resources = parsed as LearningPackDocuments['resources']
      break
    case 'theme.json':
      documents.theme = parsed as LearningPackDocuments['theme']
      break
    case 'migrations.json':
      documents.migrations = parsed as LearningPackDocuments['migrations']
      break
    default:
      throw new Error(`Unsupported public JSON path ${path}.`)
  }
}
