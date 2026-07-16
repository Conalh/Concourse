import { LearnerProfileSchema } from '../core/contracts'
import type { LearnerProfile } from '../core/contracts'
import { cloneDeep, deepFreeze } from '../core/foundation'
import type { DeepReadonly } from '../core/foundation'

export type DefinedLearnerProfile = DeepReadonly<LearnerProfile>

export function defineLearnerProfile(input: unknown): DefinedLearnerProfile {
  const profile = LearnerProfileSchema.parse(input)

  return deepFreeze(cloneDeep(profile))
}
