export interface LearningIdGenerator {
  createSessionId(): string
  createEvidenceId(): string
}
