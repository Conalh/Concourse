import { z } from 'zod'

import { ExtensionKeySchema } from './identifiers.schema'
import { NonemptyTrimmedStringSchema, addUniqueValuesIssue } from './validation'

export const TextBlockSchema = z
  .object({
    kind: z.literal('text'),
    body: NonemptyTrimmedStringSchema,
  })
  .strict()
export type TextBlock = z.infer<typeof TextBlockSchema>

export const CodeBlockSchema = z
  .object({
    kind: z.literal('code'),
    language: NonemptyTrimmedStringSchema,
    source: NonemptyTrimmedStringSchema,
    highlightedLines: z
      .array(z.number().int().positive('Highlighted lines must be positive.'))
      .superRefine((lines, context) => {
        addUniqueValuesIssue(lines, context, [], 'Highlighted lines')
      })
      .optional(),
    caption: NonemptyTrimmedStringSchema.optional(),
  })
  .strict()
export type CodeBlock = z.infer<typeof CodeBlockSchema>

export const EquationBlockSchema = z
  .object({
    kind: z.literal('equation'),
    expression: NonemptyTrimmedStringSchema,
    description: NonemptyTrimmedStringSchema.optional(),
  })
  .strict()
export type EquationBlock = z.infer<typeof EquationBlockSchema>

export const CalloutPurposeSchema = z.enum([
  'mental-model',
  'warning',
  'connection',
  'misconception',
  'observation',
])
export type CalloutPurpose = z.infer<typeof CalloutPurposeSchema>

export const CalloutBlockSchema = z
  .object({
    kind: z.literal('callout'),
    purpose: CalloutPurposeSchema,
    title: NonemptyTrimmedStringSchema.optional(),
    body: NonemptyTrimmedStringSchema,
  })
  .strict()
export type CalloutBlock = z.infer<typeof CalloutBlockSchema>

export const ComparisonItemSchema = z
  .object({
    label: NonemptyTrimmedStringSchema,
    body: NonemptyTrimmedStringSchema,
  })
  .strict()
export type ComparisonItem = z.infer<typeof ComparisonItemSchema>

export const ComparisonBlockSchema = z
  .object({
    kind: z.literal('comparison'),
    items: z
      .array(ComparisonItemSchema)
      .min(2, 'Comparison blocks require at least two items.'),
  })
  .strict()
export type ComparisonBlock = z.infer<typeof ComparisonBlockSchema>

export const QuestionBlockSchema = z
  .object({
    kind: z.literal('question'),
    prompt: NonemptyTrimmedStringSchema,
    supportingText: NonemptyTrimmedStringSchema.optional(),
  })
  .strict()
export type QuestionBlock = z.infer<typeof QuestionBlockSchema>

export const ExtensionBlockSchema = z
  .object({
    kind: z.literal('extension'),
    rendererKey: ExtensionKeySchema,
    payload: z.unknown(),
  })
  .strict()
export type ExtensionBlock = z.infer<typeof ExtensionBlockSchema>

export const ContentBlockSchema = z.discriminatedUnion('kind', [
  TextBlockSchema,
  CodeBlockSchema,
  EquationBlockSchema,
  CalloutBlockSchema,
  ComparisonBlockSchema,
  QuestionBlockSchema,
  ExtensionBlockSchema,
])
export type ContentBlock = z.infer<typeof ContentBlockSchema>
