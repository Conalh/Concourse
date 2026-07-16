import { SCHEMA_VERSION } from './constants.js'

export type JsonSchema = Record<string, unknown>

const schemaUriBase = 'https://learnt.dev/schemas/learning-pack/v0.1'
const localIdPattern = '^[a-z0-9][a-z0-9._/-]{0,127}$'
const packIdPattern = '^[a-z0-9]+([.-][a-z0-9]+)*$'
const sha256Pattern = '^[a-f0-9]{64}$'
const hexColorPattern = '^#[0-9A-Fa-f]{6}$'

const stringArray = {
  type: 'array',
  items: { type: 'string' },
} as const

const localIdArray = {
  type: 'array',
  items: { type: 'string', pattern: localIdPattern },
} as const

const nullableString = {
  anyOf: [{ type: 'string' }, { type: 'null' }],
} as const

const nullableNonnegativeInteger = {
  anyOf: [{ type: 'integer', minimum: 0 }, { type: 'null' }],
} as const

const nullableNumber = {
  anyOf: [{ type: 'number' }, { type: 'null' }],
} as const

const nullableJsonObject = {
  anyOf: [{ type: 'object', additionalProperties: true }, { type: 'null' }],
} as const

const capabilityDeclaration = {
  type: 'object',
  additionalProperties: false,
  required: ['capabilityId', 'version'],
  properties: {
    capabilityId: { type: 'string', minLength: 1 },
    version: { type: 'string', minLength: 1 },
  },
} as const

const contentBlock = {
  type: 'object',
  additionalProperties: false,
  required: ['kind', 'text', 'language', 'calloutRole', 'assetId', 'altText'],
  properties: {
    blockId: { type: 'string', pattern: localIdPattern },
    kind: {
      enum: [
        'text',
        'question',
        'code',
        'equation',
        'callout',
        'image',
        'audio',
      ],
    },
    text: { type: 'string' },
    language: nullableString,
    calloutRole: {
      anyOf: [
        { enum: ['note', 'tip', 'warning', 'definition'] },
        { type: 'null' },
      ],
    },
    assetId: {
      anyOf: [{ type: 'string', pattern: localIdPattern }, { type: 'null' }],
    },
    altText: nullableString,
  },
} as const

const resourceLink = {
  type: 'object',
  additionalProperties: false,
  required: ['resourceId', 'role'],
  properties: {
    resourceId: { type: 'string', pattern: localIdPattern },
    segmentId: { type: 'string', pattern: localIdPattern },
    role: {
      enum: [
        'primary',
        'prerequisite',
        'explanation',
        'alternative-explanation',
        'demonstration',
        'worked-example',
        'remediation',
        'reference',
        'extension',
      ],
    },
    recommendedUse: {
      enum: [
        'before-attempt',
        'after-attempt',
        'after-incorrect',
        'after-repeated-incorrect',
        'during-review',
        'optional',
      ],
    },
    priority: { type: 'integer', minimum: 0, maximum: 100 },
  },
} as const

const choiceOption = {
  type: 'object',
  additionalProperties: false,
  required: ['optionId', 'label', 'contentBlocks'],
  properties: {
    optionId: { type: 'string', pattern: localIdPattern },
    label: { type: 'string', minLength: 1 },
    contentBlocks: {
      type: 'array',
      items: contentBlock,
    },
  },
} as const

const responseDefinition = {
  type: 'object',
  additionalProperties: false,
  required: ['kind', 'options', 'textInput', 'numberInput'],
  properties: {
    kind: {
      enum: [
        'none',
        'single-choice',
        'multiple-choice',
        'text',
        'number',
        'self-grade',
      ],
    },
    options: {
      type: 'array',
      items: choiceOption,
    },
    textInput: {
      anyOf: [
        {
          type: 'object',
          additionalProperties: false,
          required: ['placeholder', 'minLength', 'maxLength'],
          properties: {
            placeholder: nullableString,
            minLength: nullableNonnegativeInteger,
            maxLength: nullableNonnegativeInteger,
          },
        },
        { type: 'null' },
      ],
    },
    numberInput: {
      anyOf: [
        {
          type: 'object',
          additionalProperties: false,
          required: ['placeholder', 'unitLabel', 'min', 'max'],
          properties: {
            placeholder: nullableString,
            unitLabel: nullableString,
            min: { anyOf: [{ type: 'number' }, { type: 'null' }] },
            max: { anyOf: [{ type: 'number' }, { type: 'null' }] },
          },
        },
        { type: 'null' },
      ],
    },
  },
} as const

const evaluationDefinition = {
  type: 'object',
  additionalProperties: false,
  required: [
    'kind',
    'correctOptionIds',
    'acceptedAnswers',
    'caseSensitive',
    'trimWhitespace',
    'expectedNumber',
    'absoluteTolerance',
    'passingSelfGrades',
  ],
  properties: {
    kind: {
      enum: [
        'manual-completion',
        'choice-selection',
        'exact-text',
        'numerical-tolerance',
        'self-grade',
      ],
    },
    correctOptionIds: localIdArray,
    acceptedAnswers: stringArray,
    caseSensitive: { type: 'boolean' },
    trimWhitespace: { type: 'boolean' },
    expectedNumber: { anyOf: [{ type: 'number' }, { type: 'null' }] },
    absoluteTolerance: {
      anyOf: [{ type: 'number', minimum: 0 }, { type: 'null' }],
    },
    passingSelfGrades: {
      type: 'array',
      items: { enum: ['again', 'hard', 'good', 'easy'] },
    },
  },
} as const

const studySetRuleScope = {
  type: 'object',
  additionalProperties: false,
  required: [
    'subjectIds',
    'courseIds',
    'nodeIds',
    'conceptIds',
    'objectiveIds',
    'allowedPlayModes',
    'tags',
  ],
  properties: {
    subjectIds: localIdArray,
    courseIds: localIdArray,
    nodeIds: localIdArray,
    conceptIds: localIdArray,
    objectiveIds: localIdArray,
    allowedPlayModes: {
      type: 'array',
      items: {
        enum: [
          'flashcard',
          'single-choice-quiz',
          'multiple-choice-quiz',
          'text-recall',
          'number-recall',
          'manual-read',
          'self-grade-review',
        ],
      },
    },
    tags: stringArray,
  },
} as const

const studySetRuleExclusion = {
  type: 'object',
  additionalProperties: false,
  required: ['itemIds', 'conceptIds', 'objectiveIds', 'tags'],
  properties: {
    itemIds: localIdArray,
    conceptIds: localIdArray,
    objectiveIds: localIdArray,
    tags: stringArray,
  },
} as const

export const packManifestSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: `${schemaUriBase}/pack.schema.json`,
  title: 'LearningPackManifest',
  type: 'object',
  additionalProperties: false,
  required: [
    'schemaVersion',
    'packId',
    'version',
    'title',
    'summary',
    'language',
    'license',
    'authors',
    'releasedAt',
    'capabilities',
    'files',
  ],
  properties: {
    schemaVersion: { const: SCHEMA_VERSION },
    packId: { type: 'string', pattern: packIdPattern },
    version: { type: 'string', minLength: 1 },
    title: { type: 'string', minLength: 1 },
    summary: { type: 'string', minLength: 1 },
    language: { type: 'string', minLength: 2 },
    license: { type: 'string', minLength: 1 },
    authors: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name'],
        properties: {
          name: { type: 'string', minLength: 1 },
          url: { type: 'string', format: 'uri' },
        },
      },
    },
    releasedAt: { type: 'string', format: 'date-time' },
    capabilities: {
      type: 'object',
      additionalProperties: false,
      required: ['required', 'optional'],
      properties: {
        required: {
          type: 'array',
          minItems: 1,
          items: capabilityDeclaration,
        },
        optional: {
          type: 'array',
          items: capabilityDeclaration,
        },
      },
    },
    files: {
      type: 'array',
      minItems: 4,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['assetId', 'path', 'role', 'mediaType', 'sha256', 'bytes'],
        properties: {
          assetId: {
            anyOf: [
              { type: 'string', pattern: localIdPattern },
              { type: 'null' },
            ],
          },
          path: { type: 'string', minLength: 1 },
          role: {
            enum: [
              'catalog',
              'courses',
              'items',
              'sets',
              'resources',
              'theme',
              'migrations',
              'asset',
              'documentation',
            ],
          },
          mediaType: { type: 'string', minLength: 1 },
          sha256: { type: 'string', pattern: sha256Pattern },
          bytes: { type: 'integer', minimum: 0 },
        },
      },
    },
    homepageUrl: { type: 'string', format: 'uri' },
    repositoryUrl: { type: 'string', format: 'uri' },
    supportUrl: { type: 'string', format: 'uri' },
    keywords: stringArray,
  },
} as const satisfies JsonSchema

export const catalogSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: `${schemaUriBase}/catalog.schema.json`,
  title: 'LearningPackCatalog',
  type: 'object',
  additionalProperties: false,
  required: ['schemaVersion', 'subjects', 'concepts', 'objectives'],
  properties: {
    schemaVersion: { const: SCHEMA_VERSION },
    subjects: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'subjectId',
          'title',
          'summary',
          'tags',
          'conceptIds',
          'objectiveIds',
          'courseIds',
        ],
        properties: {
          subjectId: { type: 'string', pattern: localIdPattern },
          title: { type: 'string', minLength: 1 },
          summary: { type: 'string', minLength: 1 },
          tags: stringArray,
          conceptIds: localIdArray,
          objectiveIds: localIdArray,
          courseIds: localIdArray,
        },
      },
    },
    concepts: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'conceptId',
          'title',
          'summary',
          'tags',
          'prerequisiteConceptIds',
          'relatedConceptIds',
        ],
        properties: {
          conceptId: { type: 'string', pattern: localIdPattern },
          title: { type: 'string', minLength: 1 },
          summary: { type: 'string', minLength: 1 },
          tags: stringArray,
          prerequisiteConceptIds: localIdArray,
          relatedConceptIds: localIdArray,
          resourceLinks: {
            type: 'array',
            items: resourceLink,
          },
        },
      },
    },
    objectives: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['objectiveId', 'statement', 'successCriteria', 'conceptIds'],
        properties: {
          objectiveId: { type: 'string', pattern: localIdPattern },
          statement: { type: 'string', minLength: 1 },
          successCriteria: {
            type: 'array',
            items: { type: 'string', minLength: 1 },
          },
          conceptIds: localIdArray,
          resourceLinks: {
            type: 'array',
            items: resourceLink,
          },
        },
      },
    },
  },
} as const satisfies JsonSchema

const curriculumEntrySchema = {
  oneOf: [
    {
      type: 'object',
      additionalProperties: false,
      required: ['kind', 'nodeId'],
      properties: {
        kind: { const: 'child-node' },
        nodeId: { type: 'string', pattern: localIdPattern },
      },
    },
    {
      type: 'object',
      additionalProperties: false,
      required: ['kind', 'resourceId'],
      properties: {
        kind: { const: 'resource' },
        resourceId: { type: 'string', pattern: localIdPattern },
        segmentId: { type: 'string', pattern: localIdPattern },
      },
    },
    {
      type: 'object',
      additionalProperties: false,
      required: ['kind', 'itemId'],
      properties: {
        kind: { const: 'item' },
        itemId: { type: 'string', pattern: localIdPattern },
      },
    },
    {
      type: 'object',
      additionalProperties: false,
      required: ['kind', 'studySetId'],
      properties: {
        kind: { const: 'study-set' },
        studySetId: { type: 'string', pattern: localIdPattern },
      },
    },
  ],
} as const

const curriculumNodeSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'nodeId',
    'kind',
    'title',
    'summary',
    'itemIds',
    'conceptIds',
    'objectiveIds',
    'children',
    'customKindLabel',
  ],
  properties: {
    nodeId: { type: 'string', pattern: localIdPattern },
    kind: {
      enum: ['module', 'unit', 'chapter', 'lesson', 'section', 'custom'],
    },
    title: { type: 'string', minLength: 1 },
    summary: { type: 'string', minLength: 1 },
    itemIds: localIdArray,
    conceptIds: localIdArray,
    objectiveIds: localIdArray,
    children: {
      type: 'array',
      items: { $ref: '#/$defs/curriculumNode' },
    },
    entries: {
      type: 'array',
      items: curriculumEntrySchema,
    },
    customKindLabel: nullableString,
  },
}

export const coursesSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: `${schemaUriBase}/courses.schema.json`,
  title: 'LearningPackCourses',
  type: 'object',
  additionalProperties: false,
  required: ['schemaVersion', 'courses'],
  $defs: {
    curriculumNode: curriculumNodeSchema,
  },
  properties: {
    schemaVersion: { const: SCHEMA_VERSION },
    courses: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'courseId',
          'title',
          'summary',
          'subjectIds',
          'tags',
          'rootNodes',
        ],
        properties: {
          courseId: { type: 'string', pattern: localIdPattern },
          title: { type: 'string', minLength: 1 },
          summary: { type: 'string', minLength: 1 },
          subjectIds: localIdArray,
          tags: stringArray,
          rootNodes: {
            type: 'array',
            items: { $ref: '#/$defs/curriculumNode' },
          },
        },
      },
    },
  },
} as const satisfies JsonSchema

export const itemsSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: `${schemaUriBase}/items.schema.json`,
  title: 'LearningPackItems',
  type: 'object',
  additionalProperties: false,
  required: ['schemaVersion', 'items'],
  properties: {
    schemaVersion: { const: SCHEMA_VERSION },
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'itemId',
          'learningRevision',
          'title',
          'promptBlocks',
          'response',
          'evaluation',
          'reviewedSolutionBlocks',
          'conceptIds',
          'objectiveIds',
          'allowedPlayModes',
        ],
        properties: {
          itemId: { type: 'string', pattern: localIdPattern },
          learningRevision: { type: 'integer', minimum: 1 },
          title: { type: 'string', minLength: 1 },
          promptBlocks: {
            type: 'array',
            items: contentBlock,
          },
          response: responseDefinition,
          evaluation: evaluationDefinition,
          reviewedSolutionBlocks: {
            type: 'array',
            items: contentBlock,
          },
          conceptIds: localIdArray,
          objectiveIds: localIdArray,
          allowedPlayModes: {
            type: 'array',
            items: {
              enum: [
                'flashcard',
                'single-choice-quiz',
                'multiple-choice-quiz',
                'text-recall',
                'number-recall',
                'manual-read',
                'self-grade-review',
              ],
            },
          },
          supportResourceLinks: {
            type: 'array',
            items: resourceLink,
          },
        },
      },
    },
  },
} as const satisfies JsonSchema

export const setsSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: `${schemaUriBase}/sets.schema.json`,
  title: 'LearningPackSets',
  type: 'object',
  additionalProperties: false,
  required: ['schemaVersion', 'sets'],
  properties: {
    schemaVersion: { const: SCHEMA_VERSION },
    sets: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'setId',
          'kind',
          'title',
          'summary',
          'selection',
          'playModes',
          'ordering',
          'timeLimitSeconds',
          'attemptLimit',
        ],
        properties: {
          setId: { type: 'string', pattern: localIdPattern },
          kind: { enum: ['deck', 'quiz', 'review', 'practice', 'exam'] },
          title: { type: 'string', minLength: 1 },
          summary: { type: 'string', minLength: 1 },
          selection: {
            oneOf: [
              {
                type: 'object',
                additionalProperties: false,
                required: ['kind', 'itemIds'],
                properties: {
                  kind: { const: 'explicit' },
                  itemIds: localIdArray,
                },
              },
              {
                type: 'object',
                additionalProperties: false,
                required: ['kind', 'include', 'exclude', 'limit'],
                properties: {
                  kind: { const: 'rule' },
                  include: studySetRuleScope,
                  exclude: studySetRuleExclusion,
                  limit: nullableNonnegativeInteger,
                },
              },
            ],
          },
          playModes: {
            type: 'array',
            items: {
              enum: [
                'flashcard',
                'single-choice-quiz',
                'multiple-choice-quiz',
                'text-recall',
                'number-recall',
                'manual-read',
                'self-grade-review',
              ],
            },
          },
          ordering: { enum: ['authored', 'shuffle', 'adaptive'] },
          timeLimitSeconds: nullableNonnegativeInteger,
          attemptLimit: nullableNonnegativeInteger,
        },
      },
    },
  },
} as const satisfies JsonSchema

const resourceSourceSchema = {
  oneOf: [
    {
      type: 'object',
      additionalProperties: false,
      required: ['kind', 'content'],
      properties: {
        kind: { const: 'embedded-content' },
        content: {
          type: 'array',
          items: contentBlock,
        },
      },
    },
    {
      type: 'object',
      additionalProperties: false,
      required: ['kind', 'url'],
      properties: {
        kind: { const: 'external-link' },
        url: { type: 'string', format: 'uri' },
        providerName: { type: 'string', minLength: 1 },
        contentTypeHint: { type: 'string', minLength: 1 },
      },
    },
    {
      type: 'object',
      additionalProperties: false,
      required: ['kind', 'provider', 'mediaId'],
      properties: {
        kind: { const: 'external-video' },
        provider: { enum: ['youtube', 'vimeo', 'other'] },
        mediaId: { type: 'string', minLength: 1 },
        canonicalUrl: { type: 'string', format: 'uri' },
        startSeconds: { type: 'number', minimum: 0 },
        endSeconds: { type: 'number', minimum: 0 },
      },
    },
    {
      type: 'object',
      additionalProperties: false,
      required: ['kind', 'provider', 'canonicalUrl'],
      properties: {
        kind: { const: 'external-audio' },
        provider: { type: 'string', minLength: 1 },
        mediaId: { type: 'string', minLength: 1 },
        canonicalUrl: { type: 'string', format: 'uri' },
        startSeconds: { type: 'number', minimum: 0 },
        endSeconds: { type: 'number', minimum: 0 },
      },
    },
    {
      type: 'object',
      additionalProperties: false,
      required: ['kind', 'title', 'authors'],
      properties: {
        kind: { const: 'bibliographic-reference' },
        title: { type: 'string', minLength: 1 },
        authors: {
          type: 'array',
          items: { type: 'string', minLength: 1 },
        },
        publisher: { type: 'string', minLength: 1 },
        publicationYear: { type: 'integer', minimum: 0 },
        edition: { type: 'string', minLength: 1 },
        isbn: { type: 'string', minLength: 1 },
        doi: { type: 'string', minLength: 1 },
        chapter: { type: 'string', minLength: 1 },
        pageRange: { type: 'string', minLength: 1 },
        canonicalUrl: { type: 'string', format: 'uri' },
        citationText: { type: 'string', minLength: 1 },
      },
    },
    {
      type: 'object',
      additionalProperties: false,
      required: ['kind', 'url', 'interactionSummary'],
      properties: {
        kind: { const: 'interactive-reference' },
        url: { type: 'string', format: 'uri' },
        providerName: { type: 'string', minLength: 1 },
        interactionSummary: { type: 'string', minLength: 1 },
        requiredEnvironment: { type: 'string', minLength: 1 },
      },
    },
  ],
} as const

const resourceSegmentSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'id',
    'title',
    'conceptIds',
    'objectiveIds',
    'checkpointStudySetIds',
    'tags',
  ],
  properties: {
    id: { type: 'string', pattern: localIdPattern },
    title: { type: 'string', minLength: 1 },
    summary: { type: 'string', minLength: 1 },
    startSeconds: { type: 'number', minimum: 0 },
    endSeconds: { type: 'number', minimum: 0 },
    contentBlockStartId: { type: 'string', pattern: localIdPattern },
    contentBlockEndId: { type: 'string', pattern: localIdPattern },
    conceptIds: localIdArray,
    objectiveIds: localIdArray,
    checkpointStudySetIds: localIdArray,
    tags: stringArray,
  },
} as const

export const resourcesSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: `${schemaUriBase}/resources.schema.json`,
  title: 'LearningPackResources',
  type: 'object',
  additionalProperties: false,
  required: ['schemaVersion', 'resources'],
  properties: {
    schemaVersion: { const: SCHEMA_VERSION },
    resources: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'id',
          'contentRevision',
          'title',
          'modality',
          'roles',
          'source',
        ],
        properties: {
          id: { type: 'string', pattern: localIdPattern },
          contentRevision: { type: 'integer', minimum: 1 },
          title: { type: 'string', minLength: 1 },
          summary: { type: 'string', minLength: 1 },
          modality: {
            enum: ['text', 'video', 'audio', 'interactive', 'mixed'],
          },
          roles: {
            type: 'array',
            minItems: 1,
            items: {
              enum: [
                'introduction',
                'explanation',
                'demonstration',
                'worked-example',
                'remediation',
                'reference',
                'enrichment',
                'summary',
              ],
            },
          },
          conceptIds: localIdArray,
          objectiveIds: localIdArray,
          estimatedDurationSeconds: { type: 'integer', minimum: 0 },
          difficulty: {
            enum: ['introductory', 'foundational', 'intermediate', 'advanced'],
          },
          language: { type: 'string', minLength: 2 },
          source: resourceSourceSchema,
          segments: {
            type: 'array',
            items: resourceSegmentSchema,
          },
          checkpointStudySetIds: localIdArray,
          tags: stringArray,
          provenance: {
            type: 'object',
            additionalProperties: false,
            required: ['contentOwnership'],
            properties: {
              author: { type: 'string', minLength: 1 },
              publisher: { type: 'string', minLength: 1 },
              sourceTitle: { type: 'string', minLength: 1 },
              license: { type: 'string', minLength: 1 },
              licenseUrl: { type: 'string', format: 'uri' },
              canonicalUrl: { type: 'string', format: 'uri' },
              attributionText: { type: 'string', minLength: 1 },
              lastReviewedAt: { type: 'string', format: 'date-time' },
              reviewedBy: { type: 'string', minLength: 1 },
              contentOwnership: {
                enum: [
                  'pack-authored',
                  'licensed-for-redistribution',
                  'public-domain',
                  'external-link-only',
                  'unknown',
                ],
              },
            },
          },
          accessibility: {
            type: 'object',
            additionalProperties: false,
            properties: {
              captionsAvailable: { type: 'boolean' },
              transcriptAvailable: { type: 'boolean' },
              audioDescriptionAvailable: { type: 'boolean' },
              screenReaderOptimized: { type: 'boolean' },
              textAlternativeAvailable: { type: 'boolean' },
              language: { type: 'string', minLength: 2 },
              accessibilityNotes: { type: 'string' },
            },
          },
          metadata: {
            type: 'object',
            additionalProperties: true,
          },
        },
      },
    },
  },
} as const satisfies JsonSchema

export const themeSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: `${schemaUriBase}/theme.schema.json`,
  title: 'LearningPackTheme',
  type: 'object',
  additionalProperties: false,
  required: [
    'schemaVersion',
    'themeId',
    'displayName',
    'accentColor',
    'backgroundRole',
    'iconAssetId',
    'coverAssetId',
  ],
  properties: {
    schemaVersion: { const: SCHEMA_VERSION },
    themeId: { type: 'string', pattern: localIdPattern },
    displayName: { type: 'string', minLength: 1 },
    accentColor: { type: 'string', pattern: hexColorPattern },
    backgroundRole: { enum: ['light', 'dark', 'system'] },
    iconAssetId: {
      anyOf: [{ type: 'string', pattern: localIdPattern }, { type: 'null' }],
    },
    coverAssetId: {
      anyOf: [{ type: 'string', pattern: localIdPattern }, { type: 'null' }],
    },
  },
} as const satisfies JsonSchema

export const migrationsSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: `${schemaUriBase}/migrations.schema.json`,
  title: 'LearningPackMigrations',
  type: 'object',
  additionalProperties: false,
  required: ['schemaVersion', 'migrations'],
  properties: {
    schemaVersion: { const: SCHEMA_VERSION },
    migrations: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['fromVersion', 'toVersion', 'entityMappings', 'notes'],
        properties: {
          fromVersion: { type: 'string', minLength: 1 },
          toVersion: { type: 'string', minLength: 1 },
          entityMappings: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: [
                'entityKind',
                'fromId',
                'toId',
                'changeKind',
                'fromLearningRevision',
                'toLearningRevision',
                'progressPolicy',
                'rationale',
              ],
              properties: {
                entityKind: {
                  enum: [
                    'subject',
                    'course',
                    'curriculum-node',
                    'concept',
                    'objective',
                    'item',
                    'set',
                    'resource',
                    'resource-segment',
                  ],
                },
                fromId: { type: 'string', pattern: localIdPattern },
                toId: {
                  anyOf: [
                    { type: 'string', pattern: localIdPattern },
                    { type: 'null' },
                  ],
                },
                changeKind: {
                  enum: [
                    'unchanged',
                    'renamed',
                    'split',
                    'merged',
                    'removed',
                    'revised',
                  ],
                },
                fromLearningRevision: nullableNonnegativeInteger,
                toLearningRevision: nullableNonnegativeInteger,
                fromContentRevision: nullableNonnegativeInteger,
                toContentRevision: nullableNonnegativeInteger,
                fromSegmentId: {
                  anyOf: [
                    { type: 'string', pattern: localIdPattern },
                    { type: 'null' },
                  ],
                },
                toSegmentId: {
                  anyOf: [
                    { type: 'string', pattern: localIdPattern },
                    { type: 'null' },
                  ],
                },
                progressPolicy: {
                  enum: [
                    'preserve',
                    'reset-mastery',
                    'history-only',
                    'manual-review',
                  ],
                },
                engagementPolicy: {
                  anyOf: [
                    {
                      enum: [
                        'preserve',
                        'preserve-history-reset-completion',
                        'archive',
                        'do-not-transfer',
                      ],
                    },
                    { type: 'null' },
                  ],
                },
                rationale: { type: 'string', minLength: 1 },
              },
            },
          },
          notes: { type: 'string' },
        },
      },
    },
  },
} as const satisfies JsonSchema

export const reviewEventSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: `${schemaUriBase}/review-event.schema.json`,
  title: 'ReviewEvent',
  type: 'object',
  additionalProperties: false,
  required: [
    'schemaVersion',
    'eventId',
    'packId',
    'packVersion',
    'itemId',
    'learningRevision',
    'subjectId',
    'courseId',
    'playMode',
    'responseSummary',
    'result',
    'normalizedScore',
    'responseTimeMs',
    'occurredAt',
    'sourceInstanceId',
    'confusionTargetIds',
    'privacy',
    'extensions',
  ],
  properties: {
    schemaVersion: { const: SCHEMA_VERSION },
    eventId: { type: 'string', pattern: localIdPattern },
    packId: { type: 'string', pattern: packIdPattern },
    packVersion: { type: 'string', minLength: 1 },
    itemId: { type: 'string', pattern: localIdPattern },
    learningRevision: { type: 'integer', minimum: 1 },
    subjectId: {
      anyOf: [{ type: 'string', pattern: localIdPattern }, { type: 'null' }],
    },
    courseId: {
      anyOf: [{ type: 'string', pattern: localIdPattern }, { type: 'null' }],
    },
    playMode: {
      enum: [
        'flashcard',
        'single-choice-quiz',
        'multiple-choice-quiz',
        'text-recall',
        'number-recall',
        'manual-read',
        'self-grade-review',
      ],
    },
    responseSummary: {
      type: 'object',
      additionalProperties: false,
      required: [
        'kind',
        'selectedOptionIds',
        'enteredText',
        'enteredNumber',
        'selfGrade',
        'customSummary',
      ],
      properties: {
        kind: {
          enum: ['none', 'choice', 'text', 'number', 'self-grade', 'custom'],
        },
        selectedOptionIds: localIdArray,
        enteredText: nullableString,
        enteredNumber: nullableNumber,
        selfGrade: {
          anyOf: [
            { enum: ['again', 'hard', 'good', 'easy'] },
            { type: 'null' },
          ],
        },
        customSummary: nullableJsonObject,
      },
    },
    result: {
      enum: ['correct', 'incorrect', 'completed', 'self-graded', 'ungraded'],
    },
    normalizedScore: {
      anyOf: [{ type: 'number', minimum: 0, maximum: 1 }, { type: 'null' }],
    },
    responseTimeMs: nullableNonnegativeInteger,
    occurredAt: { type: 'string', format: 'date-time' },
    sourceInstanceId: { type: 'string', pattern: localIdPattern },
    confusionTargetIds: localIdArray,
    privacy: {
      anyOf: [
        {
          type: 'object',
          additionalProperties: false,
          required: [
            'learnerId',
            'sessionId',
            'sourceAppId',
            'sourceAppVersion',
          ],
          properties: {
            learnerId: nullableString,
            sessionId: nullableString,
            sourceAppId: nullableString,
            sourceAppVersion: nullableString,
          },
        },
        { type: 'null' },
      ],
    },
    extensions: nullableJsonObject,
  },
} as const satisfies JsonSchema

export const resourceEngagementEventSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: `${schemaUriBase}/resource-engagement-event.schema.json`,
  title: 'ResourceEngagementEvent',
  type: 'object',
  additionalProperties: false,
  required: [
    'schemaVersion',
    'eventType',
    'eventId',
    'packId',
    'packVersion',
    'resourceId',
    'contentRevision',
    'segmentId',
    'action',
    'progressRatio',
    'positionSeconds',
    'measurement',
    'occurredAt',
    'sourceInstanceId',
    'metadata',
  ],
  properties: {
    schemaVersion: { const: SCHEMA_VERSION },
    eventType: { const: 'resource-engagement' },
    eventId: { type: 'string', pattern: localIdPattern },
    packId: { type: 'string', pattern: packIdPattern },
    packVersion: { type: 'string', minLength: 1 },
    resourceId: { type: 'string', pattern: localIdPattern },
    contentRevision: { type: 'integer', minimum: 1 },
    segmentId: {
      anyOf: [{ type: 'string', pattern: localIdPattern }, { type: 'null' }],
    },
    action: {
      enum: [
        'opened',
        'started',
        'progressed',
        'completed',
        'revisited',
        'abandoned',
        'marked-complete',
      ],
    },
    progressRatio: {
      anyOf: [{ type: 'number', minimum: 0, maximum: 1 }, { type: 'null' }],
    },
    positionSeconds: {
      anyOf: [{ type: 'number', minimum: 0 }, { type: 'null' }],
    },
    measurement: {
      enum: [
        'self-reported',
        'player-observed',
        'reader-observed',
        'external-return',
        'unknown',
      ],
    },
    occurredAt: { type: 'string', format: 'date-time' },
    sourceInstanceId: { type: 'string', pattern: localIdPattern },
    metadata: nullableJsonObject,
  },
} as const satisfies JsonSchema

export const publicJsonSchemas = {
  pack: packManifestSchema,
  catalog: catalogSchema,
  courses: coursesSchema,
  items: itemsSchema,
  sets: setsSchema,
  resources: resourcesSchema,
  theme: themeSchema,
  migrations: migrationsSchema,
  reviewEvent: reviewEventSchema,
  resourceEngagementEvent: resourceEngagementEventSchema,
} as const
