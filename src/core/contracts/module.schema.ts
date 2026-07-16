import { z } from 'zod'

import {
  ActivityIdSchema,
  ConceptIdSchema,
  ModuleIdSchema,
  ObjectiveIdSchema,
} from './identifiers.schema'
import { NonemptyTrimmedStringSchema, addUniqueValuesIssue } from './validation'

export const ModuleDefinitionSchema = z
  .object({
    id: ModuleIdSchema,
    title: NonemptyTrimmedStringSchema,
    summary: NonemptyTrimmedStringSchema,
    order: z
      .number()
      .int('Module order must be an integer.')
      .min(0, 'Module order must be nonnegative.'),
    conceptIds: z.array(ConceptIdSchema).superRefine((ids, context) => {
      addUniqueValuesIssue(ids, context, [], 'Module concept IDs')
    }),
    objectiveIds: z.array(ObjectiveIdSchema).superRefine((ids, context) => {
      addUniqueValuesIssue(ids, context, [], 'Module objective IDs')
    }),
    activityIds: z.array(ActivityIdSchema).superRefine((ids, context) => {
      addUniqueValuesIssue(ids, context, [], 'Module activity IDs')
    }),
  })
  .strict()

export type ModuleDefinition = z.infer<typeof ModuleDefinitionSchema>
