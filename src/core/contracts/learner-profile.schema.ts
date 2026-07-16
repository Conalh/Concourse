import { z } from 'zod'

import {
  LearnerIdSchema,
  LearnerProfileIdSchema,
  SchemaVersionSchema,
} from './identifiers.schema'
import { NonemptyTrimmedStringSchema, addUniqueValuesIssue } from './validation'

export const ExplanationDensitySchema = z.enum([
  'compact',
  'balanced',
  'detailed',
])
export type ExplanationDensity = z.infer<typeof ExplanationDensitySchema>

export const SignalPrioritySchema = z.enum(['normal', 'high'])
export type SignalPriority = z.infer<typeof SignalPrioritySchema>

export const DefaultChunkSizeSchema = z.enum(['small', 'medium', 'large'])
export type DefaultChunkSize = z.infer<typeof DefaultChunkSizeSchema>

export const FeedbackStyleSchema = z.enum(['gentle', 'direct'])
export type FeedbackStyle = z.infer<typeof FeedbackStyleSchema>

export const OutputSequenceItemSchema = z.enum([
  'concept',
  'build',
  'why',
  'try',
])
export type OutputSequenceItem = z.infer<typeof OutputSequenceItemSchema>

export const LearnerProfileSchema = z
  .object({
    schemaVersion: SchemaVersionSchema,
    id: LearnerProfileIdSchema,
    learnerId: LearnerIdSchema,
    displayName: NonemptyTrimmedStringSchema,
    reportedTraits: z.array(NonemptyTrimmedStringSchema),
    presentation: z
      .object({
        explanationDensity: ExplanationDensitySchema,
        signalPriority: SignalPrioritySchema,
        concreteBeforeAbstract: z.boolean(),
        examplesBeforeExtendedTheory: z.boolean(),
        visualModelsPreferred: z.boolean(),
        systemMapsPreferred: z.boolean(),
        avoidLongPassiveReading: z.boolean(),
        avoidRedundantExplanation: z.boolean(),
      })
      .strict(),
    instruction: z
      .object({
        defaultChunkSize: DefaultChunkSizeSchema,
        teachThroughBuilding: z.boolean(),
        connectConceptsToSystemBehavior: z.boolean(),
        checkpointAtConceptualBoundaries: z.boolean(),
        permitNonlinearExploration: z.boolean(),
        preserveCurrentThreadDuringDigressions: z.boolean(),
        requestPredictionWhenInformative: z.boolean(),
        requireMeaningfulLearnerAction: z.boolean(),
      })
      .strict(),
    errorHandling: z
      .object({
        feedbackStyle: FeedbackStyleSchema,
        explainDifferenceBriefly: z.boolean(),
        offerImmediateRetry: z.boolean(),
        avoidShamingLanguage: z.boolean(),
        avoidGenericPraise: z.boolean(),
      })
      .strict(),
    defaultOutputSequence: z
      .array(OutputSequenceItemSchema)
      .min(1, 'Default output sequence must contain at least one item.')
      .superRefine((sequence, context) => {
        addUniqueValuesIssue(sequence, context, [], 'Default output sequence')
      }),
    constraints: z
      .object({
        doNotInferNeedsBeyondExplicitProfile: z.boolean(),
        doNotTreatDiagnosticLabelsAsRules: z.boolean(),
        doNotInferMasteryFromSelfReport: z.boolean(),
        doNotModifyProfileAutomatically: z.boolean(),
      })
      .strict(),
  })
  .strict()

export type LearnerProfile = z.infer<typeof LearnerProfileSchema>
