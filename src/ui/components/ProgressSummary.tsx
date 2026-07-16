import type { ProgressSummary as ProgressSummaryModel } from '../../application'

export function ProgressSummary({
  progress,
}: Readonly<{ progress: ProgressSummaryModel }>) {
  const remaining = progress.unseen + progress.active
  const completedRatio =
    progress.total === 0
      ? 0
      : Math.round((progress.completed / progress.total) * 100)

  return (
    <section className="learnt-progress-summary" aria-label="Activity progress">
      <p>
        <strong>{progress.completed}</strong> completed
      </p>
      <p>
        <strong>{progress.attempted}</strong> attempted
      </p>
      <p>
        <strong>{remaining}</strong> remaining
      </p>
      <div
        className="learnt-progress-meter"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={progress.total}
        aria-valuenow={progress.completed}
        aria-label={`${String(progress.completed)} of ${String(progress.total)} activities completed`}
      >
        <span style={{ inlineSize: `${String(completedRatio)}%` }} />
      </div>
    </section>
  )
}
