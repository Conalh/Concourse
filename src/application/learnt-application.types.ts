import type {
  ActivityId,
  ActivityKind,
  ActivityProgress,
  ConceptId,
  ContentBlock,
  EvaluationResult,
  EvidenceEvent,
  InteractionMode,
  LearnerId,
  LearnerProfile,
  LearnerProfileId,
  LearningFlowOrigin,
  ModuleId,
  ObjectiveId,
  SessionId,
  SessionStatus,
  SubjectId,
} from '../core/contracts'
import type {
  LearningResourceDifficulty,
  LearningResourceModality,
  LearningResourceRole,
  LearningResourceSource,
  LearningPackDiagnostic,
  PlayMode,
  ResourceAccessibility,
  ResourceEngagementAction,
  ResourceEngagementMeasurement,
  ResourceLinkRole,
  ResourceProvenance,
  ResourceRecommendedUse,
  StudySetKind,
  StudySetOrdering,
} from '@learnt/learning-pack-contracts'
import type { LearningSubject } from '../core/engine'
import type { DeepReadonly } from '../core/foundation'
import type { PresentationPolicy } from '../core/presentation'
import type {
  Clock,
  FirstRunSetupStore,
  LearningRepositoryScanResult,
  LearningSessionRecord,
  ProductVocabularyPreferenceStore,
  RepositoryScanIssue,
  ResourceEngagementStore,
  ThemePreferenceStore,
} from '../core/ports'
import type { InstalledLearningPack } from '../learning-packs/learnt-importer'
import type {
  InstalledLearningPackRecord,
  InstalledLearningPackStore,
  LearningPackSourcePort,
  RejectedLearningPackSourceCandidate,
  ValidatedLearningPackCandidate,
} from '../learning-packs/installed-learning-pack-ports'
import type { SubjectRegistry } from '../subject-sdk'
import type { PersistentLearningService } from './persistent-learning-service'
import type { SessionRecap } from './session-recap.types'

export type {
  InstalledLearningPackRecord,
  InstalledLearningPackRelease,
  InstalledLearningPackStore,
  LearningPackSourcePort,
  LearningPackSourceReadResult,
  PersistedLearningPackRecordIssue,
  RejectedLearningPackSourceCandidate,
  ValidatedLearningPackCandidate,
  ValidatedLearningPackSourceCandidate,
} from '../learning-packs/installed-learning-pack-ports'

export type LearntApplicationDependencies = Readonly<{
  clock: Clock
  profile: DeepReadonly<LearnerProfile>
  subjectRegistry: SubjectRegistry
  persistentLearningService: PersistentLearningService
  resourceEngagementStore: ResourceEngagementStore
  themePreferenceStore?: ThemePreferenceStore
  productVocabularyPreferenceStore?: ProductVocabularyPreferenceStore
  firstRunSetupStore?: FirstRunSetupStore
  installedLearningPacks?: readonly InstalledLearningPack[]
  installedLearningPackStore?: InstalledLearningPackStore
  learningPackSource?: LearningPackSourcePort
  learningPackLibraryStates?: readonly LearningPackLibraryStateEntry[]
}>

export type LearnerSummary = DeepReadonly<{
  learnerId: LearnerId
  profileId: LearnerProfileId
  displayName: string
}>

export type SubjectSummary = DeepReadonly<{
  id: SubjectId
  version: string
  title: string
  summary: string
  tags: readonly string[]
  moduleCount: number
  conceptCount: number
  objectiveCount: number
  activityCount: number
}>

export type ConceptRelationshipKind = 'prerequisite' | 'related'

export type ConceptRelationship = DeepReadonly<{
  fromConceptId: ConceptId
  toConceptId: ConceptId
  kind: ConceptRelationshipKind
}>

export type SubjectOverview = DeepReadonly<{
  subject: LearningSubject
  orderedModules: readonly LearningSubject['modules'][number][]
  conceptRelationships: readonly ConceptRelationship[]
}>

export type SessionAvailability =
  | 'ready'
  | 'subject-not-registered'
  | 'subject-version-mismatch'
  | 'learner-profile-mismatch'

export type SessionLibraryEntry = DeepReadonly<{
  sessionId: SessionId
  subjectId: SubjectId
  subjectTitle: string | null
  persistedSubjectVersion: string
  registeredSubjectVersion: string | null
  sessionStatus: SessionStatus
  interactionMode: InteractionMode
  availability: SessionAvailability
  currentModuleId: ModuleId | null
  currentModuleTitle: string | null
  currentActivityId: ActivityId | null
  currentActivityTitle: string | null
  revision: number
  evidenceCount: number
  startedAt: string
  lastActiveAt: string
}>

export type SessionLibrarySnapshot = DeepReadonly<{
  sessions: readonly SessionLibraryEntry[]
  repositoryIssues: readonly RepositoryScanIssue[]
}>

export type LearningPackLibraryPackState =
  | 'ready'
  | 'invalid-pack'
  | 'unsupported-capability'
  | 'update-available'
  | 'partially-supported'

export type LearningPackLearningStatus =
  | 'not-started'
  | 'active'
  | 'attempted'
  | 'completed'
  | 'unavailable'

export type LearningResourceProgressState =
  | 'unseen'
  | 'opened'
  | 'in-progress'
  | 'completed'
  | 'completion-stale'
  | 'unavailable'
  | 'unsupported'

export type LearningPackVisualToken =
  | 'neutral'
  | 'logic'
  | 'proof'
  | 'practice'
  | 'warning'

export type LearningPackLibraryStateEntry = DeepReadonly<{
  packId: string
  packVersion?: string
  title: string
  state: Exclude<LearningPackLibraryPackState, 'ready'>
  message: string
  diagnostics?: readonly LearningPackDiagnostic[]
}>

export type InstalledPackChangeRejectionReason =
  | 'downgrade-blocked'
  | 'invalid-existing-record'
  | 'invalid-semver'
  | 'pack-id-mismatch'
  | 'same-version-content-conflict'

export type InstalledPackChange =
  | Readonly<{ kind: 'install'; record: InstalledLearningPackRecord }>
  | Readonly<{ kind: 'reinstall'; record: InstalledLearningPackRecord }>
  | Readonly<{
      kind: 'upgrade'
      fromVersion: string
      record: InstalledLearningPackRecord
    }>
  | Readonly<{
      kind: 'reject'
      reason: InstalledPackChangeRejectionReason
      record: InstalledLearningPackRecord | null
    }>

export type PlanInstalledPackChangeInput = Readonly<{
  existing: InstalledLearningPackRecord | null
  candidate: ValidatedLearningPackCandidate
}>

export type LearningPackDirectoryInstallOutcome =
  | RejectedLearningPackSourceCandidate
  | Readonly<{
      directoryName: string
      status: 'installed' | 'reinstalled' | 'rejected'
      packId: string
      packVersion: string
      title: string
      message: string
      diagnostics: readonly LearningPackDiagnostic[]
      change: InstalledPackChange
    }>
  | Readonly<{
      directoryName: string
      status: 'installation-error'
      packId: string
      packVersion: string
      title: string
      message: string
      diagnostics: readonly LearningPackDiagnostic[]
    }>

export type LearningPackDirectoryInstallResult = Readonly<{
  sourceName: string
  scannedDirectoryCount: number
  outcomes: readonly LearningPackDirectoryInstallOutcome[]
}>

export type LearningPackLibraryFilters = Readonly<{
  subjectId?: string
  courseId?: string
  conceptId?: string
  objectiveId?: string
  itemMode?: PlayMode
  authoredTag?: string
  installedPackId?: string
  learningStatus?: LearningPackLearningStatus
}>

export type LearningPackLibraryFilterOption = Readonly<{
  id: string
  label: string
}>

export type LearningPackLibraryFilterOptions = Readonly<{
  installedPacks: readonly LearningPackLibraryFilterOption[]
  subjects: readonly LearningPackLibraryFilterOption[]
  courses: readonly LearningPackLibraryFilterOption[]
  concepts: readonly LearningPackLibraryFilterOption[]
  objectives: readonly LearningPackLibraryFilterOption[]
  itemModes: readonly LearningPackLibraryFilterOption[]
  authoredTags: readonly LearningPackLibraryFilterOption[]
  learningStatuses: readonly LearningPackLibraryFilterOption[]
}>

export type LearningPackLibrarySummary = Readonly<{
  packCount: number
  subjectCount: number
  courseCount: number
  curriculumNodeCount: number
  studySetCount: number
  itemCount: number
  visibleItemCount: number
  invalidPackCount: number
  unsupportedCapabilityCount: number
  updateAvailableCount: number
  partiallySupportedCount: number
}>

export type LearningResourceCheckpointReference = DeepReadonly<{
  setId: string
  title: string
  summary: string
  kind: string
  itemIds: readonly string[]
  itemCount: number
  playModes: readonly PlayMode[]
}>

export type LearningResourceSegmentReference = DeepReadonly<{
  segmentId: string
  title: string
  summary: string | null
  startSeconds: number | null
  endSeconds: number | null
  conceptIds: readonly string[]
  objectiveIds: readonly string[]
  checkpoints: readonly LearningResourceCheckpointReference[]
}>

export type LearningResourceConceptReference = DeepReadonly<{
  conceptId: string
  title: string
  summary: string
}>

export type LearningResourceObjectiveReference = DeepReadonly<{
  objectiveId: string
  statement: string
}>

export type LearningResourceLinkReference = DeepReadonly<{
  packId: string
  packVersion: string
  resourceId: string
  segmentId: string | null
  title: string
  summary: string | null
  sourceKind: LearningResourceSource['kind']
  modality: LearningResourceModality
  estimatedDurationSeconds: number | null
  linkRole: ResourceLinkRole
  recommendedUse: ResourceRecommendedUse | null
  priority: number | null
  progressState: LearningResourceProgressState
}>

export type LearningResourceTeachingContext = DeepReadonly<{
  packId: string
  packVersion: string
  resourceId: string
  contentRevision: number
  title: string
  summary: string | null
  modality: LearningResourceModality
  roles: readonly LearningResourceRole[]
  estimatedDurationSeconds: number | null
  difficulty: LearningResourceDifficulty | null
  sourceKind: LearningResourceSource['kind']
  source: LearningResourceSource
  supported: boolean
  supportMessage: string | null
  progressState: LearningResourceProgressState
  segments: readonly LearningResourceSegmentReference[]
  selectedSegment: LearningResourceSegmentReference | null
  concepts: readonly LearningResourceConceptReference[]
  objectives: readonly LearningResourceObjectiveReference[]
  checkpoints: readonly LearningResourceCheckpointReference[]
  provenance: ResourceProvenance | null
  accessibility: ResourceAccessibility | null
  nextEntry: LearningPackCurriculumEntryView | null
}>

export type LearningPackCurriculumEntryView = DeepReadonly<
  | {
      kind: 'child-node'
      packId: string
      packVersion: string
      courseId: string
      nodeId: string
      index: number
      childNodeId: string
      title: string
      summary: string
    }
  | {
      kind: 'resource'
      packId: string
      packVersion: string
      courseId: string
      nodeId: string
      index: number
      resourceId: string
      segmentId: string | null
      title: string
      summary: string | null
      sourceKind: LearningResourceSource['kind']
      modality: LearningResourceModality
      progressState: LearningResourceProgressState
    }
  | {
      kind: 'item'
      packId: string
      packVersion: string
      courseId: string
      nodeId: string
      index: number
      itemId: string
      title: string
      responseKind: string
      evaluationKind: string
    }
  | {
      kind: 'study-set'
      packId: string
      packVersion: string
      courseId: string
      nodeId: string
      index: number
      setId: string
      title: string
      summary: string
      itemIds: readonly string[]
      itemCount: number
    }
>

export type GetLearningResourceInput = Readonly<{
  packId: string
  resourceId: string
  segmentId?: string
}>

export type ListResourcesForPackInput = Readonly<{
  packId: string
}>

export type ListResourcesForConceptInput = Readonly<{
  packId: string
  conceptId: string
}>

export type ListResourcesForObjectiveInput = Readonly<{
  packId: string
  objectiveId: string
}>

export type ListSupportResourcesForLearningItemInput = Readonly<{
  packId: string
  itemId: string
  recommendedUse?: ResourceRecommendedUse
}>

export type ListCurriculumEntriesInput = Readonly<{
  packId: string
  courseId: string
  nodeId: string
}>

export type RecordResourceEngagementInput = Readonly<{
  packId: string
  resourceId: string
  segmentId?: string
  action: ResourceEngagementAction
  measurement?: ResourceEngagementMeasurement
  progressRatio?: number
  positionSeconds?: number
}>

export type ResolveStudySetInput = Readonly<{
  packId: string
  studySetId: string
  seed?: string
}>

export type ResolvedStudySet = DeepReadonly<{
  packId: string
  packVersion: string
  studySetId: string
  title: string
  summary: string
  kind: StudySetKind
  ordering: StudySetOrdering
  playModes: readonly PlayMode[]
  timeLimitSeconds: number | null
  attemptLimit: number | null
  seed: string
  itemIds: readonly ActivityId[]
  itemCount: number
}>

export type StartStudySetSessionInput = Readonly<{
  packId: string
  studySetId: string
  origin: LearningFlowOrigin
  seed?: string
  interactionMode?: InteractionMode
}>

export type StudySetSessionStartResult = DeepReadonly<{
  studySet: ResolvedStudySet
  context: LearningSessionContext
}>

export type PracticeMode = 'flashcard' | 'quiz' | 'recall' | 'mixed'

export type ResolvedPracticeMode = 'flashcard' | 'quiz' | 'recall'

export type PracticeSelectionStrategy =
  | 'authored-order'
  | 'random'
  | 'weakest-first'
  | 'recent-mistakes'
  | 'least-seen'
  | 'balanced-by-concept'
  | 'due-or-weak'

export type PracticeScope = DeepReadonly<
  | {
      kind: 'pack'
      packId: string
    }
  | {
      kind: 'subject'
      packId?: string
      subjectId: string
    }
  | {
      kind: 'course'
      packId: string
      courseId: string
    }
  | {
      kind: 'curriculum-node'
      packId: string
      courseId: string
      nodeId: string
      includeDescendants?: boolean
    }
  | {
      kind: 'concepts'
      packId: string
      conceptIds: readonly string[]
    }
  | {
      kind: 'objectives'
      packId: string
      objectiveIds: readonly string[]
    }
  | {
      kind: 'study-set'
      packId: string
      studySetId: string
    }
  | {
      kind: 'items'
      packId: string
      itemIds: readonly string[]
    }
  | {
      kind: 'weak-items'
      packId?: string
      subjectId?: string
    }
  | {
      kind: 'recent-mistakes'
      packId?: string
      subjectId?: string
      since?: string
    }
>

export type PracticeRequest = DeepReadonly<{
  scope: PracticeScope
  mode: PracticeMode
  selectionStrategy: PracticeSelectionStrategy
  count?: number
  seed?: string
  includeItemIds?: readonly string[]
  excludeItemIds?: readonly string[]
  origin: LearningFlowOrigin
  preferences?: PracticePreferences
}>

export type PracticePreferences = DeepReadonly<{
  defaultCount: number
  includeWeakItems: boolean
  includeRecentMistakes: boolean
  flashcardGradeScale: readonly ['again', 'hard', 'good', 'easy']
}>

export type PracticeUnavailableReason =
  | 'play-mode-not-authored'
  | 'missing-reviewed-solution'
  | 'missing-deterministic-evaluation'
  | 'unsupported-response-kind'

export type PracticeModeAvailability = DeepReadonly<{
  mode: ResolvedPracticeMode
  available: boolean
  playModes: readonly PlayMode[]
  reasons: readonly PracticeUnavailableReason[]
}>

export type PracticeCandidateResolution = DeepReadonly<{
  itemId: ActivityId
  title: string
  learningRevision: number
  conceptIds: readonly ConceptId[]
  objectiveIds: readonly ObjectiveId[]
  availableModes: readonly PracticeModeAvailability[]
}>

export type PracticePlanItem = DeepReadonly<{
  itemId: ActivityId
  title: string
  resolvedMode: ResolvedPracticeMode
  playMode: PlayMode
  learningRevision: number
  conceptIds: readonly ConceptId[]
  objectiveIds: readonly ObjectiveId[]
}>

export type PracticePlanExclusion = DeepReadonly<{
  itemId: string
  reason: string
}>

export type PracticePlanCoverage = DeepReadonly<{
  candidateCount: number
  selectedCount: number
  conceptCount: number
  objectiveCount: number
  excludedCount: number
}>

export type PracticePlanDisplaySummary = DeepReadonly<{
  title: string
  scopeLabel: string
  modeLabel: string
  strategyLabel: string
  itemCount: number
}>

export type PracticePlan = DeepReadonly<{
  planId: string
  request: PracticeRequest
  packId: string
  packVersion: string
  mode: PracticeMode
  selectedItemIds: readonly ActivityId[]
  selectedItems: readonly PracticePlanItem[]
  selectionStrategy: PracticeSelectionStrategy
  seed: string
  coverage: PracticePlanCoverage
  exclusions: readonly PracticePlanExclusion[]
  warnings: readonly string[]
  origin: LearningFlowOrigin
  createdAt: string
  displaySummary: PracticePlanDisplaySummary
}>

export type PracticeScopeOption = DeepReadonly<{
  kind:
    | 'pack'
    | 'subject'
    | 'course'
    | 'curriculum-node'
    | 'concept'
    | 'objective'
    | 'study-set'
    | 'weak-items'
    | 'recent-mistakes'
  packId?: string
  subjectId?: string
  courseId?: string
  nodeId?: string
  conceptId?: string
  objectiveId?: string
  studySetId?: string
  label: string
  itemCount: number
}>

export type PracticeSelfGrade = 'again' | 'hard' | 'good' | 'easy'

export type PracticeItemMetrics = DeepReadonly<{
  itemId: ActivityId
  title: string
  packId: string
  packVersion: string
  conceptIds: readonly ConceptId[]
  objectiveIds: readonly ObjectiveId[]
  attempts: number
  successes: number
  successRate: number | null
  selfGrades: Record<PracticeSelfGrade, number>
  lastPracticedAt: string | null
  recentUnsuccessful: boolean
  modeAvailability: readonly PracticeModeAvailability[]
}>

export type PracticeConceptWeakness = DeepReadonly<{
  conceptId: ConceptId
  title: string
  attempts: number
  unsuccessfulAttempts: number
  weakItemIds: readonly ActivityId[]
}>

export type PracticeMetricsSummary = DeepReadonly<{
  items: Record<string, PracticeItemMetrics>
  weakConcepts: readonly PracticeConceptWeakness[]
  recentMistakes: readonly PracticeItemMetrics[]
  leastSeen: readonly PracticeItemMetrics[]
  modeAvailability: Record<string, readonly PracticeModeAvailability[]>
  exclusions: readonly PracticePlanExclusion[]
  confusionRelationships: readonly {
    fromConceptId: ConceptId
    toConceptId: ConceptId
    evidence: string
  }[]
  warnings: readonly string[]
}>

export type PracticePresetKind =
  | 'quick-practice'
  | 'weakest-concepts'
  | 'recent-mistakes'
  | 'flashcards'
  | 'quiz-me'
  | 'course-review'
  | 'chapter-review'
  | 'study-set-practice'

export type PracticePresetInput = DeepReadonly<{
  kind: PracticePresetKind
  packId?: string
  subjectId?: string
  courseId?: string
  nodeId?: string
  studySetId?: string
  origin: LearningFlowOrigin
}>

export type PracticeSessionCurrentItem = DeepReadonly<{
  itemId: ActivityId
  title: string
  resolvedMode: ResolvedPracticeMode
  playMode: PlayMode
  frontBlocks: readonly ContentBlock[]
  backBlocks: readonly ContentBlock[]
  selfGradeScale: readonly PracticeSelfGrade[]
}>

export type PracticeSessionSummary = DeepReadonly<{
  selfGradedFlashcards: number
  evaluatedQuizResponses: number
  recentUnsuccessful: number
}>

export type PracticeSessionContext = DeepReadonly<{
  planId: string
  packId: string
  packVersion: string
  mode: PracticeMode
  origin: LearningFlowOrigin
  selectedItems: readonly PracticePlanItem[]
  currentItem: PracticeSessionCurrentItem | null
  summary: PracticeSessionSummary
}>

export type StartPracticeSessionResult = DeepReadonly<{
  plan: PracticePlan
  context: LearningSessionContext
}>

export type GetSupportedPracticeModesInput = DeepReadonly<{
  packId: string
  itemId: string
}>

export type ResolvePracticeCandidatesInput = DeepReadonly<{
  scope: PracticeScope
}>

export type GetPracticeSummaryInput = DeepReadonly<{
  packId?: string
  subjectId?: string
}>

export type GetPracticeRecommendationsInput = DeepReadonly<{
  packId?: string
  subjectId?: string
  limit?: number
}>

export type GetEligibleSupportResourcesInput = Readonly<{
  sessionId: SessionId
  activityId?: ActivityId
}>

export type LearningPackLibraryItem = Readonly<{
  packId: string
  packVersion: string
  subjectId: string
  courseId: string
  curriculumNodeId: string
  itemId: string
  learningRevision: number
  title: string
  responseKind: string
  evaluationKind: string
  conceptIds: readonly string[]
  objectiveIds: readonly string[]
  allowedPlayModes: readonly PlayMode[]
  learningStatus: LearningPackLearningStatus
}>

export type LearningPackLibraryStudySet = Readonly<{
  packId: string
  packVersion: string
  setId: string
  kind: string
  title: string
  summary: string
  ordering: string
  playModes: readonly PlayMode[]
  itemIds: readonly string[]
  itemCount: number
}>

export type LearningPackLibraryResource = Readonly<{
  packId: string
  packVersion: string
  subjectId: string
  courseId: string
  curriculumNodeId: string
  resourceId: string
  segmentId: string | null
  title: string
  summary: string | null
  sourceKind: LearningResourceSource['kind']
  modality: LearningResourceModality
  estimatedDurationSeconds: number | null
}>

export type LearningPackLibraryNode = Readonly<{
  packId: string
  packVersion: string
  subjectId: string
  courseId: string
  nodeId: string
  kind: string
  kindLabel: string
  title: string
  summary: string
  conceptIds: readonly string[]
  objectiveIds: readonly string[]
  entries: readonly LearningPackCurriculumEntryView[]
  resources: readonly LearningPackLibraryResource[]
  items: readonly LearningPackLibraryItem[]
  studySets: readonly LearningPackLibraryStudySet[]
  children: readonly LearningPackLibraryNode[]
}>

export type LearningPackLibraryCourse = Readonly<{
  packId: string
  packVersion: string
  subjectId: string
  courseId: string
  title: string
  summary: string
  tags: readonly string[]
  rootNodes: readonly LearningPackLibraryNode[]
}>

export type LearningPackLibrarySubject = Readonly<{
  packId: string
  packVersion: string
  subjectId: string
  title: string
  summary: string
  tags: readonly string[]
  conceptIds: readonly string[]
  objectiveIds: readonly string[]
  courses: readonly LearningPackLibraryCourse[]
}>

export type LearningPackLibraryPack = Readonly<{
  packId: string
  packVersion: string
  title: string
  summary: string
  state: LearningPackLibraryPackState
  stateMessage: string | null
  diagnostics: readonly LearningPackDiagnostic[]
  requiredCapabilities: readonly string[]
  optionalCapabilities: readonly string[]
  visualToken: LearningPackVisualToken
  visualLabel: string | null
  releasedAt: string | null
  subjects: readonly LearningPackLibrarySubject[]
  subjectCount: number
  courseCount: number
  itemCount: number
}>

export type LearningPackLibrarySnapshot = Readonly<{
  packs: readonly LearningPackLibraryPack[]
  filterOptions: LearningPackLibraryFilterOptions
  appliedFilters: LearningPackLibraryFilters
  summary: LearningPackLibrarySummary
  isEmpty: boolean
}>

export type ActivityNavigationOption = DeepReadonly<{
  activityId: ActivityId
  activityTitle: string
  moduleId: ModuleId
  moduleTitle: string
}>

export type ConceptExplorationReference = DeepReadonly<{
  conceptId: ConceptId
  title: string
  summary: string
}>

export type SessionConceptReference = ConceptExplorationReference

export type SessionConceptObjective = DeepReadonly<{
  objectiveId: ObjectiveId
  statement: string
}>

export type SessionConceptActivityReference = DeepReadonly<{
  activityId: ActivityId
  activityTitle: string
  activityKind: ActivityKind
  moduleId: ModuleId
  moduleTitle: string
  status: ActivityProgress['status']
  isCurrentThread: boolean
}>

export type SessionConceptCurrentThread = DeepReadonly<{
  activityId: ActivityId
  activityTitle: string
  activityKind: ActivityKind
  activityStatus: ActivityProgress['status']
  moduleId: ModuleId
  moduleTitle: string
  action: 'return-to-activity' | 'continue-after-completion'
}>

export type SessionConceptExploration = DeepReadonly<{
  sessionId: SessionId
  sessionStatus: SessionStatus
  interactionMode: InteractionMode
  subject: {
    id: SubjectId
    version: string
    title: string
  }
  concept: {
    conceptId: ConceptId
    title: string
    summary: string
    tags: readonly string[]
  }
  prerequisiteConcepts: readonly SessionConceptReference[]
  dependentConcepts: readonly SessionConceptReference[]
  relatedConcepts: readonly SessionConceptReference[]
  objectives: readonly SessionConceptObjective[]
  resources: readonly LearningResourceLinkReference[]
  activities: readonly SessionConceptActivityReference[]
  currentThread: SessionConceptCurrentThread | null
  parkedPaths: readonly ConceptExplorationReference[]
  isParked: boolean
}>

export type ProgressSummary = DeepReadonly<{
  unseen: number
  active: number
  attempted: number
  completed: number
  total: number
}>

export type LearningSessionContext = DeepReadonly<{
  record: LearningSessionRecord
  learner: LearnerSummary
  subject: LearningSubject
  orderedModules: readonly LearningSubject['modules'][number][]
  currentModule: LearningSubject['modules'][number] | null
  currentActivity: LearningSubject['activities'][number] | null
  currentActivityProgress: ActivityProgress | null
  presentationPolicy: PresentationPolicy | null
  currentActivityEvidence: readonly EvidenceEvent[]
  latestCurrentActivityEvaluation: EvaluationResult | null
  nextActivities: readonly ActivityNavigationOption[]
  parkedPaths: readonly ConceptExplorationReference[]
  progress: ProgressSummary
  practice?: PracticeSessionContext
}>

export type { SessionRecap }

export type StartLearntSessionInput = Readonly<{
  subjectId: SubjectId
  interactionMode?: InteractionMode
}>

export type SubmitLearntEvidenceInput = Readonly<{
  sessionId: SessionId
  activityId: ActivityId
  response: unknown
  confidence?: number
  hintsUsed?: number
}>

export type LearntSubmissionResult = DeepReadonly<{
  context: LearningSessionContext
  evidenceEvent: EvidenceEvent
  evaluation: EvaluationResult
  activityCompleted: boolean
}>

export type AdvanceLearntSessionInput = Readonly<{
  sessionId: SessionId
  nextActivityId?: ActivityId
}>

export type ChangeLearntModeInput = Readonly<{
  sessionId: SessionId
  interactionMode: InteractionMode
}>

export type AbandonLearntSessionInput = Readonly<{
  sessionId: SessionId
}>

export type ParkLearntConceptInput = Readonly<{
  sessionId: SessionId
  conceptId: ConceptId
}>

export type UnparkLearntConceptInput = Readonly<{
  sessionId: SessionId
  conceptId: ConceptId
}>

export type SessionScanResult = LearningRepositoryScanResult
