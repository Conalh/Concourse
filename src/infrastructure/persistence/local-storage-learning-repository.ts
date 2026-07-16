import type {
  EvidenceEvent,
  LearningSession,
  SessionId,
} from '../../core/contracts'
import {
  EvidenceEventSchema,
  LearningSessionSchema,
} from '../../core/contracts'
import { SessionIdSchema } from '../../core/contracts'
import { cloneDeep, deepFreeze } from '../../core/foundation'
import type {
  CommitSubmissionInput,
  CreateSessionRecordInput,
  LearningRepository,
  LearningRepositoryScanResult,
  LearningSessionRecord,
  RepositoryScanIssue,
  SaveSessionRecordInput,
} from '../../core/ports'
import { LearningRepositoryError } from '../../core/ports'
import type { StorageLike } from './storage-like'
import {
  STORAGE_SCHEMA_VERSION,
  StoredLearningRecordSchema,
  type StoredLearningRecordEnvelope,
} from './stored-learning-record.schema'

const DEFAULT_STORAGE_PREFIX = 'learnt:learning-session:'

type RecordIdentity = Pick<
  LearningSession,
  'id' | 'learnerId' | 'profileId' | 'subjectId' | 'startedAt'
>

export class LocalStorageLearningRepository implements LearningRepository {
  private readonly storage: StorageLike
  private readonly storagePrefix: string

  constructor(
    storage: StorageLike,
    options: Readonly<{ storagePrefix?: string }> = {},
  ) {
    this.storage = storage
    this.storagePrefix = options.storagePrefix ?? DEFAULT_STORAGE_PREFIX
  }

  async createSession(
    input: CreateSessionRecordInput,
  ): Promise<LearningSessionRecord> {
    await Promise.resolve()
    const session = parseSessionForWrite(input.session)
    const subjectVersion = input.subjectVersion.trim()

    if (subjectVersion.length === 0) {
      throw new LearningRepositoryError(
        'invalid-record',
        'Subject version must be nonempty.',
        { sessionId: session.id },
      )
    }

    if (session.evidenceEventIds.length !== 0) {
      throw new LearningRepositoryError(
        'invalid-record',
        'A newly created session record cannot already reference evidence.',
        { sessionId: session.id },
      )
    }

    const key = this.keyForSessionId(session.id)

    if (this.readItem(key) !== null) {
      throw new LearningRepositoryError(
        'record-already-exists',
        'A session record already exists.',
        { sessionId: session.id, storageKey: key },
      )
    }

    const envelope = this.defineEnvelope(
      {
        storageSchemaVersion: STORAGE_SCHEMA_VERSION,
        revision: 0,
        subjectVersion,
        session,
        evidenceEvents: [],
      },
      key,
    )

    this.writeEnvelope(key, envelope)
    return freezeRecord(envelope)
  }

  async getSession(
    sessionId: SessionId,
  ): Promise<LearningSessionRecord | null> {
    await Promise.resolve()
    const key = this.keyForSessionId(sessionId)
    const raw = this.readItem(key)

    if (raw === null) {
      return null
    }

    return freezeRecord(this.parseEnvelope(raw, key, true))
  }

  async listSessions(): Promise<LearningRepositoryScanResult> {
    await Promise.resolve()
    const records: LearningSessionRecord[] = []
    const issues: RepositoryScanIssue[] = []
    const keys = this.learningStorageKeys()

    for (const key of keys) {
      const parsedKey = this.sessionIdFromKey(key)

      if (parsedKey === null) {
        issues.push(
          createScanIssue({
            code: 'invalid-storage-key',
            storageKey: key,
            message: 'Storage key does not contain a valid session ID.',
          }),
        )
        continue
      }

      const raw = this.readItem(key)

      if (raw === null) {
        continue
      }

      try {
        records.push(freezeRecord(this.parseEnvelope(raw, key, true)))
      } catch (error) {
        if (error instanceof LearningRepositoryError) {
          issues.push(
            createScanIssue({
              code:
                error.code === 'unsupported-storage-version'
                  ? 'unsupported-storage-version'
                  : 'corrupt-record',
              storageKey: key,
              sessionId: parsedKey,
              message: error.message,
            }),
          )
          continue
        }

        throw error
      }
    }

    records.sort(compareRecords)
    issues.sort((left, right) =>
      left.storageKey.localeCompare(right.storageKey),
    )

    return deepFreeze(cloneDeep({ records, issues }))
  }

  async saveSession(
    input: SaveSessionRecordInput,
  ): Promise<LearningSessionRecord> {
    await Promise.resolve()
    const session = parseSessionForWrite(input.session)
    const key = this.keyForSessionId(session.id)
    const current = this.requireExistingEnvelope(session.id)

    assertRevision(current, input.expectedRevision, key)
    assertSameIdentity(current.session, session, key)

    if (
      Date.parse(session.lastActiveAt) <
      Date.parse(current.session.lastActiveAt)
    ) {
      throwInvariant(
        'Session lastActiveAt cannot move backward.',
        session.id,
        key,
      )
    }

    assertSameEvidenceIds(
      current.session.evidenceEventIds,
      session.evidenceEventIds,
      session.id,
      key,
      'saveSession cannot change evidence IDs.',
    )

    const envelope = this.defineEnvelope(
      {
        ...current,
        revision: current.revision + 1,
        session,
        evidenceEvents: [...current.evidenceEvents],
      },
      key,
    )

    this.writeEnvelope(key, envelope)
    return freezeRecord(envelope)
  }

  async commitSubmission(
    input: CommitSubmissionInput,
  ): Promise<LearningSessionRecord> {
    await Promise.resolve()
    const session = parseSessionForWrite(input.session)
    const evidenceEvent = parseEvidenceEventForWrite(input.evidenceEvent)
    const key = this.keyForSessionId(session.id)
    const current = this.requireExistingEnvelope(session.id)

    assertRevision(current, input.expectedRevision, key)
    assertSameIdentity(current.session, session, key)

    const expectedEvidenceIds = [
      ...current.session.evidenceEventIds,
      evidenceEvent.id,
    ]
    assertSameEvidenceIds(
      expectedEvidenceIds,
      session.evidenceEventIds,
      session.id,
      key,
      'commitSubmission must append exactly one evidence ID.',
    )

    if (
      current.evidenceEvents.some(
        (existingEvent) => existingEvent.id === evidenceEvent.id,
      )
    ) {
      throwInvariant('Evidence event ID already exists.', session.id, key)
    }

    assertEventMatchesSession(evidenceEvent, session, key)

    if (evidenceEvent.timestamp !== session.lastActiveAt) {
      throwInvariant(
        'Evidence timestamp must equal session lastActiveAt.',
        session.id,
        key,
      )
    }

    const envelope = this.defineEnvelope(
      {
        ...current,
        revision: current.revision + 1,
        session,
        evidenceEvents: [...current.evidenceEvents, evidenceEvent],
      },
      key,
    )

    this.writeEnvelope(key, envelope)
    return freezeRecord(envelope)
  }

  private requireExistingEnvelope(
    sessionId: SessionId,
  ): StoredLearningRecordEnvelope {
    const key = this.keyForSessionId(sessionId)
    const raw = this.readItem(key)

    if (raw === null) {
      throw new LearningRepositoryError(
        'record-not-found',
        'Record not found.',
        {
          sessionId,
          storageKey: key,
        },
      )
    }

    return this.parseEnvelope(raw, key, true)
  }

  private parseEnvelope(
    raw: string,
    key: string,
    requireKeyMatch: boolean,
  ): StoredLearningRecordEnvelope {
    const parsedJson = parseJson(raw, key)
    const version = readStorageSchemaVersion(parsedJson)

    if (version !== STORAGE_SCHEMA_VERSION) {
      throw new LearningRepositoryError(
        'unsupported-storage-version',
        'Stored record uses an unsupported storage schema version.',
        { storageKey: key, details: { storageSchemaVersion: version } },
      )
    }

    const parsed = StoredLearningRecordSchema.safeParse(parsedJson)

    if (!parsed.success) {
      throw new LearningRepositoryError(
        'corrupt-record',
        'Stored record does not match the storage envelope contract.',
        { storageKey: key, cause: parsed.error },
      )
    }

    return this.defineEnvelope(parsed.data, key, requireKeyMatch)
  }

  private defineEnvelope(
    envelope: StoredLearningRecordEnvelope,
    key: string,
    requireKeyMatch = true,
  ): StoredLearningRecordEnvelope {
    validateEnvelopeIntegrity(
      envelope,
      key,
      this.storagePrefix,
      requireKeyMatch,
    )
    return cloneDeep(envelope)
  }

  private learningStorageKeys(): readonly string[] {
    const keys: string[] = []
    const length = this.readLength()

    for (let index = 0; index < length; index += 1) {
      const key = this.readKey(index)

      if (key?.startsWith(this.storagePrefix) === true) {
        keys.push(key)
      }
    }

    return keys.sort()
  }

  private sessionIdFromKey(key: string): SessionId | null {
    if (!key.startsWith(this.storagePrefix)) {
      return null
    }

    const parsed = SessionIdSchema.safeParse(
      key.slice(this.storagePrefix.length),
    )
    return parsed.success ? parsed.data : null
  }

  private keyForSessionId(sessionId: SessionId): string {
    return `${this.storagePrefix}${sessionId}`
  }

  private readLength(): number {
    try {
      return this.storage.length
    } catch (error) {
      throw new LearningRepositoryError(
        'read-failed',
        'Storage length could not be read.',
        { cause: error },
      )
    }
  }

  private readKey(index: number): string | null {
    try {
      return this.storage.key(index)
    } catch (error) {
      throw new LearningRepositoryError(
        'read-failed',
        'Storage key enumeration failed.',
        { details: { index }, cause: error },
      )
    }
  }

  private readItem(key: string): string | null {
    try {
      return this.storage.getItem(key)
    } catch (error) {
      throw new LearningRepositoryError(
        'read-failed',
        'Stored record could not be read.',
        { storageKey: key, cause: error },
      )
    }
  }

  private writeEnvelope(
    key: string,
    envelope: StoredLearningRecordEnvelope,
  ): void {
    let serialized: string

    try {
      serialized = JSON.stringify(envelope)
    } catch (error) {
      throw new LearningRepositoryError(
        'serialization-failed',
        'Stored record could not be serialized.',
        { storageKey: key, cause: error },
      )
    }

    try {
      this.storage.setItem(key, serialized)
    } catch (error) {
      throw new LearningRepositoryError(
        isQuotaExceeded(error) ? 'quota-exceeded' : 'write-failed',
        'Stored record could not be written.',
        { storageKey: key, cause: error },
      )
    }
  }
}

export function createBrowserLearningRepository(): LocalStorageLearningRepository {
  let storage: StorageLike | undefined

  try {
    storage = (globalThis as { localStorage?: StorageLike }).localStorage
  } catch (error) {
    throw new LearningRepositoryError(
      'storage-unavailable',
      'Browser localStorage is unavailable.',
      { cause: error },
    )
  }

  if (storage === undefined) {
    throw new LearningRepositoryError(
      'storage-unavailable',
      'Browser localStorage is unavailable.',
    )
  }

  return new LocalStorageLearningRepository(storage)
}

function parseSessionForWrite(session: unknown): LearningSession {
  const parsed = LearningSessionSchema.safeParse(session)

  if (!parsed.success) {
    throw new LearningRepositoryError(
      'invalid-record',
      'Session does not match the learning session contract.',
      { cause: parsed.error },
    )
  }

  return cloneDeep(parsed.data)
}

function parseEvidenceEventForWrite(event: unknown): EvidenceEvent {
  const parsed = EvidenceEventSchema.safeParse(event)

  if (!parsed.success) {
    throw new LearningRepositoryError(
      'invalid-record',
      'Evidence event does not match the evidence event contract.',
      { cause: parsed.error },
    )
  }

  return cloneDeep(parsed.data)
}

function parseJson(raw: string, key: string): unknown {
  try {
    return JSON.parse(raw) as unknown
  } catch (error) {
    throw new LearningRepositoryError(
      'corrupt-record',
      'Stored record contains malformed JSON.',
      { storageKey: key, cause: error },
    )
  }
}

function readStorageSchemaVersion(value: unknown): unknown {
  if (typeof value !== 'object' || value === null) {
    throw new LearningRepositoryError(
      'corrupt-record',
      'Stored record is not an object.',
    )
  }

  const version = (value as Record<string, unknown>).storageSchemaVersion

  if (typeof version !== 'string') {
    throw new LearningRepositoryError(
      'corrupt-record',
      'Stored record is missing a storage schema version.',
    )
  }

  return version
}

function validateEnvelopeIntegrity(
  envelope: StoredLearningRecordEnvelope,
  key: string,
  storagePrefix: string,
  requireKeyMatch: boolean,
): void {
  if (requireKeyMatch) {
    const parsedKeySessionId = SessionIdSchema.safeParse(
      key.startsWith(storagePrefix) ? key.slice(storagePrefix.length) : '',
    )

    if (
      !parsedKeySessionId.success ||
      parsedKeySessionId.data !== envelope.session.id
    ) {
      throw new LearningRepositoryError(
        'corrupt-record',
        'Storage key session ID does not match the stored session.',
        { storageKey: key },
      )
    }
  }

  if (envelope.subjectVersion.trim().length === 0) {
    throw new LearningRepositoryError(
      'corrupt-record',
      'Stored subject version is empty.',
      { storageKey: key },
    )
  }

  const eventIds = envelope.evidenceEvents.map((event) => event.id)
  const uniqueEventIds = new Set<string>(eventIds)

  if (uniqueEventIds.size !== eventIds.length) {
    throw new LearningRepositoryError(
      'corrupt-record',
      'Stored evidence event IDs must be unique.',
      { storageKey: key },
    )
  }

  assertSameEvidenceIds(
    envelope.session.evidenceEventIds,
    eventIds,
    envelope.session.id,
    key,
    'Session evidence IDs must match stored evidence events.',
    'corrupt-record',
  )

  const activityIds = new Set<string>(
    envelope.session.activityProgress.map((progress) => progress.activityId),
  )
  const startedAt = Date.parse(envelope.session.startedAt)
  const lastActiveAt = Date.parse(envelope.session.lastActiveAt)

  for (const event of envelope.evidenceEvents) {
    assertEventMatchesSession(event, envelope.session, key, 'corrupt-record')

    if (!activityIds.has(event.activityId)) {
      throw new LearningRepositoryError(
        'corrupt-record',
        'Evidence event references an activity absent from session progress.',
        { storageKey: key, sessionId: envelope.session.id },
      )
    }

    const eventTime = Date.parse(event.timestamp)

    if (eventTime < startedAt || eventTime > lastActiveAt) {
      throw new LearningRepositoryError(
        'corrupt-record',
        'Evidence timestamp is outside the session time range.',
        { storageKey: key, sessionId: envelope.session.id },
      )
    }
  }
}

function assertRevision(
  current: StoredLearningRecordEnvelope,
  expectedRevision: number,
  key: string,
): void {
  if (current.revision !== expectedRevision) {
    throw new LearningRepositoryError(
      'revision-conflict',
      'Stored revision does not match expected revision.',
      {
        sessionId: current.session.id,
        storageKey: key,
        details: {
          expectedRevision,
          actualRevision: current.revision,
        },
      },
    )
  }
}

function assertSameIdentity(
  current: RecordIdentity,
  next: RecordIdentity,
  key: string,
): void {
  if (
    current.id !== next.id ||
    current.learnerId !== next.learnerId ||
    current.profileId !== next.profileId ||
    current.subjectId !== next.subjectId ||
    current.startedAt !== next.startedAt
  ) {
    throwInvariant('Session identity fields cannot change.', current.id, key)
  }
}

function assertSameEvidenceIds(
  expected: readonly string[],
  actual: readonly string[],
  sessionId: SessionId,
  key: string,
  message: string,
  code:
    | 'corrupt-record'
    | 'transaction-invariant-violation' = 'transaction-invariant-violation',
): void {
  const sameLength = expected.length === actual.length
  const sameOrder =
    sameLength && expected.every((id, index) => actual[index] === id)

  if (!sameOrder) {
    throw new LearningRepositoryError(code, message, {
      sessionId,
      storageKey: key,
    })
  }
}

function assertEventMatchesSession(
  event: EvidenceEvent,
  session: LearningSession,
  key: string,
  code:
    | 'corrupt-record'
    | 'transaction-invariant-violation' = 'transaction-invariant-violation',
): void {
  if (
    event.sessionId !== session.id ||
    event.learnerId !== session.learnerId ||
    event.profileId !== session.profileId ||
    event.subjectId !== session.subjectId
  ) {
    throw new LearningRepositoryError(
      code,
      'Evidence event identity must match the session identity.',
      { sessionId: session.id, storageKey: key },
    )
  }
}

function throwInvariant(
  message: string,
  sessionId: SessionId,
  key: string,
): never {
  throw new LearningRepositoryError(
    'transaction-invariant-violation',
    message,
    {
      sessionId,
      storageKey: key,
    },
  )
}

function freezeRecord(
  envelope: StoredLearningRecordEnvelope,
): LearningSessionRecord {
  return deepFreeze(
    cloneDeep({
      revision: envelope.revision,
      subjectVersion: envelope.subjectVersion,
      session: envelope.session,
      evidenceEvents: envelope.evidenceEvents,
    }),
  )
}

function createScanIssue(
  issue: Readonly<{
    code: RepositoryScanIssue['code']
    storageKey: string
    sessionId?: SessionId
    message: string
  }>,
): RepositoryScanIssue {
  return deepFreeze(
    cloneDeep({
      code: issue.code,
      storageKey: issue.storageKey,
      ...(issue.sessionId === undefined ? {} : { sessionId: issue.sessionId }),
      message: issue.message,
    }),
  )
}

function compareRecords(
  left: LearningSessionRecord,
  right: LearningSessionRecord,
): number {
  const rightTime = Date.parse(right.session.lastActiveAt)
  const leftTime = Date.parse(left.session.lastActiveAt)
  const timeDifference = rightTime - leftTime

  return timeDifference === 0
    ? left.session.id.localeCompare(right.session.id)
    : timeDifference
}

function isQuotaExceeded(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false
  }

  const candidate = error as Record<string, unknown>
  return (
    candidate.name === 'QuotaExceededError' ||
    candidate.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    candidate.code === 22 ||
    candidate.code === 1014
  )
}
