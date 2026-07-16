import { EvidenceIdSchema, SessionIdSchema } from '../../core/contracts'
import type { LearningIdGenerator } from '../../core/ports'

export interface RandomUuidSource {
  randomUUID(): string
}

export class CryptoLearningIdGenerator implements LearningIdGenerator {
  private readonly source: RandomUuidSource

  constructor(source: RandomUuidSource) {
    this.source = source
  }

  createSessionId(): string {
    return createPrefixedId(
      'session',
      this.source.randomUUID(),
      SessionIdSchema,
    )
  }

  createEvidenceId(): string {
    return createPrefixedId(
      'evidence',
      this.source.randomUUID(),
      EvidenceIdSchema,
    )
  }
}

export function createBrowserLearningIdGenerator(): CryptoLearningIdGenerator {
  const source = (globalThis as { crypto?: Partial<RandomUuidSource> }).crypto

  if (typeof source?.randomUUID !== 'function') {
    throw new Error('Secure randomUUID is unavailable.')
  }

  const randomUUID = source.randomUUID.bind(source)

  return new CryptoLearningIdGenerator({
    randomUUID: () => randomUUID(),
  })
}

function createPrefixedId(
  prefix: 'evidence' | 'session',
  uuid: string,
  schema: typeof EvidenceIdSchema | typeof SessionIdSchema,
): string {
  return schema.parse(`${prefix}-${uuid.toLowerCase()}`)
}
