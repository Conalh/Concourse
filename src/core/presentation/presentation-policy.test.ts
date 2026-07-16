import { describe, expect, it, vi } from 'vitest'

import { ActivityDefinitionSchema, LearnerProfileSchema } from '../contracts'
import type {
  ActivityDefinition,
  InteractionMode,
  LearnerProfile,
} from '../contracts'

import { resolvePresentationPolicy } from './index'

interface TestActivityInput {
  id: string
  moduleId: string
  conceptIds: string[]
  objectiveIds: string[]
  title: string
  kind: string
  scaffoldLevel: string
  blocks: { body?: string; kind: string; prompt?: string }[]
  response?: {
    kind: string
    multiline?: boolean
    minimumLength?: number
  }
  evaluation: {
    kind: string
    acceptedAnswers?: string[]
    caseSensitive?: boolean
    trimWhitespace?: boolean
  }
  completionPolicy: { kind: string }
  nextActivityIds: string[]
}

function genericProfileInput() {
  return {
    schemaVersion: '0.1',
    id: 'generic-profile-v1',
    learnerId: 'generic-learner',
    displayName: 'Generic Learner',
    reportedTraits: ['contextual metadata'],
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
}

function createProfile(
  configure?: (input: ReturnType<typeof genericProfileInput>) => void,
): LearnerProfile {
  const input = genericProfileInput()
  configure?.(input)
  return LearnerProfileSchema.parse(input)
}

function activityInput(kind: string): TestActivityInput {
  return {
    id: `activity-${kind}`,
    moduleId: 'generic-module',
    conceptIds: ['generic-concept'],
    objectiveIds: ['generic-objective'],
    title: `Generic ${kind}`,
    kind,
    scaffoldLevel: 'guided',
    blocks: [
      { kind: 'text', body: 'Concrete setup.' },
      { kind: 'question', prompt: 'What should happen next?' },
    ],
    response: {
      kind: 'text',
      multiline: false,
      minimumLength: 1,
    },
    evaluation: {
      kind: 'exact-text',
      acceptedAnswers: ['answer'],
      caseSensitive: false,
      trimWhitespace: true,
    },
    completionPolicy: { kind: 'passing-evaluation' },
    nextActivityIds: [],
  }
}

function createActivity(
  kind: string,
  configure?: (input: ReturnType<typeof activityInput>) => void,
): ActivityDefinition {
  const input = activityInput(kind)
  configure?.(input)
  return ActivityDefinitionSchema.parse(input)
}

function resolve(
  profile: LearnerProfile,
  interactionMode: InteractionMode,
  activity: ActivityDefinition,
) {
  return resolvePresentationPolicy({
    profile,
    interactionMode,
    activity,
  })
}

describe('base presentation policy mapping', () => {
  it.each([
    ['compact', 'small', 3],
    ['balanced', 'medium', 5],
    ['detailed', 'large', 8],
  ])(
    'maps %s density and %s chunks explicitly',
    (density, chunkSize, blockBudget) => {
      const profile = createProfile((input) => {
        input.presentation.explanationDensity = density
        input.presentation.avoidLongPassiveReading = false
        input.instruction.defaultChunkSize = chunkSize
      })
      const policy = resolve(profile, 'coach', createActivity('explain'))

      expect(policy.explanationDensity).toBe(density)
      expect(policy.maximumPrimaryBlocks).toBe(blockBudget)
    },
  )

  it('maps explicit profile fields without using metadata as executable rules', () => {
    const profile = createProfile((input) => {
      input.presentation.systemMapsPreferred = false
      input.instruction.checkpointAtConceptualBoundaries = false
      input.instruction.requestPredictionWhenInformative = false
      input.instruction.permitNonlinearExploration = false
      input.instruction.preserveCurrentThreadDuringDigressions = false
      input.errorHandling.feedbackStyle = 'gentle'
      input.errorHandling.offerImmediateRetry = false
    })
    const policy = resolve(profile, 'coach', createActivity('build'))

    expect(policy.systemContextVisibility).toBe('hidden')
    expect(policy.checkpointBehavior).toBe('minimal')
    expect(policy.predictionBehavior).toBe('none')
    expect(policy.nonlinearExploration).toBe(false)
    expect(policy.preserveCurrentThread).toBe(false)
    expect(policy.feedbackStyle).toBe('gentle')
    expect(policy.immediateRetry).toBe(false)
    expect(policy.outputSequence).toEqual(profile.defaultOutputSequence)
    expect(policy.outputSequence).not.toBe(profile.defaultOutputSequence)
    expect(Object.isFrozen(policy)).toBe(true)
    expect(Object.isFrozen(policy.outputSequence)).toBe(true)
  })
})

describe('interaction mode policy overrides', () => {
  it.each([
    [
      'coach',
      {
        checkpointBehavior: 'boundary',
        interruptionBehavior: 'normal',
        guidanceVisibility: 'normal',
        hintAccess: 'available',
        newMaterial: 'allowed',
      },
    ],
    [
      'flow',
      {
        checkpointBehavior: 'minimal',
        interruptionBehavior: 'reduced',
        optionalContentVisibility: 'collapsed',
        hintAccess: 'on-request',
        maximumPrimaryBlocks: 5,
      },
    ],
    [
      'test',
      {
        checkpointBehavior: 'assessment-only',
        guidanceVisibility: 'reduced',
        hintAccess: 'withheld-until-requested',
        solutionReveal: 'after-evaluation',
        newMaterial: 'avoid',
      },
    ],
    [
      'rescue',
      {
        guidanceVisibility: 'expanded',
        hintAccess: 'proactive',
        immediateRetry: true,
        debriefAfterSupport: true,
      },
    ],
    [
      'zoom',
      {
        systemContextVisibility: 'expanded',
        optionalContentVisibility: 'expanded',
        maximumPrimaryBlocks: null,
        preserveCurrentThread: true,
      },
    ],
    [
      'recap',
      {
        checkpointBehavior: 'frequent',
        newMaterial: 'avoid',
        maximumPrimaryBlocks: 3,
        guidanceVisibility: 'reduced',
      },
    ],
  ])('applies %s mode semantics', (mode, expected) => {
    const policy = resolve(
      createProfile(),
      mode as InteractionMode,
      createActivity('build'),
    )

    expect(policy).toMatchObject(expected)
  })
})

describe('activity semantic constraints', () => {
  it('requires predictions before reveal without weakening Test mode', () => {
    const profile = createProfile()

    expect(
      resolve(profile, 'flow', createActivity('predict')).predictionBehavior,
    ).toBe('required-before-reveal')
    expect(
      resolve(profile, 'flow', createActivity('predict')).solutionReveal,
    ).toBe('after-response')
    expect(
      resolve(profile, 'test', createActivity('predict')).solutionReveal,
    ).toBe('after-evaluation')
  })

  it('keeps worked examples and information activities immediately presentable', () => {
    const profile = createProfile()

    expect(
      resolve(profile, 'test', createActivity('worked-example')).solutionReveal,
    ).toBe('immediate')
    expect(
      resolve(profile, 'test', createActivity('orient')).solutionReveal,
    ).toBe('immediate')
    expect(
      resolve(profile, 'test', createActivity('explain')).solutionReveal,
    ).toBe('immediate')
  })

  it('reveals response-bearing activity solutions after response, or after evaluation in Test mode', () => {
    const profile = createProfile()

    expect(
      resolve(profile, 'coach', createActivity('build')).solutionReveal,
    ).toBe('after-response')
    expect(
      resolve(profile, 'test', createActivity('build')).solutionReveal,
    ).toBe('after-evaluation')
  })

  it('does not invent responses or modify activity content', () => {
    const profile = createProfile()
    const activity = createActivity('reflect', (input) => {
      delete input.response
      input.evaluation = { kind: 'manual-completion' }
      input.completionPolicy = { kind: 'manual' }
    })
    const originalBlocks = structuredClone(activity.blocks)
    const policy = resolve(profile, 'coach', activity)

    expect(policy.requireMeaningfulLearnerAction).toBe(true)
    expect(activity.response).toBeUndefined()
    expect(activity.blocks).toEqual(originalBlocks)
  })
})

describe('determinism and metadata isolation', () => {
  it('ignores identity, display name, reported traits, IDs, and titles', () => {
    const profileA = createProfile()
    const profileB = createProfile((input) => {
      input.id = 'different-profile'
      input.displayName = 'Different'
      input.reportedTraits = ['AudHD', 'fast learner', 'different metadata']
    })
    const activityA = createActivity('predict')
    const activityB = createActivity('predict', (input) => {
      input.id = 'different-activity'
      input.title = 'Different title'
    })

    expect(resolve(profileA, 'flow', activityA)).toEqual(
      resolve(profileB, 'flow', activityB),
    )
  })

  it('does not use time, randomness, object identity, or mutate inputs', () => {
    const dateSpy = vi.spyOn(Date, 'now').mockImplementation(() => {
      throw new Error('Date.now must not be used.')
    })
    const randomSpy = vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('Math.random must not be used.')
    })
    const profile = createProfile()
    const activity = createActivity('transfer')
    const profileBefore = structuredClone(profile)
    const activityBefore = structuredClone(activity)

    try {
      const first = resolve(profile, 'rescue', activity)
      const second = resolve(
        LearnerProfileSchema.parse(structuredClone(genericProfileInput())),
        'rescue',
        ActivityDefinitionSchema.parse(
          structuredClone(activityInput('transfer')),
        ),
      )

      expect(first).toEqual(second)
      expect(Object.isFrozen(first)).toBe(true)
      expect(profile).toEqual(profileBefore)
      expect(activity).toEqual(activityBefore)
    } finally {
      dateSpy.mockRestore()
      randomSpy.mockRestore()
    }
  })
})
