import type { SubjectPackage } from '../../contracts'
import { SubjectPackageSchema } from '../../contracts'
import { cloneDeep, deepFreeze } from '../../foundation'
import type { DeepReadonly } from '../../foundation'

export function learningSubjectFixture(): DeepReadonly<SubjectPackage> {
  return deepFreeze(
    cloneDeep(SubjectPackageSchema.parse(learningSubjectInput())),
  )
}

export function learningSubjectInput(): unknown {
  return {
    schemaVersion: '0.1',
    id: 'engine-subject',
    version: '0.1.0',
    title: 'Engine Subject Fixture',
    summary: 'A compact trusted subject for learning-engine tests.',
    tags: ['engine'],
    modules: [
      {
        id: 'module-empty',
        title: 'Empty Warmup',
        summary: 'An intentionally empty earlier module.',
        order: 0,
        conceptIds: [],
        objectiveIds: [],
        activityIds: [],
      },
      {
        id: 'module-foundations',
        title: 'Foundations',
        summary: 'The primary authored activity order.',
        order: 10,
        conceptIds: ['concept-signal', 'concept-choice'],
        objectiveIds: ['objective-answer', 'objective-select'],
        activityIds: [
          'activity-exact',
          'activity-single',
          'activity-multiple',
          'activity-number',
          'activity-confidence',
          'activity-code',
          'activity-rubric',
          'activity-extension',
        ],
      },
      {
        id: 'module-transfer',
        title: 'Transfer',
        summary: 'A later module used for cross-module advancement.',
        order: 20,
        conceptIds: ['concept-signal', 'concept-choice'],
        objectiveIds: ['objective-complete'],
        activityIds: ['activity-manual'],
      },
    ],
    concepts: [
      {
        id: 'concept-signal',
        title: 'Signal',
        summary: 'The learner inspects a signal.',
        prerequisiteConceptIds: [],
        relatedConceptIds: ['concept-choice'],
        tags: ['fixture'],
      },
      {
        id: 'concept-choice',
        title: 'Choice',
        summary: 'The learner chooses among authored options.',
        prerequisiteConceptIds: ['concept-signal'],
        relatedConceptIds: [],
        tags: ['fixture'],
      },
    ],
    objectives: [
      {
        id: 'objective-answer',
        conceptIds: ['concept-signal'],
        statement: 'Submit an exact response.',
        successCriteria: ['Matches one accepted answer.'],
      },
      {
        id: 'objective-select',
        conceptIds: ['concept-choice'],
        statement: 'Select the correct authored options.',
        successCriteria: ['Chooses the complete correct set.'],
      },
      {
        id: 'objective-complete',
        conceptIds: ['concept-signal', 'concept-choice'],
        statement: 'Complete the authored activity.',
        successCriteria: ['Records completion without claiming mastery.'],
      },
    ],
    activities: [
      {
        id: 'activity-exact',
        moduleId: 'module-foundations',
        conceptIds: ['concept-signal'],
        objectiveIds: ['objective-answer'],
        title: 'Exact answer',
        kind: 'predict',
        scaffoldLevel: 'guided',
        blocks: [
          {
            kind: 'question',
            prompt: 'What word completes the fixture answer?',
          },
        ],
        response: {
          kind: 'text',
          multiline: false,
          minimumLength: 3,
          maximumLength: 20,
        },
        evaluation: {
          kind: 'exact-text',
          acceptedAnswers: ['correct answer', 'backup answer'],
          caseSensitive: false,
          trimWhitespace: true,
        },
        completionPolicy: { kind: 'passing-evaluation' },
        nextActivityIds: ['activity-single'],
      },
      {
        id: 'activity-single',
        moduleId: 'module-foundations',
        conceptIds: ['concept-choice'],
        objectiveIds: ['objective-select'],
        title: 'Single choice',
        kind: 'predict',
        scaffoldLevel: 'guided',
        blocks: [
          {
            kind: 'question',
            prompt: 'Which option is the authored answer?',
          },
        ],
        response: {
          kind: 'single-choice',
          options: [
            { id: 'option-yes', label: 'Yes' },
            { id: 'option-no', label: 'No' },
            { id: 'option-maybe', label: 'Maybe' },
          ],
        },
        evaluation: {
          kind: 'choice-selection',
          correctOptionIds: ['option-yes'],
        },
        completionPolicy: { kind: 'passing-evaluation' },
        nextActivityIds: ['activity-multiple', 'activity-number'],
      },
      {
        id: 'activity-multiple',
        moduleId: 'module-foundations',
        conceptIds: ['concept-choice'],
        objectiveIds: ['objective-select'],
        title: 'Multiple choice',
        kind: 'predict',
        scaffoldLevel: 'guided',
        blocks: [
          {
            kind: 'question',
            prompt: 'Which two options are correct?',
          },
        ],
        response: {
          kind: 'multiple-choice',
          options: [
            { id: 'option-alpha', label: 'Alpha' },
            { id: 'option-beta', label: 'Beta' },
            { id: 'option-gamma', label: 'Gamma' },
          ],
          minimumSelections: 1,
          maximumSelections: 2,
        },
        evaluation: {
          kind: 'choice-selection',
          correctOptionIds: ['option-alpha', 'option-beta'],
        },
        completionPolicy: { kind: 'passing-evaluation' },
        nextActivityIds: ['activity-manual'],
      },
      {
        id: 'activity-number',
        moduleId: 'module-foundations',
        conceptIds: ['concept-signal'],
        objectiveIds: ['objective-answer'],
        title: 'Number response',
        kind: 'predict',
        scaffoldLevel: 'guided',
        blocks: [
          {
            kind: 'question',
            prompt: 'Which number is expected?',
          },
        ],
        response: {
          kind: 'number',
          minimum: 0,
          maximum: 10,
          step: 0.5,
        },
        evaluation: {
          kind: 'numerical-tolerance',
          expected: 5,
          absoluteTolerance: 0.5,
        },
        completionPolicy: { kind: 'passing-evaluation' },
        nextActivityIds: ['activity-manual'],
      },
      {
        id: 'activity-confidence',
        moduleId: 'module-foundations',
        conceptIds: ['concept-signal'],
        objectiveIds: ['objective-complete'],
        title: 'Confidence response',
        kind: 'reflect',
        scaffoldLevel: 'guided',
        blocks: [
          {
            kind: 'question',
            prompt: 'How confident are you?',
          },
        ],
        response: {
          kind: 'confidence',
          minimum: 2,
          maximum: 4,
        },
        evaluation: {
          kind: 'extension',
          evaluatorKey: 'engine-subject.confidence-check',
          payload: { note: 'intentionally unimplemented' },
        },
        completionPolicy: { kind: 'submission' },
        nextActivityIds: [],
      },
      {
        id: 'activity-code',
        moduleId: 'module-foundations',
        conceptIds: ['concept-signal'],
        objectiveIds: ['objective-complete'],
        title: 'Code response',
        kind: 'build',
        scaffoldLevel: 'guided',
        blocks: [
          {
            kind: 'question',
            prompt: 'Write the requested code fragment.',
          },
        ],
        response: {
          kind: 'code',
          language: 'typescript',
          starterCode: 'export const value = ',
        },
        evaluation: {
          kind: 'rubric-assisted-text',
          criteria: [
            {
              id: 'contains-export',
              description: 'Contains an export statement.',
              required: true,
            },
          ],
        },
        completionPolicy: { kind: 'submission' },
        nextActivityIds: [],
      },
      {
        id: 'activity-rubric',
        moduleId: 'module-foundations',
        conceptIds: ['concept-signal'],
        objectiveIds: ['objective-complete'],
        title: 'Rubric response',
        kind: 'reflect',
        scaffoldLevel: 'guided',
        blocks: [
          {
            kind: 'question',
            prompt: 'Explain the deciding feature.',
          },
        ],
        response: {
          kind: 'text',
          multiline: true,
          minimumLength: 3,
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
      {
        id: 'activity-extension',
        moduleId: 'module-foundations',
        conceptIds: ['concept-signal'],
        objectiveIds: ['objective-complete'],
        title: 'Extension response',
        kind: 'reflect',
        scaffoldLevel: 'guided',
        blocks: [
          {
            kind: 'question',
            prompt: 'Submit opaque extension data.',
          },
        ],
        response: {
          kind: 'text',
          multiline: false,
          minimumLength: 1,
        },
        evaluation: {
          kind: 'extension',
          evaluatorKey: 'engine-subject.external-evaluator',
          payload: { opaque: true },
        },
        completionPolicy: { kind: 'submission' },
        nextActivityIds: [],
      },
      {
        id: 'activity-manual',
        moduleId: 'module-transfer',
        conceptIds: ['concept-signal', 'concept-choice'],
        objectiveIds: ['objective-complete'],
        title: 'Manual completion',
        kind: 'complete',
        scaffoldLevel: 'independent',
        blocks: [
          {
            kind: 'text',
            body: 'Complete the final reflection when ready.',
          },
        ],
        evaluation: { kind: 'manual-completion' },
        completionPolicy: { kind: 'manual' },
        nextActivityIds: [],
      },
    ],
    extensions: [
      { key: 'engine-subject.confidence-check', kind: 'evaluator' },
      { key: 'engine-subject.external-evaluator', kind: 'evaluator' },
    ],
  }
}
