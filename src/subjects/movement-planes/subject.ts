import { createSubjectAdapter, defineSubject } from '../../subject-sdk'

export const movementPlanesSubject = defineSubject({
  schemaVersion: '0.1',
  id: 'movement-planes',
  version: '0.1.0',
  title: 'Movement Planes',
  summary:
    'Classify common movement by predominant anatomical plane while recognizing multiplanar motion.',
  tags: ['anatomy', 'kinesiology', 'movement'],
  modules: [
    {
      id: 'anatomical-planes',
      title: 'Anatomical Planes',
      summary: 'The sagittal, frontal, and transverse planes.',
      order: 0,
      conceptIds: ['sagittal-plane', 'frontal-plane', 'transverse-plane'],
      objectiveIds: [
        'classify-common-movement',
        'identify-directional-feature',
      ],
      activityIds: [
        'orient-anatomical-planes',
        'predict-squat-plane',
        'predict-jumping-jack-plane',
        'predict-trunk-rotation-plane',
      ],
    },
    {
      id: 'movement-classification',
      title: 'Movement Classification',
      summary: 'Primary-plane classification and multiplanar movement.',
      order: 10,
      conceptIds: [
        'primary-plane-classification',
        'multiplanar-movement',
        'sagittal-plane',
        'transverse-plane',
      ],
      objectiveIds: [
        'classify-common-movement',
        'correct-plane-classification',
        'identify-multiple-components',
      ],
      activityIds: [
        'orient-primary-plane',
        'classify-forward-lunge',
        'debug-plane-classification',
        'transfer-lunge-with-rotation',
      ],
    },
  ],
  concepts: [
    {
      id: 'sagittal-plane',
      title: 'Sagittal plane',
      summary: 'Forward and backward movement, such as squatting or lunging.',
      prerequisiteConceptIds: [],
      relatedConceptIds: ['frontal-plane', 'transverse-plane'],
      tags: ['plane'],
    },
    {
      id: 'frontal-plane',
      title: 'Frontal plane',
      summary: 'Side-to-side movement, such as abduction or jumping jacks.',
      prerequisiteConceptIds: [],
      relatedConceptIds: ['sagittal-plane', 'transverse-plane'],
      tags: ['plane'],
    },
    {
      id: 'transverse-plane',
      title: 'Transverse plane',
      summary: 'Rotational movement around a vertical axis.',
      prerequisiteConceptIds: [],
      relatedConceptIds: ['sagittal-plane', 'frontal-plane'],
      tags: ['plane'],
    },
    {
      id: 'primary-plane-classification',
      title: 'Primary-plane classification',
      summary:
        'Choosing the predominant plane for a movement while noting the deciding feature.',
      prerequisiteConceptIds: [
        'sagittal-plane',
        'frontal-plane',
        'transverse-plane',
      ],
      relatedConceptIds: ['multiplanar-movement'],
      tags: ['classification'],
    },
    {
      id: 'multiplanar-movement',
      title: 'Multiplanar movement',
      summary:
        'Real movement often contains components from more than one plane.',
      prerequisiteConceptIds: ['primary-plane-classification'],
      relatedConceptIds: ['transverse-plane'],
      tags: ['classification'],
    },
  ],
  objectives: [
    {
      id: 'classify-common-movement',
      conceptIds: [
        'sagittal-plane',
        'frontal-plane',
        'transverse-plane',
        'primary-plane-classification',
      ],
      statement:
        'Classify a common movement by its predominant anatomical plane.',
      successCriteria: ['Selects the plane that matches the primary motion.'],
    },
    {
      id: 'identify-directional-feature',
      conceptIds: ['sagittal-plane', 'frontal-plane', 'transverse-plane'],
      statement: 'Identify the directional feature used to distinguish planes.',
      successCriteria: ['Names forward/back, side-to-side, or rotation.'],
    },
    {
      id: 'correct-plane-classification',
      conceptIds: ['primary-plane-classification'],
      statement: 'Correct an inaccurate plane classification.',
      successCriteria: ['Identifies the incorrect claim and the better plane.'],
    },
    {
      id: 'identify-multiple-components',
      conceptIds: ['multiplanar-movement'],
      statement: 'Identify multiple plane components in a compound movement.',
      successCriteria: ['Names the sagittal and transverse components.'],
    },
  ],
  activities: [
    {
      id: 'orient-anatomical-planes',
      moduleId: 'anatomical-planes',
      conceptIds: ['sagittal-plane', 'frontal-plane', 'transverse-plane'],
      objectiveIds: ['identify-directional-feature'],
      title: 'Orient to anatomical planes',
      kind: 'orient',
      scaffoldLevel: 'worked',
      blocks: [
        {
          kind: 'comparison',
          items: [
            { label: 'Sagittal', body: 'Forward and backward movement.' },
            { label: 'Frontal', body: 'Side-to-side movement.' },
            { label: 'Transverse', body: 'Rotational movement.' },
          ],
        },
        {
          kind: 'callout',
          purpose: 'mental-model',
          title: 'Primary plane',
          body: 'Primary plane is a classification aid. Real human movement is frequently multiplanar.',
        },
      ],
      evaluation: { kind: 'manual-completion' },
      completionPolicy: { kind: 'manual' },
      nextActivityIds: ['predict-squat-plane'],
    },
    {
      id: 'predict-squat-plane',
      moduleId: 'anatomical-planes',
      conceptIds: ['sagittal-plane'],
      objectiveIds: ['classify-common-movement'],
      title: 'Predict the squat plane',
      kind: 'predict',
      scaffoldLevel: 'guided',
      blocks: [
        {
          kind: 'question',
          prompt:
            'A bodyweight squat mainly moves forward and backward. Which plane is predominant?',
        },
      ],
      response: {
        kind: 'single-choice',
        options: [
          { id: 'option-sagittal', label: 'sagittal' },
          { id: 'option-frontal', label: 'frontal' },
          { id: 'option-transverse', label: 'transverse' },
        ],
      },
      evaluation: {
        kind: 'choice-selection',
        correctOptionIds: ['option-sagittal'],
      },
      completionPolicy: { kind: 'passing-evaluation' },
      nextActivityIds: ['predict-jumping-jack-plane'],
    },
    {
      id: 'predict-jumping-jack-plane',
      moduleId: 'anatomical-planes',
      conceptIds: ['frontal-plane'],
      objectiveIds: ['classify-common-movement'],
      title: 'Predict the jumping-jack plane',
      kind: 'predict',
      scaffoldLevel: 'guided',
      blocks: [
        {
          kind: 'question',
          prompt:
            'A jumping jack mainly moves the limbs side to side. Which plane is predominant?',
        },
      ],
      response: {
        kind: 'single-choice',
        options: [
          { id: 'option-sagittal', label: 'sagittal' },
          { id: 'option-frontal', label: 'frontal' },
          { id: 'option-transverse', label: 'transverse' },
        ],
      },
      evaluation: {
        kind: 'choice-selection',
        correctOptionIds: ['option-frontal'],
      },
      completionPolicy: { kind: 'passing-evaluation' },
      nextActivityIds: ['predict-trunk-rotation-plane'],
    },
    {
      id: 'predict-trunk-rotation-plane',
      moduleId: 'anatomical-planes',
      conceptIds: ['transverse-plane'],
      objectiveIds: ['classify-common-movement'],
      title: 'Predict the trunk-rotation plane',
      kind: 'predict',
      scaffoldLevel: 'guided',
      blocks: [
        {
          kind: 'question',
          prompt:
            'A trunk rotation turns around a vertical axis. Which plane is predominant?',
        },
      ],
      response: {
        kind: 'single-choice',
        options: [
          { id: 'option-sagittal', label: 'sagittal' },
          { id: 'option-frontal', label: 'frontal' },
          { id: 'option-transverse', label: 'transverse' },
        ],
      },
      evaluation: {
        kind: 'choice-selection',
        correctOptionIds: ['option-transverse'],
      },
      completionPolicy: { kind: 'passing-evaluation' },
      nextActivityIds: ['orient-primary-plane'],
    },
    {
      id: 'orient-primary-plane',
      moduleId: 'movement-classification',
      conceptIds: ['primary-plane-classification', 'multiplanar-movement'],
      objectiveIds: ['identify-directional-feature'],
      title: 'Orient to primary-plane classification',
      kind: 'orient',
      scaffoldLevel: 'worked',
      blocks: [
        {
          kind: 'callout',
          purpose: 'observation',
          title: 'Classification aid',
          body: 'Primary plane does not mean exclusive plane. It names the most useful classification for the main motion.',
        },
      ],
      evaluation: { kind: 'manual-completion' },
      completionPolicy: { kind: 'manual' },
      nextActivityIds: ['classify-forward-lunge'],
    },
    {
      id: 'classify-forward-lunge',
      moduleId: 'movement-classification',
      conceptIds: ['sagittal-plane', 'primary-plane-classification'],
      objectiveIds: ['classify-common-movement'],
      title: 'Classify a forward lunge',
      kind: 'predict',
      scaffoldLevel: 'guided',
      blocks: [
        {
          kind: 'question',
          prompt:
            'A forward lunge mainly moves forward and backward. Which plane is predominant?',
        },
      ],
      response: {
        kind: 'single-choice',
        options: [
          { id: 'option-sagittal', label: 'sagittal' },
          { id: 'option-frontal', label: 'frontal' },
          { id: 'option-transverse', label: 'transverse' },
        ],
      },
      evaluation: {
        kind: 'choice-selection',
        correctOptionIds: ['option-sagittal'],
      },
      completionPolicy: { kind: 'passing-evaluation' },
      nextActivityIds: ['debug-plane-classification'],
    },
    {
      id: 'debug-plane-classification',
      moduleId: 'movement-classification',
      conceptIds: [
        'primary-plane-classification',
        'multiplanar-movement',
        'transverse-plane',
      ],
      objectiveIds: ['correct-plane-classification'],
      title: 'Debug a plane classification',
      kind: 'debug',
      scaffoldLevel: 'guided',
      blocks: [
        {
          kind: 'question',
          prompt:
            'A coach says a forward lunge with trunk rotation is only sagittal. What needs correction?',
        },
      ],
      response: {
        kind: 'multiple-choice',
        options: [
          {
            id: 'option-sagittal-component',
            label: 'The lunge has a sagittal component.',
          },
          {
            id: 'option-transverse-component',
            label: 'The trunk rotation adds a transverse component.',
          },
          {
            id: 'option-not-exclusive',
            label: 'Primary plane classification is not exclusive.',
          },
        ],
        minimumSelections: 2,
        maximumSelections: 2,
      },
      evaluation: {
        kind: 'choice-selection',
        correctOptionIds: [
          'option-transverse-component',
          'option-not-exclusive',
        ],
      },
      completionPolicy: { kind: 'passing-evaluation' },
      nextActivityIds: ['transfer-lunge-with-rotation'],
    },
    {
      id: 'transfer-lunge-with-rotation',
      moduleId: 'movement-classification',
      conceptIds: [
        'sagittal-plane',
        'transverse-plane',
        'multiplanar-movement',
      ],
      objectiveIds: ['identify-multiple-components'],
      title: 'Transfer to a lunge with rotation',
      kind: 'transfer',
      scaffoldLevel: 'transfer',
      blocks: [
        {
          kind: 'question',
          prompt:
            'Explain the sagittal and transverse components in a forward lunge with trunk rotation.',
        },
      ],
      response: {
        kind: 'text',
        multiline: true,
        minimumLength: 10,
      },
      evaluation: {
        kind: 'rubric-assisted-text',
        criteria: [
          {
            id: 'names-sagittal',
            description: 'Names the forward-lunge sagittal component.',
            required: true,
          },
          {
            id: 'names-transverse',
            description: 'Names the trunk-rotation transverse component.',
            required: true,
          },
        ],
      },
      completionPolicy: { kind: 'submission' },
      nextActivityIds: [],
    },
  ],
  extensions: [],
})

export const movementPlanesSubjectAdapter = createSubjectAdapter(
  movementPlanesSubject,
)
