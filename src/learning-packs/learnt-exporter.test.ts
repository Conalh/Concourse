import {
  createContractValidatorConformanceAdapter,
  runLearningPackConformanceChecks,
  validateLearningPackDocuments,
  type LearningPackDocuments,
} from '@learnt/learning-pack-contracts'
import { describe, expect, it } from 'vitest'

import { defineSubject } from '../subject-sdk'

import { adaptSubjectPackageToLearningPack } from './learnt-exporter'

type TestActivity = Readonly<{
  id: string
  title: string
}> &
  Readonly<Record<string, unknown>>

type TestExtension = Readonly<{
  key: string
  kind: 'renderer' | 'evaluator'
}>

describe('adaptSubjectPackageToLearningPack', () => {
  it('maps supported response kinds and deterministic evaluators into a valid pack', () => {
    const pack = adaptSubjectPackageToLearningPack(
      defineSubject(
        subjectPackage([
          manualActivity(),
          singleChoiceActivity(),
          multipleChoiceActivity(),
          exactTextActivity(),
          numericalActivity(),
        ]),
      ),
    )

    expect(validateLearningPackDocuments(pack).ok).toBe(true)
    expect(pack.manifest.authors).toEqual([{ name: 'Concourse' }])
    expect(pack.catalog.subjects[0]).toMatchObject({
      subjectId: 'export-fixture',
      title: 'Export Fixture',
      conceptIds: ['concept-a'],
      objectiveIds: ['objective-a'],
      courseIds: ['export-fixture-course'],
    })
    expect(pack.courses.courses[0]?.rootNodes[0]).toMatchObject({
      nodeId: 'module-a',
      itemIds: [
        'manual-activity',
        'single-choice-activity',
        'multiple-choice-activity',
        'exact-text-activity',
        'numerical-activity',
      ],
    })

    expect(item(pack, 'manual-activity')).toMatchObject({
      response: { kind: 'none' },
      evaluation: { kind: 'manual-completion' },
      allowedPlayModes: ['manual-read'],
    })
    expect(item(pack, 'single-choice-activity')).toMatchObject({
      response: {
        kind: 'single-choice',
        options: [
          { optionId: 'option-true', label: 'true' },
          { optionId: 'option-false', label: 'false' },
        ],
      },
      evaluation: {
        kind: 'choice-selection',
        correctOptionIds: ['option-false'],
      },
      allowedPlayModes: ['single-choice-quiz', 'flashcard'],
    })
    expect(item(pack, 'multiple-choice-activity')).toMatchObject({
      response: {
        kind: 'multiple-choice',
        options: [
          { optionId: 'option-alpha', label: 'alpha' },
          { optionId: 'option-beta', label: 'beta' },
          { optionId: 'option-gamma', label: 'gamma' },
        ],
      },
      evaluation: {
        kind: 'choice-selection',
        correctOptionIds: ['option-alpha', 'option-beta'],
      },
      allowedPlayModes: ['multiple-choice-quiz', 'flashcard'],
    })
    expect(item(pack, 'exact-text-activity')).toMatchObject({
      response: {
        kind: 'text',
        textInput: {
          placeholder: 'Short answer',
          minLength: 2,
          maxLength: 24,
        },
      },
      evaluation: {
        kind: 'exact-text',
        acceptedAnswers: ['alpha', 'beta'],
        caseSensitive: false,
        trimWhitespace: true,
      },
      allowedPlayModes: ['text-recall', 'flashcard'],
    })
    expect(item(pack, 'numerical-activity')).toMatchObject({
      response: {
        kind: 'number',
        numberInput: {
          min: 0,
          max: 100,
        },
      },
      evaluation: {
        kind: 'numerical-tolerance',
        expectedNumber: 42,
        absoluteTolerance: 0.5,
      },
      allowedPlayModes: ['number-recall', 'flashcard'],
    })
  })

  it('preserves stable IDs for subjects, concepts, objectives, activities, options, and answer criteria', () => {
    const pack = adaptSubjectPackageToLearningPack(
      defineSubject(subjectPackage([singleChoiceActivity()])),
    )

    expect(pack.catalog.subjects.map((subject) => subject.subjectId)).toEqual([
      'export-fixture',
    ])
    expect(pack.catalog.concepts.map((concept) => concept.conceptId)).toEqual([
      'concept-a',
    ])
    expect(
      pack.catalog.objectives.map((objective) => objective.objectiveId),
    ).toEqual(['objective-a'])
    expect(pack.items.items.map((learningItem) => learningItem.itemId)).toEqual(
      ['single-choice-activity'],
    )
    expect(item(pack, 'single-choice-activity').response.options).toEqual([
      { optionId: 'option-true', label: 'true', contentBlocks: [] },
      { optionId: 'option-false', label: 'false', contentBlocks: [] },
    ])
    expect(
      item(pack, 'single-choice-activity').evaluation.correctOptionIds,
    ).toEqual(['option-false'])
  })

  it('generates flashcard solutions only from deterministic answers', () => {
    const pack = adaptSubjectPackageToLearningPack(
      defineSubject(
        subjectPackage([
          singleChoiceActivity(),
          multipleChoiceActivity(),
          exactTextActivity(),
          numericalActivity(),
          manualActivity(),
        ]),
      ),
    )

    expect(solutionText(pack, 'single-choice-activity')).toBe(
      'Correct answer: false.',
    )
    expect(solutionText(pack, 'multiple-choice-activity')).toBe(
      'Correct answers: alpha; beta.',
    )
    expect(solutionText(pack, 'exact-text-activity')).toBe(
      'Accepted answers: alpha; beta.',
    )
    expect(solutionText(pack, 'numerical-activity')).toBe(
      'Expected answer: 42 (tolerance 0.5).',
    )
    expect(item(pack, 'manual-activity').reviewedSolutionBlocks).toEqual([])
    expect(item(pack, 'manual-activity').allowedPlayModes).not.toContain(
      'flashcard',
    )
  })

  it('does not derive a solution or flashcard mode from rubric text', () => {
    const pack = adaptSubjectPackageToLearningPack(
      defineSubject(subjectPackage([rubricTextActivity()])),
    )
    const learningItem = item(pack, 'rubric-text-activity')

    expect(learningItem.response.kind).toBe('self-grade')
    expect(learningItem.evaluation.kind).toBe('self-grade')
    expect(learningItem.allowedPlayModes).toEqual(['self-grade-review'])
    expect(learningItem.allowedPlayModes).not.toContain('flashcard')
    expect(learningItem.reviewedSolutionBlocks).toEqual([])
    expect(JSON.stringify(learningItem)).not.toContain('tempting rubric phrase')
  })

  it('declares recoverable extension content as an optional capability', () => {
    const pack = adaptSubjectPackageToLearningPack(
      defineSubject(
        subjectPackage(
          [extensionContentActivity()],
          [{ key: 'fixture.diagram', kind: 'renderer' }],
        ),
      ),
    )
    const validation = validateLearningPackDocuments(pack)

    expect(validation.ok).toBe(true)
    expect(pack.manifest.capabilities.optional).toContainEqual({
      capabilityId: 'learnt.renderer.fixture.diagram',
      version: '0.1',
    })
    expect(validation.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'UNSUPPORTED_OPTIONAL_CAPABILITY',
          severity: 'warning',
        }),
      ]),
    )
  })

  it('projects code rubric activities as self-grade review without a generated solution', () => {
    const pack = adaptSubjectPackageToLearningPack(
      defineSubject(subjectPackage([codeResponseActivity()])),
    )
    const learningItem = item(pack, 'code-response-activity')

    expect(learningItem.response.kind).toBe('self-grade')
    expect(learningItem.evaluation.kind).toBe('self-grade')
    expect(learningItem.allowedPlayModes).toEqual(['self-grade-review'])
    expect(learningItem.reviewedSolutionBlocks).toEqual([])
    expect(pack.manifest.capabilities.optional).toEqual(
      expect.arrayContaining([
        {
          capabilityId: 'learnt.evaluation.rubric-assisted-text',
          version: '0.1',
        },
        { capabilityId: 'learnt.response.code-draft', version: '0.1' },
      ]),
    )
  })

  it('fails clearly when a required response cannot be represented', () => {
    expect(() =>
      adaptSubjectPackageToLearningPack(
        defineSubject(subjectPackage([confidenceActivity()])),
      ),
    ).toThrow(/confidence response cannot be represented/)
  })

  it('fails clearly when a required extension evaluator cannot be represented', () => {
    expect(() =>
      adaptSubjectPackageToLearningPack(
        defineSubject(
          subjectPackage(
            [extensionEvaluationActivity()],
            [{ key: 'fixture.custom-evaluator', kind: 'evaluator' }],
          ),
        ),
      ),
    ).toThrow(/extension evaluation cannot be represented/)
  })

  it('does not leak learner, evidence, session, profile, or presentation state', () => {
    const pack = adaptSubjectPackageToLearningPack(
      defineSubject(subjectPackage([singleChoiceActivity()])),
    )
    const serializedPack = JSON.stringify(pack)

    expect(serializedPack).not.toContain('learnerId')
    expect(serializedPack).not.toContain('profileId')
    expect(serializedPack).not.toContain('sessionId')
    expect(serializedPack).not.toContain('evidence')
    expect(serializedPack).not.toContain('presentationPolicy')
    expect(serializedPack).not.toContain('interactionMode')
  })

  it('validates successfully against the shared golden fixture conformance checks', async () => {
    const report = await runLearningPackConformanceChecks(
      createContractValidatorConformanceAdapter(),
    )

    expect(report.ok).toBe(true)
  })
})

function subjectPackage(
  activities: TestActivity[],
  extensions: TestExtension[] = [],
): unknown {
  return {
    schemaVersion: '0.1',
    id: 'export-fixture',
    version: '0.1.0',
    title: 'Export Fixture',
    summary: 'Fixture subject for learning-pack export tests.',
    tags: ['fixture'],
    modules: [
      {
        id: 'module-a',
        title: 'Module A',
        summary: 'A test module.',
        order: 0,
        conceptIds: ['concept-a'],
        objectiveIds: ['objective-a'],
        activityIds: activities.map((activity) => activity.id),
      },
    ],
    concepts: [
      {
        id: 'concept-a',
        title: 'Concept A',
        summary: 'A test concept.',
        prerequisiteConceptIds: [],
        relatedConceptIds: [],
        tags: ['fixture'],
      },
    ],
    objectives: [
      {
        id: 'objective-a',
        conceptIds: ['concept-a'],
        statement: 'Answer fixture prompts.',
        successCriteria: ['Uses deterministic answer criteria when available.'],
      },
    ],
    activities,
    extensions,
  }
}

function baseActivity(activity: TestActivity): TestActivity {
  return {
    moduleId: 'module-a',
    conceptIds: ['concept-a'],
    objectiveIds: ['objective-a'],
    blocks: [
      {
        kind: 'question',
        prompt: `Prompt for ${activity.title}?`,
      },
    ],
    completionPolicy: { kind: 'passing-evaluation' },
    ...activity,
  }
}

function manualActivity(): TestActivity {
  return baseActivity({
    id: 'manual-activity',
    title: 'Manual activity',
    kind: 'orient',
    scaffoldLevel: 'worked',
    blocks: [{ kind: 'text', body: 'Read this.' }],
    evaluation: { kind: 'manual-completion' },
    completionPolicy: { kind: 'manual' },
    nextActivityIds: [],
  })
}

function singleChoiceActivity(): TestActivity {
  return baseActivity({
    id: 'single-choice-activity',
    title: 'Single choice activity',
    kind: 'predict',
    scaffoldLevel: 'guided',
    response: {
      kind: 'single-choice',
      options: [
        { id: 'option-true', label: 'true' },
        { id: 'option-false', label: 'false' },
      ],
    },
    evaluation: {
      kind: 'choice-selection',
      correctOptionIds: ['option-false'],
    },
    nextActivityIds: [],
  })
}

function multipleChoiceActivity(): TestActivity {
  return baseActivity({
    id: 'multiple-choice-activity',
    title: 'Multiple choice activity',
    kind: 'recall',
    scaffoldLevel: 'guided',
    response: {
      kind: 'multiple-choice',
      options: [
        { id: 'option-alpha', label: 'alpha' },
        { id: 'option-beta', label: 'beta' },
        { id: 'option-gamma', label: 'gamma' },
      ],
      minimumSelections: 2,
      maximumSelections: 2,
    },
    evaluation: {
      kind: 'choice-selection',
      correctOptionIds: ['option-alpha', 'option-beta'],
    },
    nextActivityIds: [],
  })
}

function exactTextActivity(): TestActivity {
  return baseActivity({
    id: 'exact-text-activity',
    title: 'Exact text activity',
    kind: 'transfer',
    scaffoldLevel: 'transfer',
    response: {
      kind: 'text',
      multiline: false,
      placeholder: 'Short answer',
      minimumLength: 2,
      maximumLength: 24,
    },
    evaluation: {
      kind: 'exact-text',
      acceptedAnswers: ['alpha', 'beta'],
      caseSensitive: false,
      trimWhitespace: true,
    },
    nextActivityIds: [],
  })
}

function numericalActivity(): TestActivity {
  return baseActivity({
    id: 'numerical-activity',
    title: 'Numerical activity',
    kind: 'predict',
    scaffoldLevel: 'guided',
    response: {
      kind: 'number',
      minimum: 0,
      maximum: 100,
      step: 0.5,
    },
    evaluation: {
      kind: 'numerical-tolerance',
      expected: 42,
      absoluteTolerance: 0.5,
    },
    nextActivityIds: [],
  })
}

function confidenceActivity(): TestActivity {
  return baseActivity({
    id: 'confidence-activity',
    title: 'Confidence activity',
    kind: 'reflect',
    scaffoldLevel: 'guided',
    response: {
      kind: 'confidence',
      minimum: 1,
      maximum: 5,
      lowLabel: 'Low',
      highLabel: 'High',
    },
    evaluation: { kind: 'manual-completion' },
    completionPolicy: { kind: 'submission' },
    nextActivityIds: [],
  })
}

function rubricTextActivity(): TestActivity {
  return baseActivity({
    id: 'rubric-text-activity',
    title: 'Rubric text activity',
    kind: 'explain',
    scaffoldLevel: 'guided',
    response: {
      kind: 'text',
      multiline: true,
      minimumLength: 10,
    },
    evaluation: {
      kind: 'rubric-assisted-text',
      criteria: [
        {
          id: 'criterion-a',
          description: 'Mentions the tempting rubric phrase.',
          required: true,
        },
      ],
    },
    completionPolicy: { kind: 'submission' },
    nextActivityIds: [],
  })
}

function codeResponseActivity(): TestActivity {
  return baseActivity({
    id: 'code-response-activity',
    title: 'Code response activity',
    kind: 'build',
    scaffoldLevel: 'guided',
    response: {
      kind: 'code',
      language: 'typescript',
      starterCode: 'return true',
    },
    evaluation: {
      kind: 'rubric-assisted-text',
      criteria: [
        {
          id: 'criterion-code',
          description: 'Explains the code.',
          required: true,
        },
      ],
    },
    completionPolicy: { kind: 'submission' },
    nextActivityIds: [],
  })
}

function extensionEvaluationActivity(): TestActivity {
  return baseActivity({
    id: 'extension-evaluation-activity',
    title: 'Extension evaluation activity',
    kind: 'predict',
    scaffoldLevel: 'guided',
    response: {
      kind: 'single-choice',
      options: [{ id: 'option-a', label: 'A' }],
    },
    evaluation: {
      kind: 'extension',
      evaluatorKey: 'fixture.custom-evaluator',
      payload: { answer: 'A' },
    },
    nextActivityIds: [],
  })
}

function extensionContentActivity(): TestActivity {
  return baseActivity({
    id: 'extension-content-activity',
    title: 'Extension content activity',
    kind: 'predict',
    scaffoldLevel: 'guided',
    blocks: [
      { kind: 'question', prompt: 'Choose the safe option.' },
      {
        kind: 'extension',
        rendererKey: 'fixture.diagram',
        payload: { nodes: ['a', 'b'] },
      },
    ],
    response: {
      kind: 'single-choice',
      options: [
        { id: 'option-safe', label: 'safe' },
        { id: 'option-unsafe', label: 'unsafe' },
      ],
    },
    evaluation: {
      kind: 'choice-selection',
      correctOptionIds: ['option-safe'],
    },
    nextActivityIds: [],
  })
}

function item(pack: LearningPackDocuments, itemId: string) {
  const learningItem = pack.items.items.find(
    (candidate) => candidate.itemId === itemId,
  )
  if (!learningItem) {
    throw new Error(`Missing item ${itemId}.`)
  }
  return learningItem
}

function solutionText(pack: LearningPackDocuments, itemId: string): string {
  return item(pack, itemId)
    .reviewedSolutionBlocks.map((block) => block.text)
    .join('\n')
}
