import { Unzip, UnzipInflate, UnzipPassThrough } from 'fflate'
import {
  hasBlockingDiagnostics,
  type LearningPackDiagnostic,
} from '@learnt/learning-pack-contracts'
import { crc32 } from './crc32.js'
import { fileManifestDiagnostic } from './diagnostics.js'
import {
  createArchiveLimitAccumulator,
  DEFAULT_ARCHIVE_LIMITS,
} from './limits.js'
import { compareArchivePaths, validateArchivePath } from './paths.js'
import type { ArchiveLimits, PackFileRecord } from './types.js'

interface CentralDirectoryRecord {
  name: Uint8Array
  crc: number
  size: number
  offset: number
}

interface ZipEntryMetadata {
  path: string
  flags: number
  compression: number
  compressedSize: number
  uncompressedSize: number
  localHeaderOffset: number
}

const encoder = new TextEncoder()
const decoder = new TextDecoder('utf-8', { fatal: true })
const fixedDosTime = 0
const fixedDosDate = (1 << 5) | 1
const unzipInputChunkBytes = 8 * 1024

export function createDeterministicZip(
  files: readonly PackFileRecord[],
): Uint8Array {
  const sortedFiles = [...files].sort((left, right) =>
    compareArchivePaths(left.path, right.path),
  )
  const chunks: Uint8Array[] = []
  const centralRecords: CentralDirectoryRecord[] = []
  let offset = 0

  for (const file of sortedFiles) {
    const name = encoder.encode(file.path)
    const size = file.bytes.byteLength
    assertZip32Size(file.path, size)
    const checksum = crc32(file.bytes)
    const header = new Uint8Array(30 + name.byteLength)
    const view = new DataView(header.buffer)
    writeLocalFileHeader(view, name.byteLength, checksum, size)
    header.set(name, 30)
    chunks.push(header, file.bytes)
    centralRecords.push({ name, crc: checksum, size, offset })
    offset += header.byteLength + file.bytes.byteLength
  }

  const centralOffset = offset
  for (const record of centralRecords) {
    assertZip32Size('central-directory-offset', record.offset)
    const header = new Uint8Array(46 + record.name.byteLength)
    const view = new DataView(header.buffer)
    writeCentralDirectoryHeader(view, record)
    header.set(record.name, 46)
    chunks.push(header)
    offset += header.byteLength
  }

  const centralSize = offset - centralOffset
  assertZip32Size('central-directory-size', centralSize)
  if (centralRecords.length > 0xffff) {
    throw new Error('ZIP64 archives are not supported by this SDK.')
  }

  const end = new Uint8Array(22)
  const endView = new DataView(end.buffer)
  endView.setUint32(0, 0x06054b50, true)
  endView.setUint16(8, centralRecords.length, true)
  endView.setUint16(10, centralRecords.length, true)
  endView.setUint32(12, centralSize, true)
  endView.setUint32(16, centralOffset, true)
  chunks.push(end)

  return concatBytes(chunks)
}

export function readZipEntries(
  bytes: Uint8Array,
  limits: ArchiveLimits = DEFAULT_ARCHIVE_LIMITS,
): {
  files: PackFileRecord[]
  diagnostics: LearningPackDiagnostic[]
} {
  const inspected = inspectZipMetadata(bytes, limits)
  if (hasBlockingDiagnostics(inspected.diagnostics)) {
    return { files: [], diagnostics: inspected.diagnostics }
  }

  const extracted = extractZipEntriesBounded(bytes, inspected.entries, limits)
  return {
    files: extracted.files,
    diagnostics: [...inspected.diagnostics, ...extracted.diagnostics],
  }
}

export function inspectZipCentralDirectory(
  bytes: Uint8Array,
  limits: ArchiveLimits = DEFAULT_ARCHIVE_LIMITS,
): LearningPackDiagnostic[] {
  return inspectZipMetadata(bytes, limits).diagnostics
}

function inspectZipMetadata(
  bytes: Uint8Array,
  limits: ArchiveLimits,
): Readonly<{
  entries: readonly ZipEntryMetadata[]
  diagnostics: LearningPackDiagnostic[]
}> {
  const diagnostics: LearningPackDiagnostic[] = []
  const entries: ZipEntryMetadata[] = []
  if (bytes.byteLength > limits.maxTotalBytes) {
    diagnostics.push(
      fileManifestDiagnostic(
        'archive.zip',
        `Compressed archive bytes ${bytes.byteLength} exceed limit ${limits.maxTotalBytes}.`,
      ),
    )
    return { entries, diagnostics }
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const eocdOffset = findEndOfCentralDirectory(view)
  if (eocdOffset === -1) {
    diagnostics.push(
      fileManifestDiagnostic(
        'archive.zip',
        'ZIP end-of-central-directory record is missing.',
      ),
    )
    return { entries, diagnostics }
  }

  const diskNumber = view.getUint16(eocdOffset + 4, true)
  const centralDirectoryDisk = view.getUint16(eocdOffset + 6, true)
  const diskEntryCount = view.getUint16(eocdOffset + 8, true)
  const entryCount = view.getUint16(eocdOffset + 10, true)
  const centralDirectorySize = view.getUint32(eocdOffset + 12, true)
  const centralDirectoryOffset = view.getUint32(eocdOffset + 16, true)
  if (
    diskNumber !== 0 ||
    centralDirectoryDisk !== 0 ||
    diskEntryCount !== entryCount
  ) {
    diagnostics.push(
      fileManifestDiagnostic(
        'archive.zip',
        'Multi-disk ZIP archives are not supported.',
      ),
    )
    return { entries, diagnostics }
  }
  if (
    entryCount === 0xffff ||
    centralDirectorySize === 0xffffffff ||
    centralDirectoryOffset === 0xffffffff
  ) {
    diagnostics.push(
      fileManifestDiagnostic(
        'archive.zip',
        'ZIP64 archives are not supported by this SDK.',
      ),
    )
    return { entries, diagnostics }
  }
  if (entryCount > limits.maxFileCount) {
    diagnostics.push(
      fileManifestDiagnostic(
        'archive.files',
        `File count ${entryCount} exceeds limit ${limits.maxFileCount}.`,
      ),
    )
    return { entries, diagnostics }
  }
  if (
    centralDirectoryOffset + centralDirectorySize > bytes.byteLength ||
    centralDirectoryOffset > bytes.byteLength
  ) {
    diagnostics.push(
      fileManifestDiagnostic(
        'archive.zip',
        'ZIP central directory points outside the archive.',
      ),
    )
    return { entries, diagnostics }
  }

  const seen = new Set<string>()
  const accumulator = createArchiveLimitAccumulator(limits)
  let offset = centralDirectoryOffset
  for (let index = 0; index < entryCount; index += 1) {
    if (
      offset + 46 > bytes.byteLength ||
      view.getUint32(offset, true) !== 0x02014b50
    ) {
      diagnostics.push(
        fileManifestDiagnostic(
          'archive.zip',
          'ZIP central directory entry is malformed.',
        ),
      )
      return { entries, diagnostics }
    }

    const versionMadeBy = view.getUint16(offset + 4, true)
    const flags = view.getUint16(offset + 8, true)
    const compression = view.getUint16(offset + 10, true)
    const compressedSize = view.getUint32(offset + 20, true)
    const uncompressedSize = view.getUint32(offset + 24, true)
    const fileNameLength = view.getUint16(offset + 28, true)
    const extraLength = view.getUint16(offset + 30, true)
    const commentLength = view.getUint16(offset + 32, true)
    const diskStart = view.getUint16(offset + 34, true)
    const externalAttributes = view.getUint32(offset + 38, true)
    const localHeaderOffset = view.getUint32(offset + 42, true)
    const fileNameStart = offset + 46
    const fileNameEnd = fileNameStart + fileNameLength
    const extraEnd = fileNameEnd + extraLength
    const recordEnd = extraEnd + commentLength
    if (
      recordEnd > centralDirectoryOffset + centralDirectorySize ||
      recordEnd > bytes.byteLength
    ) {
      diagnostics.push(
        fileManifestDiagnostic(
          'archive.zip',
          'ZIP central directory filename is malformed.',
        ),
      )
      return { entries, diagnostics }
    }

    let archivePath: string
    try {
      archivePath = decoder.decode(bytes.subarray(fileNameStart, fileNameEnd))
    } catch {
      diagnostics.push(
        fileManifestDiagnostic(
          'archive.zip',
          'ZIP central directory filename is not valid UTF-8.',
        ),
      )
      return { entries, diagnostics }
    }
    const extra = bytes.subarray(fileNameEnd, extraEnd)
    if (
      compressedSize === 0xffffffff ||
      uncompressedSize === 0xffffffff ||
      localHeaderOffset === 0xffffffff ||
      diskStart === 0xffff ||
      containsZip64Extra(extra)
    ) {
      diagnostics.push(
        fileManifestDiagnostic(
          archivePath || 'archive.zip',
          'ZIP64 archives are not supported by this SDK.',
        ),
      )
    }
    if ((flags & 1) !== 0) {
      diagnostics.push(
        fileManifestDiagnostic(
          archivePath,
          `Encrypted ZIP entries are not supported: ${archivePath}.`,
        ),
      )
    }
    if (compression !== 0 && compression !== 8) {
      diagnostics.push(
        fileManifestDiagnostic(
          archivePath,
          `ZIP compression method ${compression} is not supported: ${archivePath}.`,
        ),
      )
    }
    const hostSystem = versionMadeBy >> 8
    const unixMode = externalAttributes >>> 16
    const isUnixSymlink = hostSystem === 3 && (unixMode & 0o170000) === 0o120000
    if (isUnixSymlink) {
      diagnostics.push(
        fileManifestDiagnostic(
          archivePath,
          `Symbolic link entries are not supported in learning pack archives: ${archivePath}.`,
        ),
      )
    }

    if (seen.has(archivePath)) {
      diagnostics.push(
        fileManifestDiagnostic(
          archivePath,
          `Archive path ${archivePath} is duplicated.`,
        ),
      )
    }
    seen.add(archivePath)
    diagnostics.push(...validateArchivePath(archivePath))
    diagnostics.push(
      ...accumulator.acceptMetadata(archivePath, uncompressedSize),
    )
    if (
      localHeaderOffset + 30 > centralDirectoryOffset ||
      view.getUint32(localHeaderOffset, true) !== 0x04034b50
    ) {
      diagnostics.push(
        fileManifestDiagnostic(
          archivePath,
          `Local ZIP header is malformed for ${archivePath}.`,
        ),
      )
    } else {
      const localFlags = view.getUint16(localHeaderOffset + 6, true)
      const localCompression = view.getUint16(localHeaderOffset + 8, true)
      const localNameLength = view.getUint16(localHeaderOffset + 26, true)
      const localExtraLength = view.getUint16(localHeaderOffset + 28, true)
      const localNameStart = localHeaderOffset + 30
      const localNameEnd = localNameStart + localNameLength
      const localExtraEnd = localNameEnd + localExtraLength
      const compressedDataEnd = localExtraEnd + compressedSize
      if (
        localExtraEnd > centralDirectoryOffset ||
        compressedDataEnd > centralDirectoryOffset
      ) {
        diagnostics.push(
          fileManifestDiagnostic(
            archivePath,
            `Local ZIP header is malformed for ${archivePath}.`,
          ),
        )
      } else {
        let localPath: string | null = null
        try {
          localPath = decoder.decode(
            bytes.subarray(localNameStart, localNameEnd),
          )
        } catch {
          diagnostics.push(
            fileManifestDiagnostic(
              archivePath,
              `Local ZIP filename is not valid UTF-8 for ${archivePath}.`,
            ),
          )
        }
        if (
          localPath !== archivePath ||
          localFlags !== flags ||
          localCompression !== compression
        ) {
          diagnostics.push(
            fileManifestDiagnostic(
              archivePath,
              `Local ZIP header does not match central directory for ${archivePath}.`,
            ),
          )
        }
        if ((localFlags & 1) !== 0) {
          diagnostics.push(
            fileManifestDiagnostic(
              archivePath,
              `Encrypted ZIP entries are not supported: ${archivePath}.`,
            ),
          )
        }
        if (containsZip64Extra(bytes.subarray(localNameEnd, localExtraEnd))) {
          diagnostics.push(
            fileManifestDiagnostic(
              archivePath,
              'ZIP64 archives are not supported by this SDK.',
            ),
          )
        }
      }
    }
    entries.push({
      path: archivePath,
      flags,
      compression,
      compressedSize,
      uncompressedSize,
      localHeaderOffset,
    })
    offset = recordEnd
  }

  if (offset !== centralDirectoryOffset + centralDirectorySize) {
    diagnostics.push(
      fileManifestDiagnostic(
        'archive.zip',
        'ZIP central directory size does not match its entries.',
      ),
    )
  }
  return { entries, diagnostics }
}

function extractZipEntriesBounded(
  bytes: Uint8Array,
  entries: readonly ZipEntryMetadata[],
  limits: ArchiveLimits,
): Readonly<{
  files: PackFileRecord[]
  diagnostics: LearningPackDiagnostic[]
}> {
  const metadataByPath = new Map(entries.map((entry) => [entry.path, entry]))
  const accumulator = createArchiveLimitAccumulator(limits)
  for (const entry of entries) {
    accumulator.acceptMetadata(entry.path, entry.uncompressedSize)
  }
  const files: PackFileRecord[] = []
  const diagnostics: LearningPackDiagnostic[] = []
  const completed = new Set<string>()
  let blocking = false
  const unzip = new Unzip((file) => {
    const metadata = metadataByPath.get(file.name)
    if (metadata === undefined || completed.has(file.name)) {
      diagnostics.push(
        fileManifestDiagnostic(
          file.name,
          `Archive emitted unexpected file ${file.name}.`,
        ),
      )
      blocking = true
      file.terminate()
      return
    }
    const chunks: Uint8Array[] = []
    let fileBytes = 0
    file.ondata = (error, chunk, final) => {
      if (blocking) {
        file.terminate()
        return
      }
      if (error !== null) {
        diagnostics.push(
          fileManifestDiagnostic(
            file.name,
            `Could not decompress ${file.name}: ${error.message}`,
          ),
        )
        blocking = true
        file.terminate()
        return
      }
      const outputDiagnostics = accumulator.acceptOutput(
        file.name,
        chunk.byteLength,
      )
      if (outputDiagnostics.length > 0) {
        diagnostics.push(...outputDiagnostics)
        blocking = true
        file.terminate()
        return
      }
      chunks.push(chunk)
      fileBytes += chunk.byteLength
      if (!final) {
        return
      }
      if (fileBytes !== metadata.uncompressedSize) {
        diagnostics.push(
          fileManifestDiagnostic(
            file.name,
            `Actual output bytes ${fileBytes} do not match declared size ${metadata.uncompressedSize}.`,
          ),
        )
        blocking = true
        return
      }
      const entryBytes = concatBytes(chunks)
      files.push({
        path: file.name,
        bytes: entryBytes,
        sha256: '',
        size: entryBytes.byteLength,
      })
      completed.add(file.name)
    }
    file.start()
  })
  unzip.register(UnzipInflate)
  unzip.register(UnzipPassThrough)

  try {
    for (
      let offset = 0;
      offset < bytes.byteLength && !blocking;
      offset += unzipInputChunkBytes
    ) {
      const end = Math.min(offset + unzipInputChunkBytes, bytes.byteLength)
      unzip.push(bytes.subarray(offset, end), end === bytes.byteLength)
    }
  } catch (error) {
    diagnostics.push(
      fileManifestDiagnostic(
        'archive.zip',
        `Could not decompress learning pack archive: ${(error as Error).message}`,
      ),
    )
    blocking = true
  }
  if (!blocking && completed.size !== entries.length) {
    diagnostics.push(
      fileManifestDiagnostic(
        'archive.zip',
        `Archive emitted ${completed.size} files but declared ${entries.length}.`,
      ),
    )
  }
  if (hasBlockingDiagnostics(diagnostics)) {
    return { files: [], diagnostics }
  }
  files.sort((left, right) => compareArchivePaths(left.path, right.path))
  return { files, diagnostics }
}

function containsZip64Extra(extra: Uint8Array): boolean {
  const view = new DataView(extra.buffer, extra.byteOffset, extra.byteLength)
  let offset = 0
  while (offset + 4 <= extra.byteLength) {
    const headerId = view.getUint16(offset, true)
    const size = view.getUint16(offset + 2, true)
    offset += 4
    if (offset + size > extra.byteLength) {
      return true
    }
    if (headerId === 0x0001) {
      return true
    }
    offset += size
  }
  return offset !== extra.byteLength
}

function writeLocalFileHeader(
  view: DataView,
  nameLength: number,
  checksum: number,
  size: number,
): void {
  view.setUint32(0, 0x04034b50, true)
  view.setUint16(4, 20, true)
  view.setUint16(6, 0, true)
  view.setUint16(8, 0, true)
  view.setUint16(10, fixedDosTime, true)
  view.setUint16(12, fixedDosDate, true)
  view.setUint32(14, checksum, true)
  view.setUint32(18, size, true)
  view.setUint32(22, size, true)
  view.setUint16(26, nameLength, true)
  view.setUint16(28, 0, true)
}

function writeCentralDirectoryHeader(
  view: DataView,
  record: CentralDirectoryRecord,
): void {
  view.setUint32(0, 0x02014b50, true)
  view.setUint16(4, 20, true)
  view.setUint16(6, 20, true)
  view.setUint16(8, 0, true)
  view.setUint16(10, 0, true)
  view.setUint16(12, fixedDosTime, true)
  view.setUint16(14, fixedDosDate, true)
  view.setUint32(16, record.crc, true)
  view.setUint32(20, record.size, true)
  view.setUint32(24, record.size, true)
  view.setUint16(28, record.name.byteLength, true)
  view.setUint16(30, 0, true)
  view.setUint16(32, 0, true)
  view.setUint16(34, 0, true)
  view.setUint16(36, 0, true)
  view.setUint32(38, 0, true)
  view.setUint32(42, record.offset, true)
}

function concatBytes(chunks: readonly Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0)
  const output = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    output.set(chunk, offset)
    offset += chunk.byteLength
  }
  return output
}

function findEndOfCentralDirectory(view: DataView): number {
  const minimumEocdSize = 22
  const maximumCommentSize = 0xffff
  const start = Math.max(
    0,
    view.byteLength - minimumEocdSize - maximumCommentSize,
  )
  for (
    let offset = view.byteLength - minimumEocdSize;
    offset >= start;
    offset -= 1
  ) {
    if (view.getUint32(offset, true) === 0x06054b50) {
      return offset
    }
  }
  return -1
}

function assertZip32Size(label: string, value: number): void {
  if (value > 0xffffffff) {
    throw new Error(`${label} is too large for deterministic ZIP32 output.`)
  }
}
