import { z } from 'zod'

import { ActivityDefinitionSchema } from './activity.schema'
import { ConceptDefinitionSchema } from './concept.schema'
import {
  ExtensionKeySchema,
  SchemaVersionSchema,
  SubjectIdSchema,
} from './identifiers.schema'
import { ModuleDefinitionSchema } from './module.schema'
import { LearningObjectiveSchema } from './objective.schema'
import { NonemptyTrimmedStringSchema, addUniqueValuesIssue } from './validation'

export const SubjectExtensionKindSchema = z.enum(['renderer', 'evaluator'])
export type SubjectExtensionKind = z.infer<typeof SubjectExtensionKindSchema>

export const SubjectExtensionManifestSchema = z
  .object({
    key: ExtensionKeySchema,
    kind: SubjectExtensionKindSchema,
  })
  .strict()
export type SubjectExtensionManifest = z.infer<
  typeof SubjectExtensionManifestSchema
>

export const SubjectPackageSchema = z
  .object({
    schemaVersion: SchemaVersionSchema,
    id: SubjectIdSchema,
    version: z
      .string()
      .regex(
        /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/,
        'Subject version must be a semantic version string.',
      ),
    title: NonemptyTrimmedStringSchema,
    summary: NonemptyTrimmedStringSchema,
    tags: z.array(NonemptyTrimmedStringSchema).superRefine((tags, context) => {
      addUniqueValuesIssue(tags, context, [], 'Subject tags')
    }),
    modules: z.array(ModuleDefinitionSchema),
    concepts: z.array(ConceptDefinitionSchema),
    objectives: z.array(LearningObjectiveSchema),
    activities: z.array(ActivityDefinitionSchema),
    extensions: z
      .array(SubjectExtensionManifestSchema)
      .superRefine((extensions, context) => {
        addUniqueValuesIssue(
          extensions.map((extension) => `${extension.kind}:${extension.key}`),
          context,
          [],
          'Subject extension manifests',
        )
      }),
  })
  .strict()

export type SubjectPackage = z.infer<typeof SubjectPackageSchema>
