import type { LearningSessionContext } from '../../application'
import { activityStatusLabel } from './format'

export function ModuleNavigator({
  context,
}: Readonly<{ context: LearningSessionContext }>) {
  const progressByActivity = new Map(
    context.record.session.activityProgress.map((progress) => [
      progress.activityId,
      progress.status,
    ]),
  )

  return (
    <nav className="learnt-module-navigator" aria-label="Module sequence">
      <h2>Module sequence</h2>
      <ol>
        {context.orderedModules.map((module) => {
          const activities = context.subject.activities.filter(
            (activity) => activity.moduleId === module.id,
          )

          return (
            <li key={module.id}>
              <h3>{module.title}</h3>
              <ol>
                {activities.map((activity) => {
                  const status = progressByActivity.get(activity.id) ?? 'unseen'
                  const isCurrent = activity.id === context.currentActivity?.id

                  return (
                    <li
                      aria-current={isCurrent ? 'step' : undefined}
                      className="learnt-module-activity"
                      data-status={status}
                      key={activity.id}
                    >
                      <span>{activity.title}</span>
                      <span>{activityStatusLabel(status)}</span>
                    </li>
                  )
                })}
              </ol>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
