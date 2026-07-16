import type {
  ActivityDefinition,
  EvaluationResult,
  EvidencePayload,
} from '../contracts'
import { EvaluationResultSchema } from '../contracts'
import type { DeepReadonly } from '../foundation'

export function evaluateActivityEvidence(
  activity: DeepReadonly<ActivityDefinition>,
  evidence: EvidencePayload,
): EvaluationResult {
  switch (activity.evaluation.kind) {
    case 'manual-completion':
      return defineEvaluationResult(
        evidence.kind === 'manual'
          ? {
              status: 'passed',
              score: 1,
              feedback: 'Manual completion recorded.',
              matchedCriteria: ['manual-completion'],
              missingCriteria: [],
            }
          : {
              status: 'ungraded',
              feedback: 'Manual completion was not recorded.',
              matchedCriteria: [],
              missingCriteria: [],
            },
      )

    case 'exact-text':
      if (evidence.kind !== 'text') {
        return ungradedResult('Text evidence is required for exact evaluation.')
      }

      return evaluateExactText(activity.evaluation, evidence.value)

    case 'choice-selection':
      if (
        evidence.kind !== 'single-choice' &&
        evidence.kind !== 'multiple-choice'
      ) {
        return ungradedResult(
          'Choice evidence is required for choice evaluation.',
        )
      }

      return evaluateChoiceSelection(
        activity.evaluation.correctOptionIds,
        evidence,
      )

    case 'numerical-tolerance':
      if (evidence.kind !== 'number') {
        return ungradedResult(
          'Number evidence is required for numerical evaluation.',
        )
      }

      return evaluateNumber(
        evidence.value,
        activity.evaluation.expected,
        activity.evaluation.absoluteTolerance,
      )

    case 'rubric-assisted-text':
      return ungradedResult('Rubric-assisted evaluation requires an evaluator.')

    case 'extension':
      return ungradedResult('Extension evaluation requires an evaluator.')
  }
}

export function isActivityCompletedByPolicy(
  activity: DeepReadonly<ActivityDefinition>,
  evidence: EvidencePayload,
  evaluation: EvaluationResult,
): boolean {
  switch (activity.completionPolicy.kind) {
    case 'submission':
      return true
    case 'passing-evaluation':
      return evaluation.status === 'passed'
    case 'manual':
      return evidence.kind === 'manual' && evidence.completed
  }
}

function evaluateExactText(
  evaluation: Extract<
    DeepReadonly<ActivityDefinition>['evaluation'],
    { kind: 'exact-text' }
  >,
  value: string,
): EvaluationResult {
  const normalizedValue = normalizeExactText(value, evaluation)
  const accepted = evaluation.acceptedAnswers.some(
    (answer) => normalizeExactText(answer, evaluation) === normalizedValue,
  )

  return defineEvaluationResult(
    accepted
      ? {
          status: 'passed',
          score: 1,
          feedback: 'Response matched an accepted answer.',
          matchedCriteria: ['accepted-answer'],
          missingCriteria: [],
        }
      : {
          status: 'retry',
          score: 0,
          feedback: 'Response did not match an accepted answer.',
          matchedCriteria: [],
          missingCriteria: ['accepted-answer'],
        },
  )
}

function normalizeExactText(
  value: string,
  evaluation: Extract<
    DeepReadonly<ActivityDefinition>['evaluation'],
    { kind: 'exact-text' }
  >,
): string {
  const trimmed = evaluation.trimWhitespace ? value.trim() : value
  return evaluation.caseSensitive ? trimmed : trimmed.toLowerCase()
}

function evaluateChoiceSelection(
  correctOptionIds: readonly string[],
  evidence: Extract<
    EvidencePayload,
    { kind: 'single-choice' | 'multiple-choice' }
  >,
): EvaluationResult {
  const selectedOptionIds =
    evidence.kind === 'single-choice' ? [evidence.optionId] : evidence.optionIds
  const selected = new Set<string>(selectedOptionIds)
  const correct = new Set<string>(correctOptionIds)
  const matchedCriteria = correctOptionIds.filter((optionId) =>
    selected.has(optionId),
  )
  const missingCriteria = correctOptionIds.filter(
    (optionId) => !selected.has(optionId),
  )
  const exact =
    selected.size === correct.size &&
    correctOptionIds.every((optionId) => selected.has(optionId))

  if (exact) {
    return defineEvaluationResult({
      status: 'passed',
      score: 1,
      feedback: 'Selection matched the correct option set.',
      matchedCriteria,
      missingCriteria: [],
    })
  }

  if (evidence.kind === 'single-choice' || matchedCriteria.length === 0) {
    return defineEvaluationResult({
      status: 'retry',
      score: 0,
      feedback: 'Selection did not match the correct option set.',
      matchedCriteria,
      missingCriteria,
    })
  }

  const union = new Set<string>([...selected, ...correct])
  const score = matchedCriteria.length / union.size

  return defineEvaluationResult({
    status: 'partial',
    score,
    feedback: 'Selection partially matched the correct option set.',
    matchedCriteria,
    missingCriteria,
  })
}

function evaluateNumber(
  actual: number,
  expected: number,
  absoluteTolerance: number,
): EvaluationResult {
  const passed = Math.abs(actual - expected) <= absoluteTolerance

  return defineEvaluationResult(
    passed
      ? {
          status: 'passed',
          score: 1,
          feedback: 'Number was within the accepted tolerance.',
          matchedCriteria: ['numerical-tolerance'],
          missingCriteria: [],
        }
      : {
          status: 'retry',
          score: 0,
          feedback: 'Number was outside the accepted tolerance.',
          matchedCriteria: [],
          missingCriteria: ['numerical-tolerance'],
        },
  )
}

function ungradedResult(feedback: string): EvaluationResult {
  return defineEvaluationResult({
    status: 'ungraded',
    feedback,
    matchedCriteria: [],
    missingCriteria: [],
  })
}

function defineEvaluationResult(result: EvaluationResult): EvaluationResult {
  return EvaluationResultSchema.parse(result)
}
