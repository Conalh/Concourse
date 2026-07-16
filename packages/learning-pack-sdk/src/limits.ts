import type { LearningPackDiagnostic } from '@learnt/learning-pack-contracts'
import { fileManifestDiagnostic } from './diagnostics.js'
import type {
  ArchiveLimits,
  LearningPackSdkOptions,
  PackFileRecord,
} from './types.js'

export const DEFAULT_ARCHIVE_LIMITS: ArchiveLimits = {
  maxTotalBytes: 50 * 1024 * 1024,
  maxFileCount: 512,
  maxFileBytes: 10 * 1024 * 1024,
}

export interface ArchiveLimitAccumulator {
  readonly fileCount: number
  readonly totalBytes: number
  acceptMetadata(path: string, size: number): LearningPackDiagnostic[]
  acceptOutput(path: string, chunkBytes: number): LearningPackDiagnostic[]
}

export function createArchiveLimitAccumulator(
  limits: ArchiveLimits,
): ArchiveLimitAccumulator {
  let fileCount = 0
  let declaredTotalBytes = 0
  let actualTotalBytes = 0
  const declaredByPath = new Map<string, number>()
  const actualByPath = new Map<string, number>()

  return {
    get fileCount() {
      return fileCount
    },
    get totalBytes() {
      return declaredTotalBytes
    },
    acceptMetadata(path, size) {
      fileCount += 1
      const diagnostics: LearningPackDiagnostic[] = []
      if (!Number.isSafeInteger(size) || size < 0) {
        diagnostics.push(
          fileManifestDiagnostic(path, `File size ${String(size)} is invalid.`),
        )
        return diagnostics
      }
      declaredByPath.set(path, size)
      declaredTotalBytes += size
      if (fileCount > limits.maxFileCount) {
        diagnostics.push(
          fileManifestDiagnostic(
            'archive.files',
            `File count ${fileCount} exceeds limit ${limits.maxFileCount}.`,
          ),
        )
      }
      if (size > limits.maxFileBytes) {
        diagnostics.push(
          fileManifestDiagnostic(
            path,
            `File size ${size} exceeds per-file limit ${limits.maxFileBytes}.`,
          ),
        )
      }
      if (declaredTotalBytes > limits.maxTotalBytes) {
        diagnostics.push(
          fileManifestDiagnostic(
            'archive.files',
            `Total declared file bytes ${declaredTotalBytes} exceeds limit ${limits.maxTotalBytes}.`,
          ),
        )
      }
      return diagnostics
    },
    acceptOutput(path, chunkBytes) {
      const diagnostics: LearningPackDiagnostic[] = []
      const fileBytes = (actualByPath.get(path) ?? 0) + chunkBytes
      actualByPath.set(path, fileBytes)
      actualTotalBytes += chunkBytes
      const declaredBytes = declaredByPath.get(path)
      if (declaredBytes === undefined) {
        diagnostics.push(
          fileManifestDiagnostic(
            path,
            `Archive emitted undeclared file ${path}.`,
          ),
        )
      } else if (fileBytes > declaredBytes) {
        diagnostics.push(
          fileManifestDiagnostic(
            path,
            `Actual output bytes ${fileBytes} exceed declared size ${declaredBytes}.`,
          ),
        )
      }
      if (fileBytes > limits.maxFileBytes) {
        diagnostics.push(
          fileManifestDiagnostic(
            path,
            `Actual output bytes ${fileBytes} exceed per-file limit ${limits.maxFileBytes}.`,
          ),
        )
      }
      if (actualTotalBytes > limits.maxTotalBytes) {
        diagnostics.push(
          fileManifestDiagnostic(
            'archive.files',
            `Actual total output bytes ${actualTotalBytes} exceed limit ${limits.maxTotalBytes}.`,
          ),
        )
      }
      return diagnostics
    },
  }
}

export function resolveArchiveLimits(
  options: LearningPackSdkOptions = {},
): ArchiveLimits {
  const limits = {
    maxTotalBytes:
      options.limits?.maxTotalBytes ?? DEFAULT_ARCHIVE_LIMITS.maxTotalBytes,
    maxFileCount:
      options.limits?.maxFileCount ?? DEFAULT_ARCHIVE_LIMITS.maxFileCount,
    maxFileBytes:
      options.limits?.maxFileBytes ?? DEFAULT_ARCHIVE_LIMITS.maxFileBytes,
  }

  for (const [name, value] of Object.entries(limits)) {
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new RangeError(
        `Learning pack limit ${name} must be a positive safe integer; received ${String(value)}.`,
      )
    }
  }

  return limits
}

export function enforceArchiveLimits(
  files: readonly PackFileRecord[],
  limits: ArchiveLimits,
): LearningPackDiagnostic[] {
  const diagnostics: LearningPackDiagnostic[] = []
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0)

  if (files.length > limits.maxFileCount) {
    diagnostics.push(
      fileManifestDiagnostic(
        'archive.files',
        `File count ${files.length} exceeds limit ${limits.maxFileCount}.`,
      ),
    )
  }

  if (totalBytes > limits.maxTotalBytes) {
    diagnostics.push(
      fileManifestDiagnostic(
        'archive.files',
        `Total file bytes ${totalBytes} exceeds limit ${limits.maxTotalBytes}.`,
      ),
    )
  }

  for (const file of files) {
    if (file.size > limits.maxFileBytes) {
      diagnostics.push(
        fileManifestDiagnostic(
          file.path,
          `File size ${file.size} exceeds per-file limit ${limits.maxFileBytes}.`,
        ),
      )
    }
  }

  return diagnostics
}
