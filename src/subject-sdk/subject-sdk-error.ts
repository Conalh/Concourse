export type SubjectDefinitionIssueCode =
  | 'invalid-shape'
  | 'duplicate-entity-id'
  | 'duplicate-module-order'
  | 'missing-reference'
  | 'module-activity-mismatch'
  | 'activity-listed-multiple-times'
  | 'concept-prerequisite-cycle'
  | 'activity-sequence-cycle'
  | 'invalid-choice-answer-reference'
  | 'undeclared-renderer-extension'
  | 'undeclared-evaluator-extension'

export interface SubjectDefinitionIssue {
  readonly code: SubjectDefinitionIssueCode
  readonly path: readonly (number | string)[]
  readonly message: string
}

export class SubjectDefinitionError extends Error {
  readonly issues: readonly SubjectDefinitionIssue[]

  constructor(
    message: string,
    issues: readonly SubjectDefinitionIssue[],
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = 'SubjectDefinitionError'
    this.issues = issues
  }
}

export class SubjectRegistryError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'SubjectRegistryError'
  }
}
