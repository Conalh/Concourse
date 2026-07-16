import type { EvaluationResult } from '../../core/contracts'
import type { DeepReadonly } from '../../core/foundation'
import { evaluationStatusLabel } from './format'

export function EvaluationFeedback({
  evaluation,
}: Readonly<{ evaluation: DeepReadonly<EvaluationResult> | null }>) {
  if (evaluation === null) {
    return null
  }

  const statusLabel = evaluationStatusLabel(evaluation.status)
  const matchedCount = evaluation.matchedCriteria.length
  const missingCount = evaluation.missingCriteria.length
  const criteriaSummary =
    matchedCount > 0 || missingCount > 0
      ? `${String(matchedCount)} satisfied / ${String(missingCount)} remaining`
      : null

  return (
    <section
      className={`learnt-evaluation learnt-reviewed-answer learnt-evaluation-${evaluation.status}`}
      aria-live="polite"
      aria-labelledby="evaluation-title"
    >
      <div className="learnt-reviewed-answer-header">
        <p className="learnt-kicker">Reviewed answer</p>
        <span
          className={`learnt-evaluation-status learnt-evaluation-status-${evaluation.status}`}
        >
          {statusLabel}
        </span>
      </div>
      <h2 id="evaluation-title">{statusLabel}</h2>
      <p>{evaluationMessage(evaluation)}</p>
      {evaluation.feedback === undefined ? null : <p>{evaluation.feedback}</p>}
      {evaluation.score === undefined && criteriaSummary === null ? null : (
        <dl className="learnt-evaluation-signals">
          {evaluation.score === undefined ? null : (
            <div>
              <dt>Score signal</dt>
              <dd>{evaluation.score}</dd>
            </div>
          )}
          {criteriaSummary === null ? null : (
            <div>
              <dt>Criteria</dt>
              <dd>{criteriaSummary}</dd>
            </div>
          )}
        </dl>
      )}
    </section>
  )
}

function evaluationMessage(evaluation: DeepReadonly<EvaluationResult>): string {
  switch (evaluation.status) {
    case 'passed':
      return 'Correct - the answer satisfies the current checkpoint.'
    case 'partial':
      return 'Some evidence matched, but this checkpoint still needs another pass.'
    case 'retry':
      return 'Not quite - your draft is still here so you can revise it.'
    case 'ungraded':
      return 'The evidence was recorded without a deterministic judgment.'
  }
}
