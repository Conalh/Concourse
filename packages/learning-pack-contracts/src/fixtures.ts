import { SCHEMA_VERSION } from './constants.js'
import type { LearningPackDocuments } from './types.js'

const hash = '0'.repeat(64)

export function createValidLearningPackFixture(): LearningPackDocuments {
  return {
    manifest: {
      schemaVersion: SCHEMA_VERSION,
      packId: 'learnt.logic-basics-core',
      version: '0.1.0',
      title: 'Logic Basics Core',
      summary: 'Boolean values, operators, and compound decision rules.',
      language: 'en-US',
      license: 'proprietary-review-required',
      authors: [{ name: 'Learnt' }],
      releasedAt: '2026-06-23T00:00:00.000Z',
      capabilities: {
        required: [
          { capabilityId: 'core.learning-pack', version: SCHEMA_VERSION },
        ],
        optional: [],
      },
      files: [
        {
          assetId: null,
          path: 'catalog.json',
          role: 'catalog',
          mediaType: 'application/json',
          sha256: hash,
          bytes: 100,
        },
        {
          assetId: null,
          path: 'courses.json',
          role: 'courses',
          mediaType: 'application/json',
          sha256: hash,
          bytes: 100,
        },
        {
          assetId: null,
          path: 'items.json',
          role: 'items',
          mediaType: 'application/json',
          sha256: hash,
          bytes: 100,
        },
        {
          assetId: null,
          path: 'sets.json',
          role: 'sets',
          mediaType: 'application/json',
          sha256: hash,
          bytes: 100,
        },
        {
          assetId: 'cover',
          path: 'assets/cover.png',
          role: 'asset',
          mediaType: 'image/png',
          sha256: hash,
          bytes: 100,
        },
      ],
    },
    catalog: {
      schemaVersion: SCHEMA_VERSION,
      subjects: [
        {
          subjectId: 'logic-basics',
          title: 'Logic Basics',
          summary: 'Core boolean logic concepts.',
          tags: ['logic'],
          conceptIds: ['boolean-values'],
          objectiveIds: ['predict-negation'],
          courseIds: ['logic-basics-core'],
        },
      ],
      concepts: [
        {
          conceptId: 'boolean-values',
          title: 'Boolean Values',
          summary: 'Truth values used in logical expressions.',
          tags: ['logic'],
          prerequisiteConceptIds: [],
          relatedConceptIds: [],
        },
      ],
      objectives: [
        {
          objectiveId: 'predict-negation',
          statement: 'Predict the result of negating a boolean value.',
          successCriteria: ['Select the correct negated value.'],
          conceptIds: ['boolean-values'],
        },
      ],
    },
    courses: {
      schemaVersion: SCHEMA_VERSION,
      courses: [
        {
          courseId: 'logic-basics-core',
          title: 'Logic Basics Core',
          summary: 'A short course on foundational boolean logic.',
          subjectIds: ['logic-basics'],
          tags: ['logic'],
          rootNodes: [
            {
              nodeId: 'boolean-module',
              kind: 'module',
              title: 'Boolean Module',
              summary: 'Boolean values and negation.',
              itemIds: ['predict-negation-item'],
              conceptIds: ['boolean-values'],
              objectiveIds: ['predict-negation'],
              children: [],
              customKindLabel: null,
            },
          ],
        },
      ],
    },
    items: {
      schemaVersion: SCHEMA_VERSION,
      items: [
        {
          itemId: 'predict-negation-item',
          learningRevision: 1,
          title: 'Predict NOT true',
          promptBlocks: [
            {
              kind: 'question',
              text: 'What is NOT true?',
              language: null,
              calloutRole: null,
              assetId: null,
              altText: null,
            },
          ],
          response: {
            kind: 'single-choice',
            options: [
              { optionId: 'option-true', label: 'true', contentBlocks: [] },
              { optionId: 'option-false', label: 'false', contentBlocks: [] },
            ],
            textInput: null,
            numberInput: null,
          },
          evaluation: {
            kind: 'choice-selection',
            correctOptionIds: ['option-false'],
            acceptedAnswers: [],
            caseSensitive: false,
            trimWhitespace: true,
            expectedNumber: null,
            absoluteTolerance: null,
            passingSelfGrades: [],
          },
          reviewedSolutionBlocks: [
            {
              kind: 'text',
              text: 'NOT true evaluates to false.',
              language: null,
              calloutRole: null,
              assetId: null,
              altText: null,
            },
          ],
          conceptIds: ['boolean-values'],
          objectiveIds: ['predict-negation'],
          allowedPlayModes: ['single-choice-quiz', 'flashcard'],
        },
      ],
    },
    sets: {
      schemaVersion: SCHEMA_VERSION,
      sets: [
        {
          setId: 'logic-basics-deck',
          kind: 'deck',
          title: 'Logic Basics Deck',
          summary: 'Reusable deck for boolean logic practice.',
          selection: {
            kind: 'explicit',
            itemIds: ['predict-negation-item'],
          },
          playModes: ['flashcard', 'single-choice-quiz'],
          ordering: 'authored',
          timeLimitSeconds: null,
          attemptLimit: null,
        },
      ],
    },
  }
}

export function createInvalidDuplicateIdFixture(): LearningPackDocuments {
  const fixture = createValidLearningPackFixture()
  fixture.catalog.concepts.push({
    conceptId: 'boolean-values',
    title: 'Duplicate Boolean Values',
    summary: 'Duplicate concept ID fixture.',
    tags: [],
    prerequisiteConceptIds: [],
    relatedConceptIds: [],
  })
  return fixture
}

export function createInvalidMissingReferenceFixture(): LearningPackDocuments {
  const fixture = createValidLearningPackFixture()
  fixture.items.items[0]?.conceptIds.push('missing-concept')
  return fixture
}

export function createInvalidCapabilityFixture(): LearningPackDocuments {
  const fixture = createValidLearningPackFixture()
  fixture.manifest.capabilities.required.push({
    capabilityId: 'vendor.executable-renderer',
    version: '9.9',
  })
  return fixture
}

export const validLearningPackFixture = createValidLearningPackFixture()
