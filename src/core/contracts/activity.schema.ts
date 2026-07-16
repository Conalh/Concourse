import { z } from 'zod'

import { ContentBlockSchema } from './content-block.schema'
import {
  ActivityIdSchema,
  ConceptIdSchema,
  ModuleIdSchema,
  ObjectiveIdSchema,
} from './identifiers.schema'
import { EvaluationDefinitionSchema } from './evaluation.schema'
import { ResponseDefinitionSchema } from './response.schema'
import { NonemptyTrimmedStringSchema, addUniqueValuesIssue } from './validation'

export const ActivityKindSchema = z.enum([
  'orient',
  'explain',
  'predict',
  'worked-example',
  'complete',
  'build',
  'modify',
  'debug',
  'recall',
  'transfer',
  'reflect',
])
export type ActivityKind = z.infer<typeof ActivityKindSchema>

export const ScaffoldLevelSchema = z.enum([
  'worked',
  'completion',
  'guided',
  'independent',
  'transfer',
])
export type ScaffoldLevel = z.infer<typeof ScaffoldLevelSchema>

export const CompletionPolicySchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('submission') }).strict(),
  z.object({ kind: z.literal('passing-evaluation') }).strict(),
  z.object({ kind: z.literal('manual') }).strict(),
])
export type CompletionPolicy = z.infer<typeof CompletionPolicySchema>

export const ActivityDefinitionSchema = z
  .object({
    id: ActivityIdSchema,
    moduleId: ModuleIdSchema,
    conceptIds: z
      .array(ConceptIdSchema)
      .min(1, 'Activities must reference at least one concept.')
      .superRefine((ids, context) => {
        addUniqueValuesIssue(ids, context, [], 'Activity concept IDs')
      }),
    objectiveIds: z
      .array(ObjectiveIdSchema)
      .min(1, 'Activities must reference at least one objective.')
      .superRefine((ids, context) => {
        addUniqueValuesIssue(ids, context, [], 'Activity objective IDs')
      }),
    title: NonemptyTrimmedStringSchema,
    kind: ActivityKindSchema,
    scaffoldLevel: ScaffoldLevelSchema,
    blocks: z
      .array(ContentBlockSchema)
      .min(1, 'Activities must contain at least one content block.'),
    response: ResponseDefinitionSchema.optional(),
    evaluation: EvaluationDefinitionSchema,
    completionPolicy: CompletionPolicySchema,
    nextActivityIds: z.array(ActivityIdSchema).superRefine((ids, context) => {
      addUniqueValuesIssue(ids, context, [], 'Next activity IDs')
    }),
  })
  .strict()
  .superRefine((activity, context) => {
    if (activity.nextActivityIds.includes(activity.id)) {
      context.addIssue({
        code: 'custom',
        path: ['nextActivityIds'],
        message: 'An activity cannot list itself as a next activity.',
      })
    }

    if (
      activity.response === undefined &&
      activity.completionPolicy.kind !== 'manual'
    ) {
      context.addIssue({
        code: 'custom',
        path: ['response'],
        message:
          'Submission and passing-evaluation completion policies require a response definition.',
      })
    }

    const responseKind = activity.response?.kind

    if (activity.evaluation.kind === 'exact-text' && responseKind !== 'text') {
      context.addIssue({
        code: 'custom',
        path: ['evaluation'],
        message: 'Exact-text evaluation requires a text response.',
      })
    }

    if (
      activity.evaluation.kind === 'choice-selection' &&
      responseKind !== 'single-choice' &&
      responseKind !== 'multiple-choice'
    ) {
      context.addIssue({
        code: 'custom',
        path: ['evaluation'],
        message:
          'Choice-selection evaluation requires a single-choice or multiple-choice response.',
      })
    }

    if (
      activity.evaluation.kind === 'numerical-tolerance' &&
      responseKind !== 'number'
    ) {
      context.addIssue({
        code: 'custom',
        path: ['evaluation'],
        message: 'Numerical-tolerance evaluation requires a number response.',
      })
    }

    if (
      activity.evaluation.kind === 'rubric-assisted-text' &&
      responseKind !== 'text' &&
      responseKind !== 'code'
    ) {
      context.addIssue({
        code: 'custom',
        path: ['evaluation'],
        message:
          'Rubric-assisted text evaluation requires a text or code response.',
      })
    }
  })

export type ActivityDefinition = z.infer<typeof ActivityDefinitionSchema>
