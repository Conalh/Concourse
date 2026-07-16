export type LearningEngineErrorCode =
  | 'invalid-generated-id'
  | 'duplicate-generated-id'
  | 'invalid-clock-value'
  | 'subject-has-no-activities'
  | 'session-subject-mismatch'
  | 'session-not-active'
  | 'invalid-session-state'
  | 'activity-not-found'
  | 'concept-not-found'
  | 'concept-already-parked'
  | 'concept-not-parked'
  | 'activity-not-current'
  | 'activity-already-completed'
  | 'module-activity-mismatch'
  | 'invalid-evidence'
  | 'response-kind-mismatch'
  | 'response-constraint-violation'
  | 'activity-not-completed'
  | 'next-activity-selection-required'
  | 'invalid-next-activity'
  | 'next-activity-not-available'

export class LearningEngineError extends Error {
  override readonly name = 'LearningEngineError'

  readonly code: LearningEngineErrorCode
  readonly path?: readonly (string | number)[]
  readonly details?: Readonly<Record<string, unknown>>

  constructor(
    code: LearningEngineErrorCode,
    message: string,
    options: Readonly<{
      path?: readonly (string | number)[]
      details?: Readonly<Record<string, unknown>>
      cause?: unknown
    }> = {},
  ) {
    super(message, { cause: options.cause })
    this.code = code

    if (options.path !== undefined) {
      this.path = options.path
    }

    if (options.details !== undefined) {
      this.details = options.details
    }
  }
}
