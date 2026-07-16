import type {
  ActivityDefinition,
  InteractionMode,
  LearnerProfile,
} from '../contracts'
import type { DeepReadonly } from '../foundation'

export type CheckpointBehavior =
  | 'frequent'
  | 'boundary'
  | 'minimal'
  | 'assessment-only'

export type InterruptionBehavior = 'normal' | 'reduced' | 'only-when-blocked'

export type OptionalContentVisibility = 'collapsed' | 'available' | 'expanded'

export type SystemContextVisibility = 'hidden' | 'compact' | 'expanded'

export type PredictionBehavior =
  | 'none'
  | 'when-informative'
  | 'required-before-reveal'

export type SolutionReveal = 'immediate' | 'after-response' | 'after-evaluation'

export type GuidanceVisibility = 'reduced' | 'normal' | 'expanded'

export type HintAccess =
  | 'available'
  | 'on-request'
  | 'withheld-until-requested'
  | 'proactive'

export type NewMaterialPolicy = 'allowed' | 'avoid'

export type OutputSequenceItem = LearnerProfile['defaultOutputSequence'][number]

export interface PresentationPolicy {
  readonly outputSequence: readonly OutputSequenceItem[]
  readonly explanationDensity: LearnerProfile['presentation']['explanationDensity']
  readonly maximumPrimaryBlocks: number | null
  readonly optionalContentVisibility: OptionalContentVisibility
  readonly systemContextVisibility: SystemContextVisibility
  readonly checkpointBehavior: CheckpointBehavior
  readonly interruptionBehavior: InterruptionBehavior
  readonly predictionBehavior: PredictionBehavior
  readonly solutionReveal: SolutionReveal
  readonly guidanceVisibility: GuidanceVisibility
  readonly hintAccess: HintAccess
  readonly newMaterial: NewMaterialPolicy
  readonly feedbackStyle: LearnerProfile['errorHandling']['feedbackStyle']
  readonly explainDifferenceBriefly: boolean
  readonly immediateRetry: boolean
  readonly nonlinearExploration: boolean
  readonly preserveCurrentThread: boolean
  readonly requireMeaningfulLearnerAction: boolean
  readonly debriefAfterSupport: boolean
}

export interface ResolvePresentationPolicyInput {
  readonly profile: DeepReadonly<LearnerProfile>
  readonly interactionMode: InteractionMode
  readonly activity: DeepReadonly<ActivityDefinition>
}

export type MutablePresentationPolicy = {
  -readonly [Key in keyof PresentationPolicy]: PresentationPolicy[Key]
}
