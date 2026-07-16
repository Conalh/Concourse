import { z } from 'zod'

import { ConceptIdSchema, ObjectiveIdSchema } from './identifiers.schema'
import { NonemptyTrimmedStringSchema, addUniqueValuesIssue } from './validation'

export const LearningObjectiveSchema = z
  .object({
    id: ObjectiveIdSchema,
    conceptIds: z
      .array(ConceptIdSchema)
      .min(1, 'Learning objectives must reference at least one concept.')
      .superRefine((ids, context) => {
        addUniqueValuesIssue(ids, context, [], 'Objective concept IDs')
      }),
    statement: NonemptyTrimmedStringSchema,
    successCriteria: z
      .array(NonemptyTrimmedStringSchema)
      .min(1, 'Learning objectives must define at least one success criterion.')
      .superRefine((criteria, context) => {
        addUniqueValuesIssue(criteria, context, [], 'Success criteria')
      }),
  })
  .strict()

export type LearningObjective = z.infer<typeof LearningObjectiveSchema>
