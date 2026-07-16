import type { SCHEMA_VERSION } from './constants.js'

export type SchemaVersion = typeof SCHEMA_VERSION

export type JsonPrimitive = string | number | boolean | null
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[]
export interface JsonObject {
  [key: string]: JsonValue
}

export type CapabilityId =
  | 'core.learning-pack'
  | 'theme.metadata'
  | 'migrations.basic'
  | 'assets.static'
  | 'learning-resource.embedded-content'
  | 'learning-resource.external-link'
  | 'learning-resource.external-video'
  | 'learning-resource.external-audio'
  | 'learning-resource.bibliographic-reference'
  | 'learning-resource.interactive-reference'
  | 'learning-resource.pack-asset'
  | 'learning-resource.segments'
  | 'learning-resource.checkpoints'
  | 'curriculum.ordered-resource-entries'
  | (string & {})

export interface CapabilityDeclaration {
  capabilityId: CapabilityId
  version: string
}

export interface PackCapabilities {
  required: CapabilityDeclaration[]
  optional: CapabilityDeclaration[]
}

export interface AuthorRecord {
  name: string
  url?: string
}

export type PackFileRole =
  | 'catalog'
  | 'courses'
  | 'items'
  | 'sets'
  | 'resources'
  | 'theme'
  | 'migrations'
  | 'asset'
  | 'documentation'

export interface PackFileManifestEntry {
  assetId: string | null
  path: string
  role: PackFileRole
  mediaType: string
  sha256: string
  bytes: number
}

export interface LearningPackManifest {
  schemaVersion: SchemaVersion
  packId: string
  version: string
  title: string
  summary: string
  language: string
  license: string
  authors: AuthorRecord[]
  releasedAt: string
  capabilities: PackCapabilities
  files: PackFileManifestEntry[]
  homepageUrl?: string
  repositoryUrl?: string
  supportUrl?: string
  keywords?: string[]
}

export interface Subject {
  subjectId: string
  title: string
  summary: string
  tags: string[]
  conceptIds: string[]
  objectiveIds: string[]
  courseIds: string[]
}

export type ResourceLinkRole =
  | 'primary'
  | 'prerequisite'
  | 'explanation'
  | 'alternative-explanation'
  | 'demonstration'
  | 'worked-example'
  | 'remediation'
  | 'reference'
  | 'extension'

export type ResourceRecommendedUse =
  | 'before-attempt'
  | 'after-attempt'
  | 'after-incorrect'
  | 'after-repeated-incorrect'
  | 'during-review'
  | 'optional'

export interface ResourceLink {
  resourceId: string
  segmentId?: string
  role: ResourceLinkRole
  recommendedUse?: ResourceRecommendedUse
  priority?: number
}

export interface Concept {
  conceptId: string
  title: string
  summary: string
  tags: string[]
  prerequisiteConceptIds: string[]
  relatedConceptIds: string[]
  resourceLinks?: ResourceLink[]
}

export interface Objective {
  objectiveId: string
  statement: string
  successCriteria: string[]
  conceptIds: string[]
  resourceLinks?: ResourceLink[]
}

export interface CatalogDocument {
  schemaVersion: SchemaVersion
  subjects: Subject[]
  concepts: Concept[]
  objectives: Objective[]
}

export type CurriculumNodeKind =
  | 'module'
  | 'unit'
  | 'chapter'
  | 'lesson'
  | 'section'
  | 'custom'

export interface CurriculumNode {
  nodeId: string
  kind: CurriculumNodeKind
  title: string
  summary: string
  itemIds: string[]
  conceptIds: string[]
  objectiveIds: string[]
  children: CurriculumNode[]
  entries?: CurriculumEntry[]
  customKindLabel: string | null
}

export interface Course {
  courseId: string
  title: string
  summary: string
  subjectIds: string[]
  tags: string[]
  rootNodes: CurriculumNode[]
}

export interface CoursesDocument {
  schemaVersion: SchemaVersion
  courses: Course[]
}

export type CurriculumEntry =
  | { kind: 'child-node'; nodeId: string }
  | { kind: 'resource'; resourceId: string; segmentId?: string }
  | { kind: 'item'; itemId: string }
  | { kind: 'study-set'; studySetId: string }

export type PlayMode =
  | 'flashcard'
  | 'single-choice-quiz'
  | 'multiple-choice-quiz'
  | 'text-recall'
  | 'number-recall'
  | 'manual-read'
  | 'self-grade-review'

export type ContentBlockKind =
  | 'text'
  | 'question'
  | 'code'
  | 'equation'
  | 'callout'
  | 'image'
  | 'audio'

export type CalloutRole = 'note' | 'tip' | 'warning' | 'definition'

export interface ContentBlock {
  blockId?: string
  kind: ContentBlockKind
  text: string
  language: string | null
  calloutRole: CalloutRole | null
  assetId: string | null
  altText: string | null
}

export interface ChoiceOption {
  optionId: string
  label: string
  contentBlocks: ContentBlock[]
}

export interface TextInputDefinition {
  placeholder: string | null
  minLength: number | null
  maxLength: number | null
}

export interface NumberInputDefinition {
  placeholder: string | null
  unitLabel: string | null
  min: number | null
  max: number | null
}

export type ResponseKind =
  | 'none'
  | 'single-choice'
  | 'multiple-choice'
  | 'text'
  | 'number'
  | 'self-grade'

export interface ResponseDefinition {
  kind: ResponseKind
  options: ChoiceOption[]
  textInput: TextInputDefinition | null
  numberInput: NumberInputDefinition | null
}

export type EvaluationKind =
  | 'manual-completion'
  | 'choice-selection'
  | 'exact-text'
  | 'numerical-tolerance'
  | 'self-grade'

export type SelfGrade = 'again' | 'hard' | 'good' | 'easy'

export interface EvaluationDefinition {
  kind: EvaluationKind
  correctOptionIds: string[]
  acceptedAnswers: string[]
  caseSensitive: boolean
  trimWhitespace: boolean
  expectedNumber: number | null
  absoluteTolerance: number | null
  passingSelfGrades: SelfGrade[]
}

export interface LearningItem {
  itemId: string
  learningRevision: number
  title: string
  promptBlocks: ContentBlock[]
  response: ResponseDefinition
  evaluation: EvaluationDefinition
  reviewedSolutionBlocks: ContentBlock[]
  conceptIds: string[]
  objectiveIds: string[]
  allowedPlayModes: PlayMode[]
  supportResourceLinks?: ResourceLink[]
}

export interface ItemsDocument {
  schemaVersion: SchemaVersion
  items: LearningItem[]
}

export type StudySetKind = 'deck' | 'quiz' | 'review' | 'practice' | 'exam'
export type StudySetOrdering = 'authored' | 'shuffle' | 'adaptive'

export interface StudySetRuleScope {
  subjectIds: string[]
  courseIds: string[]
  nodeIds: string[]
  conceptIds: string[]
  objectiveIds: string[]
  allowedPlayModes: PlayMode[]
  tags: string[]
}

export interface StudySetRuleExclusion {
  itemIds: string[]
  conceptIds: string[]
  objectiveIds: string[]
  tags: string[]
}

export interface ExplicitStudySetSelection {
  kind: 'explicit'
  itemIds: string[]
}

export interface RuleStudySetSelection {
  kind: 'rule'
  include: StudySetRuleScope
  exclude: StudySetRuleExclusion
  limit: number | null
}

export type StudySetSelection =
  | ExplicitStudySetSelection
  | RuleStudySetSelection

export interface StudySet {
  setId: string
  kind: StudySetKind
  title: string
  summary: string
  selection: StudySetSelection
  playModes: PlayMode[]
  ordering: StudySetOrdering
  timeLimitSeconds: number | null
  attemptLimit: number | null
}

export interface SetsDocument {
  schemaVersion: SchemaVersion
  sets: StudySet[]
}

export type BackgroundRole = 'light' | 'dark' | 'system'

export interface ThemeMetadata {
  schemaVersion: SchemaVersion
  themeId: string
  displayName: string
  accentColor: string
  backgroundRole: BackgroundRole
  iconAssetId: string | null
  coverAssetId: string | null
}

export type LearningResourceModality =
  | 'text'
  | 'video'
  | 'audio'
  | 'interactive'
  | 'mixed'

export type LearningResourceRole =
  | 'introduction'
  | 'explanation'
  | 'demonstration'
  | 'worked-example'
  | 'remediation'
  | 'reference'
  | 'enrichment'
  | 'summary'

export type LearningResourceDifficulty =
  | 'introductory'
  | 'foundational'
  | 'intermediate'
  | 'advanced'

export type LearningResourceSource =
  | EmbeddedContentResourceSource
  | ExternalLinkResourceSource
  | ExternalVideoResourceSource
  | ExternalAudioResourceSource
  | BibliographicResourceSource
  | InteractiveReferenceResourceSource
  | PackAssetResourceSource

export interface EmbeddedContentResourceSource {
  kind: 'embedded-content'
  content: ContentBlock[]
}

export interface ExternalLinkResourceSource {
  kind: 'external-link'
  url: string
  providerName?: string
  contentTypeHint?: string
}

export type ExternalVideoProvider = 'youtube' | 'vimeo' | 'other'

export interface ExternalVideoResourceSource {
  kind: 'external-video'
  provider: ExternalVideoProvider
  mediaId: string
  canonicalUrl?: string
  startSeconds?: number
  endSeconds?: number
}

export interface ExternalAudioResourceSource {
  kind: 'external-audio'
  provider: string
  mediaId?: string
  canonicalUrl: string
  startSeconds?: number
  endSeconds?: number
}

export interface BibliographicResourceSource {
  kind: 'bibliographic-reference'
  title: string
  authors: string[]
  publisher?: string
  publicationYear?: number
  edition?: string
  isbn?: string
  doi?: string
  chapter?: string
  pageRange?: string
  canonicalUrl?: string
  citationText?: string
}

export interface InteractiveReferenceResourceSource {
  kind: 'interactive-reference'
  url: string
  providerName?: string
  interactionSummary: string
  requiredEnvironment?: string
}

export type PackAssetMediaType =
  | 'application/x-ipynb+json'
  | 'text/x-python'
  | 'text/csv'
  | 'text/markdown'
  | 'text/plain'
  | 'application/yaml'

export interface PackAssetResourceSource {
  kind: 'pack-asset'
  assetId: string
  suggestedFileName: string
  mediaType: PackAssetMediaType
}

export interface ResourceSegment {
  id: string
  title: string
  summary?: string
  startSeconds?: number
  endSeconds?: number
  contentBlockStartId?: string
  contentBlockEndId?: string
  conceptIds: string[]
  objectiveIds: string[]
  checkpointStudySetIds: string[]
  tags: string[]
}

export type ResourceContentOwnership =
  | 'pack-authored'
  | 'licensed-for-redistribution'
  | 'public-domain'
  | 'external-link-only'
  | 'unknown'

export interface ResourceProvenance {
  author?: string
  publisher?: string
  sourceTitle?: string
  license?: string
  licenseUrl?: string
  canonicalUrl?: string
  attributionText?: string
  lastReviewedAt?: string
  reviewedBy?: string
  contentOwnership: ResourceContentOwnership
}

export interface ResourceAccessibility {
  captionsAvailable?: boolean
  transcriptAvailable?: boolean
  audioDescriptionAvailable?: boolean
  screenReaderOptimized?: boolean
  textAlternativeAvailable?: boolean
  language?: string
  accessibilityNotes?: string
}

export interface LearningResource {
  id: string
  contentRevision: number
  title: string
  summary?: string
  modality: LearningResourceModality
  roles: LearningResourceRole[]
  conceptIds?: string[]
  objectiveIds?: string[]
  estimatedDurationSeconds?: number
  difficulty?: LearningResourceDifficulty
  language?: string
  source: LearningResourceSource
  segments?: ResourceSegment[]
  checkpointStudySetIds?: string[]
  tags?: string[]
  provenance?: ResourceProvenance
  accessibility?: ResourceAccessibility
  metadata?: JsonObject
}

export interface ResourcesDocument {
  schemaVersion: SchemaVersion
  resources: LearningResource[]
}

export type MigrationEntityKind =
  | 'subject'
  | 'course'
  | 'curriculum-node'
  | 'concept'
  | 'objective'
  | 'item'
  | 'set'
  | 'resource'
  | 'resource-segment'

export type MigrationChangeKind =
  | 'unchanged'
  | 'renamed'
  | 'split'
  | 'merged'
  | 'removed'
  | 'revised'

export type ProgressPolicy =
  | 'preserve'
  | 'reset-mastery'
  | 'history-only'
  | 'manual-review'

export type ResourceEngagementPolicy =
  | 'preserve'
  | 'preserve-history-reset-completion'
  | 'archive'
  | 'do-not-transfer'

export interface MigrationEntityMapping {
  entityKind: MigrationEntityKind
  fromId: string
  toId: string | null
  changeKind: MigrationChangeKind
  fromLearningRevision: number | null
  toLearningRevision: number | null
  fromContentRevision?: number | null
  toContentRevision?: number | null
  fromSegmentId?: string | null
  toSegmentId?: string | null
  progressPolicy: ProgressPolicy
  engagementPolicy?: ResourceEngagementPolicy | null
  rationale: string
}

export interface PackMigration {
  fromVersion: string
  toVersion: string
  entityMappings: MigrationEntityMapping[]
  notes: string
}

export interface MigrationsDocument {
  schemaVersion: SchemaVersion
  migrations: PackMigration[]
}

export interface LearningPackDocuments {
  manifest: LearningPackManifest
  catalog: CatalogDocument
  courses: CoursesDocument
  items: ItemsDocument
  sets: SetsDocument
  resources?: ResourcesDocument
  theme?: ThemeMetadata
  migrations?: MigrationsDocument
}

export type ReviewEventResponseKind =
  | 'none'
  | 'choice'
  | 'text'
  | 'number'
  | 'self-grade'
  | 'custom'

export type ReviewEventResult =
  | 'correct'
  | 'incorrect'
  | 'completed'
  | 'self-graded'
  | 'ungraded'

export interface ReviewEventResponseSummary {
  kind: ReviewEventResponseKind
  selectedOptionIds: string[]
  enteredText: string | null
  enteredNumber: number | null
  selfGrade: SelfGrade | null
  customSummary: JsonObject | null
}

export interface ReviewEventPrivacyMetadata {
  learnerId: string | null
  sessionId: string | null
  sourceAppId: string | null
  sourceAppVersion: string | null
}

export interface ReviewEvent {
  schemaVersion: SchemaVersion
  eventId: string
  packId: string
  packVersion: string
  itemId: string
  learningRevision: number
  subjectId: string | null
  courseId: string | null
  playMode: PlayMode
  responseSummary: ReviewEventResponseSummary
  result: ReviewEventResult
  normalizedScore: number | null
  responseTimeMs: number | null
  occurredAt: string
  sourceInstanceId: string
  confusionTargetIds: string[]
  privacy: ReviewEventPrivacyMetadata | null
  extensions: JsonObject | null
}

export type ResourceEngagementAction =
  | 'opened'
  | 'started'
  | 'progressed'
  | 'completed'
  | 'revisited'
  | 'abandoned'
  | 'marked-complete'

export type ResourceEngagementMeasurement =
  | 'self-reported'
  | 'player-observed'
  | 'reader-observed'
  | 'external-return'
  | 'unknown'

export interface ResourceEngagementEvent {
  schemaVersion: SchemaVersion
  eventType: 'resource-engagement'
  eventId: string
  packId: string
  packVersion: string
  resourceId: string
  contentRevision: number
  segmentId: string | null
  action: ResourceEngagementAction
  progressRatio: number | null
  positionSeconds: number | null
  measurement: ResourceEngagementMeasurement
  occurredAt: string
  sourceInstanceId: string
  metadata: JsonObject | null
}

export type LearningEvidenceEvent = ReviewEvent | ResourceEngagementEvent
