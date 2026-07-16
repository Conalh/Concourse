import type {
  ActivityDefinition,
  ActivityId,
  ModuleDefinition,
  SubjectPackage,
} from '../contracts'
import type { DeepReadonly } from '../foundation'

type ReadonlySubject = DeepReadonly<SubjectPackage>
type ReadonlyModule = DeepReadonly<ModuleDefinition>
type ReadonlyActivity = DeepReadonly<ActivityDefinition>

export function getCanonicalActivityOrder(
  subject: ReadonlySubject,
): readonly ReadonlyActivity[] {
  const activitiesById = new Map<string, ReadonlyActivity>(
    subject.activities.map((activity) => [activity.id, activity]),
  )

  return [...subject.modules]
    .sort((left, right) => left.order - right.order)
    .flatMap((module) =>
      module.activityIds.flatMap((activityId) => {
        const activity = activitiesById.get(activityId)
        return activity === undefined ? [] : [activity]
      }),
    )
}

export function findActivity(
  subject: ReadonlySubject,
  activityId: ActivityId,
): ReadonlyActivity | undefined {
  return subject.activities.find((activity) => activity.id === activityId)
}

export function findModuleForActivity(
  subject: ReadonlySubject,
  activity: ReadonlyActivity,
): ReadonlyModule | undefined {
  return subject.modules.find((module) => module.id === activity.moduleId)
}

export function findModuleByCurrentId(
  subject: ReadonlySubject,
  moduleId: string,
): ReadonlyModule | undefined {
  return subject.modules.find((module) => module.id === moduleId)
}
