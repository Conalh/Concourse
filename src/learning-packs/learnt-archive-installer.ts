import type { LearningPackDiagnostic } from '@learnt/learning-pack-contracts'
import {
  loadLearningPackArchive,
  loadLearningPackDirectory,
  type LearningPackSdkOptions,
  type LoadedLearningPack,
} from '@learnt/learning-pack-sdk'

import type { ValidatedLearningPackCandidate } from './installed-learning-pack-ports'
import {
  LearningPackInstallError,
  type LearningPackInstallStage,
} from './learnt-importer'

export type LearningPackArchiveCandidateInput = Readonly<
  LearningPackSdkOptions & {
    archiveFile: string
  }
>

export type LearningPackDirectoryCandidateInput = Readonly<
  LearningPackSdkOptions & {
    directory: string
  }
>

export async function loadLearningPackArchiveCandidate(
  input: LearningPackArchiveCandidateInput,
): Promise<ValidatedLearningPackCandidate> {
  return candidateFromLoaded(
    await loadLearningPackArchive(input.archiveFile, toSdkOptions(input)),
    'inspect',
    input.archiveFile,
  )
}

export async function loadLearningPackDirectoryCandidate(
  input: string | LearningPackDirectoryCandidateInput,
): Promise<ValidatedLearningPackCandidate> {
  const directory = typeof input === 'string' ? input : input.directory
  const options = typeof input === 'string' ? {} : toSdkOptions(input)

  return candidateFromLoaded(
    await loadLearningPackDirectory(directory, options),
    'validate',
    directory,
  )
}

function candidateFromLoaded(
  loaded: LoadedLearningPack | { diagnostics: LearningPackDiagnostic[] },
  stage: LearningPackInstallStage,
  sourcePath: string,
): ValidatedLearningPackCandidate {
  if (!('documents' in loaded)) {
    throw diagnosticInstallError(
      stage,
      `Learning pack validation failed for ${sourcePath}.`,
      loaded.diagnostics,
    )
  }

  return Object.freeze({
    contentHash: loaded.contentHash,
    documents: loaded.documents,
    files: loaded.files,
  })
}

function diagnosticInstallError(
  stage: LearningPackInstallStage,
  message: string,
  diagnostics: readonly LearningPackDiagnostic[],
): LearningPackInstallError {
  return new LearningPackInstallError(
    `${message} ${formatDiagnostics(diagnostics)}`,
    diagnostics,
    { stage },
  )
}

function formatDiagnostics(
  diagnostics: readonly LearningPackDiagnostic[],
): string {
  const blockingDiagnostics = diagnostics.filter(
    (diagnostic) => diagnostic.severity === 'error',
  )
  if (blockingDiagnostics.length === 0) {
    return 'No blocking diagnostics were reported.'
  }

  return blockingDiagnostics
    .map(
      (diagnostic) =>
        `${diagnostic.code} at ${diagnostic.path}: ${diagnostic.message}`,
    )
    .join('; ')
}

function toSdkOptions(input: LearningPackSdkOptions): LearningPackSdkOptions {
  return {
    ...(input.limits === undefined ? {} : { limits: input.limits }),
    ...(input.supportedCapabilities === undefined
      ? {}
      : { supportedCapabilities: input.supportedCapabilities }),
  }
}
