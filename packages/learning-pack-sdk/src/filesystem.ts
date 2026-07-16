import fs from 'node:fs/promises'
import path from 'node:path'
import { sha256Hex } from './hash.js'
import {
  compareArchivePaths,
  toArchivePath,
  validateUnsupportedPath,
} from './paths.js'
import type { LearningPackDiagnostic } from '@learnt/learning-pack-contracts'
import { fileManifestDiagnostic } from './diagnostics.js'
import {
  createArchiveLimitAccumulator,
  resolveArchiveLimits,
} from './limits.js'
import type { LearningPackSdkOptions, PackFileRecord } from './types.js'

export async function readDirectoryFiles(
  rootDirectory: string,
  options: LearningPackSdkOptions = {},
): Promise<
  | { files: PackFileRecord[]; diagnostics: LearningPackDiagnostic[] }
  | { diagnostics: LearningPackDiagnostic[] }
> {
  const root = path.resolve(rootDirectory)
  const diagnostics: LearningPackDiagnostic[] = []
  const files: PackFileRecord[] = []
  const accumulator = createArchiveLimitAccumulator(
    resolveArchiveLimits(options),
  )
  const rootStat = await fs.lstat(root)
  if (rootStat.isSymbolicLink()) {
    return {
      diagnostics: [
        fileManifestDiagnostic(
          rootDirectory,
          `Symbolic links are not supported as learning pack directory roots: ${rootDirectory}.`,
        ),
      ],
    }
  }
  if (!rootStat.isDirectory()) {
    return {
      diagnostics: [
        fileManifestDiagnostic(
          rootDirectory,
          `Learning pack source must be a directory: ${rootDirectory}.`,
        ),
      ],
    }
  }

  async function walk(currentDirectory: string): Promise<boolean> {
    const entries = await fs.readdir(currentDirectory, { withFileTypes: true })
    entries.sort((left, right) => left.name.localeCompare(right.name))

    for (const entry of entries) {
      const absolutePath = path.join(currentDirectory, entry.name)
      const relativePath = path.relative(root, absolutePath)
      const archivePath = toArchivePath(relativePath)
      const stat = await fs.lstat(absolutePath)

      if (stat.isSymbolicLink()) {
        diagnostics.push(
          fileManifestDiagnostic(
            archivePath,
            `Symbolic links are not supported in learning pack directories: ${archivePath}.`,
          ),
        )
        continue
      }

      if (entry.isDirectory()) {
        if (!(await walk(absolutePath))) {
          return false
        }
        continue
      }

      if (!entry.isFile()) {
        diagnostics.push(
          fileManifestDiagnostic(
            archivePath,
            `Only regular files are supported in learning pack directories: ${archivePath}.`,
          ),
        )
        continue
      }

      diagnostics.push(...validateUnsupportedPath(archivePath))
      const limitDiagnostics = accumulator.acceptMetadata(
        archivePath,
        stat.size,
      )
      if (limitDiagnostics.length > 0) {
        diagnostics.push(...limitDiagnostics)
        return false
      }
      const bytes = await readFileAtKnownSize(absolutePath, stat.size)
      if (bytes.byteLength !== stat.size) {
        diagnostics.push(
          fileManifestDiagnostic(
            archivePath,
            `File size changed while reading ${archivePath}: expected ${stat.size}, read ${bytes.byteLength}.`,
          ),
        )
        return false
      }
      files.push({
        path: archivePath,
        bytes,
        sha256: sha256Hex(bytes),
        size: bytes.byteLength,
      })
    }
    return true
  }

  await walk(root)
  files.sort((left, right) => compareArchivePaths(left.path, right.path))

  return { files, diagnostics }
}

export async function readFileAtKnownSize(
  filePath: string,
  expectedSize: number,
): Promise<Uint8Array> {
  const handle = await fs.open(filePath, 'r')
  try {
    const bytes = new Uint8Array(expectedSize + 1)
    let offset = 0
    while (offset < bytes.byteLength) {
      const result = await handle.read(
        bytes,
        offset,
        bytes.byteLength - offset,
        offset,
      )
      if (result.bytesRead === 0) {
        break
      }
      offset += result.bytesRead
    }
    return bytes.subarray(0, offset)
  } finally {
    await handle.close()
  }
}

export async function writeFilesToDirectory(
  rootDirectory: string,
  files: readonly PackFileRecord[],
): Promise<void> {
  const root = path.resolve(rootDirectory)
  for (const file of files) {
    const absolutePath = path.resolve(root, file.path)
    if (
      !absolutePath.startsWith(`${root}${path.sep}`) &&
      absolutePath !== root
    ) {
      throw new Error(
        `Refusing to write outside output directory: ${file.path}`,
      )
    }
    await fs.mkdir(path.dirname(absolutePath), { recursive: true })
    await fs.writeFile(absolutePath, file.bytes)
  }
}
