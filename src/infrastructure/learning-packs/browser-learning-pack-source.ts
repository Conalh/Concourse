import {
  LearningPackErrorCode,
  makeDiagnostic,
  type LearningPackDiagnostic,
} from '@learnt/learning-pack-contracts'
import {
  createArchiveLimitAccumulator,
  loadLearningPackFromFilesAsync,
  resolveArchiveLimits,
  type ArchiveLimitAccumulator,
} from '@learnt/learning-pack-sdk/browser'
import type {
  LearningPackSdkOptions,
  PackFileRecord,
} from '@learnt/learning-pack-sdk'

import type {
  LearningPackSourcePort,
  LearningPackSourceReadResult,
  RejectedLearningPackSourceCandidate,
  ValidatedLearningPackSourceCandidate,
} from '../../learning-packs/installed-learning-pack-ports'
import { BrowserLearningPackSourceStore } from './browser-learning-pack-state-store'

type BrowserReadableFile = Readonly<{
  size: number
  arrayBuffer: () => Promise<ArrayBuffer>
}>

type BrowserLearningPackFileHandle = Readonly<{
  kind?: 'file'
  name: string
  getFile: () => Promise<BrowserReadableFile>
}>

type BrowserLearningPackDirectoryEntry =
  | BrowserLearningPackFileHandle
  | BrowserLearningPackSourceDirectoryHandle

export type BrowserLearningPackSourceDirectoryHandle = Readonly<{
  kind?: 'directory'
  name: string
  getFileHandle: (name: string) => Promise<BrowserLearningPackFileHandle>
  values: () => AsyncIterable<BrowserLearningPackDirectoryEntry>
  queryPermission?: (
    descriptor: Readonly<{ mode: 'read' }>,
  ) => Promise<DirectoryPermissionState>
}>

export type DirectoryPermissionState = 'granted' | 'prompt' | 'denied'

export type BrowserLearningPackDirectoryPickerHost = Readonly<{
  showDirectoryPicker?: (
    options?: Readonly<{ mode?: 'read' }>,
  ) => Promise<BrowserLearningPackSourceDirectoryHandle>
}>

export type BrowserLearningPackSourceOptions = Readonly<{
  sourceStore?: BrowserLearningPackSourceStorePort
  directoryPickerHost?: BrowserLearningPackDirectoryPickerHost
  sdkOptions?: LearningPackSdkOptions
}>

export interface BrowserLearningPackSourceStorePort {
  loadSelectedDirectory(): Promise<BrowserLearningPackSourceDirectoryHandle | null>
  saveSelectedDirectory(
    handle: BrowserLearningPackSourceDirectoryHandle,
  ): Promise<void>
}

type BrowserLearningPackSourceOutcome =
  | (ValidatedLearningPackSourceCandidate & Readonly<{ status: 'validated' }>)
  | RejectedLearningPackSourceCandidate

export class BrowserLearningPackSource implements LearningPackSourcePort {
  private readonly sourceStore: BrowserLearningPackSourceStorePort
  private readonly pickerHost: BrowserLearningPackDirectoryPickerHost
  private readonly sdkOptions: LearningPackSdkOptions

  constructor(options: BrowserLearningPackSourceOptions = {}) {
    this.sourceStore =
      options.sourceStore ?? new BrowserLearningPackSourceStore()
    this.pickerHost = options.directoryPickerHost ?? directoryPickerHost()
    this.sdkOptions = options.sdkOptions ?? {}
  }

  async chooseDirectory(): Promise<LearningPackSourceReadResult | null> {
    const picker = this.pickerHost.showDirectoryPicker
    if (picker === undefined) {
      throw new Error(
        'Directory selection requires a browser with the File System Access API.',
      )
    }

    try {
      const directory = await picker({ mode: 'read' })
      await this.sourceStore.saveSelectedDirectory(directory)
      return await readLearningPackSourceDirectory(directory, this.sdkOptions)
    } catch (error) {
      if (isAbortError(error)) {
        return null
      }
      throw error
    }
  }

  async readSelectedDirectory(): Promise<LearningPackSourceReadResult | null> {
    const directory = await this.sourceStore.loadSelectedDirectory()
    if (directory === null) {
      return null
    }
    await assertReadPermission(directory)
    return readLearningPackSourceDirectory(directory, this.sdkOptions)
  }
}

export async function readLearningPackSourceDirectory(
  sourceDirectory: BrowserLearningPackSourceDirectoryHandle,
  options: LearningPackSdkOptions = {},
): Promise<LearningPackSourceReadResult> {
  if (await hasDirectPackManifest(sourceDirectory)) {
    const directOutcome = await readLearningPackCandidate(
      sourceDirectory,
      options,
    )
    return buildResult(sourceDirectory.name, 1, [directOutcome])
  }

  const childDirectories = await listChildDirectories(sourceDirectory)
  const outcomes: BrowserLearningPackSourceOutcome[] = []

  for (const childDirectory of childDirectories) {
    if (!(await hasDirectPackManifest(childDirectory))) {
      continue
    }
    const outcome = await readLearningPackCandidate(childDirectory, options)

    if (outcome.status !== 'not-pack') {
      outcomes.push(outcome)
    }
  }

  return buildResult(sourceDirectory.name, childDirectories.length, outcomes)
}

async function hasDirectPackManifest(
  directory: BrowserLearningPackSourceDirectoryHandle,
): Promise<boolean> {
  try {
    await directory.getFileHandle('pack.json')
    return true
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === 'NotFoundError' || error.name === 'TypeMismatchError')
    ) {
      return false
    }
    throw error
  }
}

function buildResult(
  sourceName: string,
  scannedDirectoryCount: number,
  outcomes: readonly BrowserLearningPackSourceOutcome[],
): LearningPackSourceReadResult {
  return {
    sourceName,
    scannedDirectoryCount,
    candidates: outcomes.flatMap((outcome) =>
      outcome.status === 'validated' ? [withoutValidatedStatus(outcome)] : [],
    ),
    rejectedCandidates: outcomes.flatMap((outcome) =>
      outcome.status === 'validated' ? [] : [outcome],
    ),
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

async function readLearningPackCandidate(
  directory: BrowserLearningPackSourceDirectoryHandle,
  options: LearningPackSdkOptions,
): Promise<BrowserLearningPackSourceOutcome> {
  let files: PackFileRecord[]

  try {
    files = await readDirectoryFiles(directory, options)
  } catch (error) {
    if (isDirectoryPermissionError(error)) {
      throw new Error(
        `Permission to read ${directory.name} is no longer available. Choose the directory again; installed packs were retained.`,
        { cause: error },
      )
    }
    const message =
      error instanceof Error
        ? error.message
        : `Could not read ${directory.name}.`
    return invalidOutcome(directory.name, undefined, {
      message,
      diagnostics: [
        makeDiagnostic(
          LearningPackErrorCode.STRUCTURE_INVALID,
          'error',
          directory.name,
          message,
        ),
      ],
    })
  }

  if (!files.some((file) => file.path === 'pack.json')) {
    return {
      directoryName: directory.name,
      status: 'not-pack',
      message: 'No pack.json file was found.',
      diagnostics: [],
    }
  }

  const loaded = await loadLearningPackFromFilesAsync(
    'directory',
    directory.name,
    files,
    options,
  )

  if (!('documents' in loaded)) {
    return invalidOutcome(directory.name, manifestMetadataFromFiles(files), {
      message: 'Learning pack validation failed.',
      diagnostics: loaded.diagnostics,
    })
  }

  return {
    directoryName: directory.name,
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

async function readDirectoryFiles(
  directory: BrowserLearningPackSourceDirectoryHandle,
  options: LearningPackSdkOptions,
  prefix = '',
  accumulator: ArchiveLimitAccumulator = createArchiveLimitAccumulator(
    resolveArchiveLimits(options),
  ),
): Promise<PackFileRecord[]> {
  const files: PackFileRecord[] = []

  for await (const entry of directory.values()) {
    const path = `${prefix}${entry.name}`
    if (isDirectoryHandle(entry)) {
      files.push(
        ...(await readDirectoryFiles(entry, options, `${path}/`, accumulator)),
      )
      continue
    }

    const file = await entry.getFile()
    const limitDiagnostic = accumulator.acceptMetadata(path, file.size)[0]
    if (limitDiagnostic !== undefined) {
      throw new Error(limitDiagnostic.message)
    }
    const bytes = new Uint8Array(await file.arrayBuffer())
    if (bytes.byteLength !== file.size) {
      throw new Error(
        `File size changed while reading ${path}: expected ${String(file.size)}, read ${String(bytes.byteLength)}.`,
      )
    }
    files.push({
      path,
      bytes,
      sha256: '',
      size: bytes.byteLength,
    })
  }

  return files
}

async function listChildDirectories(
  directory: BrowserLearningPackSourceDirectoryHandle,
): Promise<BrowserLearningPackSourceDirectoryHandle[]> {
  const directories: BrowserLearningPackSourceDirectoryHandle[] = []

  for await (const entry of directory.values()) {
    if (isDirectoryHandle(entry)) {
      directories.push(entry)
    }
  }

  return directories.sort((left, right) => left.name.localeCompare(right.name))
}

function isDirectoryHandle(
  entry: BrowserLearningPackDirectoryEntry,
): entry is BrowserLearningPackSourceDirectoryHandle {
  return entry.kind === 'directory' || 'values' in entry
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

async function assertReadPermission(
  directory: BrowserLearningPackSourceDirectoryHandle,
): Promise<void> {
  if (directory.queryPermission === undefined) {
    return
  }
  const permission = await directory.queryPermission({ mode: 'read' })
  if (permission === 'granted') {
    return
  }
  throw new Error(
    `Permission to read ${directory.name} is not available. Choose the directory again; installed packs were retained.`,
  )
}

function directoryPickerHost(): BrowserLearningPackDirectoryPickerHost {
  return globalThis as BrowserLearningPackDirectoryPickerHost
}

function isAbortError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === 'AbortError' ||
      error.message === 'The user aborted a request.')
  )
}

function isDirectoryPermissionError(error: unknown): boolean {
  return error instanceof Error && error.name === 'NotAllowedError'
}
