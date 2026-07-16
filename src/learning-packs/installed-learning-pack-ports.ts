import type {
  LearningPackDiagnostic,
  LearningPackDocuments,
} from '@learnt/learning-pack-contracts'
import type { PackFileRecord } from '@learnt/learning-pack-sdk'

export type ValidatedLearningPackCandidate = Readonly<{
  contentHash: string
  documents: LearningPackDocuments
  files: readonly PackFileRecord[]
}>

export type InstalledLearningPackRelease = Readonly<{
  releaseId: string
  packVersion: string
  contentHash: string
  documents: LearningPackDocuments
  files: readonly PackFileRecord[]
}>

export type InstalledLearningPackRecord = Readonly<{
  packId: string
  activeReleaseId: string
  rollbackReleaseId: string | null
  releases: readonly InstalledLearningPackRelease[]
}>

export type PersistedLearningPackRecordIssue = Readonly<{
  packId: string | null
  message: string
}>

export type InstalledLearningPackStoreSnapshot = Readonly<{
  records: readonly InstalledLearningPackRecord[]
  issues: readonly PersistedLearningPackRecordIssue[]
}>

export interface InstalledLearningPackStore {
  readSnapshot(): Promise<InstalledLearningPackStoreSnapshot>
  write(record: InstalledLearningPackRecord): Promise<void>
}

export type ValidatedLearningPackSourceCandidate = Readonly<{
  directoryName: string
  packId: string
  packVersion: string
  title: string
  diagnostics: readonly LearningPackDiagnostic[]
  candidate: ValidatedLearningPackCandidate
}>

export type RejectedLearningPackSourceCandidate = Readonly<{
  directoryName: string
  status: 'invalid' | 'not-pack'
  packId?: string
  packVersion?: string
  title?: string
  message: string
  diagnostics: readonly LearningPackDiagnostic[]
}>

export type LearningPackSourceReadResult = Readonly<{
  sourceName: string
  scannedDirectoryCount: number
  candidates: readonly ValidatedLearningPackSourceCandidate[]
  rejectedCandidates: readonly RejectedLearningPackSourceCandidate[]
}>

export interface LearningPackSourcePort {
  chooseDirectory(): Promise<LearningPackSourceReadResult | null>
  readSelectedDirectory(): Promise<LearningPackSourceReadResult | null>
}
