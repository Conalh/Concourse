import type {
  CapabilityDeclaration,
  LearningPackDiagnostic,
  LearningPackDocuments,
  LearningPackManifest,
  PackMigration,
} from '@learnt/learning-pack-contracts'

export const LEARNTPACK_EXTENSION = '.learntpack' as const

export const PUBLISHER_SIGNATURE_EXTENSION_POINT = {
  status: 'reserved-for-future',
  reservedDirectory: 'signatures/',
  manifestPath: 'signatures/publisher-signature.json',
} as const

export interface ArchiveLimits {
  maxTotalBytes: number
  maxFileCount: number
  maxFileBytes: number
}

export interface LearningPackSdkOptions {
  limits?: Partial<ArchiveLimits>
  supportedCapabilities?: readonly CapabilityDeclaration[]
}

export interface PackFileRecord {
  path: string
  bytes: Uint8Array
  sha256: string
  size: number
}

export interface LoadedLearningPack {
  sourceKind: 'directory' | 'archive' | 'memory'
  sourcePath: string
  documents: LearningPackDocuments
  files: PackFileRecord[]
  contentHash: string
  diagnostics: LearningPackDiagnostic[]
}

export interface ValidationSummary {
  ok: boolean
  sourceKind: 'directory' | 'archive'
  path: string
  contentHash?: string
  packId?: string
  version?: string
  diagnostics: LearningPackDiagnostic[]
}

export interface PackArchiveResult {
  ok: boolean
  inputDirectory: string
  outFile: string
  archiveSha256?: string
  archiveBytes?: number
  packId?: string
  version?: string
  diagnostics: LearningPackDiagnostic[]
}

export interface UnpackArchiveResult {
  ok: boolean
  archiveFile: string
  outDirectory: string
  contentHash?: string
  packId?: string
  version?: string
  diagnostics: LearningPackDiagnostic[]
}

export interface InspectArchiveResult {
  ok: boolean
  archiveFile: string
  archiveSha256?: string
  archiveBytes?: number
  contentHash?: string
  manifest?: Pick<
    LearningPackManifest,
    'packId' | 'version' | 'title' | 'summary' | 'language' | 'releasedAt'
  >
  counts?: {
    subjects: number
    concepts: number
    objectives: number
    courses: number
    items: number
    resources: number
    studySets: number
    files: number
    totalFileBytes: number
  }
  capabilities?: LearningPackManifest['capabilities']
  migrations?: PackMigration[]
  signatures: typeof PUBLISHER_SIGNATURE_EXTENSION_POINT
  diagnostics: LearningPackDiagnostic[]
}

export interface DiffLearningPackResult {
  ok: boolean
  oldPath: string
  newPath: string
  oldPackId?: string
  newPackId?: string
  oldVersion?: string
  newVersion?: string
  changedRelease?: boolean
  addedItems: string[]
  removedItems: string[]
  changedItems: string[]
  addedResources: string[]
  removedResources: string[]
  changedResources: string[]
  learningRevisionIncreases: Array<{
    itemId: string
    fromLearningRevision: number
    toLearningRevision: number
    masteryMustReset: boolean
  }>
  resourceRevisionIncreases: Array<{
    resourceId: string
    fromContentRevision: number
    toContentRevision: number
    engagementMayBeStale: boolean
  }>
  changedResourceMetadata: string[]
  changedResourceSources: string[]
  changedResourceSegments: Array<{
    resourceId: string
    addedSegmentIds: string[]
    removedSegmentIds: string[]
    changedSegmentIds: string[]
  }>
  changedResourceCheckpoints: Array<{
    resourceId: string
    addedCheckpointIds: string[]
    removedCheckpointIds: string[]
  }>
  changedCurriculumOrders: string[]
  addedFiles: string[]
  removedFiles: string[]
  changedFiles: string[]
  migrations: PackMigration[]
  diagnostics: LearningPackDiagnostic[]
}
