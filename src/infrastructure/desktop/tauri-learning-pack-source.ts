import {
  LearningPackErrorCode,
  makeDiagnostic,
  type LearningPackDiagnostic,
} from '@learnt/learning-pack-contracts'
import type {
  ArchiveLimits,
  LearningPackSdkOptions,
  PackFileRecord,
} from '@learnt/learning-pack-sdk'
import {
  loadLearningPackFromFilesAsync,
  resolveArchiveLimits,
} from '@learnt/learning-pack-sdk/browser'

import type {
  LearningPackSourcePort,
  LearningPackSourceReadResult,
  RejectedLearningPackSourceCandidate,
  ValidatedLearningPackSourceCandidate,
} from '../../learning-packs/installed-learning-pack-ports'

export type TauriCourseFolderFileSnapshot = Readonly<{
  relativePath: string
  bytes: readonly number[]
}>

export type TauriCourseFolderPackCandidate = Readonly<{
  directoryName: string
  files: readonly TauriCourseFolderFileSnapshot[]
}>

export type TauriCourseFolderDiagnostic = Readonly<{
  code: string
  message: string
  path: string
}>

export type TauriCourseFolderScan = Readonly<{
  sourceName: string
  scannedDirectoryCount: number
  candidates: readonly TauriCourseFolderPackCandidate[]
  diagnostics: readonly TauriCourseFolderDiagnostic[]
}>

export interface TauriLearningPackSourceBridge {
  chooseCourseFolder(): Promise<string | null>
  loadSelectedCourseFolder(): Promise<string | null>
  saveSelectedCourseFolder(path: string): Promise<void>
  readCourseFolderCandidates(
    path: string,
    limits: ArchiveLimits,
  ): Promise<unknown>
}

type TauriLearningPackSourceOutcome =
  | (ValidatedLearningPackSourceCandidate & Readonly<{ status: 'validated' }>)
  | RejectedLearningPackSourceCandidate

/**
 * Tauri's filesystem command supplies bytes only. The shared browser-compatible
 * SDK remains the single authority for pack validation and document parsing.
 */
export class TauriLearningPackSource implements LearningPackSourcePort {
  private readonly bridge: TauriLearningPackSourceBridge
  private readonly sdkOptions: LearningPackSdkOptions

  constructor(
    bridge: TauriLearningPackSourceBridge,
    sdkOptions: LearningPackSdkOptions = {},
  ) {
    this.bridge = bridge
    this.sdkOptions = sdkOptions
  }

  async chooseDirectory(): Promise<LearningPackSourceReadResult | null> {
    const selectedRoot = await this.bridge.chooseCourseFolder()
    if (selectedRoot === null) {
      return null
    }

    await this.bridge.saveSelectedCourseFolder(selectedRoot)
    return readTauriLearningPackSourceDirectory(
      this.bridge,
      selectedRoot,
      this.sdkOptions,
    )
  }

  async readSelectedDirectory(): Promise<LearningPackSourceReadResult | null> {
    const selectedRoot = await this.bridge.loadSelectedCourseFolder()
    if (selectedRoot === null) {
      return null
    }

    return readTauriLearningPackSourceDirectory(
      this.bridge,
      selectedRoot,
      this.sdkOptions,
    )
  }
}

export async function readTauriLearningPackSourceDirectory(
  bridge: TauriLearningPackSourceBridge,
  selectedRoot: string,
  options: LearningPackSdkOptions = {},
): Promise<LearningPackSourceReadResult> {
  let rawScan: unknown
  try {
    rawScan = await bridge.readCourseFolderCandidates(
      selectedRoot,
      resolveArchiveLimits(options),
    )
  } catch (error) {
    return failedNativeScanResult(
      selectedRoot,
      nativeDiagnosticFromError(error, selectedRoot),
    )
  }

  const parsedScan = parseTauriCourseFolderScan(rawScan, selectedRoot)
  if (!('scan' in parsedScan)) {
    return failedNativeScanResult(selectedRoot, parsedScan.diagnostic)
  }

  const { scan } = parsedScan
  const outcomes: TauriLearningPackSourceOutcome[] = []

  for (const candidate of scan.candidates) {
    outcomes.push(await readTauriLearningPackCandidate(candidate, options))
  }

  for (const sourceDiagnostic of scan.diagnostics) {
    if (sourceDiagnostic.code !== 'partial-candidate') {
      outcomes.push(rejectedNativeScanOutcome(sourceDiagnostic))
    }
  }

  return {
    sourceName: scan.sourceName,
    scannedDirectoryCount: scan.scannedDirectoryCount,
    candidates: outcomes.flatMap((outcome) =>
      outcome.status === 'validated' ? [withoutValidatedStatus(outcome)] : [],
    ),
    rejectedCandidates: outcomes.flatMap((outcome) =>
      outcome.status === 'validated' ? [] : [outcome],
    ),
  }
}

function failedNativeScanResult(
  selectedRoot: string,
  diagnostic: TauriCourseFolderDiagnostic,
): LearningPackSourceReadResult {
  return {
    sourceName: finalPathSegment(selectedRoot),
    scannedDirectoryCount: 0,
    candidates: [],
    rejectedCandidates: [rejectedNativeScanOutcome(diagnostic)],
  }
}

async function readTauriLearningPackCandidate(
  candidate: TauriCourseFolderPackCandidate,
  options: LearningPackSdkOptions,
): Promise<TauriLearningPackSourceOutcome> {
  const files = candidate.files.map(toPackFileRecord)
  const loaded = await loadLearningPackFromFilesAsync(
    'directory',
    candidate.directoryName,
    files,
    options,
  )

  if (!('documents' in loaded)) {
    return invalidOutcome(
      candidate.directoryName,
      manifestMetadataFromFiles(files),
      {
        message: 'Learning pack validation failed.',
        diagnostics: loaded.diagnostics,
      },
    )
  }

  return {
    directoryName: candidate.directoryName,
    status: 'validated',
    candidate: {
      contentHash: loaded.contentHash,
      documents: loaded.documents,
      files: loaded.files,
    },
    packId: loaded.documents.manifest.packId,
    packVersion: loaded.documents.manifest.version,
    title: loaded.documents.manifest.title,
    diagnostics: loaded.diagnostics,
  }
}

function toPackFileRecord(
  snapshot: TauriCourseFolderFileSnapshot,
): PackFileRecord {
  const bytes = new Uint8Array(snapshot.bytes)
  return {
    path: snapshot.relativePath,
    bytes,
    sha256: '',
    size: bytes.byteLength,
  }
}

function rejectedNativeScanOutcome(
  sourceDiagnostic: TauriCourseFolderDiagnostic,
): RejectedLearningPackSourceCandidate {
  const directoryName = finalPathSegment(sourceDiagnostic.path)
  return {
    directoryName,
    status: 'invalid',
    message: sourceDiagnostic.message,
    diagnostics: [
      makeDiagnostic(
        LearningPackErrorCode.STRUCTURE_INVALID,
        'error',
        sourceDiagnostic.path,
        sourceDiagnostic.message,
      ),
    ],
  }
}

function withoutValidatedStatus(
  outcome: ValidatedLearningPackSourceCandidate &
    Readonly<{ status: 'validated' }>,
): ValidatedLearningPackSourceCandidate {
  return {
    directoryName: outcome.directoryName,
    packId: outcome.packId,
    packVersion: outcome.packVersion,
    title: outcome.title,
    diagnostics: outcome.diagnostics,
    candidate: outcome.candidate,
  }
}

function invalidOutcome(
  directoryName: string,
  manifest: unknown,
  input: Readonly<{
    message: string
    diagnostics: readonly LearningPackDiagnostic[]
  }>,
): RejectedLearningPackSourceCandidate {
  const metadata = manifestMetadata(manifest)
  return {
    directoryName,
    status: 'invalid',
    message: input.message,
    diagnostics: input.diagnostics,
    ...(metadata.packId === undefined ? {} : { packId: metadata.packId }),
    ...(metadata.packVersion === undefined
      ? {}
      : { packVersion: metadata.packVersion }),
    ...(metadata.title === undefined ? {} : { title: metadata.title }),
  }
}

function manifestMetadataFromFiles(files: readonly PackFileRecord[]): unknown {
  const manifestFile = files.find((file) => file.path === 'pack.json')
  if (manifestFile === undefined) {
    return undefined
  }

  try {
    return JSON.parse(
      new TextDecoder('utf-8', { fatal: true }).decode(manifestFile.bytes),
    )
  } catch {
    return undefined
  }
}

function manifestMetadata(manifest: unknown): Readonly<{
  packId?: string
  packVersion?: string
  title?: string
}> {
  if (typeof manifest !== 'object' || manifest === null) {
    return {}
  }

  const record = manifest as Record<string, unknown>
  return {
    ...(typeof record.packId === 'string' ? { packId: record.packId } : {}),
    ...(typeof record.version === 'string'
      ? { packVersion: record.version }
      : {}),
    ...(typeof record.title === 'string' ? { title: record.title } : {}),
  }
}

function finalPathSegment(path: string): string {
  const segments = path.split(/[\\/]/).filter(Boolean)
  return segments.at(-1) ?? path
}

function parseTauriCourseFolderScan(
  value: unknown,
  selectedRoot: string,
):
  | Readonly<{ scan: TauriCourseFolderScan }>
  | Readonly<{
      diagnostic: TauriCourseFolderDiagnostic
    }> {
  if (!isRecord(value)) {
    return malformedNativeScan(
      selectedRoot,
      'The native scan response was not an object.',
    )
  }
  if (typeof value.sourceName !== 'string' || value.sourceName.length === 0) {
    return malformedNativeScan(
      selectedRoot,
      'The native scan response had no source name.',
    )
  }
  if (
    typeof value.scannedDirectoryCount !== 'number' ||
    !Number.isSafeInteger(value.scannedDirectoryCount) ||
    value.scannedDirectoryCount < 0
  ) {
    return malformedNativeScan(
      selectedRoot,
      'The native scan response had an invalid scanned-directory count.',
    )
  }
  if (!Array.isArray(value.candidates) || !Array.isArray(value.diagnostics)) {
    return malformedNativeScan(
      selectedRoot,
      'The native scan response had invalid candidate or diagnostic collections.',
    )
  }

  const candidates: TauriCourseFolderPackCandidate[] = []
  for (const candidate of value.candidates) {
    const parsedCandidate = parseTauriCourseFolderCandidate(candidate)
    if (parsedCandidate === null) {
      return malformedNativeScan(
        selectedRoot,
        'The native scan response contained an invalid candidate payload.',
      )
    }
    candidates.push(parsedCandidate)
  }

  const diagnostics: TauriCourseFolderDiagnostic[] = []
  for (const diagnostic of value.diagnostics) {
    if (!isTauriCourseFolderDiagnostic(diagnostic)) {
      return malformedNativeScan(
        selectedRoot,
        'The native scan response contained an invalid diagnostic payload.',
      )
    }
    diagnostics.push(diagnostic)
  }

  return {
    scan: {
      sourceName: value.sourceName,
      scannedDirectoryCount: value.scannedDirectoryCount,
      candidates,
      diagnostics,
    },
  }
}

function parseTauriCourseFolderCandidate(
  value: unknown,
): TauriCourseFolderPackCandidate | null {
  if (!isRecord(value) || typeof value.directoryName !== 'string') {
    return null
  }
  if (value.directoryName.length === 0 || !Array.isArray(value.files)) {
    return null
  }

  const files: TauriCourseFolderFileSnapshot[] = []
  for (const file of value.files) {
    if (!isRecord(file) || typeof file.relativePath !== 'string') {
      return null
    }
    if (file.relativePath.length === 0 || !Array.isArray(file.bytes)) {
      return null
    }
    if (
      !file.bytes.every(
        (byte) =>
          typeof byte === 'number' &&
          Number.isSafeInteger(byte) &&
          byte >= 0 &&
          byte <= 255,
      )
    ) {
      return null
    }
    files.push({ relativePath: file.relativePath, bytes: file.bytes })
  }

  return { directoryName: value.directoryName, files }
}

function nativeDiagnosticFromError(
  error: unknown,
  selectedRoot: string,
): TauriCourseFolderDiagnostic {
  if (isTauriCourseFolderDiagnostic(error)) {
    return error
  }
  return {
    code: 'native-invoke-failed',
    message:
      error instanceof Error
        ? error.message
        : 'The native course-folder command failed.',
    path: selectedRoot,
  }
}

function malformedNativeScan(
  selectedRoot: string,
  message: string,
): Readonly<{ diagnostic: TauriCourseFolderDiagnostic }> {
  return {
    diagnostic: {
      code: 'malformed-native-response',
      message,
      path: selectedRoot,
    },
  }
}

function isTauriCourseFolderDiagnostic(
  value: unknown,
): value is TauriCourseFolderDiagnostic {
  return (
    isRecord(value) &&
    typeof value.code === 'string' &&
    typeof value.message === 'string' &&
    typeof value.path === 'string'
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
