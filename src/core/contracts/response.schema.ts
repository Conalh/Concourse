import { z } from 'zod'

import { OptionIdSchema } from './identifiers.schema'
import { NonemptyTrimmedStringSchema, addUniqueValuesIssue } from './validation'

export const ChoiceOptionSchema = z
  .object({
    id: OptionIdSchema,
    label: NonemptyTrimmedStringSchema,
    description: NonemptyTrimmedStringSchema.optional(),
  })
  .strict()
export type ChoiceOption = z.infer<typeof ChoiceOptionSchema>

const ChoiceOptionsSchema = z
  .array(ChoiceOptionSchema)
  .min(1, 'Choice responses must provide at least one option.')
  .superRefine((options, context) => {
    addUniqueValuesIssue(
      options.map((option) => option.id),
      context,
      [],
      'Choice option IDs',
    )
  })

export const TextResponseDefinitionSchema = z
  .object({
    kind: z.literal('text'),
    multiline: z.boolean(),
    placeholder: NonemptyTrimmedStringSchema.optional(),
    minimumLength: z.number().int().min(0).optional(),
    maximumLength: z.number().int().min(1).optional(),
  })
  .strict()
  .superRefine((response, context) => {
    if (
      response.minimumLength !== undefined &&
      response.maximumLength !== undefined &&
      response.minimumLength > response.maximumLength
    ) {
      context.addIssue({
        code: 'custom',
        path: ['maximumLength'],
        message: 'Maximum text length cannot be less than minimum text length.',
      })
    }
  })
export type TextResponseDefinition = z.infer<
  typeof TextResponseDefinitionSchema
>

export const NumberResponseDefinitionSchema = z
  .object({
    kind: z.literal('number'),
    minimum: z.number().optional(),
    maximum: z.number().optional(),
    step: z
      .number()
      .positive('Number response step must be positive.')
      .optional(),
  })
  .strict()
  .superRefine((response, context) => {
    if (
      response.minimum !== undefined &&
      response.maximum !== undefined &&
      response.minimum > response.maximum
    ) {
      context.addIssue({
        code: 'custom',
        path: ['maximum'],
        message: 'Maximum number cannot be less than minimum number.',
      })
    }
  })
export type NumberResponseDefinition = z.infer<
  typeof NumberResponseDefinitionSchema
>

export const SingleChoiceResponseDefinitionSchema = z
  .object({
    kind: z.literal('single-choice'),
    options: ChoiceOptionsSchema,
  })
  .strict()
export type SingleChoiceResponseDefinition = z.infer<
  typeof SingleChoiceResponseDefinitionSchema
>

export const MultipleChoiceResponseDefinitionSchema = z
  .object({
    kind: z.literal('multiple-choice'),
    options: ChoiceOptionsSchema,
    minimumSelections: z.number().int().min(0).optional(),
    maximumSelections: z.number().int().min(1).optional(),
  })
  .strict()
  .superRefine((response, context) => {
    if (
      response.minimumSelections !== undefined &&
      response.minimumSelections > response.options.length
    ) {
      context.addIssue({
        code: 'custom',
        path: ['minimumSelections'],
        message: 'Minimum selections cannot exceed the option count.',
      })
    }

    if (
      response.maximumSelections !== undefined &&
      response.maximumSelections > response.options.length
    ) {
      context.addIssue({
        code: 'custom',
        path: ['maximumSelections'],
        message: 'Maximum selections cannot exceed the option count.',
      })
    }

    if (
      response.minimumSelections !== undefined &&
      response.maximumSelections !== undefined &&
      response.minimumSelections > response.maximumSelections
    ) {
      context.addIssue({
        code: 'custom',
        path: ['maximumSelections'],
        message: 'Maximum selections cannot be less than minimum selections.',
      })
    }
  })
export type MultipleChoiceResponseDefinition = z.infer<
  typeof MultipleChoiceResponseDefinitionSchema
>

export const ConfidenceResponseDefinitionSchema = z
  .object({
    kind: z.literal('confidence'),
    minimum: z.number().int().min(1).max(5),
    maximum: z.number().int().min(1).max(5),
    lowLabel: NonemptyTrimmedStringSchema.optional(),
    highLabel: NonemptyTrimmedStringSchema.optional(),
  })
  .strict()
  .superRefine((response, context) => {
    if (response.minimum > response.maximum) {
      context.addIssue({
        code: 'custom',
        path: ['maximum'],
        message: 'Confidence maximum cannot be less than confidence minimum.',
      })
    }
  })
export type ConfidenceResponseDefinition = z.infer<
  typeof ConfidenceResponseDefinitionSchema
>

export const CodeResponseDefinitionSchema = z
  .object({
    kind: z.literal('code'),
    language: NonemptyTrimmedStringSchema,
    starterCode: z.string().optional(),
  })
  .strict()
export type CodeResponseDefinition = z.infer<
  typeof CodeResponseDefinitionSchema
>

export const ResponseDefinitionSchema = z.discriminatedUnion('kind', [
  TextResponseDefinitionSchema,
  NumberResponseDefinitionSchema,
  SingleChoiceResponseDefinitionSchema,
  MultipleChoiceResponseDefinitionSchema,
  ConfidenceResponseDefinitionSchema,
  CodeResponseDefinitionSchema,
])
export type ResponseDefinition = z.infer<typeof ResponseDefinitionSchema>
