import { SUPPORTED_CAPABILITIES } from './constants.js'
import {
  LearningPackErrorCode,
  makeDiagnostic,
  type LearningPackDiagnostic,
} from './errors.js'
import type {
  CapabilityDeclaration,
  LearningResource,
  LearningPackManifest,
  PackFileManifestEntry,
} from './types.js'

const packIdPattern = /^[a-z0-9]+([.-][a-z0-9]+)*$/
const localEntityIdPattern = /^[a-z0-9][a-z0-9._/-]{0,127}$/

export interface GlobalEntityKeyParts {
  packId: string
  entityId: string
}

export interface VersionedItemKeyParts extends GlobalEntityKeyParts {
  packVersion: string
  learningRevision: number
}

export interface CapabilityCheckOptions {
  supportedCapabilities?: readonly CapabilityDeclaration[]
  path?: string
}

export interface CapabilityCheckResult {
  ok: boolean
  diagnostics: LearningPackDiagnostic[]
  unsupportedRequired: CapabilityDeclaration[]
  unsupportedOptional: CapabilityDeclaration[]
}

export interface InstalledPackRecord {
  packId: string
  version: string
  files: Pick<PackFileManifestEntry, 'path' | 'sha256'>[]
}

export type PackUpdateAction =
  | 'install-new'
  | 'already-installed'
  | 'reject-version-conflict'
  | 'install-additional-version'

export interface PackUpdatePlan {
  action: PackUpdateAction
  packId: string
  version: string
  reason: string
  conflictingFiles: string[]
}

export type ResourceUpdateAction =
  | 'new-resource'
  | 'preserve-engagement-history'
  | 'stale-engagement-history'
  | 'resource-removed'

export interface InstalledResourceRecord {
  packId: string
  resourceId: string
  contentRevision: number
}

export interface ResourceUpdatePlan {
  action: ResourceUpdateAction
  packId: string
  resourceId: string
  fromContentRevision: number | null
  toContentRevision: number | null
  reason: string
}

export function isValidPackId(value: string): boolean {
  return packIdPattern.test(value)
}

export function isValidLocalEntityId(value: string): boolean {
  return localEntityIdPattern.test(value) && !hasForbiddenLocalIdSegment(value)
}

export function makeGlobalEntityKey(packId: string, entityId: string): string {
  assertValidPackId(packId)
  assertValidLocalEntityId(entityId)
  return `${packId}:${entityId}`
}

export function createResourceGlobalKey(
  packId: string,
  resourceId: string,
): string {
  return makeGlobalEntityKey(packId, resourceId)
}

export function parseGlobalEntityKey(key: string): GlobalEntityKeyParts {
  const separatorIndex = key.indexOf(':')
  if (separatorIndex <= 0 || separatorIndex === key.length - 1) {
    throw new Error(`Invalid global entity key: ${key}`)
  }

  const packId = key.slice(0, separatorIndex)
  const entityId = key.slice(separatorIndex + 1)
  assertValidPackId(packId)
  assertValidLocalEntityId(entityId)
  return { packId, entityId }
}

export function makeVersionedItemKey(parts: VersionedItemKeyParts): string {
  assertValidPackId(parts.packId)
  assertValidLocalEntityId(parts.entityId)
  if (!Number.isInteger(parts.learningRevision) || parts.learningRevision < 1) {
    throw new Error('learningRevision must be a positive integer.')
  }
  return `${parts.packId}@${parts.packVersion}:${parts.entityId}#${parts.learningRevision}`
}

export function compareLearningRevision(
  left: number,
  right: number,
): -1 | 0 | 1 {
  if (left === right) {
    return 0
  }
  return left < right ? -1 : 1
}

export function compareResourceRevisions(
  left: number,
  right: number,
): -1 | 0 | 1 {
  return compareLearningRevision(left, right)
}

export function canPreserveMasteryAcrossRevision(
  fromLearningRevision: number,
  toLearningRevision: number,
): boolean {
  return compareLearningRevision(fromLearningRevision, toLearningRevision) === 0
}

export function checkCapabilities(
  required: readonly CapabilityDeclaration[],
  optional: readonly CapabilityDeclaration[] = [],
  options: CapabilityCheckOptions = {},
): CapabilityCheckResult {
  const supported = options.supportedCapabilities ?? SUPPORTED_CAPABILITIES
  const rootPath = options.path ?? 'pack.capabilities'
  const unsupportedRequired = required.filter(
    (capability) => !hasCapability(supported, capability),
  )
  const unsupportedOptional = optional.filter(
    (capability) => !hasCapability(supported, capability),
  )

  const diagnostics = [
    ...unsupportedRequired.map((capability) =>
      makeDiagnostic(
        LearningPackErrorCode.UNSUPPORTED_REQUIRED_CAPABILITY,
        'error',
        `${rootPath}.required`,
        `Required capability ${capability.capabilityId}@${capability.version} is not supported.`,
      ),
    ),
    ...unsupportedOptional.map((capability) =>
      makeDiagnostic(
        LearningPackErrorCode.UNSUPPORTED_OPTIONAL_CAPABILITY,
        'warning',
        `${rootPath}.optional`,
        `Optional capability ${capability.capabilityId}@${capability.version} is not supported and may be ignored.`,
      ),
    ),
  ]

  return {
    ok: unsupportedRequired.length === 0,
    diagnostics,
    unsupportedRequired,
    unsupportedOptional,
  }
}

export function hasCapability(
  supportedCapabilities: readonly CapabilityDeclaration[],
  requested: CapabilityDeclaration,
): boolean {
  return supportedCapabilities.some(
    (capability) =>
      capability.capabilityId === requested.capabilityId &&
      capability.version === requested.version,
  )
}

export function planPackUpdate(
  installed: readonly InstalledPackRecord[],
  nextManifest: LearningPackManifest,
): PackUpdatePlan {
  const sameRelease = installed.find(
    (record) =>
      record.packId === nextManifest.packId &&
      record.version === nextManifest.version,
  )

  if (!sameRelease) {
    return {
      action: installed.some((record) => record.packId === nextManifest.packId)
        ? 'install-additional-version'
        : 'install-new',
      packId: nextManifest.packId,
      version: nextManifest.version,
      reason: 'No installed release has this exact packId and version.',
      conflictingFiles: [],
    }
  }

  const conflicts = findFileHashConflicts(sameRelease.files, nextManifest.files)
  if (conflicts.length > 0) {
    return {
      action: 'reject-version-conflict',
      packId: nextManifest.packId,
      version: nextManifest.version,
      reason:
        'The same packId/version is already installed with different file hashes.',
      conflictingFiles: conflicts,
    }
  }

  return {
    action: 'already-installed',
    packId: nextManifest.packId,
    version: nextManifest.version,
    reason: 'The same immutable pack release is already installed.',
    conflictingFiles: [],
  }
}

export function planResourceUpdate(
  installed: InstalledResourceRecord | null,
  next: Pick<LearningResource, 'id' | 'contentRevision'> | null,
  packId: string,
): ResourceUpdatePlan {
  if (!installed && !next) {
    throw new Error(
      'planResourceUpdate requires an installed resource or a next resource.',
    )
  }

  if (!next) {
    return {
      action: 'resource-removed',
      packId: installed!.packId,
      resourceId: installed!.resourceId,
      fromContentRevision: installed!.contentRevision,
      toContentRevision: null,
      reason: 'The resource is no longer present in the next pack version.',
    }
  }

  if (!installed) {
    return {
      action: 'new-resource',
      packId,
      resourceId: next.id,
      fromContentRevision: null,
      toContentRevision: next.contentRevision,
      reason: 'No installed resource has this resource ID.',
    }
  }

  if (installed.contentRevision === next.contentRevision) {
    return {
      action: 'preserve-engagement-history',
      packId,
      resourceId: next.id,
      fromContentRevision: installed.contentRevision,
      toContentRevision: next.contentRevision,
      reason: 'Resource identity and contentRevision are unchanged.',
    }
  }

  return {
    action: 'stale-engagement-history',
    packId,
    resourceId: next.id,
    fromContentRevision: installed.contentRevision,
    toContentRevision: next.contentRevision,
    reason:
      'Resource contentRevision changed; retain history but allow apps to treat prior completion as stale.',
  }
}

export function isValidAssetPath(path: string): boolean {
  if (!path.startsWith('assets/')) {
    return false
  }
  if (path.includes('\\') || path.startsWith('/') || /^[A-Za-z]:/.test(path)) {
    return false
  }
  const segments = path.split('/')
  return segments.every(
    (segment) => segment.length > 0 && segment !== '.' && segment !== '..',
  )
}

function assertValidPackId(packId: string): void {
  if (!isValidPackId(packId)) {
    throw new Error(`Invalid packId: ${packId}`)
  }
}

function assertValidLocalEntityId(entityId: string): void {
  if (!isValidLocalEntityId(entityId)) {
    throw new Error(`Invalid local entity ID: ${entityId}`)
  }
}

function hasForbiddenLocalIdSegment(value: string): boolean {
  return (
    value.includes(':') ||
    /\s/.test(value) ||
    value.includes('..') ||
    value.startsWith('/') ||
    value.endsWith('/')
  )
}

function findFileHashConflicts(
  installedFiles: readonly Pick<PackFileManifestEntry, 'path' | 'sha256'>[],
  nextFiles: readonly Pick<PackFileManifestEntry, 'path' | 'sha256'>[],
): string[] {
  const installedHashes = new Map(
    installedFiles.map((file) => [file.path, file.sha256]),
  )
  const conflicts: string[] = []

  for (const nextFile of nextFiles) {
    const installedHash = installedHashes.get(nextFile.path)
    if (installedHash !== undefined && installedHash !== nextFile.sha256) {
      conflicts.push(nextFile.path)
    }
  }

  return conflicts
}
