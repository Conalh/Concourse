import { z } from 'zod'

import {
  ActivityIdSchema,
  ConceptIdSchema,
  EvidenceIdSchema,
  LearnerIdSchema,
  LearnerProfileIdSchema,
  ModuleIdSchema,
  ObjectiveIdSchema,
  SchemaVersionSchema,
  SessionIdSchema,
  SubjectIdSchema,
} from './identifiers.schema'
import {
  IsoTimestampSchema,
  addChronologicalTimestampIssue,
  addUniqueValuesIssue,
} from './validation'

export const InteractionModeSchema = z.enum([
  'coach',
  'flow',
  'test',
  'rescue',
  'zoom',
  'recap',
])
export type InteractionMode = z.infer<typeof InteractionModeSchema>

export const ActivityStatusSchema = z.enum([
  'unseen',
  'active',
  'attempted',
  'completed',
])
export type ActivityStatus = z.infer<typeof ActivityStatusSchema>

export const ActivityProgressSchema = z
  .object({
    activityId: ActivityIdSchema,
    status: ActivityStatusSchema,
  })
  .strict()
export type ActivityProgress = z.infer<typeof ActivityProgressSchema>

export const SessionStatusSchema = z.enum(['active', 'completed', 'abandoned'])
export type SessionStatus = z.infer<typeof SessionStatusSchema>

const SafeLearningRouteSchema = z
  .string()
  .max(2048, 'Learning flow routes must stay within the local app route limit.')
  .refine((value) => value.startsWith('#/'), {
    message: 'Learning flow routes must be local hash routes.',
  })
  .refine((value) => !value.includes('://'), {
    message: 'Learning flow routes must not contain external URLs.',
  })

const LearningFlowRouteFieldsSchema = z
  .object({
    returnRoute: SafeLearningRouteSchema.optional(),
    continuationRoute: SafeLearningRouteSchema.optional(),
  })
  .strict()

export const LearningFlowOriginSchema = z.discriminatedUnion('kind', [
  LearningFlowRouteFieldsSchema.extend({
    kind: z.literal('library'),
  }).strict(),
  LearningFlowRouteFieldsSchema.extend({
    kind: z.literal('course-curriculum'),
    packId: z.string().min(1),
    courseId: z.string().min(1),
    curriculumNodeId: z.string().min(1).optional(),
  }).strict(),
  LearningFlowRouteFieldsSchema.extend({
    kind: z.literal('learning-resource'),
    packId: z.string().min(1),
    resourceId: z.string().min(1),
    segmentId: z.string().min(1).optional(),
  }).strict(),
  LearningFlowRouteFieldsSchema.extend({
    kind: z.literal('concept-exploration'),
    sessionId: SessionIdSchema.optional(),
    conceptId: ConceptIdSchema,
  }).strict(),
  LearningFlowRouteFieldsSchema.extend({
    kind: z.literal('objective-exploration'),
    objectiveId: ObjectiveIdSchema,
  }).strict(),
  LearningFlowRouteFieldsSchema.extend({
    kind: z.literal('active-session'),
    sessionId: SessionIdSchema,
    activityId: ActivityIdSchema.optional(),
  }).strict(),
])
export type LearningFlowOrigin = z.infer<typeof LearningFlowOriginSchema>

const StudySetLearningFlowSessionStateSchema = z
  .object({
    kind: z.literal('study-set-checkpoint'),
    packId: z.string().min(1),
    packVersion: z.string().min(1),
    studySetId: z.string().min(1),
    studySetTitle: z.string().min(1),
    seed: z.string().min(1),
    itemIds: z
      .array(ActivityIdSchema)
      .min(1, 'StudySet checkpoint sessions must include at least one item.')
      .superRefine((ids, context) => {
        addUniqueValuesIssue(ids, context, [], 'StudySet checkpoint item IDs')
      }),
    origin: LearningFlowOriginSchema,
  })
  .strict()

const PracticeResolvedModeSchema = z.enum(['flashcard', 'quiz', 'recall'])

const PracticePlanSessionItemSchema = z
  .object({
    itemId: ActivityIdSchema,
    title: z.string().min(1),
    resolvedMode: PracticeResolvedModeSchema,
    playMode: z.enum([
      'flashcard',
      'single-choice-quiz',
      'multiple-choice-quiz',
      'text-recall',
      'number-recall',
      'manual-read',
      'self-grade-review',
    ]),
    learningRevision: z.number().int().min(0),
  })
  .strict()

const PracticeLearningFlowSessionStateSchema = z
  .object({
    kind: z.literal('practice-plan'),
    planId: z.string().min(1),
    title: z.string().min(1),
    packId: z.string().min(1),
    packVersion: z.string().min(1),
    mode: z.enum(['flashcard', 'quiz', 'recall', 'mixed']),
    seed: z.string().min(1),
    selectedItems: z
      .array(PracticePlanSessionItemSchema)
      .min(1, 'Practice plan sessions must include at least one item.')
      .superRefine((items, context) => {
        addUniqueValuesIssue(
          items.map((item) => item.itemId),
          context,
          [],
          'Practice plan item IDs',
        )
      }),
    origin: LearningFlowOriginSchema,
  })
  .strict()

export const LearningFlowSessionStateSchema = z.discriminatedUnion('kind', [
  StudySetLearningFlowSessionStateSchema,
  PracticeLearningFlowSessionStateSchema,
])
export type LearningFlowSessionState = z.infer<
  typeof LearningFlowSessionStateSchema
>

export const SessionExplorationStateSchema = z
  .object({
    parkedConceptIds: z.array(ConceptIdSchema).superRefine((ids, context) => {
      addUniqueValuesIssue(ids, context, [], 'Parked concept IDs')
    }),
    learningFlow: LearningFlowSessionStateSchema.optional(),
  })
  .strict()
export type SessionExplorationState = z.infer<
  typeof SessionExplorationStateSchema
>

export const LearningSessionSchema = z
  .object({
    schemaVersion: SchemaVersionSchema,
    id: SessionIdSchema,
    learnerId: LearnerIdSchema,
    profileId: LearnerProfileIdSchema,
    subjectId: SubjectIdSchema,
    status: SessionStatusSchema,
    interactionMode: InteractionModeSchema,
    currentModuleId: ModuleIdSchema.nullable(),
    currentActivityId: ActivityIdSchema.nullable(),
    startedAt: IsoTimestampSchema,
    lastActiveAt: IsoTimestampSchema,
    activityProgress: z
      .array(ActivityProgressSchema)
      .superRefine((progress, context) => {
        addUniqueValuesIssue(
          progress.map((entry) => entry.activityId),
          context,
          [],
          'Activity progress entries',
        )
      }),
    evidenceEventIds: z.array(EvidenceIdSchema).superRefine((ids, context) => {
      addUniqueValuesIssue(ids, context, [], 'Evidence event IDs')
    }),
    exploration: SessionExplorationStateSchema.default(() => ({
      parkedConceptIds: [],
    })),
  })
  .strict()
  .superRefine((session, context) => {
    addChronologicalTimestampIssue(
      session.startedAt,
      session.lastActiveAt,
      context,
      ['lastActiveAt'],
    )

    if (session.status === 'active') {
      if (session.currentModuleId === null) {
        context.addIssue({
          code: 'custom',
          path: ['currentModuleId'],
          message: 'An active session must have a current module.',
        })
      }

      if (session.currentActivityId === null) {
        context.addIssue({
          code: 'custom',
          path: ['currentActivityId'],
          message: 'An active session must have a current activity.',
        })
      }
    }

    if (session.status === 'completed' && session.currentActivityId !== null) {
      context.addIssue({
        code: 'custom',
        path: ['currentActivityId'],
        message: 'A completed session must not have a current activity.',
      })
    }
  })

export type LearningSession = z.infer<typeof LearningSessionSchema>
