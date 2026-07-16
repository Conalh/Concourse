import { z } from 'zod'

import {
  ExtensionKeySchema,
  OptionIdSchema,
  StableIdSchema,
} from './identifiers.schema'
import { NonemptyTrimmedStringSchema, addUniqueValuesIssue } from './validation'

export const ManualCompletionEvaluationSchema = z
  .object({
    kind: z.literal('manual-completion'),
  })
  .strict()
export type ManualCompletionEvaluation = z.infer<
  typeof ManualCompletionEvaluationSchema
>

export const ExactTextEvaluationSchema = z
  .object({
    kind: z.literal('exact-text'),
    acceptedAnswers: z
      .array(NonemptyTrimmedStringSchema)
      .min(1, 'Exact-text evaluation requires at least one accepted answer.')
      .superRefine((answers, context) => {
        addUniqueValuesIssue(answers, context, [], 'Accepted answers')
      }),
    caseSensitive: z.boolean(),
    trimWhitespace: z.boolean(),
  })
  .strict()
export type ExactTextEvaluation = z.infer<typeof ExactTextEvaluationSchema>

export const ChoiceSelectionEvaluationSchema = z
  .object({
    kind: z.literal('choice-selection'),
    correctOptionIds: z
      .array(OptionIdSchema)
      .min(1, 'Choice evaluation requires at least one correct option ID.')
      .superRefine((ids, context) => {
        addUniqueValuesIssue(ids, context, [], 'Correct option IDs')
      }),
  })
  .strict()
export type ChoiceSelectionEvaluation = z.infer<
  typeof ChoiceSelectionEvaluationSchema
>

export const NumericalToleranceEvaluationSchema = z
  .object({
    kind: z.literal('numerical-tolerance'),
    expected: z.number(),
    absoluteTolerance: z
      .number()
      .min(0, 'Numerical tolerance must be nonnegative.'),
  })
  .strict()
export type NumericalToleranceEvaluation = z.infer<
  typeof NumericalToleranceEvaluationSchema
>

export const RubricCriterionSchema = z
  .object({
    id: StableIdSchema,
    description: NonemptyTrimmedStringSchema,
    required: z.boolean(),
  })
  .strict()
export type RubricCriterion = z.infer<typeof RubricCriterionSchema>

export const RubricAssistedTextEvaluationSchema = z
  .object({
    kind: z.literal('rubric-assisted-text'),
    criteria: z
      .array(RubricCriterionSchema)
      .min(1, 'Rubric-assisted evaluation requires at least one criterion.')
      .superRefine((criteria, context) => {
        addUniqueValuesIssue(
          criteria.map((criterion) => criterion.id),
          context,
          [],
          'Rubric criterion IDs',
        )
      }),
  })
  .strict()
export type RubricAssistedTextEvaluation = z.infer<
  typeof RubricAssistedTextEvaluationSchema
>

export const ExtensionEvaluationSchema = z
  .object({
    kind: z.literal('extension'),
    evaluatorKey: ExtensionKeySchema,
    payload: z.unknown(),
  })
  .strict()
export type ExtensionEvaluation = z.infer<typeof ExtensionEvaluationSchema>

export const EvaluationDefinitionSchema = z.discriminatedUnion('kind', [
  ManualCompletionEvaluationSchema,
  ExactTextEvaluationSchema,
  ChoiceSelectionEvaluationSchema,
  NumericalToleranceEvaluationSchema,
  RubricAssistedTextEvaluationSchema,
  ExtensionEvaluationSchema,
])
export type EvaluationDefinition = z.infer<typeof EvaluationDefinitionSchema>

export const EvaluationStatusSchema = z.enum([
  'passed',
  'partial',
  'retry',
  'ungraded',
])
export type EvaluationStatus = z.infer<typeof EvaluationStatusSchema>

export const EvaluationResultSchema = z
  .object({
    status: EvaluationStatusSchema,
    score: z.number().min(0).max(1).optional(),
    feedback: NonemptyTrimmedStringSchema.optional(),
    matchedCriteria: z
      .array(NonemptyTrimmedStringSchema)
      .superRefine((criteria, context) => {
        addUniqueValuesIssue(criteria, context, [], 'Matched criteria')
      }),
    missingCriteria: z
      .array(NonemptyTrimmedStringSchema)
      .superRefine((criteria, context) => {
        addUniqueValuesIssue(criteria, context, [], 'Missing criteria')
      }),
  })
  .strict()
export type EvaluationResult = z.infer<typeof EvaluationResultSchema>
