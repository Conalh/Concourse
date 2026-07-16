import { SCHEMA_VERSION } from './constants.js'
import { makeGlobalEntityKey, planPackUpdate } from './helpers.js'
import type {
  ContentBlock,
  Course,
  CurriculumNode,
  EvaluationDefinition,
  LearningItem,
  LearningPackDocuments,
  LearningResource,
  PackFileManifestEntry,
  PackMigration,
  PlayMode,
  ResponseDefinition,
  StudySet,
  StudySetSelection,
} from './types.js'

export type LogicFoundationsReleaseVersion =
  | '1.0.0'
  | '1.0.1'
  | '1.1.0'
  | '2.0.0'

export interface FlashcardProjectionSnapshot {
  releaseVersion: LogicFoundationsReleaseVersion
  cards: Array<{
    itemId: string
    title: string
    frontText: string
    solutionText: string
    conceptIds: string[]
    objectiveIds: string[]
  }>
}

export interface QuizProjectionSnapshot {
  releaseVersion: LogicFoundationsReleaseVersion
  questions: Array<{
    itemId: string
    playMode: PlayMode
    promptText: string
    optionIds: string[]
    correctOptionIds: string[]
    acceptedAnswers: string[]
    expectedNumber: number | null
    absoluteTolerance: number | null
  }>
}

export interface CurriculumNavigationSnapshot {
  releaseVersion: LogicFoundationsReleaseVersion
  courses: Array<{
    courseId: string
    title: string
    nodes: CurriculumNavigationNode[]
  }>
}

export interface CurriculumNavigationNode {
  nodeId: string
  kind: string
  title: string
  itemIds: string[]
  children: CurriculumNavigationNode[]
}

export interface SubjectFilteringSnapshot {
  releaseVersion: LogicFoundationsReleaseVersion
  subjects: Array<{
    subjectId: string
    courseIds: string[]
    conceptIds: string[]
    objectiveIds: string[]
    itemIds: string[]
  }>
}

export interface StudySetSelectionSnapshot {
  releaseVersion: LogicFoundationsReleaseVersion
  sets: Array<{
    setId: string
    selectionKind: StudySetSelection['kind']
    resolvedItemIds: string[]
    playModes: PlayMode[]
  }>
}

export interface LogicFoundationsProjectionSnapshots {
  flashcardMode: FlashcardProjectionSnapshot
  quizMode: QuizProjectionSnapshot
  curriculumNavigation: CurriculumNavigationSnapshot
  subjectFiltering: SubjectFilteringSnapshot
  studySetSelection: StudySetSelectionSnapshot
}

export interface LogicFoundationsMasteryResetExample {
  fromVersion: '1.1.0'
  toVersion: '2.0.0'
  itemId: 'item-negation-single-choice'
  fromLearningRevision: 1
  toLearningRevision: 2
  progressPolicy: 'reset-mastery'
  expectedBehavior: 'retain-review-history-reset-current-mastery'
}

export interface LogicFoundationsUpdateScenario {
  name: string
  installed: Array<{
    packId: string
    version: string
    files: Array<Pick<PackFileManifestEntry, 'path' | 'sha256'>>
  }>
  nextVersion: LogicFoundationsReleaseVersion
  expectedAction: ReturnType<typeof planPackUpdate>['action']
  conflictFileHash?: boolean
  expectedConflictingFiles?: string[]
}

export interface LogicFoundationsGoldenFixture {
  releases: Record<LogicFoundationsReleaseVersion, LearningPackDocuments>
  invalidPacks: {
    missingReference: Partial<LearningPackDocuments>
    embeddedLearnerProgress: Partial<LearningPackDocuments>
  }
  projectionSnapshots: LogicFoundationsProjectionSnapshots
  masteryResetExample: LogicFoundationsMasteryResetExample
  updateScenarios: LogicFoundationsUpdateScenario[]
}

const packId = 'learnt.logic-foundations'
const hashByVersion: Record<LogicFoundationsReleaseVersion, string> = {
  '1.0.0': '1'.repeat(64),
  '1.0.1': '2'.repeat(64),
  '1.1.0': '3'.repeat(64),
  '2.0.0': '4'.repeat(64),
}

export function createLogicFoundationsGoldenFixture(): LogicFoundationsGoldenFixture {
  const releases = {
    '1.0.0': createRelease('1.0.0'),
    '1.0.1': createRelease('1.0.1'),
    '1.1.0': createRelease('1.1.0'),
    '2.0.0': createRelease('2.0.0'),
  } satisfies Record<LogicFoundationsReleaseVersion, LearningPackDocuments>

  return {
    releases,
    invalidPacks: {
      missingReference: createMissingReferencePack(),
      embeddedLearnerProgress: createEmbeddedLearnerProgressPack(),
    },
    projectionSnapshots: createProjectionSnapshots(releases['2.0.0']),
    masteryResetExample: {
      fromVersion: '1.1.0',
      toVersion: '2.0.0',
      itemId: 'item-negation-single-choice',
      fromLearningRevision: 1,
      toLearningRevision: 2,
      progressPolicy: 'reset-mastery',
      expectedBehavior: 'retain-review-history-reset-current-mastery',
    },
    updateScenarios: createUpdateScenarios(releases),
  }
}

export function createLogicFoundationsRelease(
  version: LogicFoundationsReleaseVersion,
): LearningPackDocuments {
  return createRelease(version)
}

export function createLogicFoundationsProjectionSnapshots(
  pack: LearningPackDocuments = createRelease('2.0.0'),
): LogicFoundationsProjectionSnapshots {
  return createProjectionSnapshots(pack)
}

export function expectedLogicFoundationsGlobalEntityKeys(
  pack: LearningPackDocuments,
): string[] {
  const ids = [
    ...pack.catalog.subjects.map((subject) => subject.subjectId),
    ...pack.catalog.concepts.map((concept) => concept.conceptId),
    ...pack.catalog.objectives.map((objective) => objective.objectiveId),
    ...pack.courses.courses.map((course) => course.courseId),
    ...pack.courses.courses.flatMap((course) =>
      flattenNodes(course.rootNodes).map((node) => node.nodeId),
    ),
    ...pack.items.items.map((item) => item.itemId),
    ...pack.sets.sets.map((set) => set.setId),
    ...(pack.resources
      ? pack.resources.resources.flatMap((resource) => [
          resource.id,
          ...(resource.segments ?? []).map(
            (segment) => `${resource.id}/${segment.id}`,
          ),
        ])
      : []),
    ...(pack.theme ? [pack.theme.themeId] : []),
    ...pack.manifest.files.flatMap((file) =>
      file.assetId ? [file.assetId] : [],
    ),
  ]

  return ids.map((id) => makeGlobalEntityKey(pack.manifest.packId, id)).sort()
}

function createRelease(
  version: LogicFoundationsReleaseVersion,
): LearningPackDocuments {
  const includeAddedItems = version === '1.1.0' || version === '2.0.0'
  const includeResources = version === '1.1.0' || version === '2.0.0'
  const isPatch = version === '1.0.1'
  const isMajor = version === '2.0.0'
  const items = createItems({
    includeAddedItems,
    includeResources,
    isPatch,
    isMajor,
  })
  const courses = createCourses(includeAddedItems, includeResources)
  const sets = createStudySets(includeAddedItems)
  const resources = includeResources ? createResources(isMajor) : undefined
  const migrations = isMajor ? createMigrations() : undefined

  return {
    manifest: {
      schemaVersion: SCHEMA_VERSION,
      packId,
      version,
      title: 'Logic Foundations',
      summary: isPatch
        ? 'Logic foundations with clarified wording and progress-preserving metadata additions.'
        : 'Core propositional logic and proof foundations for portable study.',
      language: 'en-US',
      license: 'CC-BY-4.0',
      authors: [{ name: 'Learnt' }],
      releasedAt: releaseDate(version),
      capabilities: {
        required: [
          { capabilityId: 'core.learning-pack', version: SCHEMA_VERSION },
        ],
        optional: [
          { capabilityId: 'theme.metadata', version: SCHEMA_VERSION },
          { capabilityId: 'assets.static', version: SCHEMA_VERSION },
          ...(includeResources ? resourceCapabilities() : []),
          ...(isMajor
            ? [{ capabilityId: 'migrations.basic', version: SCHEMA_VERSION }]
            : []),
        ],
      },
      files: createManifestFiles(
        version,
        resources !== undefined,
        migrations !== undefined,
      ),
      keywords: ['logic', 'proofs', 'truth tables', 'foundations'],
    },
    catalog: {
      schemaVersion: SCHEMA_VERSION,
      subjects: [
        {
          subjectId: 'subject-propositional-logic',
          title: 'Propositional Logic',
          summary: isPatch
            ? 'Truth values, connectives, and truth-table reasoning.'
            : 'Truth values, logical connectives, and truth-table reasoning.',
          tags: ['logic', 'truth-tables'],
          conceptIds: [
            'concept-truth-values',
            'concept-propositions',
            'concept-logical-connectives',
            'concept-truth-tables',
          ],
          objectiveIds: [
            'objective-recognize-truth-values',
            'objective-evaluate-negation',
            'objective-build-truth-table',
          ],
          courseIds: ['course-logic-core'],
        },
        {
          subjectId: 'subject-proof-strategies',
          title: 'Proof Strategies',
          summary: 'Validity, soundness, and argument checking.',
          tags: ['logic', 'proofs'],
          conceptIds: [
            'concept-truth-values',
            'concept-validity',
            'concept-soundness',
          ],
          objectiveIds: [
            'objective-identify-valid-argument',
            'objective-explain-soundness',
          ],
          courseIds: ['course-proof-practice'],
        },
      ],
      concepts: [
        {
          conceptId: 'concept-truth-values',
          title: 'Truth Values',
          summary: 'The values true and false used to evaluate propositions.',
          tags: ['shared', 'foundations'],
          prerequisiteConceptIds: [],
          relatedConceptIds: ['concept-propositions', 'concept-validity'],
          ...(includeResources
            ? {
                resourceLinks: [
                  {
                    resourceId: 'resource-logic-reading',
                    segmentId: 'segment-reading-intro',
                    role: 'primary',
                    recommendedUse: 'before-attempt',
                    priority: 10,
                  },
                  {
                    resourceId: 'resource-logic-article',
                    role: 'alternative-explanation',
                    recommendedUse: 'after-incorrect',
                    priority: 60,
                  },
                  {
                    resourceId: 'resource-negation-video',
                    segmentId: 'segment-video-worked-example',
                    role: 'worked-example',
                    recommendedUse: 'during-review',
                    priority: 20,
                  },
                ],
              }
            : {}),
        },
        {
          conceptId: 'concept-propositions',
          title: 'Propositions',
          summary: 'Statements that can be evaluated as true or false.',
          tags: ['statements'],
          prerequisiteConceptIds: ['concept-truth-values'],
          relatedConceptIds: [
            'concept-logical-connectives',
            'concept-validity',
          ],
        },
        {
          conceptId: 'concept-logical-connectives',
          title: 'Logical Connectives',
          summary: 'Operators such as NOT, AND, OR, and IF-THEN.',
          tags: ['operators'],
          prerequisiteConceptIds: ['concept-propositions'],
          relatedConceptIds: ['concept-truth-tables'],
        },
        {
          conceptId: 'concept-truth-tables',
          title: 'Truth Tables',
          summary: 'Rows that enumerate possible truth-value assignments.',
          tags: ['tables'],
          prerequisiteConceptIds: ['concept-logical-connectives'],
          relatedConceptIds: ['concept-validity'],
        },
        {
          conceptId: 'concept-validity',
          title: 'Validity',
          summary:
            'A valid argument cannot have true premises and a false conclusion.',
          tags: ['arguments'],
          prerequisiteConceptIds: ['concept-propositions'],
          relatedConceptIds: ['concept-soundness', 'concept-truth-tables'],
        },
        {
          conceptId: 'concept-soundness',
          title: 'Soundness',
          summary: 'A sound argument is valid and has true premises.',
          tags: ['arguments'],
          prerequisiteConceptIds: ['concept-validity'],
          relatedConceptIds: ['concept-truth-values'],
        },
      ],
      objectives: [
        {
          objectiveId: 'objective-recognize-truth-values',
          statement: 'Recognize true and false as truth values.',
          successCriteria: ['Distinguish truth values from ordinary labels.'],
          conceptIds: ['concept-truth-values'],
          ...(includeResources
            ? {
                resourceLinks: [
                  {
                    resourceId: 'resource-logic-reading',
                    role: 'explanation',
                    recommendedUse: 'before-attempt',
                  },
                ],
              }
            : {}),
        },
        {
          objectiveId: 'objective-evaluate-negation',
          statement: 'Evaluate the negation of a proposition.',
          successCriteria: [
            'Select the opposite truth value for NOT statements.',
          ],
          conceptIds: ['concept-truth-values', 'concept-logical-connectives'],
        },
        {
          objectiveId: 'objective-build-truth-table',
          statement: 'Determine the row count for a truth table.',
          successCriteria: [
            'Compute rows from the number of atomic propositions.',
          ],
          conceptIds: ['concept-truth-tables'],
        },
        {
          objectiveId: 'objective-identify-valid-argument',
          statement: 'Identify the condition that makes an argument valid.',
          successCriteria: [
            'Name validity from true-premise false-conclusion impossibility.',
          ],
          conceptIds: ['concept-validity'],
        },
        {
          objectiveId: 'objective-explain-soundness',
          statement: 'Explain how soundness relates to validity and truth.',
          successCriteria: ['State both required parts of soundness.'],
          conceptIds: ['concept-soundness', 'concept-validity'],
        },
      ],
    },
    courses: {
      schemaVersion: SCHEMA_VERSION,
      courses,
    },
    items: {
      schemaVersion: SCHEMA_VERSION,
      items,
    },
    sets: {
      schemaVersion: SCHEMA_VERSION,
      sets,
    },
    ...(resources
      ? { resources: { schemaVersion: SCHEMA_VERSION, resources } }
      : {}),
    theme: {
      schemaVersion: SCHEMA_VERSION,
      themeId: 'theme-logic-foundations',
      displayName: 'Logic Foundations',
      accentColor: '#3366CC',
      backgroundRole: 'system',
      iconAssetId: 'asset-logic-icon',
      coverAssetId: 'asset-logic-cover',
    },
    ...(migrations ? { migrations } : {}),
  }
}

function createCourses(
  includeAddedItems: boolean,
  includeResources: boolean,
): Course[] {
  return [
    {
      courseId: 'course-logic-core',
      title: 'Logic Core',
      summary:
        'A structured path through truth values, connectives, and tables.',
      subjectIds: ['subject-propositional-logic'],
      tags: ['logic', 'core'],
      rootNodes: [
        moduleNode('node-core-module', 'Core Logic Module', [
          chapterNode('node-core-truth-chapter', 'Truth Values Chapter', [
            lessonNode(
              'node-core-truth-values-lesson',
              'Truth Values Lesson',
              ['item-truth-values-flashcard', 'item-negation-single-choice'],
              ['concept-truth-values'],
              [
                'objective-recognize-truth-values',
                'objective-evaluate-negation',
              ],
              includeResources
                ? [
                    { kind: 'resource', resourceId: 'resource-logic-reading' },
                    { kind: 'item', itemId: 'item-truth-values-flashcard' },
                    {
                      kind: 'resource',
                      resourceId: 'resource-negation-video',
                      segmentId: 'segment-video-worked-example',
                    },
                    { kind: 'study-set', studySetId: 'set-core-quiz' },
                    { kind: 'item', itemId: 'item-negation-single-choice' },
                  ]
                : undefined,
            ),
          ]),
          chapterNode('node-core-tables-chapter', 'Truth Tables Chapter', [
            lessonNode(
              'node-core-connectives-lesson',
              'Connectives Lesson',
              [
                'item-connectives-multiple-choice',
                'item-truth-table-row-count',
                ...(includeAddedItems
                  ? ['item-conditional-single-choice']
                  : []),
              ],
              ['concept-logical-connectives', 'concept-truth-tables'],
              ['objective-build-truth-table'],
              includeResources
                ? [
                    {
                      kind: 'resource',
                      resourceId: 'resource-truth-table-demo',
                    },
                    {
                      kind: 'item',
                      itemId: 'item-connectives-multiple-choice',
                    },
                    { kind: 'study-set', studySetId: 'set-core-quiz' },
                  ]
                : undefined,
            ),
          ]),
        ]),
      ],
    },
    {
      courseId: 'course-proof-practice',
      title: 'Proof Practice',
      summary: 'A practical path through validity and soundness checks.',
      subjectIds: ['subject-proof-strategies'],
      tags: ['logic', 'proofs'],
      rootNodes: [
        moduleNode('node-proof-module', 'Proof Strategies Module', [
          chapterNode('node-proof-validity-chapter', 'Validity Chapter', [
            lessonNode(
              'node-proof-validity-lesson',
              'Validity Lesson',
              [
                'item-validity-text-recall',
                ...(includeAddedItems ? ['item-validity-flashcard'] : []),
              ],
              ['concept-validity', 'concept-truth-values'],
              ['objective-identify-valid-argument'],
            ),
          ]),
          chapterNode('node-proof-soundness-chapter', 'Soundness Chapter', [
            lessonNode(
              'node-proof-soundness-lesson',
              'Soundness Lesson',
              ['item-soundness-manual-read'],
              ['concept-soundness', 'concept-validity'],
              ['objective-explain-soundness'],
            ),
          ]),
        ]),
      ],
    },
  ]
}

function resourceCapabilities(): Array<{
  capabilityId: string
  version: string
}> {
  return [
    { capabilityId: 'learning-resource.embedded-content', version: '1' },
    { capabilityId: 'learning-resource.external-link', version: '1' },
    { capabilityId: 'learning-resource.external-video', version: '1' },
    { capabilityId: 'learning-resource.external-audio', version: '1' },
    { capabilityId: 'learning-resource.bibliographic-reference', version: '1' },
    { capabilityId: 'learning-resource.interactive-reference', version: '1' },
    { capabilityId: 'learning-resource.segments', version: '1' },
    { capabilityId: 'learning-resource.checkpoints', version: '1' },
    { capabilityId: 'curriculum.ordered-resource-entries', version: '1' },
  ]
}

function createResources(isMajor: boolean): LearningResource[] {
  return [
    {
      id: 'resource-logic-reading',
      contentRevision: isMajor ? 2 : 1,
      title: 'Five-Minute Logic Reading',
      summary: isMajor
        ? 'A revised pack-native reading that introduces truth values and negation checkpoints.'
        : 'A pack-native reading that introduces truth values and negation checkpoints.',
      modality: 'text',
      roles: ['introduction', 'explanation'],
      conceptIds: ['concept-truth-values', 'concept-propositions'],
      objectiveIds: [
        'objective-recognize-truth-values',
        'objective-evaluate-negation',
      ],
      estimatedDurationSeconds: 300,
      difficulty: 'introductory',
      language: 'en-US',
      source: {
        kind: 'embedded-content',
        content: [
          {
            ...textBlock(
              'A proposition is a statement that can be evaluated as true or false.',
            ),
            blockId: 'block-reading-intro',
          },
          {
            ...calloutBlock(
              'Negation flips the truth value of a proposition.',
              'definition',
            ),
            blockId: 'block-reading-negation',
          },
        ],
      },
      segments: [
        {
          id: 'segment-reading-intro',
          title: 'Truth-value intuition',
          summary: 'Introduces propositions and truth values.',
          contentBlockStartId: 'block-reading-intro',
          contentBlockEndId: 'block-reading-negation',
          conceptIds: ['concept-truth-values'],
          objectiveIds: ['objective-recognize-truth-values'],
          checkpointStudySetIds: ['set-core-quiz'],
          tags: ['reading'],
        },
      ],
      checkpointStudySetIds: ['set-core-quiz'],
      tags: ['reading', 'intro'],
      provenance: {
        author: 'Learnt',
        license: 'CC-BY-4.0',
        attributionText: 'Logic reading by Learnt.',
        contentOwnership: 'pack-authored',
      },
      accessibility: {
        screenReaderOptimized: true,
        textAlternativeAvailable: true,
        language: 'en-US',
      },
      metadata: { fixturePurpose: 'embedded-reading' },
    },
    {
      id: 'resource-logic-article',
      contentRevision: 1,
      title: 'External Article On Propositions',
      summary: 'A curated external article for alternate explanation.',
      modality: 'text',
      roles: ['remediation', 'reference'],
      source: {
        kind: 'external-link',
        url: 'https://example.com/logic/propositions',
        providerName: 'Example University',
        contentTypeHint: 'article',
      },
      tags: ['article'],
      provenance: {
        sourceTitle: 'Example University Logic Notes',
        canonicalUrl: 'https://example.com/logic/propositions',
        contentOwnership: 'external-link-only',
      },
    },
    {
      id: 'resource-negation-video',
      contentRevision: 1,
      title: 'Negation Walkthrough Video',
      summary: 'A safe external video locator with timestamped key moments.',
      modality: 'video',
      roles: ['demonstration', 'worked-example'],
      conceptIds: ['concept-truth-values', 'concept-logical-connectives'],
      objectiveIds: ['objective-evaluate-negation'],
      estimatedDurationSeconds: 420,
      source: {
        kind: 'external-video',
        provider: 'youtube',
        mediaId: 'dQw4w9WgXcQ',
        canonicalUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        startSeconds: 0,
        endSeconds: 420,
      },
      segments: [
        {
          id: 'segment-video-intro',
          title: 'Negation setup',
          startSeconds: 10,
          endSeconds: 90,
          conceptIds: ['concept-truth-values'],
          objectiveIds: ['objective-evaluate-negation'],
          checkpointStudySetIds: [],
          tags: ['video'],
        },
        {
          id: 'segment-video-worked-example',
          title: 'Worked NOT example',
          startSeconds: 91,
          endSeconds: 180,
          conceptIds: ['concept-truth-values', 'concept-logical-connectives'],
          objectiveIds: ['objective-evaluate-negation'],
          checkpointStudySetIds: ['set-core-quiz'],
          tags: ['worked-example'],
        },
      ],
      provenance: {
        sourceTitle: 'Negation Walkthrough',
        canonicalUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        contentOwnership: 'external-link-only',
      },
      accessibility: {
        captionsAvailable: true,
        transcriptAvailable: false,
        language: 'en-US',
      },
    },
    {
      id: 'resource-logic-podcast',
      contentRevision: 1,
      title: 'Logic Podcast Segment',
      modality: 'audio',
      roles: ['enrichment'],
      source: {
        kind: 'external-audio',
        provider: 'example-podcast',
        mediaId: 'logic-episode-1',
        canonicalUrl: 'https://example.com/podcasts/logic-episode-1',
        startSeconds: 30,
        endSeconds: 240,
      },
      provenance: {
        sourceTitle: 'Logic Podcast',
        contentOwnership: 'external-link-only',
      },
      accessibility: {
        transcriptAvailable: true,
        language: 'en-US',
      },
    },
    {
      id: 'resource-logic-book-chapter',
      contentRevision: 1,
      title: 'Logic Textbook Chapter',
      modality: 'text',
      roles: ['reference'],
      source: {
        kind: 'bibliographic-reference',
        title: 'Introduction to Logic',
        authors: ['A. Author'],
        publisher: 'Example Press',
        publicationYear: 2020,
        chapter: 'Chapter 1',
        pageRange: '1-24',
        canonicalUrl: 'https://example.com/books/intro-logic',
        citationText: 'A. Author, Introduction to Logic, Chapter 1.',
      },
      provenance: {
        sourceTitle: 'Introduction to Logic',
        contentOwnership: 'external-link-only',
      },
    },
    {
      id: 'resource-truth-table-demo',
      contentRevision: 1,
      title: 'Truth Table Sandbox',
      modality: 'interactive',
      roles: ['demonstration', 'worked-example'],
      conceptIds: ['concept-truth-tables'],
      objectiveIds: ['objective-build-truth-table'],
      source: {
        kind: 'interactive-reference',
        url: 'https://example.com/sandboxes/truth-table',
        providerName: 'Example Sandbox',
        interactionSummary:
          'Learners toggle proposition values to observe truth-table rows.',
        requiredEnvironment: 'modern browser',
      },
      provenance: {
        sourceTitle: 'Truth Table Sandbox',
        contentOwnership: 'external-link-only',
      },
      accessibility: {
        accessibilityNotes: 'External sandbox accessibility is provider-owned.',
      },
    },
  ]
}

function createItems(options: {
  includeAddedItems: boolean
  includeResources: boolean
  isPatch: boolean
  isMajor: boolean
}): LearningItem[] {
  const negationPrompt = options.isMajor
    ? 'What is NOT false?'
    : options.isPatch
      ? 'What truth value results from NOT true?'
      : 'What is NOT true?'
  const negationCorrect = options.isMajor ? 'option-true' : 'option-false'
  const negationSolution = options.isMajor
    ? 'NOT false evaluates to true, so prior mastery for NOT true must be reset.'
    : 'NOT true evaluates to false.'

  return [
    {
      itemId: 'item-truth-values-flashcard',
      learningRevision: 1,
      title: 'Truth Values',
      promptBlocks: [
        questionBlock(
          'What are the two basic truth values in propositional logic?',
        ),
      ],
      response: selfGradeResponse(),
      evaluation: selfGradeEvaluation(),
      reviewedSolutionBlocks: [
        textBlock('The two basic truth values are true and false.'),
        calloutBlock(
          'A proposition is evaluated using exactly one truth value at a time.',
          'definition',
        ),
      ],
      conceptIds: ['concept-truth-values'],
      objectiveIds: ['objective-recognize-truth-values'],
      allowedPlayModes: ['flashcard', 'self-grade-review'],
    },
    {
      itemId: 'item-negation-single-choice',
      learningRevision: options.isMajor ? 2 : 1,
      title: options.isMajor ? 'Evaluate NOT false' : 'Evaluate NOT true',
      promptBlocks: [questionBlock(negationPrompt)],
      response: choiceResponse('single-choice', [
        ['option-true', 'true'],
        ['option-false', 'false'],
      ]),
      evaluation: choiceEvaluation([negationCorrect]),
      reviewedSolutionBlocks: [textBlock(negationSolution)],
      conceptIds: ['concept-truth-values', 'concept-logical-connectives'],
      objectiveIds: ['objective-evaluate-negation'],
      allowedPlayModes: ['single-choice-quiz', 'flashcard'],
      ...(options.includeResources
        ? {
            supportResourceLinks: [
              {
                resourceId: 'resource-logic-reading',
                segmentId: 'segment-reading-intro',
                role: 'remediation',
                recommendedUse: 'after-incorrect',
                priority: 5,
              },
            ],
          }
        : {}),
    },
    {
      itemId: 'item-connectives-multiple-choice',
      learningRevision: 1,
      title: 'Identify Binary Connectives',
      promptBlocks: [
        questionBlock('Which connectives combine two propositions?'),
      ],
      response: choiceResponse('multiple-choice', [
        ['option-and', 'AND'],
        ['option-or', 'OR'],
        ['option-not', 'NOT'],
        ['option-if-then', 'IF-THEN'],
      ]),
      evaluation: choiceEvaluation([
        'option-and',
        'option-or',
        'option-if-then',
      ]),
      reviewedSolutionBlocks: [
        textBlock(
          'AND, OR, and IF-THEN combine two propositions; NOT applies to one proposition.',
        ),
      ],
      conceptIds: ['concept-logical-connectives'],
      objectiveIds: ['objective-build-truth-table'],
      allowedPlayModes: ['multiple-choice-quiz', 'flashcard'],
    },
    {
      itemId: 'item-validity-text-recall',
      learningRevision: 1,
      title: 'Name the Argument Property',
      promptBlocks: [
        questionBlock(
          'What property means an argument cannot have true premises and a false conclusion?',
        ),
      ],
      response: {
        kind: 'text',
        options: [],
        textInput: {
          placeholder: 'property name',
          minLength: 3,
          maxLength: 32,
        },
        numberInput: null,
      },
      evaluation: {
        kind: 'exact-text',
        correctOptionIds: [],
        acceptedAnswers: ['validity', 'valid'],
        caseSensitive: false,
        trimWhitespace: true,
        expectedNumber: null,
        absoluteTolerance: null,
        passingSelfGrades: [],
      },
      reviewedSolutionBlocks: [
        textBlock(
          'The property is validity. A valid argument rules out true premises with a false conclusion.',
        ),
      ],
      conceptIds: ['concept-validity'],
      objectiveIds: ['objective-identify-valid-argument'],
      allowedPlayModes: ['text-recall', 'flashcard'],
    },
    {
      itemId: 'item-truth-table-row-count',
      learningRevision: 1,
      title: 'Truth Table Rows',
      promptBlocks: [
        questionBlock(
          'How many rows does a truth table with two atomic propositions have?',
        ),
      ],
      response: {
        kind: 'number',
        options: [],
        textInput: null,
        numberInput: {
          placeholder: 'row count',
          unitLabel: 'rows',
          min: 0,
          max: 16,
        },
      },
      evaluation: {
        kind: 'numerical-tolerance',
        correctOptionIds: [],
        acceptedAnswers: [],
        caseSensitive: false,
        trimWhitespace: true,
        expectedNumber: 4,
        absoluteTolerance: 0,
        passingSelfGrades: [],
      },
      reviewedSolutionBlocks: [
        textBlock(
          'Two atomic propositions produce 2^2 rows, so the truth table has 4 rows.',
        ),
      ],
      conceptIds: ['concept-truth-tables', 'concept-truth-values'],
      objectiveIds: ['objective-build-truth-table'],
      allowedPlayModes: ['number-recall', 'flashcard'],
    },
    {
      itemId: 'item-soundness-manual-read',
      learningRevision: 1,
      title: 'Soundness Reading',
      promptBlocks: [
        textBlock(
          'Read the definition of soundness and compare it with validity.',
        ),
        imageBlock('asset-logic-cover', 'Logic foundations cover image'),
      ],
      response: noResponse(),
      evaluation: manualEvaluation(),
      reviewedSolutionBlocks: [
        textBlock('Soundness requires validity plus actually true premises.'),
        calloutBlock(
          'A sound argument is always valid, but a valid argument need not be sound.',
          'tip',
        ),
      ],
      conceptIds: [
        'concept-soundness',
        'concept-validity',
        'concept-truth-values',
      ],
      objectiveIds: ['objective-explain-soundness'],
      allowedPlayModes: ['manual-read'],
    },
    ...(options.includeAddedItems ? createAddedItems() : []),
  ]
}

function createAddedItems(): LearningItem[] {
  return [
    {
      itemId: 'item-conditional-single-choice',
      learningRevision: 1,
      title: 'Conditional False Case',
      promptBlocks: [questionBlock('When is IF P THEN Q false?')],
      response: choiceResponse('single-choice', [
        ['option-p-true-q-false', 'P is true and Q is false'],
        ['option-p-false-q-true', 'P is false and Q is true'],
        ['option-p-false-q-false', 'P is false and Q is false'],
      ]),
      evaluation: choiceEvaluation(['option-p-true-q-false']),
      reviewedSolutionBlocks: [
        textBlock(
          'A conditional is false only when the antecedent is true and the consequent is false.',
        ),
      ],
      conceptIds: ['concept-logical-connectives', 'concept-truth-tables'],
      objectiveIds: ['objective-build-truth-table'],
      allowedPlayModes: ['single-choice-quiz', 'flashcard'],
    },
    {
      itemId: 'item-validity-flashcard',
      learningRevision: 1,
      title: 'Validity Flashcard',
      promptBlocks: [
        questionBlock(
          'What does validity preserve from premises to conclusion?',
        ),
      ],
      response: selfGradeResponse(),
      evaluation: selfGradeEvaluation(),
      reviewedSolutionBlocks: [
        textBlock(
          'Validity preserves truth conditionally: if the premises are true, the conclusion cannot be false.',
        ),
      ],
      conceptIds: ['concept-validity', 'concept-truth-values'],
      objectiveIds: ['objective-identify-valid-argument'],
      allowedPlayModes: ['flashcard', 'self-grade-review'],
    },
  ]
}

function createStudySets(includeAddedItems: boolean): StudySet[] {
  return [
    {
      setId: 'set-logic-flashcards',
      kind: 'deck',
      title: 'Logic Flashcards',
      summary: 'Reusable flashcards for shared logic concepts.',
      selection: {
        kind: 'explicit',
        itemIds: [
          'item-truth-values-flashcard',
          'item-negation-single-choice',
          'item-validity-text-recall',
          ...(includeAddedItems ? ['item-validity-flashcard'] : []),
        ],
      },
      playModes: ['flashcard'],
      ordering: 'authored',
      timeLimitSeconds: null,
      attemptLimit: null,
    },
    {
      setId: 'set-core-quiz',
      kind: 'quiz',
      title: 'Core Logic Quiz',
      summary: 'Quiz items selected from the core logic course.',
      selection: {
        kind: 'rule',
        include: {
          subjectIds: ['subject-propositional-logic'],
          courseIds: ['course-logic-core'],
          nodeIds: ['node-core-connectives-lesson'],
          conceptIds: ['concept-logical-connectives'],
          objectiveIds: [],
          allowedPlayModes: [
            'single-choice-quiz',
            'multiple-choice-quiz',
            'number-recall',
          ],
          tags: [],
        },
        exclude: {
          itemIds: [],
          conceptIds: [],
          objectiveIds: [],
          tags: [],
        },
        limit: 10,
      },
      playModes: [
        'single-choice-quiz',
        'multiple-choice-quiz',
        'number-recall',
      ],
      ordering: 'shuffle',
      timeLimitSeconds: 600,
      attemptLimit: null,
    },
  ]
}

function createMigrations(): {
  schemaVersion: typeof SCHEMA_VERSION
  migrations: PackMigration[]
} {
  return {
    schemaVersion: SCHEMA_VERSION,
    migrations: [
      {
        fromVersion: '1.1.0',
        toVersion: '2.0.0',
        notes:
          'Version 2.0.0 revises the negation prompt. Review history is retained, but current mastery resets for the revised item.',
        entityMappings: [
          {
            entityKind: 'item',
            fromId: 'item-truth-values-flashcard',
            toId: 'item-truth-values-flashcard',
            changeKind: 'unchanged',
            fromLearningRevision: 1,
            toLearningRevision: 1,
            progressPolicy: 'preserve',
            rationale: 'No educational meaning changed.',
          },
          {
            entityKind: 'item',
            fromId: 'item-negation-single-choice',
            toId: 'item-negation-single-choice',
            changeKind: 'revised',
            fromLearningRevision: 1,
            toLearningRevision: 2,
            progressPolicy: 'reset-mastery',
            rationale:
              'The prompt and correct answer changed from NOT true to NOT false.',
          },
          {
            entityKind: 'item',
            fromId: 'item-connectives-multiple-choice',
            toId: 'item-connectives-multiple-choice',
            changeKind: 'unchanged',
            fromLearningRevision: 1,
            toLearningRevision: 1,
            progressPolicy: 'preserve',
            rationale: 'No educational meaning changed.',
          },
          {
            entityKind: 'item',
            fromId: 'item-validity-text-recall',
            toId: 'item-validity-text-recall',
            changeKind: 'unchanged',
            fromLearningRevision: 1,
            toLearningRevision: 1,
            progressPolicy: 'preserve',
            rationale: 'No educational meaning changed.',
          },
          {
            entityKind: 'item',
            fromId: 'item-truth-table-row-count',
            toId: 'item-truth-table-row-count',
            changeKind: 'unchanged',
            fromLearningRevision: 1,
            toLearningRevision: 1,
            progressPolicy: 'preserve',
            rationale: 'No educational meaning changed.',
          },
          {
            entityKind: 'item',
            fromId: 'item-soundness-manual-read',
            toId: 'item-soundness-manual-read',
            changeKind: 'unchanged',
            fromLearningRevision: 1,
            toLearningRevision: 1,
            progressPolicy: 'preserve',
            rationale: 'No educational meaning changed.',
          },
          {
            entityKind: 'course',
            fromId: 'course-logic-core',
            toId: 'course-logic-core',
            changeKind: 'unchanged',
            fromLearningRevision: null,
            toLearningRevision: null,
            progressPolicy: 'preserve',
            rationale: 'Course identity did not change.',
          },
          {
            entityKind: 'resource',
            fromId: 'resource-logic-reading',
            toId: 'resource-logic-reading',
            changeKind: 'revised',
            fromLearningRevision: null,
            toLearningRevision: null,
            fromContentRevision: 1,
            toContentRevision: 2,
            progressPolicy: 'manual-review',
            engagementPolicy: 'preserve-history-reset-completion',
            rationale:
              'The reading was revised; engagement history remains, but completion can be treated as stale.',
          },
        ],
      },
    ],
  }
}

function createProjectionSnapshots(
  pack: LearningPackDocuments,
): LogicFoundationsProjectionSnapshots {
  const releaseVersion = pack.manifest.version as LogicFoundationsReleaseVersion
  return {
    flashcardMode: {
      releaseVersion,
      cards: pack.items.items
        .filter((item) => item.allowedPlayModes.includes('flashcard'))
        .map((item) => ({
          itemId: item.itemId,
          title: item.title,
          frontText: blockText(item.promptBlocks),
          solutionText: blockText(item.reviewedSolutionBlocks),
          conceptIds: item.conceptIds,
          objectiveIds: item.objectiveIds,
        })),
    },
    quizMode: {
      releaseVersion,
      questions: pack.items.items.flatMap((item) =>
        item.allowedPlayModes
          .filter((mode) => isQuizMode(mode))
          .map((playMode) => ({
            itemId: item.itemId,
            playMode,
            promptText: blockText(item.promptBlocks),
            optionIds: item.response.options.map((option) => option.optionId),
            correctOptionIds: item.evaluation.correctOptionIds,
            acceptedAnswers: item.evaluation.acceptedAnswers,
            expectedNumber: item.evaluation.expectedNumber,
            absoluteTolerance: item.evaluation.absoluteTolerance,
          })),
      ),
    },
    curriculumNavigation: {
      releaseVersion,
      courses: pack.courses.courses.map((course) => ({
        courseId: course.courseId,
        title: course.title,
        nodes: course.rootNodes.map(toNavigationNode),
      })),
    },
    subjectFiltering: {
      releaseVersion,
      subjects: pack.catalog.subjects.map((subject) => ({
        subjectId: subject.subjectId,
        courseIds: subject.courseIds,
        conceptIds: subject.conceptIds,
        objectiveIds: subject.objectiveIds,
        itemIds: itemIdsForSubject(pack, subject.courseIds),
      })),
    },
    studySetSelection: {
      releaseVersion,
      sets: pack.sets.sets.map((set) => ({
        setId: set.setId,
        selectionKind: set.selection.kind,
        resolvedItemIds: resolveStudySetItemIds(pack, set),
        playModes: set.playModes,
      })),
    },
  }
}

export function resolveStudySetItemIds(
  pack: LearningPackDocuments,
  set: StudySet,
): string[] {
  if (set.selection.kind === 'explicit') {
    return set.selection.itemIds
  }

  const nodeItemIds = itemIdsForNodes(pack, set.selection.include.nodeIds)
  const courseItemIds = itemIdsForCourses(pack, set.selection.include.courseIds)
  const subjectItemIds = itemIdsForSubjectIds(
    pack,
    set.selection.include.subjectIds,
  )

  const resolved = pack.items.items
    .filter((item) => {
      const include =
        set.selection.kind === 'rule' ? set.selection.include : undefined
      const exclude =
        set.selection.kind === 'rule' ? set.selection.exclude : undefined
      if (!include || !exclude) {
        return false
      }
      if (include.nodeIds.length > 0 && !nodeItemIds.has(item.itemId)) {
        return false
      }
      if (include.courseIds.length > 0 && !courseItemIds.has(item.itemId)) {
        return false
      }
      if (include.subjectIds.length > 0 && !subjectItemIds.has(item.itemId)) {
        return false
      }
      if (
        include.conceptIds.length > 0 &&
        !item.conceptIds.some((id) => include.conceptIds.includes(id))
      ) {
        return false
      }
      if (
        include.objectiveIds.length > 0 &&
        !item.objectiveIds.some((id) => include.objectiveIds.includes(id))
      ) {
        return false
      }
      if (
        include.allowedPlayModes.length > 0 &&
        !item.allowedPlayModes.some((mode) =>
          include.allowedPlayModes.includes(mode),
        )
      ) {
        return false
      }
      if (exclude.itemIds.includes(item.itemId)) {
        return false
      }
      if (item.conceptIds.some((id) => exclude.conceptIds.includes(id))) {
        return false
      }
      if (item.objectiveIds.some((id) => exclude.objectiveIds.includes(id))) {
        return false
      }
      return true
    })
    .map((item) => item.itemId)

  return set.selection.limit === null
    ? resolved
    : resolved.slice(0, set.selection.limit)
}

function createMissingReferencePack(): Partial<LearningPackDocuments> {
  const pack = createRelease('1.0.0')
  pack.items.items[0]?.conceptIds.push('concept-missing')
  return pack
}

function createEmbeddedLearnerProgressPack(): Partial<LearningPackDocuments> {
  const pack = createRelease('1.0.0') as Partial<LearningPackDocuments> & {
    items: { items: Array<LearningItem & { reviewEvents?: unknown[] }> }
  }
  pack.items.items[0]!.reviewEvents = [
    {
      eventId: 'forbidden-progress-event',
      itemId: 'item-truth-values-flashcard',
      learningRevision: 1,
    },
  ]
  return pack
}

function createUpdateScenarios(
  releases: Record<LogicFoundationsReleaseVersion, LearningPackDocuments>,
): LogicFoundationsUpdateScenario[] {
  const installed100 = [installedRecord(releases['1.0.0'])]
  const installed101 = [installedRecord(releases['1.0.1'])]
  const conflicting100 = structuredClone(releases['1.0.0'].manifest)
  conflicting100.files[0]!.sha256 = '9'.repeat(64)

  return [
    {
      name: 'fresh-install',
      installed: [],
      nextVersion: '1.0.0',
      expectedAction: planPackUpdate([], releases['1.0.0'].manifest).action,
    },
    {
      name: 'idempotent-install',
      installed: installed100,
      nextVersion: '1.0.0',
      expectedAction: planPackUpdate(installed100, releases['1.0.0'].manifest)
        .action,
    },
    {
      name: 'patch-update',
      installed: installed100,
      nextVersion: '1.0.1',
      expectedAction: planPackUpdate(installed100, releases['1.0.1'].manifest)
        .action,
    },
    {
      name: 'minor-update',
      installed: installed101,
      nextVersion: '1.1.0',
      expectedAction: planPackUpdate(installed101, releases['1.1.0'].manifest)
        .action,
    },
    {
      name: 'major-update-with-migration',
      installed: [installedRecord(releases['1.1.0'])],
      nextVersion: '2.0.0',
      expectedAction: planPackUpdate(
        [installedRecord(releases['1.1.0'])],
        releases['2.0.0'].manifest,
      ).action,
    },
    {
      name: 'immutable-version-conflict',
      installed: installed100,
      nextVersion: '1.0.0',
      expectedAction: planPackUpdate(installed100, conflicting100).action,
      conflictFileHash: true,
      expectedConflictingFiles: ['catalog.json'],
    },
  ]
}

function installedRecord(pack: LearningPackDocuments): {
  packId: string
  version: string
  files: Array<Pick<PackFileManifestEntry, 'path' | 'sha256'>>
} {
  return {
    packId: pack.manifest.packId,
    version: pack.manifest.version,
    files: pack.manifest.files.map((file) => ({
      path: file.path,
      sha256: file.sha256,
    })),
  }
}

function releaseDate(version: LogicFoundationsReleaseVersion): string {
  switch (version) {
    case '1.0.0':
      return '2026-06-23T00:00:00.000Z'
    case '1.0.1':
      return '2026-06-24T00:00:00.000Z'
    case '1.1.0':
      return '2026-07-01T00:00:00.000Z'
    case '2.0.0':
      return '2026-08-01T00:00:00.000Z'
  }
}

function createManifestFiles(
  version: LogicFoundationsReleaseVersion,
  includeResources: boolean,
  includeMigrations: boolean,
): PackFileManifestEntry[] {
  const hash = hashByVersion[version]
  return [
    jsonFile('catalog.json', 'catalog', hash),
    jsonFile('courses.json', 'courses', hash),
    jsonFile('items.json', 'items', hash),
    jsonFile('sets.json', 'sets', hash),
    ...(includeResources
      ? [jsonFile('resources.json', 'resources', hash)]
      : []),
    jsonFile('theme.json', 'theme', hash),
    ...(includeMigrations
      ? [jsonFile('migrations.json', 'migrations', hash)]
      : []),
    assetFile(
      'asset-logic-cover',
      'assets/logic-cover.svg',
      'image/svg+xml',
      hash,
    ),
    assetFile(
      'asset-logic-icon',
      'assets/logic-icon.svg',
      'image/svg+xml',
      hash,
    ),
  ]
}

function jsonFile(
  path: string,
  role: PackFileManifestEntry['role'],
  sha256: string,
): PackFileManifestEntry {
  return {
    assetId: null,
    path,
    role,
    mediaType: 'application/json',
    sha256,
    bytes: 1000,
  }
}

function assetFile(
  assetId: string,
  path: string,
  mediaType: string,
  sha256: string,
): PackFileManifestEntry {
  return {
    assetId,
    path,
    role: 'asset',
    mediaType,
    sha256,
    bytes: 256,
  }
}

function moduleNode(
  nodeId: string,
  title: string,
  children: CurriculumNode[],
): CurriculumNode {
  return {
    nodeId,
    kind: 'module',
    title,
    summary: title,
    itemIds: [],
    conceptIds: childConceptIds(children),
    objectiveIds: childObjectiveIds(children),
    children,
    customKindLabel: null,
  }
}

function chapterNode(
  nodeId: string,
  title: string,
  children: CurriculumNode[],
): CurriculumNode {
  return {
    nodeId,
    kind: 'chapter',
    title,
    summary: title,
    itemIds: [],
    conceptIds: childConceptIds(children),
    objectiveIds: childObjectiveIds(children),
    children,
    customKindLabel: null,
  }
}

function lessonNode(
  nodeId: string,
  title: string,
  itemIds: string[],
  conceptIds: string[],
  objectiveIds: string[],
  entries?: CurriculumNode['entries'],
): CurriculumNode {
  return {
    nodeId,
    kind: 'lesson',
    title,
    summary: title,
    itemIds,
    conceptIds,
    objectiveIds,
    children: [],
    ...(entries ? { entries } : {}),
    customKindLabel: null,
  }
}

function childConceptIds(children: CurriculumNode[]): string[] {
  return [...new Set(children.flatMap((child) => child.conceptIds))]
}

function childObjectiveIds(children: CurriculumNode[]): string[] {
  return [...new Set(children.flatMap((child) => child.objectiveIds))]
}

function questionBlock(text: string): ContentBlock {
  return {
    kind: 'question',
    text,
    language: null,
    calloutRole: null,
    assetId: null,
    altText: null,
  }
}

function textBlock(text: string): ContentBlock {
  return {
    kind: 'text',
    text,
    language: null,
    calloutRole: null,
    assetId: null,
    altText: null,
  }
}

function calloutBlock(
  text: string,
  calloutRole: NonNullable<ContentBlock['calloutRole']>,
): ContentBlock {
  return {
    kind: 'callout',
    text,
    language: null,
    calloutRole,
    assetId: null,
    altText: null,
  }
}

function imageBlock(assetId: string, altText: string): ContentBlock {
  return {
    kind: 'image',
    text: '',
    language: null,
    calloutRole: null,
    assetId,
    altText,
  }
}

function choiceResponse(
  kind: 'single-choice' | 'multiple-choice',
  options: Array<[string, string]>,
): ResponseDefinition {
  return {
    kind,
    options: options.map(([optionId, label]) => ({
      optionId,
      label,
      contentBlocks: [],
    })),
    textInput: null,
    numberInput: null,
  }
}

function choiceEvaluation(correctOptionIds: string[]): EvaluationDefinition {
  return {
    kind: 'choice-selection',
    correctOptionIds,
    acceptedAnswers: [],
    caseSensitive: false,
    trimWhitespace: true,
    expectedNumber: null,
    absoluteTolerance: null,
    passingSelfGrades: [],
  }
}

function selfGradeResponse(): ResponseDefinition {
  return {
    kind: 'self-grade',
    options: [],
    textInput: null,
    numberInput: null,
  }
}

function selfGradeEvaluation(): EvaluationDefinition {
  return {
    kind: 'self-grade',
    correctOptionIds: [],
    acceptedAnswers: [],
    caseSensitive: false,
    trimWhitespace: true,
    expectedNumber: null,
    absoluteTolerance: null,
    passingSelfGrades: ['good', 'easy'],
  }
}

function noResponse(): ResponseDefinition {
  return {
    kind: 'none',
    options: [],
    textInput: null,
    numberInput: null,
  }
}

function manualEvaluation(): EvaluationDefinition {
  return {
    kind: 'manual-completion',
    correctOptionIds: [],
    acceptedAnswers: [],
    caseSensitive: false,
    trimWhitespace: true,
    expectedNumber: null,
    absoluteTolerance: null,
    passingSelfGrades: [],
  }
}

function isQuizMode(playMode: PlayMode): boolean {
  return (
    playMode === 'single-choice-quiz' ||
    playMode === 'multiple-choice-quiz' ||
    playMode === 'text-recall' ||
    playMode === 'number-recall'
  )
}

function blockText(blocks: readonly ContentBlock[]): string {
  return blocks
    .map((block) => block.text)
    .filter((text) => text.trim().length > 0)
    .join('\n')
}

function toNavigationNode(node: CurriculumNode): CurriculumNavigationNode {
  return {
    nodeId: node.nodeId,
    kind: node.kind,
    title: node.title,
    itemIds: node.itemIds,
    children: node.children.map(toNavigationNode),
  }
}

function itemIdsForSubject(
  pack: LearningPackDocuments,
  courseIds: readonly string[],
): string[] {
  return [...itemIdsForCourses(pack, courseIds)]
}

function itemIdsForSubjectIds(
  pack: LearningPackDocuments,
  subjectIds: readonly string[],
): Set<string> {
  const courseIds = pack.courses.courses
    .filter((course) =>
      course.subjectIds.some((subjectId) => subjectIds.includes(subjectId)),
    )
    .map((course) => course.courseId)
  return itemIdsForCourses(pack, courseIds)
}

function itemIdsForCourses(
  pack: LearningPackDocuments,
  courseIds: readonly string[],
): Set<string> {
  return new Set(
    pack.courses.courses
      .filter((course) => courseIds.includes(course.courseId))
      .flatMap((course) => flattenNodes(course.rootNodes))
      .flatMap((node) => node.itemIds),
  )
}

function itemIdsForNodes(
  pack: LearningPackDocuments,
  nodeIds: readonly string[],
): Set<string> {
  return new Set(
    pack.courses.courses
      .flatMap((course) => flattenNodes(course.rootNodes))
      .filter((node) => nodeIds.includes(node.nodeId))
      .flatMap((node) => node.itemIds),
  )
}

function flattenNodes(nodes: readonly CurriculumNode[]): CurriculumNode[] {
  return nodes.flatMap((node) => [node, ...flattenNodes(node.children)])
}
