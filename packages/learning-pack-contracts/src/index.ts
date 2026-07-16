/**
 * Public entry point for Learning Pack Contract v0.1.
 *
 * Consumers should import all shared types, schemas, validators, diagnostics,
 * and helper utilities from this module instead of duplicating contract types
 * inside application code.
 */

export {
  PUBLIC_JSON_FILE_PATHS,
  REQUIRED_JSON_FILE_PATHS,
  SCHEMA_VERSION,
  SUPPORTED_CAPABILITIES,
} from './constants.js'

export {
  LearningPackErrorCode,
  hasBlockingDiagnostics,
  makeDiagnostic,
} from './errors.js'

export type {
  DiagnosticSeverity,
  LearningPackDiagnostic,
  ValidationResult,
} from './errors.js'

export {
  canPreserveMasteryAcrossRevision,
  checkCapabilities,
  compareLearningRevision,
  compareResourceRevisions,
  createResourceGlobalKey,
  hasCapability,
  isValidAssetPath,
  isValidLocalEntityId,
  isValidPackId,
  makeGlobalEntityKey,
  makeVersionedItemKey,
  parseGlobalEntityKey,
  planPackUpdate,
  planResourceUpdate,
} from './helpers.js'

export type {
  CapabilityCheckOptions,
  CapabilityCheckResult,
  GlobalEntityKeyParts,
  InstalledPackRecord,
  InstalledResourceRecord,
  PackUpdateAction,
  PackUpdatePlan,
  ResourceUpdateAction,
  ResourceUpdatePlan,
  VersionedItemKeyParts,
} from './helpers.js'

export {
  catalogSchema,
  coursesSchema,
  itemsSchema,
  migrationsSchema,
  packManifestSchema,
  publicJsonSchemas,
  resourceEngagementEventSchema,
  resourcesSchema,
  reviewEventSchema,
  setsSchema,
  themeSchema,
} from './schemas.js'

export type { JsonSchema } from './schemas.js'

export { getJsonSchema, validateJsonFile } from './structural-validation.js'

export type {
  PublicJsonFileKind,
  StructuralValidationOptions,
} from './structural-validation.js'

export {
  validateLearningPackDocuments,
  validateLearningPackSemantics,
} from './semantic-validation.js'

export type { LearningPackValidationOptions } from './semantic-validation.js'

export {
  validateReviewEvent,
  validateReviewEventSemantics,
} from './review-event-validation.js'

export type { ReviewEventValidationOptions } from './review-event-validation.js'

export {
  validateResourceEngagementEvent,
  validateResourceEngagementEventSemantics,
} from './resource-engagement-validation.js'

export type { ResourceEngagementEventValidationOptions } from './resource-engagement-validation.js'

export {
  createInvalidCapabilityFixture,
  createInvalidDuplicateIdFixture,
  createInvalidMissingReferenceFixture,
  createValidLearningPackFixture,
  validLearningPackFixture,
} from './fixtures.js'

export {
  createLogicFoundationsGoldenFixture,
  createLogicFoundationsProjectionSnapshots,
  createLogicFoundationsRelease,
  expectedLogicFoundationsGlobalEntityKeys,
  resolveStudySetItemIds,
} from './logic-foundations-golden.js'

export type {
  CurriculumNavigationNode,
  CurriculumNavigationSnapshot,
  FlashcardProjectionSnapshot,
  LogicFoundationsGoldenFixture,
  LogicFoundationsMasteryResetExample,
  LogicFoundationsProjectionSnapshots,
  LogicFoundationsReleaseVersion,
  LogicFoundationsUpdateScenario,
  QuizProjectionSnapshot,
  StudySetSelectionSnapshot,
  SubjectFilteringSnapshot,
} from './logic-foundations-golden.js'

export {
  createContractValidatorConformanceAdapter,
  runLearningPackConformanceChecks,
} from './conformance.js'

export type {
  ConformanceAcceptedPackResult,
  ConformanceRejectedPackResult,
  LearningPackConformanceAdapter,
  LearningPackConformanceCheck,
  LearningPackConformanceReport,
} from './conformance.js'

export type {
  AuthorRecord,
  BackgroundRole,
  CalloutRole,
  CapabilityDeclaration,
  CapabilityId,
  CatalogDocument,
  ChoiceOption,
  Concept,
  ContentBlock,
  ContentBlockKind,
  Course,
  CoursesDocument,
  CurriculumEntry,
  CurriculumNode,
  CurriculumNodeKind,
  EvaluationDefinition,
  EvaluationKind,
  ExplicitStudySetSelection,
  JsonObject,
  JsonPrimitive,
  JsonValue,
  LearningEvidenceEvent,
  LearningItem,
  LearningPackDocuments,
  LearningPackManifest,
  LearningResource,
  LearningResourceDifficulty,
  LearningResourceModality,
  LearningResourceRole,
  LearningResourceSource,
  MigrationChangeKind,
  MigrationEntityKind,
  MigrationEntityMapping,
  MigrationsDocument,
  NumberInputDefinition,
  Objective,
  PackCapabilities,
  PackFileManifestEntry,
  PackFileRole,
  PackMigration,
  PlayMode,
  ProgressPolicy,
  ResourceAccessibility,
  ResourceContentOwnership,
  ResourceEngagementAction,
  ResourceEngagementEvent,
  ResourceEngagementMeasurement,
  ResourceEngagementPolicy,
  ResourceLink,
  ResourceLinkRole,
  ResourceProvenance,
  ResourceRecommendedUse,
  ResourceSegment,
  ResourcesDocument,
  ResponseDefinition,
  ResponseKind,
  ReviewEvent,
  ReviewEventPrivacyMetadata,
  ReviewEventResponseKind,
  ReviewEventResponseSummary,
  ReviewEventResult,
  RuleStudySetSelection,
  SchemaVersion,
  SelfGrade,
  SetsDocument,
  StudySet,
  StudySetKind,
  StudySetOrdering,
  StudySetRuleExclusion,
  StudySetRuleScope,
  StudySetSelection,
  Subject,
  TextInputDefinition,
  ThemeMetadata,
} from './types.js'
