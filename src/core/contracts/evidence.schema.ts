import { z } from 'zod'

import {
  ActivityIdSchema,
  EvidenceIdSchema,
  LearnerIdSchema,
  LearnerProfileIdSchema,
  ModuleIdSchema,
  ObjectiveIdSchema,
  OptionIdSchema,
  SchemaVersionSchema,
  SessionIdSchema,
  SubjectIdSchema,
} from './identifiers.schema'
import { ActivityKindSchema } from './activity.schema'
import { EvaluationResultSchema } from './evaluation.schema'
import {
  IsoTimestampSchema,
  NonemptyTrimmedStringSchema,
  addUniqueValuesIssue,
} from './validation'

export const TextEvidenceSchema = z
  .object({
    kind: z.literal('text'),
    value: z.string(),
  })
  .strict()
export type TextEvidence = z.infer<typeof TextEvidenceSchema>

export const NumberEvidenceSchema = z
  .object({
    kind: z.literal('number'),
    value: z.number(),
  })
  .strict()
export type NumberEvidence = z.infer<typeof NumberEvidenceSchema>

export const SingleChoiceEvidenceSchema = z
  .object({
    kind: z.literal('single-choice'),
    optionId: OptionIdSchema,
  })
  .strict()
export type SingleChoiceEvidence = z.infer<typeof SingleChoiceEvidenceSchema>

export const MultipleChoiceEvidenceSchema = z
  .object({
    kind: z.literal('multiple-choice'),
    optionIds: z
      .array(OptionIdSchema)
      .min(1, 'Multiple-choice evidence must include at least one option ID.')
      .superRefine((ids, context) => {
        addUniqueValuesIssue(ids, context, [], 'Multiple-choice option IDs')
      }),
  })
  .strict()
export type MultipleChoiceEvidence = z.infer<
  typeof MultipleChoiceEvidenceSchema
>

export const ConfidenceEvidenceSchema = z
  .object({
    kind: z.literal('confidence'),
    value: z.number().int().min(1).max(5),
  })
  .strict()
export type ConfidenceEvidence = z.infer<typeof ConfidenceEvidenceSchema>

export const CodeEvidenceSchema = z
  .object({
    kind: z.literal('code'),
    language: NonemptyTrimmedStringSchema,
    source: z.string(),
  })
  .strict()
export type CodeEvidence = z.infer<typeof CodeEvidenceSchema>

export const ManualEvidenceSchema = z
  .object({
    kind: z.literal('manual'),
    completed: z.literal(true),
  })
  .strict()
export type ManualEvidence = z.infer<typeof ManualEvidenceSchema>

export const EvidencePayloadSchema = z.discriminatedUnion('kind', [
  TextEvidenceSchema,
  NumberEvidenceSchema,
  SingleChoiceEvidenceSchema,
  MultipleChoiceEvidenceSchema,
  ConfidenceEvidenceSchema,
  CodeEvidenceSchema,
  ManualEvidenceSchema,
])
export type EvidencePayload = z.infer<typeof EvidencePayloadSchema>

export const EvidenceEventSchema = z
  .object({
    schemaVersion: SchemaVersionSchema,
    id: EvidenceIdSchema,
    timestamp: IsoTimestampSchema,
    learnerId: LearnerIdSchema,
    profileId: LearnerProfileIdSchema,
    sessionId: SessionIdSchema,
    subjectId: SubjectIdSchema,
    moduleId: ModuleIdSchema,
    activityId: ActivityIdSchema,
    objectiveIds: z
      .array(ObjectiveIdSchema)
      .min(1, 'Evidence events must reference at least one objective.')
      .superRefine((ids, context) => {
        addUniqueValuesIssue(ids, context, [], 'Evidence objective IDs')
      }),
    activityKind: ActivityKindSchema,
    response: EvidencePayloadSchema,
    confidence: z.number().int().min(1).max(5).optional(),
    hintsUsed: z
      .number()
      .int('Hints used must be an integer.')
      .min(0, 'Hints used must be nonnegative.'),
    evaluation: EvaluationResultSchema,
  })
  .strict()

export type EvidenceEvent = z.infer<typeof EvidenceEventSchema>
