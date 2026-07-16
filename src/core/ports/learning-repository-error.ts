import type { SessionId } from '../contracts'

export type LearningRepositoryErrorCode =
  | 'storage-unavailable'
  | 'record-already-exists'
  | 'record-not-found'
  | 'revision-conflict'
  | 'corrupt-record'
  | 'unsupported-storage-version'
  | 'invalid-record'
  | 'transaction-invariant-violation'
  | 'serialization-failed'
  | 'read-failed'
  | 'write-failed'
  | 'quota-exceeded'

export class LearningRepositoryError extends Error {
  override readonly name = 'LearningRepositoryError'

  readonly code: LearningRepositoryErrorCode
  readonly sessionId?: SessionId
  readonly storageKey?: string
  readonly details?: Readonly<Record<string, unknown>>

  constructor(
    code: LearningRepositoryErrorCode,
    message: string,
    options: Readonly<{
      sessionId?: SessionId
      storageKey?: string
      details?: Readonly<Record<string, unknown>>
      cause?: unknown
    }> = {},
  ) {
    super(message, { cause: options.cause })
    this.code = code

    if (options.sessionId !== undefined) {
      this.sessionId = options.sessionId
    }

    if (options.storageKey !== undefined) {
      this.storageKey = options.storageKey
    }

    if (options.details !== undefined) {
      this.details = options.details
    }
  }
}
