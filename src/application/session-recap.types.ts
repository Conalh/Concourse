import type {
  ActivityId,
  ActivityKind,
  ActivityStatus,
  ConceptId,
  EvaluationStatus,
  EvidenceId,
  InteractionMode,
  ModuleId,
  ObjectiveId,
  OptionId,
  ScaffoldLevel,
  SessionId,
  SessionStatus,
  SubjectId,
} from '../core/contracts'
import type { DeepReadonly } from '../core/foundation'
import type { ProgressSummary } from './learnt-application.types'

export type SessionRecap = DeepReadonly<{
  sessionId: SessionId
  revision: number
  subject: {
    id: SubjectId
    version: string
    title: string
    summary: string
  }
  sessionStatus: SessionStatus
  interactionMode: InteractionMode
  startedAt: string
  lastActiveAt: string
  progress: ProgressSummary
  evidenceCount: number
  totalHintsUsed: number
  currentThread: SessionCurrentThread | null
  parkedPaths: readonly RecapConceptReference[]
  modules: readonly SessionModuleRecap[]
  timeline: readonly SessionTimelineEntry[]
  conceptEncounters: readonly ConceptEncounterRecap[]
}>

export type SessionCurrentThread = DeepReadonly<{
  moduleId: ModuleId
  moduleTitle: string
  activityId: ActivityId
  activityTitle: string
  activityKind: ActivityKind
  activityStatus: ActivityStatus
  action:
    | 'resume-attempt'
    | 'continue-after-completion'
    | 'begin-current-activity'
}>

export type SessionModuleRecap = DeepReadonly<{
  moduleId: ModuleId
  title: string
  summary: string
  order: number
  activities: readonly SessionActivityRecap[]
}>

export type SessionActivityRecap = DeepReadonly<{
  activityId: ActivityId
  moduleId: ModuleId
  title: string
  kind: ActivityKind
  scaffoldLevel: ScaffoldLevel
  status: ActivityStatus
  concepts: readonly RecapConceptReference[]
  objectives: readonly RecapObjectiveReference[]
  attemptCount: number
  totalHintsUsed: number
  firstAttemptAt: string | null
  latestAttemptAt: string | null
  latestEvaluation: RecapEvaluation | null
  attempts: readonly SessionAttemptRecap[]
}>

export type RecapConceptReference = DeepReadonly<{
  conceptId: ConceptId
  title: string
  summary: string
}>

export type RecapObjectiveReference = DeepReadonly<{
  objectiveId: ObjectiveId
  statement: string
}>

export type SessionAttemptRecap = DeepReadonly<{
  evidenceId: EvidenceId
  attemptNumber: number
  timestamp: string
  response: RecapResponse
  confidence: number | null
  hintsUsed: number
  evaluation: RecapEvaluation
}>

export type RecapEvaluation = DeepReadonly<{
  status: EvaluationStatus
  score: number | null
  feedback: string | null
}>

export type RecapResponse =
  | RecapTextResponse
  | RecapNumberResponse
  | RecapSingleChoiceResponse
  | RecapMultipleChoiceResponse
  | RecapConfidenceResponse
  | RecapCodeResponse
  | RecapManualResponse

export type RecapTextResponse = DeepReadonly<{
  kind: 'text'
  value: string
}>

export type RecapNumberResponse = DeepReadonly<{
  kind: 'number'
  value: number
}>

export type RecapSingleChoiceResponse = DeepReadonly<{
  kind: 'single-choice'
  optionId: OptionId
  optionLabel: string
}>

export type RecapMultipleChoiceResponse = DeepReadonly<{
  kind: 'multiple-choice'
  options: readonly DeepReadonly<{
    optionId: OptionId
    optionLabel: string
  }>[]
}>

export type RecapConfidenceResponse = DeepReadonly<{
  kind: 'confidence'
  value: number
}>

export type RecapCodeResponse = DeepReadonly<{
  kind: 'code'
  language: string
  source: string
}>

export type RecapManualResponse = DeepReadonly<{
  kind: 'manual'
  completed: true
}>

export type SessionTimelineEntry = DeepReadonly<{
  evidenceId: EvidenceId
  timestamp: string
  moduleId: ModuleId
  moduleTitle: string
  activityId: ActivityId
  activityTitle: string
  activityKind: ActivityKind
  attemptNumber: number
  evaluationStatus: EvaluationStatus
}>

export type ConceptEncounterRecap = DeepReadonly<{
  conceptId: ConceptId
  title: string
  activityIds: readonly ActivityId[]
  evidenceCount: number
  firstEncounterAt: string
  latestEncounterAt: string
}>
