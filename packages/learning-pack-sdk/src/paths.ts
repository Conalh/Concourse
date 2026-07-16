import type { LearningPackDiagnostic } from '@learnt/learning-pack-contracts'
import {
  fileManifestDiagnostic,
  invalidAssetPathDiagnostic,
} from './diagnostics.js'
import {
  LEARNTPACK_EXTENSION,
  PUBLISHER_SIGNATURE_EXTENSION_POINT,
} from './types.js'

const unsupportedExtensions = new Set([
  '.bat',
  '.bin',
  '.cmd',
  '.com',
  '.cjs',
  '.css',
  '.dll',
  '.dmg',
  '.dylib',
  '.elf',
  '.exe',
  '.html',
  '.htm',
  '.jar',
  '.js',
  '.jsx',
  '.lib',
  '.mjs',
  '.msi',
  '.node',
  '.o',
  '.pyd',
  '.pyc',
  '.rpm',
  '.deb',
  '.pkg',
  '.ps1',
  '.scr',
  '.sh',
  '.so',
  '.ts',
  '.tsx',
  '.wasm',
])

export function assertLearntPackExtension(
  filePath: string,
): LearningPackDiagnostic[] {
  if (extensionOf(filePath).toLowerCase() !== LEARNTPACK_EXTENSION) {
    return [
      fileManifestDiagnostic(
        filePath,
        `Learning pack archives must use the ${LEARNTPACK_EXTENSION} extension.`,
      ),
    ]
  }
  return []
}

export function toArchivePath(relativePath: string): string {
  return relativePath.replace(/\\/g, '/')
}

export function compareArchivePaths(left: string, right: string): number {
  return left.localeCompare(right, 'en', { sensitivity: 'variant' })
}

export function validateArchivePath(
  archivePath: string,
): LearningPackDiagnostic[] {
  const diagnostics: LearningPackDiagnostic[] = []

  if (
    archivePath.length === 0 ||
    archivePath.includes('\0') ||
    archivePath.includes('\\') ||
    archivePath.startsWith('/') ||
    archivePath.startsWith('//') ||
    /^[A-Za-z]:/.test(archivePath)
  ) {
    diagnostics.push(
      fileManifestDiagnostic(
        archivePath || 'archive.path',
        `Archive path ${archivePath || '<empty>'} must be a relative POSIX path.`,
      ),
    )
  }

  const segments = archivePath.split('/')
  if (
    segments.some(
      (segment) => segment.length === 0 || segment === '.' || segment === '..',
    )
  ) {
    diagnostics.push(
      fileManifestDiagnostic(
        archivePath,
        `Archive path ${archivePath} must not contain empty, dot, or dot-dot segments.`,
      ),
    )
  }

  if (
    archivePath.startsWith(
      PUBLISHER_SIGNATURE_EXTENSION_POINT.reservedDirectory,
    )
  ) {
    diagnostics.push(
      fileManifestDiagnostic(
        archivePath,
        'Publisher signatures are reserved for a future extension and are not supported in v0.1 SDK archives.',
      ),
    )
  }

  diagnostics.push(...validateUnsupportedPath(archivePath))
  return diagnostics
}

export function validateUnsupportedPath(
  archivePath: string,
): LearningPackDiagnostic[] {
  const extension = extensionOf(archivePath).toLowerCase()
  if (!unsupportedExtensions.has(extension)) {
    return []
  }

  const diagnostic = archivePath.startsWith('assets/')
    ? invalidAssetPathDiagnostic
    : fileManifestDiagnostic

  return [
    diagnostic(
      archivePath,
      `File extension ${extension} is unsupported in learning pack archives.`,
    ),
  ]
}

function extensionOf(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/')
  const filename = normalized.split('/').at(-1) ?? ''
  const dotIndex = filename.lastIndexOf('.')
  return dotIndex > 0 ? filename.slice(dotIndex) : ''
}
