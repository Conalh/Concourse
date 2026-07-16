import { z } from 'zod'

import {
  EvidenceEventSchema,
  LearningSessionSchema,
} from '../../core/contracts'

export const STORAGE_SCHEMA_VERSION = '0.1'

export const StoredLearningRecordSchema = z
  .object({
    storageSchemaVersion: z.literal(STORAGE_SCHEMA_VERSION),
    revision: z.number().int().nonnegative(),
    subjectVersion: z.string().trim().min(1),
    session: LearningSessionSchema,
    evidenceEvents: z.array(EvidenceEventSchema),
  })
  .strict()

export type StoredLearningRecordEnvelope = z.infer<
  typeof StoredLearningRecordSchema
>
