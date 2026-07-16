export type LearningApplicationErrorCode =
  | 'session-not-found'
  | 'subject-not-found'
  | 'concept-not-found'
  | 'subject-version-mismatch'
  | 'learner-profile-mismatch'
  | 'session-state-incompatible'
  | 'pack-asset-integrity-failed'
  | 'pack-asset-delivery-unavailable'

export class LearningApplicationError extends Error {
  override readonly name = 'LearningApplicationError'

  readonly code: LearningApplicationErrorCode
  readonly details?: Readonly<Record<string, unknown>>

  constructor(
    code: LearningApplicationErrorCode,
    message: string,
    options: Readonly<{
      details?: Readonly<Record<string, unknown>>
      cause?: unknown
    }> = {},
  ) {
    super(message, { cause: options.cause })
    this.code = code

    if (options.details !== undefined) {
      this.details = options.details
    }
  }
}
