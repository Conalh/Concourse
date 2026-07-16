import type { ActivityKind } from '../contracts'
import { deepFreeze } from '../foundation'

import type {
  MutablePresentationPolicy,
  PresentationPolicy,
  ResolvePresentationPolicyInput,
} from './presentation-policy.types'

export function resolvePresentationPolicy(
  input: ResolvePresentationPolicyInput,
): PresentationPolicy {
  const policy = applyActivitySemantics(
    input.activity.kind,
    input.activity.response !== undefined,
    applyInteractionMode(input.interactionMode, resolveProfileDefaults(input)),
  )

  return deepFreeze(policy)
}

function resolveProfileDefaults(
  input: ResolvePresentationPolicyInput,
): MutablePresentationPolicy {
  const { profile } = input

  return {
    outputSequence: [...profile.defaultOutputSequence],
    explanationDensity: profile.presentation.explanationDensity,
    maximumPrimaryBlocks: mapChunkSize(profile.instruction.defaultChunkSize),
    optionalContentVisibility: resolveOptionalContentVisibility(input),
    systemContextVisibility: profile.presentation.systemMapsPreferred
      ? 'compact'
      : 'hidden',
    checkpointBehavior: profile.instruction.checkpointAtConceptualBoundaries
      ? 'boundary'
      : 'minimal',
    interruptionBehavior: 'normal',
    predictionBehavior: profile.instruction.requestPredictionWhenInformative
      ? 'when-informative'
      : 'none',
    solutionReveal: 'after-response',
    guidanceVisibility: 'normal',
    hintAccess: 'available',
    newMaterial: 'allowed',
    feedbackStyle: profile.errorHandling.feedbackStyle,
    explainDifferenceBriefly: profile.errorHandling.explainDifferenceBriefly,
    immediateRetry: profile.errorHandling.offerImmediateRetry,
    nonlinearExploration: profile.instruction.permitNonlinearExploration,
    preserveCurrentThread:
      profile.instruction.preserveCurrentThreadDuringDigressions,
    requireMeaningfulLearnerAction:
      profile.instruction.requireMeaningfulLearnerAction,
    debriefAfterSupport: false,
  }
}

function mapChunkSize(
  chunkSize: ResolvePresentationPolicyInput['profile']['instruction']['defaultChunkSize'],
): number {
  switch (chunkSize) {
    case 'small':
      return 3
    case 'medium':
      return 5
    case 'large':
      return 8
    default:
      return assertNever(chunkSize)
  }
}

function resolveOptionalContentVisibility(
  input: ResolvePresentationPolicyInput,
): MutablePresentationPolicy['optionalContentVisibility'] {
  const { presentation } = input.profile

  if (
    presentation.explanationDensity === 'compact' ||
    presentation.avoidLongPassiveReading
  ) {
    return 'collapsed'
  }

  if (presentation.explanationDensity === 'balanced') {
    return 'available'
  }

  return 'expanded'
}

function applyInteractionMode(
  interactionMode: ResolvePresentationPolicyInput['interactionMode'],
  policy: MutablePresentationPolicy,
): MutablePresentationPolicy {
  switch (interactionMode) {
    case 'coach':
      return {
        ...policy,
        interruptionBehavior: 'normal',
        guidanceVisibility: 'normal',
        hintAccess: 'available',
        newMaterial: 'allowed',
        debriefAfterSupport: false,
      }
    case 'flow':
      return {
        ...policy,
        checkpointBehavior: 'minimal',
        interruptionBehavior: 'reduced',
        guidanceVisibility: 'normal',
        hintAccess: 'on-request',
        optionalContentVisibility: 'collapsed',
        maximumPrimaryBlocks:
          policy.maximumPrimaryBlocks === null
            ? null
            : Math.min(policy.maximumPrimaryBlocks + 2, 8),
        newMaterial: 'allowed',
        debriefAfterSupport: false,
      }
    case 'test':
      return {
        ...policy,
        checkpointBehavior: 'assessment-only',
        interruptionBehavior: 'only-when-blocked',
        guidanceVisibility: 'reduced',
        hintAccess: 'withheld-until-requested',
        optionalContentVisibility: 'collapsed',
        solutionReveal: 'after-evaluation',
        newMaterial: 'avoid',
        debriefAfterSupport: false,
      }
    case 'rescue':
      return {
        ...policy,
        checkpointBehavior: 'boundary',
        interruptionBehavior: 'normal',
        guidanceVisibility: 'expanded',
        hintAccess: 'proactive',
        optionalContentVisibility: 'available',
        solutionReveal: 'after-response',
        newMaterial: 'allowed',
        immediateRetry: true,
        debriefAfterSupport: true,
      }
    case 'zoom':
      return {
        ...policy,
        checkpointBehavior: 'minimal',
        interruptionBehavior: 'reduced',
        guidanceVisibility: 'expanded',
        hintAccess: 'available',
        optionalContentVisibility: 'expanded',
        systemContextVisibility: 'expanded',
        maximumPrimaryBlocks: null,
        newMaterial: 'allowed',
        preserveCurrentThread: true,
        debriefAfterSupport: false,
      }
    case 'recap':
      return {
        ...policy,
        checkpointBehavior: 'frequent',
        interruptionBehavior: 'normal',
        guidanceVisibility: 'reduced',
        hintAccess: 'on-request',
        optionalContentVisibility: 'collapsed',
        systemContextVisibility: 'compact',
        newMaterial: 'avoid',
        maximumPrimaryBlocks: 3,
        debriefAfterSupport: false,
      }
    default:
      return assertNever(interactionMode)
  }
}

function applyActivitySemantics(
  activityKind: ActivityKind,
  hasResponse: boolean,
  policy: MutablePresentationPolicy,
): MutablePresentationPolicy {
  switch (activityKind) {
    case 'predict':
      return {
        ...policy,
        predictionBehavior: 'required-before-reveal',
        solutionReveal:
          policy.solutionReveal === 'after-evaluation'
            ? 'after-evaluation'
            : 'after-response',
      }
    case 'worked-example':
    case 'orient':
    case 'explain':
      return {
        ...policy,
        solutionReveal: 'immediate',
      }
    case 'complete':
    case 'build':
    case 'modify':
    case 'debug':
    case 'recall':
    case 'transfer':
    case 'reflect':
      return {
        ...policy,
        solutionReveal: hasResponse
          ? policy.solutionReveal === 'after-evaluation'
            ? 'after-evaluation'
            : 'after-response'
          : 'immediate',
      }
    default:
      return assertNever(activityKind)
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled presentation policy case: ${String(value)}.`)
}
