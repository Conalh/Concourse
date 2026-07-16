import { z } from 'zod'

export const SchemaVersionSchema = z.literal('0.1')
export type SchemaVersion = z.infer<typeof SchemaVersionSchema>

export const StableIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
export const ExtensionKeyPattern =
  /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\.[a-z0-9]+(?:-[a-z0-9]+)*)+$/

function createStableIdSchema(label: string) {
  return z
    .string()
    .regex(
      StableIdPattern,
      `${label} must be a stable kebab-case ID using lowercase letters, numbers, and single hyphens.`,
    )
}

export const StableIdSchema = createStableIdSchema('ID').brand<'StableId'>()
export type StableId = z.infer<typeof StableIdSchema>

export const LearnerIdSchema =
  createStableIdSchema('LearnerId').brand<'LearnerId'>()
export type LearnerId = z.infer<typeof LearnerIdSchema>

export const LearnerProfileIdSchema =
  createStableIdSchema('LearnerProfileId').brand<'LearnerProfileId'>()
export type LearnerProfileId = z.infer<typeof LearnerProfileIdSchema>

export const SubjectIdSchema =
  createStableIdSchema('SubjectId').brand<'SubjectId'>()
export type SubjectId = z.infer<typeof SubjectIdSchema>

export const ModuleIdSchema =
  createStableIdSchema('ModuleId').brand<'ModuleId'>()
export type ModuleId = z.infer<typeof ModuleIdSchema>

export const ConceptIdSchema =
  createStableIdSchema('ConceptId').brand<'ConceptId'>()
export type ConceptId = z.infer<typeof ConceptIdSchema>

export const ObjectiveIdSchema =
  createStableIdSchema('ObjectiveId').brand<'ObjectiveId'>()
export type ObjectiveId = z.infer<typeof ObjectiveIdSchema>

export const ActivityIdSchema =
  createStableIdSchema('ActivityId').brand<'ActivityId'>()
export type ActivityId = z.infer<typeof ActivityIdSchema>

export const SessionIdSchema =
  createStableIdSchema('SessionId').brand<'SessionId'>()
export type SessionId = z.infer<typeof SessionIdSchema>

export const EvidenceIdSchema =
  createStableIdSchema('EvidenceId').brand<'EvidenceId'>()
export type EvidenceId = z.infer<typeof EvidenceIdSchema>

export const OptionIdSchema =
  createStableIdSchema('OptionId').brand<'OptionId'>()
export type OptionId = z.infer<typeof OptionIdSchema>

export const ExtensionKeySchema = z
  .string()
  .regex(
    ExtensionKeyPattern,
    'ExtensionKey must use namespaced kebab-case segments such as subject-id.renderer-key.',
  )
  .brand<'ExtensionKey'>()
export type ExtensionKey = z.infer<typeof ExtensionKeySchema>
