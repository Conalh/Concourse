import type { EvidenceEvent, LearningSession, SessionId } from '../contracts'
import type { DeepReadonly } from '../foundation'

export type StoredLearningSession = DeepReadonly<LearningSession>
export type StoredEvidenceEvent = DeepReadonly<EvidenceEvent>

export type LearningSessionRecord = DeepReadonly<{
  revision: number
  subjectVersion: string
  session: LearningSession
  evidenceEvents: readonly EvidenceEvent[]
}>

export type RepositoryScanIssueCode =
  | 'invalid-storage-key'
  | 'corrupt-record'
  | 'unsupported-storage-version'

export type RepositoryScanIssue = DeepReadonly<{
  code: RepositoryScanIssueCode
  storageKey: string
  sessionId?: SessionId
  message: string
}>

export type LearningRepositoryScanResult = DeepReadonly<{
  records: readonly LearningSessionRecord[]
  issues: readonly RepositoryScanIssue[]
}>

export type CreateSessionRecordInput = Readonly<{
  subjectVersion: string
  session: StoredLearningSession
}>

export type SaveSessionRecordInput = Readonly<{
  expectedRevision: number
  session: StoredLearningSession
}>

export type CommitSubmissionInput = Readonly<{
  expectedRevision: number
  session: StoredLearningSession
  evidenceEvent: StoredEvidenceEvent
}>

export interface LearningRepository {
  createSession(input: CreateSessionRecordInput): Promise<LearningSessionRecord>

  getSession(sessionId: SessionId): Promise<LearningSessionRecord | null>

  listSessions(): Promise<LearningRepositoryScanResult>

  saveSession(input: SaveSessionRecordInput): Promise<LearningSessionRecord>

  commitSubmission(input: CommitSubmissionInput): Promise<LearningSessionRecord>
}
