import { z } from 'zod'

import { ConceptIdSchema } from './identifiers.schema'
import { NonemptyTrimmedStringSchema, addUniqueValuesIssue } from './validation'

export const ConceptDefinitionSchema = z
  .object({
    id: ConceptIdSchema,
    title: NonemptyTrimmedStringSchema,
    summary: NonemptyTrimmedStringSchema,
    prerequisiteConceptIds: z
      .array(ConceptIdSchema)
      .superRefine((ids, context) => {
        addUniqueValuesIssue(ids, context, [], 'Prerequisite concept IDs')
      }),
    relatedConceptIds: z.array(ConceptIdSchema).superRefine((ids, context) => {
      addUniqueValuesIssue(ids, context, [], 'Related concept IDs')
    }),
    tags: z.array(NonemptyTrimmedStringSchema).superRefine((tags, context) => {
      addUniqueValuesIssue(tags, context, [], 'Concept tags')
    }),
  })
  .strict()
  .superRefine((concept, context) => {
    if (concept.prerequisiteConceptIds.includes(concept.id)) {
      context.addIssue({
        code: 'custom',
        path: ['prerequisiteConceptIds'],
        message: 'A concept cannot list itself as a prerequisite.',
      })
    }

    if (concept.relatedConceptIds.includes(concept.id)) {
      context.addIssue({
        code: 'custom',
        path: ['relatedConceptIds'],
        message: 'A concept cannot list itself as related.',
      })
    }
  })

export type ConceptDefinition = z.infer<typeof ConceptDefinitionSchema>
