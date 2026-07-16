import { describe, expect, expectTypeOf, it } from 'vitest'

import type { DefinedLearnerProfile } from './index'
import { demoLearnerProfile, defineLearnerProfile } from './index'

function demoLearnerProfileInput() {
  return {
    schemaVersion: '0.1',
    id: 'demo-learner-v1',
    learnerId: 'demo-learner',
    displayName: 'Demo learner',
    reportedTraits: [
      'prefers compact explanations',
      'strong pattern recognition',
      'strong systems thinking',
      'prefers nonlinear exploration',
      'benefits from explicit attention anchors',
    ],
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

describe('defineLearnerProfile', () => {
  it('validates and freezes caller-provided learner profile data', () => {
    const input = demoLearnerProfileInput()
    const profile = defineLearnerProfile(input)

    expect(profile.id).toBe('demo-learner-v1')
    expect(profile.learnerId).toBe('demo-learner')
    expect(Object.isFrozen(profile)).toBe(true)
    expect(Object.isFrozen(profile.reportedTraits)).toBe(true)
    expect(Object.isFrozen(profile.presentation)).toBe(true)
    expect(Object.isFrozen(profile.instruction)).toBe(true)
    expect(Object.isFrozen(profile.errorHandling)).toBe(true)
    expect(Object.isFrozen(profile.defaultOutputSequence)).toBe(true)
    expect(Object.isFrozen(profile.constraints)).toBe(true)
    expect(Object.isFrozen(input)).toBe(false)
    expect(Object.isFrozen(input.reportedTraits)).toBe(false)
  })

  it('rejects unsupported schema versions', () => {
    const input = demoLearnerProfileInput()
    input.schemaVersion = '0.2'

    expect(() => defineLearnerProfile(input)).toThrow()
  })

  it('returns a deeply readonly profile type', () => {
    const profile = defineLearnerProfile(demoLearnerProfileInput())
    const typedProfile: DefinedLearnerProfile = profile

    expectTypeOf(typedProfile.reportedTraits).toExtend<readonly string[]>()
    expectTypeOf(typedProfile.defaultOutputSequence).toExtend<
      readonly string[]
    >()
  })
})

describe('demoLearnerProfile', () => {
  it('exports one validated fixed profile through the public profiles barrel', () => {
    expect(demoLearnerProfile.id).toBe('demo-learner-v1')
    expect(demoLearnerProfile.learnerId).toBe('demo-learner')
    expect(demoLearnerProfile.displayName).toBe('Demo learner')
    expect(demoLearnerProfile.presentation.explanationDensity).toBe('compact')
    expect(demoLearnerProfile.presentation.signalPriority).toBe('high')
    expect(demoLearnerProfile.instruction.defaultChunkSize).toBe('small')
    expect(
      demoLearnerProfile.instruction.preserveCurrentThreadDuringDigressions,
    ).toBe(true)
    expect(demoLearnerProfile.errorHandling.feedbackStyle).toBe('direct')
    expect(demoLearnerProfile.defaultOutputSequence).toEqual([
      'concept',
      'build',
      'why',
      'try',
    ])
    expect(Object.isFrozen(demoLearnerProfile)).toBe(true)
  })
})
