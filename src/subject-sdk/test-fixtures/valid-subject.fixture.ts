export interface TestSubjectInput {
  schemaVersion: string
  id: string
  version: string
  title: string
  summary: string
  tags: string[]
  modules: [TestModuleInput, TestModuleInput, ...TestModuleInput[]]
  concepts: [
    TestConceptInput,
    TestConceptInput,
    TestConceptInput,
    ...TestConceptInput[],
  ]
  objectives: [TestObjectiveInput, TestObjectiveInput, ...TestObjectiveInput[]]
  activities: [
    TestActivityInput,
    TestActivityInput,
    TestActivityInput,
    TestActivityInput,
    ...TestActivityInput[],
  ]
  extensions: TestExtensionManifestInput[]
}

interface TestModuleInput {
  id: string
  title: string
  summary: string
  order: number
  conceptIds: string[]
  objectiveIds: string[]
  activityIds: string[]
}

interface TestConceptInput {
  id: string
  title: string
  summary: string
  prerequisiteConceptIds: string[]
  relatedConceptIds: string[]
  tags: string[]
}

interface TestObjectiveInput {
  id: string
  conceptIds: string[]
  statement: string
  successCriteria: string[]
}

interface TestChoiceOptionInput {
  id: string
  label: string
  description?: string
}

interface TestResponseInput {
  kind: string
  multiline?: boolean
  minimumLength?: number
  maximumLength?: number
  options?: TestChoiceOptionInput[]
  minimumSelections?: number
  maximumSelections?: number
}

interface TestEvaluationInput {
  kind: string
  acceptedAnswers?: string[]
  caseSensitive?: boolean
  trimWhitespace?: boolean
  correctOptionIds?: string[]
  criteria?: TestRubricCriterionInput[]
  evaluatorKey?: string
  payload?: unknown
}

interface TestRubricCriterionInput {
  id: string
  description: string
  required: boolean
}

interface TestContentBlockInput {
  kind: string
  body?: string
  prompt?: string
  rendererKey?: string
  payload?: unknown
}

interface TestActivityInput {
  id: string
  moduleId: string
  conceptIds: string[]
  objectiveIds: string[]
  title: string
  kind: string
  scaffoldLevel: string
  blocks: TestContentBlockInput[]
  response?: TestResponseInput
  evaluation: TestEvaluationInput
  completionPolicy: { kind: string }
  nextActivityIds: string[]
}

interface TestExtensionManifestInput {
  kind: string
  key: string
}

export function validSubjectInput(): TestSubjectInput {
  return {
    schemaVersion: '0.1',
    id: 'example-subject',
    version: '0.1.0',
    title: 'Example Subject',
    summary: 'A small complete subject for SDK integrity tests.',
    tags: ['example'],
    modules: [
      {
        id: 'foundations',
        title: 'Foundations',
        summary: 'Core ideas and first predictions.',
        order: 0,
        conceptIds: ['input-signal', 'decision-rule'],
        objectiveIds: ['predict-rule-output'],
        activityIds: [
          'orient-input-signal',
          'predict-rule-output',
          'choose-rule-output',
        ],
      },
      {
        id: 'transfer',
        title: 'Transfer',
        summary: 'Use the idea in a new context.',
        order: 10,
        conceptIds: ['input-signal', 'decision-rule', 'transfer-context'],
        objectiveIds: ['apply-rule-in-transfer'],
        activityIds: ['transfer-rule'],
      },
    ],
    concepts: [
      {
        id: 'input-signal',
        title: 'Input signal',
        summary: 'The concrete thing being inspected.',
        prerequisiteConceptIds: [],
        relatedConceptIds: ['decision-rule'],
        tags: ['signal'],
      },
      {
        id: 'decision-rule',
        title: 'Decision rule',
        summary: 'A condition that maps an input to an output.',
        prerequisiteConceptIds: ['input-signal'],
        relatedConceptIds: ['transfer-context'],
        tags: ['rule'],
      },
      {
        id: 'transfer-context',
        title: 'Transfer context',
        summary: 'A new setting where the same rule applies.',
        prerequisiteConceptIds: ['decision-rule'],
        relatedConceptIds: [],
        tags: ['transfer'],
      },
    ],
    objectives: [
      {
        id: 'predict-rule-output',
        conceptIds: ['input-signal', 'decision-rule'],
        statement:
          'Predict the output of a decision rule for a concrete input.',
        successCriteria: [
          'Identifies the input signal.',
          'Applies the decision rule to select the output.',
        ],
      },
      {
        id: 'apply-rule-in-transfer',
        conceptIds: ['decision-rule', 'transfer-context'],
        statement: 'Apply a decision rule in a new context.',
        successCriteria: ['Names the deciding feature in the new context.'],
      },
    ],
    activities: [
      {
        id: 'orient-input-signal',
        moduleId: 'foundations',
        conceptIds: ['input-signal'],
        objectiveIds: ['predict-rule-output'],
        title: 'Orient to the signal',
        kind: 'orient',
        scaffoldLevel: 'worked',
        blocks: [
          {
            kind: 'text',
            body: 'A signal is the concrete input the rule will inspect.',
          },
        ],
        evaluation: { kind: 'manual-completion' },
        completionPolicy: { kind: 'manual' },
        nextActivityIds: ['predict-rule-output'],
      },
      {
        id: 'predict-rule-output',
        moduleId: 'foundations',
        conceptIds: ['input-signal', 'decision-rule'],
        objectiveIds: ['predict-rule-output'],
        title: 'Predict the rule output',
        kind: 'predict',
        scaffoldLevel: 'guided',
        blocks: [
          {
            kind: 'question',
            prompt:
              'If the signal is active, which output should the rule choose?',
          },
        ],
        response: {
          kind: 'text',
          multiline: false,
          minimumLength: 6,
          maximumLength: 6,
        },
        evaluation: {
          kind: 'exact-text',
          acceptedAnswers: ['output'],
          caseSensitive: false,
          trimWhitespace: true,
        },
        completionPolicy: { kind: 'passing-evaluation' },
        nextActivityIds: ['choose-rule-output'],
      },
      {
        id: 'choose-rule-output',
        moduleId: 'foundations',
        conceptIds: ['decision-rule'],
        objectiveIds: ['predict-rule-output'],
        title: 'Choose the rule output',
        kind: 'predict',
        scaffoldLevel: 'guided',
        blocks: [
          {
            kind: 'question',
            prompt: 'Which option matches an active signal?',
          },
        ],
        response: {
          kind: 'single-choice',
          options: [
            { id: 'option-output', label: 'Output' },
            { id: 'option-ignore', label: 'Ignore it' },
            { id: 'option-reset', label: 'Reset' },
            { id: 'option-delay', label: 'Delay' },
          ],
        },
        evaluation: {
          kind: 'choice-selection',
          correctOptionIds: ['option-output'],
        },
        completionPolicy: { kind: 'passing-evaluation' },
        nextActivityIds: ['transfer-rule'],
      },
      {
        id: 'transfer-rule',
        moduleId: 'transfer',
        conceptIds: ['decision-rule', 'transfer-context'],
        objectiveIds: ['apply-rule-in-transfer'],
        title: 'Transfer the rule',
        kind: 'transfer',
        scaffoldLevel: 'transfer',
        blocks: [
          {
            kind: 'question',
            prompt: 'What feature decides the output in the new context?',
          },
        ],
        response: {
          kind: 'text',
          multiline: true,
          minimumLength: 8,
        },
        evaluation: {
          kind: 'rubric-assisted-text',
          criteria: [
            {
              id: 'names-feature',
              description: 'Names the deciding feature.',
              required: true,
            },
          ],
        },
        completionPolicy: { kind: 'passing-evaluation' },
        nextActivityIds: [],
      },
    ],
    extensions: [],
  }
}
