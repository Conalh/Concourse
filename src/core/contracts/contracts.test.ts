import { describe, expect, it } from 'vitest'

import {
  ActivityDefinitionSchema,
  ConceptDefinitionSchema,
  ContentBlockSchema,
  EvidenceEventSchema,
  EvidencePayloadSchema,
  LearnerProfileSchema,
  LearningObjectiveSchema,
  LearningSessionSchema,
  ModuleDefinitionSchema,
  SubjectPackageSchema,
  LearnerIdSchema,
  ExtensionKeySchema,
} from './index'

const validProfileInput = {
  schemaVersion: '0.1',
  id: 'generic-profile-v1',
  learnerId: 'generic-learner',
  displayName: 'Generic Learner',
  reportedTraits: ['fast pattern matching'],
  presentation: {
    explanationDensity: 'compact',
    signalPriority: 'high',
    concreteBeforeAbstract: true,
    examplesBeforeExtendedTheory: true,
    visualModelsPreferred: true,
    systemMapsPreferred: true,
    avoidLongPassiveReading: true,
    avoidRedundantExplanation: true,
  },
  instruction: {
    defaultChunkSize: 'small',
    teachThroughBuilding: true,
    connectConceptsToSystemBehavior: true,
    checkpointAtConceptualBoundaries: true,
    permitNonlinearExploration: true,
    preserveCurrentThreadDuringDigressions: true,
    requestPredictionWhenInformative: true,
    requireMeaningfulLearnerAction: true,
  },
  errorHandling: {
    feedbackStyle: 'direct',
    explainDifferenceBriefly: true,
    offerImmediateRetry: true,
    avoidShamingLanguage: true,
    avoidGenericPraise: true,
  },
  defaultOutputSequence: ['concept', 'build', 'why', 'try'],
  constraints: {
    doNotInferNeedsBeyondExplicitProfile: true,
    doNotTreatDiagnosticLabelsAsRules: true,
    doNotInferMasteryFromSelfReport: true,
    doNotModifyProfileAutomatically: true,
  },
}

const validConceptInput = {
  id: 'boolean-values',
  title: 'Boolean values',
  summary: 'Values that can be true or false.',
  prerequisiteConceptIds: [],
  relatedConceptIds: ['conjunction'],
  tags: ['logic'],
}

const validObjectiveInput = {
  id: 'classify-boolean-outcome',
  conceptIds: ['boolean-values'],
  statement: 'Classify a value as true or false from a concrete expression.',
  successCriteria: ['Names the resulting Boolean value.'],
}

const validTextActivityInput = {
  id: 'activity-predict-conjunction',
  moduleId: 'logic-module',
  conceptIds: ['boolean-values'],
  objectiveIds: ['classify-boolean-outcome'],
  title: 'Predict a conjunction',
  kind: 'predict',
  scaffoldLevel: 'guided',
  blocks: [{ kind: 'question', prompt: 'What does true AND false produce?' }],
  response: {
    kind: 'text',
    multiline: false,
    placeholder: 'true or false',
    minimumLength: 4,
    maximumLength: 5,
  },
  evaluation: {
    kind: 'exact-text',
    acceptedAnswers: ['false'],
    caseSensitive: false,
    trimWhitespace: true,
  },
  completionPolicy: { kind: 'passing-evaluation' },
  nextActivityIds: [],
}

const validEvidenceEventInput = {
  schemaVersion: '0.1',
  id: 'evidence-001',
  timestamp: '2026-06-22T21:00:00.000Z',
  learnerId: 'generic-learner',
  profileId: 'generic-profile-v1',
  sessionId: 'session-001',
  subjectId: 'logic-basics',
  moduleId: 'logic-module',
  activityId: 'activity-predict-conjunction',
  objectiveIds: ['classify-boolean-outcome'],
  activityKind: 'predict',
  response: { kind: 'text', value: 'false' },
  confidence: 4,
  hintsUsed: 0,
  evaluation: {
    status: 'passed',
    score: 1,
    feedback: 'Correct.',
    matchedCriteria: ['exact-answer'],
    missingCriteria: [],
  },
}

const validActiveSessionInput = {
  schemaVersion: '0.1',
  id: 'session-001',
  learnerId: 'generic-learner',
  profileId: 'generic-profile-v1',
  subjectId: 'logic-basics',
  status: 'active',
  interactionMode: 'coach',
  currentModuleId: 'logic-module',
  currentActivityId: 'activity-predict-conjunction',
  startedAt: '2026-06-22T21:00:00.000Z',
  lastActiveAt: '2026-06-22T21:01:00.000Z',
  activityProgress: [
    { activityId: 'activity-predict-conjunction', status: 'active' },
  ],
  evidenceEventIds: ['evidence-001'],
}

describe('identifier contracts', () => {
  it('accepts valid kebab-case IDs and namespaced extension keys', () => {
    expect(LearnerIdSchema.safeParse('demo-learner-v1').success).toBe(true)
    expect(
      ExtensionKeySchema.safeParse('logic-basics.truth-table').success,
    ).toBe(true)
  })

  it('rejects spaces, underscores, uppercase characters, and malformed hyphens', () => {
    for (const value of [
      'Logic Basics',
      'boolean_values',
      'Boolean-values',
      '-logic',
      'logic-',
      'logic--basics',
    ]) {
      expect(LearnerIdSchema.safeParse(value).success).toBe(false)
    }
  })
})

describe('learner profile contracts', () => {
  it('accepts a valid generic profile', () => {
    expect(LearnerProfileSchema.safeParse(validProfileInput).success).toBe(true)
  })

  it('rejects unsupported schema versions', () => {
    expect(
      LearnerProfileSchema.safeParse({
        ...validProfileInput,
        schemaVersion: '0.2',
      }).success,
    ).toBe(false)
  })

  it('rejects duplicate output-sequence entries and empty display names', () => {
    expect(
      LearnerProfileSchema.safeParse({
        ...validProfileInput,
        defaultOutputSequence: ['concept', 'concept'],
      }).success,
    ).toBe(false)
    expect(
      LearnerProfileSchema.safeParse({
        ...validProfileInput,
        displayName: '   ',
      }).success,
    ).toBe(false)
  })
})

describe('concept and objective contracts', () => {
  it('rejects self-prerequisites and duplicate concept references', () => {
    expect(
      ConceptDefinitionSchema.safeParse({
        ...validConceptInput,
        prerequisiteConceptIds: ['boolean-values'],
      }).success,
    ).toBe(false)
    expect(
      ConceptDefinitionSchema.safeParse({
        ...validConceptInput,
        relatedConceptIds: ['conjunction', 'conjunction'],
      }).success,
    ).toBe(false)
  })

  it('rejects objectives without success criteria', () => {
    expect(
      LearningObjectiveSchema.safeParse({
        ...validObjectiveInput,
        successCriteria: [],
      }).success,
    ).toBe(false)
  })
})

describe('module contracts', () => {
  it('rejects duplicate local references', () => {
    expect(
      ModuleDefinitionSchema.safeParse({
        id: 'logic-module',
        title: 'Logic module',
        summary: 'A short logic module.',
        order: 0,
        conceptIds: ['boolean-values', 'boolean-values'],
        objectiveIds: ['classify-boolean-outcome'],
        activityIds: ['activity-predict-conjunction'],
      }).success,
    ).toBe(false)
  })
})

describe('content block contracts', () => {
  it('accepts every standard content-block kind', () => {
    const blocks = [
      { kind: 'text', body: 'A compact explanation.' },
      {
        kind: 'code',
        language: 'ts',
        source: 'const value = true',
        highlightedLines: [1],
        caption: 'Boolean assignment',
      },
      { kind: 'equation', expression: '1 + 1 = 2', description: 'Addition.' },
      {
        kind: 'callout',
        purpose: 'mental-model',
        title: 'Switch',
        body: 'Think of true and false as two switch positions.',
      },
      {
        kind: 'comparison',
        items: [
          { label: 'True', body: 'Condition is met.' },
          { label: 'False', body: 'Condition is not met.' },
        ],
      },
      { kind: 'question', prompt: 'Which value comes out?' },
      {
        kind: 'extension',
        rendererKey: 'logic-basics.truth-table',
        payload: { columns: ['a', 'b'] },
      },
    ]

    for (const block of blocks) {
      expect(ContentBlockSchema.safeParse(block).success).toBe(true)
    }
  })

  it('rejects unknown discriminators, short comparisons, and invalid highlighted lines', () => {
    expect(
      ContentBlockSchema.safeParse({ kind: 'video', url: 'x' }).success,
    ).toBe(false)
    expect(
      ContentBlockSchema.safeParse({
        kind: 'comparison',
        items: [{ label: 'Only', body: 'One item.' }],
      }).success,
    ).toBe(false)
    expect(
      ContentBlockSchema.safeParse({
        kind: 'code',
        language: 'ts',
        source: 'const value = true',
        highlightedLines: [1, 1],
      }).success,
    ).toBe(false)
    expect(
      ContentBlockSchema.safeParse({
        kind: 'code',
        language: 'ts',
        source: 'const value = true',
        highlightedLines: [0],
      }).success,
    ).toBe(false)
  })
})

describe('response and activity contracts', () => {
  it('rejects duplicate choice-option IDs and incoherent selection limits', () => {
    const duplicateOptions = {
      id: 'activity-choice',
      moduleId: 'logic-module',
      conceptIds: ['boolean-values'],
      objectiveIds: ['classify-boolean-outcome'],
      title: 'Choose one',
      kind: 'predict',
      scaffoldLevel: 'guided',
      blocks: [{ kind: 'question', prompt: 'Which option is true?' }],
      response: {
        kind: 'single-choice',
        options: [
          { id: 'option-a', label: 'A' },
          { id: 'option-a', label: 'A again' },
        ],
      },
      evaluation: {
        kind: 'choice-selection',
        correctOptionIds: ['option-a'],
      },
      completionPolicy: { kind: 'passing-evaluation' },
      nextActivityIds: [],
    }

    expect(ActivityDefinitionSchema.safeParse(duplicateOptions).success).toBe(
      false,
    )
    expect(
      ActivityDefinitionSchema.safeParse({
        ...duplicateOptions,
        response: {
          kind: 'multiple-choice',
          options: [
            { id: 'option-a', label: 'A' },
            { id: 'option-b', label: 'B' },
          ],
          minimumSelections: 3,
          maximumSelections: 1,
        },
      }).success,
    ).toBe(false)
  })

  it('rejects incoherent numeric bounds', () => {
    expect(
      ActivityDefinitionSchema.safeParse({
        ...validTextActivityInput,
        response: { kind: 'number', minimum: 10, maximum: 2 },
        evaluation: {
          kind: 'numerical-tolerance',
          expected: 5,
          absoluteTolerance: 1,
        },
      }).success,
    ).toBe(false)
  })

  it('accepts valid activity and evaluation combinations', () => {
    expect(
      ActivityDefinitionSchema.safeParse(validTextActivityInput).success,
    ).toBe(true)
  })

  it('rejects incompatible activity and evaluation combinations', () => {
    expect(
      ActivityDefinitionSchema.safeParse({
        ...validTextActivityInput,
        response: { kind: 'number' },
      }).success,
    ).toBe(false)
    expect(
      ActivityDefinitionSchema.safeParse({
        ...validTextActivityInput,
        evaluation: {
          kind: 'numerical-tolerance',
          expected: 1,
          absoluteTolerance: 0,
        },
      }).success,
    ).toBe(false)
    expect(
      ActivityDefinitionSchema.safeParse({
        ...validTextActivityInput,
        evaluation: {
          kind: 'choice-selection',
          correctOptionIds: ['option-a'],
        },
      }).success,
    ).toBe(false)
  })

  it('rejects self-referencing next activity IDs', () => {
    expect(
      ActivityDefinitionSchema.safeParse({
        ...validTextActivityInput,
        nextActivityIds: ['activity-predict-conjunction'],
      }).success,
    ).toBe(false)
  })
})

describe('subject package contracts', () => {
  it('accepts a structurally valid subject package', () => {
    expect(
      SubjectPackageSchema.safeParse({
        schemaVersion: '0.1',
        id: 'logic-basics',
        version: '0.1.0',
        title: 'Logic Basics',
        summary: 'A small logic subject.',
        tags: ['logic'],
        modules: [],
        concepts: [],
        objectives: [],
        activities: [],
        extensions: [],
      }).success,
    ).toBe(true)
  })

  it('rejects unsupported schema versions', () => {
    expect(
      SubjectPackageSchema.safeParse({
        schemaVersion: '0.2',
        id: 'logic-basics',
        version: '0.1.0',
        title: 'Logic Basics',
        summary: 'A small logic subject.',
        tags: [],
        modules: [],
        concepts: [],
        objectives: [],
        activities: [],
        extensions: [],
      }).success,
    ).toBe(false)
  })

  it('does not falsely claim to validate cross-references yet', () => {
    expect(
      SubjectPackageSchema.safeParse({
        schemaVersion: '0.1',
        id: 'logic-basics',
        version: '0.1.0',
        title: 'Logic Basics',
        summary: 'A small logic subject.',
        tags: ['logic'],
        modules: [
          {
            id: 'logic-module',
            title: 'Logic module',
            summary: 'A module with references validated later.',
            order: 0,
            conceptIds: ['missing-concept'],
            objectiveIds: ['missing-objective'],
            activityIds: ['missing-activity'],
          },
        ],
        concepts: [],
        objectives: [],
        activities: [],
        extensions: [],
      }).success,
    ).toBe(true)
  })
})

describe('evidence contracts', () => {
  it('accepts a valid evidence event', () => {
    expect(EvidenceEventSchema.safeParse(validEvidenceEventInput).success).toBe(
      true,
    )
  })

  it('rejects malformed timestamps, negative hints, and invalid confidence values', () => {
    expect(
      EvidenceEventSchema.safeParse({
        ...validEvidenceEventInput,
        timestamp: 'not-a-date',
      }).success,
    ).toBe(false)
    expect(
      EvidenceEventSchema.safeParse({
        ...validEvidenceEventInput,
        hintsUsed: -1,
      }).success,
    ).toBe(false)
    expect(
      EvidenceEventSchema.safeParse({
        ...validEvidenceEventInput,
        confidence: 6,
      }).success,
    ).toBe(false)
  })

  it('rejects duplicate multiple-choice evidence IDs', () => {
    expect(
      EvidencePayloadSchema.safeParse({
        kind: 'multiple-choice',
        optionIds: ['option-a', 'option-a'],
      }).success,
    ).toBe(false)
  })
})

describe('session contracts', () => {
  it('accepts a valid active session', () => {
    const parsed = LearningSessionSchema.safeParse(validActiveSessionInput)

    expect(parsed.success).toBe(true)
    expect(parsed.data?.exploration).toEqual({ parkedConceptIds: [] })
  })

  it('rejects duplicate activity-progress entries and reversed timestamps', () => {
    expect(
      LearningSessionSchema.safeParse({
        ...validActiveSessionInput,
        activityProgress: [
          { activityId: 'activity-predict-conjunction', status: 'active' },
          { activityId: 'activity-predict-conjunction', status: 'attempted' },
        ],
      }).success,
    ).toBe(false)
    expect(
      LearningSessionSchema.safeParse({
        ...validActiveSessionInput,
        lastActiveAt: '2026-06-22T20:59:00.000Z',
      }).success,
    ).toBe(false)
  })

  it('rejects an active session with no current activity', () => {
    expect(
      LearningSessionSchema.safeParse({
        ...validActiveSessionInput,
        currentActivityId: null,
      }).success,
    ).toBe(false)
  })

  it('accepts a completed session with a null current activity', () => {
    expect(
      LearningSessionSchema.safeParse({
        ...validActiveSessionInput,
        status: 'completed',
        currentActivityId: null,
      }).success,
    ).toBe(true)
  })

  it('accepts explicit empty exploration and rejects duplicate parked concept IDs', () => {
    expect(
      LearningSessionSchema.safeParse({
        ...validActiveSessionInput,
        exploration: { parkedConceptIds: [] },
      }).success,
    ).toBe(true)

    expect(
      LearningSessionSchema.safeParse({
        ...validActiveSessionInput,
        exploration: {
          parkedConceptIds: ['boolean-values', 'boolean-values'],
        },
      }).success,
    ).toBe(false)
  })

  it('parses legacy sessions with empty exploration without mutating the source', () => {
    const legacyInput = { ...validActiveSessionInput }

    const parsed = LearningSessionSchema.parse(legacyInput)

    expect(parsed.exploration).toEqual({ parkedConceptIds: [] })
    expect('exploration' in legacyInput).toBe(false)
  })

  it('continues to reject unsupported session schema versions', () => {
    expect(
      LearningSessionSchema.safeParse({
        ...validActiveSessionInput,
        schemaVersion: '0.2',
      }).success,
    ).toBe(false)
  })
})
