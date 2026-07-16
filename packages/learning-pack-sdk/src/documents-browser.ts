import type { LearningPackDiagnostic } from '@learnt/learning-pack-contracts'
import { validateNormalizedPackFiles } from './documents-common.js'
import { contentHash, sha256Hex } from './hash-browser.js'
import { compareArchivePaths } from './paths.js'
import type {
  LearningPackSdkOptions,
  LoadedLearningPack,
  PackFileRecord,
} from './types.js'

export async function loadLearningPackFromFilesAsync(
  sourceKind: LoadedLearningPack['sourceKind'],
  sourcePath: string,
  inputFiles: readonly PackFileRecord[],
  options: LearningPackSdkOptions = {},
): Promise<LoadedLearningPack | { diagnostics: LearningPackDiagnostic[] }> {
  const normalizedFiles = await normalizeFileRecords(inputFiles)
  const validation = validateNormalizedPackFiles(normalizedFiles, options)

  if (validation.documents) {
    return {
      sourceKind,
      sourcePath,
      documents: validation.documents,
      files: normalizedFiles,
      contentHash: await contentHash(normalizedFiles),
      diagnostics: validation.diagnostics,
    }
  }

  return { diagnostics: validation.diagnostics }
}

async function normalizeFileRecords(
  files: readonly PackFileRecord[],
): Promise<PackFileRecord[]> {
  return Promise.all(
    files.map(async (file) => ({
      ...file,
      sha256: file.sha256 || (await sha256Hex(file.bytes)),
      size: file.size || file.bytes.byteLength,
    })),
  ).then((records) =>
    records.sort((left, right) => compareArchivePaths(left.path, right.path)),
  )
}
