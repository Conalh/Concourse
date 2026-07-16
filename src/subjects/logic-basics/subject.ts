import { createSubjectAdapter, defineSubject } from '../../subject-sdk'

export const logicBasicsSubject = defineSubject({
  schemaVersion: '0.1',
  id: 'logic-basics',
  version: '0.1.0',
  title: 'Logic Basics',
  summary:
    'Predict Boolean values, simple operators, and compound decision rules.',
  tags: ['logic', 'reasoning', 'foundations'],
  modules: [
    {
      id: 'boolean-foundations',
      title: 'Boolean Foundations',
      summary: 'Boolean values and the behavior of negation.',
      order: 0,
      conceptIds: ['boolean-values', 'logical-negation'],
      objectiveIds: ['identify-boolean-values', 'predict-negation'],
      activityIds: [
        'orient-boolean-values',
        'predict-negation',
        'recall-boolean-values',
      ],
    },
    {
      id: 'combining-conditions',
      title: 'Combining Conditions',
      summary: 'AND, OR, and compound decision rules.',
      order: 10,
      conceptIds: [
        'logical-conjunction',
        'logical-disjunction',
        'compound-conditions',
      ],
      objectiveIds: [
        'predict-compound-operators',
        'diagnose-compound-condition',
        'apply-decision-rule',
      ],
      activityIds: [
        'orient-compound-conditions',
        'predict-conjunction',
        'predict-disjunction',
        'debug-access-rule',
        'transfer-release-gate',
      ],
    },
  ],
  concepts: [
    {
      id: 'boolean-values',
      title: 'Boolean values',
      summary: 'A value that is either true or false.',
      prerequisiteConceptIds: [],
      relatedConceptIds: [
        'logical-negation',
        'logical-conjunction',
        'logical-disjunction',
      ],
      tags: ['logic'],
    },
    {
      id: 'logical-negation',
      title: 'Logical negation',
      summary: 'NOT flips a Boolean value to its opposite.',
      prerequisiteConceptIds: ['boolean-values'],
      relatedConceptIds: ['compound-conditions'],
      tags: ['operator'],
    },
    {
      id: 'logical-conjunction',
      title: 'Logical conjunction',
      summary: 'AND is true only when every required condition is true.',
      prerequisiteConceptIds: ['boolean-values'],
      relatedConceptIds: ['logical-disjunction', 'compound-conditions'],
      tags: ['operator'],
    },
    {
      id: 'logical-disjunction',
      title: 'Logical disjunction',
      summary: 'OR is true when at least one allowed condition is true.',
      prerequisiteConceptIds: ['boolean-values'],
      relatedConceptIds: ['logical-conjunction', 'compound-conditions'],
      tags: ['operator'],
    },
    {
      id: 'compound-conditions',
      title: 'Compound conditions',
      summary: 'A decision rule that combines smaller Boolean conditions.',
      prerequisiteConceptIds: ['logical-conjunction', 'logical-disjunction'],
      relatedConceptIds: ['logical-negation'],
      tags: ['decision-rule'],
    },
  ],
  objectives: [
    {
      id: 'identify-boolean-values',
      conceptIds: ['boolean-values'],
      statement: 'Identify valid Boolean values in a small set of values.',
      successCriteria: ['Selects true and false as the Boolean values.'],
    },
    {
      id: 'predict-negation',
      conceptIds: ['boolean-values', 'logical-negation'],
      statement: 'Predict the result of logical negation.',
      successCriteria: ['Correctly flips true to false or false to true.'],
    },
    {
      id: 'predict-compound-operators',
      conceptIds: ['logical-conjunction', 'logical-disjunction'],
      statement: 'Predict conjunction and disjunction from supplied inputs.',
      successCriteria: ['Applies AND and OR rules to concrete values.'],
    },
    {
      id: 'diagnose-compound-condition',
      conceptIds: ['logical-conjunction', 'compound-conditions'],
      statement: 'Diagnose why a compound condition evaluates to false.',
      successCriteria: ['Identifies the false requirement in an AND rule.'],
    },
    {
      id: 'apply-decision-rule',
      conceptIds: ['compound-conditions'],
      statement: 'Apply Boolean operators to a new decision rule.',
      successCriteria: ['Predicts the resulting decision from rule inputs.'],
    },
  ],
  activities: [
    {
      id: 'orient-boolean-values',
      moduleId: 'boolean-foundations',
      conceptIds: ['boolean-values'],
      objectiveIds: ['identify-boolean-values'],
      title: 'Orient to Boolean values',
      kind: 'orient',
      scaffoldLevel: 'worked',
      blocks: [
        {
          kind: 'text',
          body: 'A Boolean value has only two possible values: true or false.',
        },
        {
          kind: 'callout',
          purpose: 'mental-model',
          title: 'Switch model',
          body: 'Think of a Boolean as an on/off switch for a condition.',
        },
      ],
      evaluation: { kind: 'manual-completion' },
      completionPolicy: { kind: 'manual' },
      nextActivityIds: ['predict-negation'],
    },
    {
      id: 'predict-negation',
      moduleId: 'boolean-foundations',
      conceptIds: ['boolean-values', 'logical-negation'],
      objectiveIds: ['predict-negation'],
      title: 'Predict NOT true',
      kind: 'predict',
      scaffoldLevel: 'guided',
      blocks: [{ kind: 'question', prompt: 'What is NOT true?' }],
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
      completionPolicy: { kind: 'passing-evaluation' },
      nextActivityIds: ['recall-boolean-values'],
    },
    {
      id: 'recall-boolean-values',
      moduleId: 'boolean-foundations',
      conceptIds: ['boolean-values'],
      objectiveIds: ['identify-boolean-values'],
      title: 'Recall Boolean values',
      kind: 'recall',
      scaffoldLevel: 'guided',
      blocks: [
        {
          kind: 'question',
          prompt: 'Which values are valid Boolean values?',
        },
      ],
      response: {
        kind: 'multiple-choice',
        options: [
          { id: 'option-true', label: 'true' },
          { id: 'option-false', label: 'false' },
          { id: 'option-sometimes', label: 'sometimes' },
          { id: 'option-maybe', label: 'maybe' },
        ],
        minimumSelections: 2,
        maximumSelections: 2,
      },
      evaluation: {
        kind: 'choice-selection',
        correctOptionIds: ['option-true', 'option-false'],
      },
      completionPolicy: { kind: 'passing-evaluation' },
      nextActivityIds: ['orient-compound-conditions'],
    },
    {
      id: 'orient-compound-conditions',
      moduleId: 'combining-conditions',
      conceptIds: [
        'logical-conjunction',
        'logical-disjunction',
        'compound-conditions',
      ],
      objectiveIds: ['predict-compound-operators'],
      title: 'Orient to compound conditions',
      kind: 'orient',
      scaffoldLevel: 'worked',
      blocks: [
        {
          kind: 'comparison',
          items: [
            { label: 'A AND B', body: 'True only when A and B are both true.' },
            { label: 'A OR B', body: 'True when A, B, or both are true.' },
          ],
        },
      ],
      evaluation: { kind: 'manual-completion' },
      completionPolicy: { kind: 'manual' },
      nextActivityIds: ['predict-conjunction'],
    },
    {
      id: 'predict-conjunction',
      moduleId: 'combining-conditions',
      conceptIds: ['logical-conjunction'],
      objectiveIds: ['predict-compound-operators'],
      title: 'Predict true AND false',
      kind: 'predict',
      scaffoldLevel: 'guided',
      blocks: [
        {
          kind: 'question',
          prompt: 'A = true and B = false. What is A AND B?',
        },
      ],
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
      completionPolicy: { kind: 'passing-evaluation' },
      nextActivityIds: ['predict-disjunction'],
    },
    {
      id: 'predict-disjunction',
      moduleId: 'combining-conditions',
      conceptIds: ['logical-disjunction'],
      objectiveIds: ['predict-compound-operators'],
      title: 'Predict true OR false',
      kind: 'predict',
      scaffoldLevel: 'guided',
      blocks: [
        {
          kind: 'question',
          prompt: 'A = true and B = false. What is A OR B?',
        },
      ],
      response: {
        kind: 'single-choice',
        options: [
          { id: 'option-true', label: 'true' },
          { id: 'option-false', label: 'false' },
        ],
      },
      evaluation: {
        kind: 'choice-selection',
        correctOptionIds: ['option-true'],
      },
      completionPolicy: { kind: 'passing-evaluation' },
      nextActivityIds: ['debug-access-rule', 'transfer-release-gate'],
    },
    {
      id: 'debug-access-rule',
      moduleId: 'combining-conditions',
      conceptIds: ['logical-conjunction', 'compound-conditions'],
      objectiveIds: ['diagnose-compound-condition'],
      title: 'Debug an access rule',
      kind: 'debug',
      scaffoldLevel: 'guided',
      blocks: [
        {
          kind: 'question',
          prompt:
            'accessAllowed = isAdministrator AND hasActiveSubscription. isAdministrator = true. hasActiveSubscription = false. Why is accessAllowed false?',
        },
      ],
      response: {
        kind: 'multiple-choice',
        options: [
          {
            id: 'option-admin-false',
            label: 'isAdministrator is false.',
          },
          {
            id: 'option-subscription-false',
            label: 'hasActiveSubscription is false.',
          },
          {
            id: 'option-and-requires-both',
            label: 'AND requires both conditions to be true.',
          },
        ],
        minimumSelections: 2,
        maximumSelections: 2,
      },
      evaluation: {
        kind: 'choice-selection',
        correctOptionIds: [
          'option-subscription-false',
          'option-and-requires-both',
        ],
      },
      completionPolicy: { kind: 'passing-evaluation' },
      nextActivityIds: [],
    },
    {
      id: 'transfer-release-gate',
      moduleId: 'combining-conditions',
      conceptIds: ['logical-conjunction', 'compound-conditions'],
      objectiveIds: ['apply-decision-rule'],
      title: 'Transfer to a release gate',
      kind: 'transfer',
      scaffoldLevel: 'transfer',
      blocks: [
        {
          kind: 'question',
          prompt:
            'A release ships only when testsPassed AND approvalGranted are both true. testsPassed = true and approvalGranted = false. What should the gate decide?',
        },
      ],
      response: {
        kind: 'text',
        multiline: false,
        minimumLength: 7,
        maximumLength: 20,
      },
      evaluation: {
        kind: 'exact-text',
        acceptedAnswers: ['do not release', 'block release'],
        caseSensitive: false,
        trimWhitespace: true,
      },
      completionPolicy: { kind: 'passing-evaluation' },
      nextActivityIds: [],
    },
  ],
  extensions: [],
})

export const logicBasicsSubjectAdapter =
  createSubjectAdapter(logicBasicsSubject)
