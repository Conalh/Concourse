import type { ActivityDefinition, EvidencePayload } from '../contracts'
import { EvidencePayloadSchema } from '../contracts'
import type { DeepReadonly } from '../foundation'
import { LearningEngineError } from './learning-engine-error'

export function parseAndValidateEvidencePayload(
  activity: DeepReadonly<ActivityDefinition>,
  response: unknown,
): EvidencePayload {
  const parsed = EvidencePayloadSchema.safeParse(response)

  if (!parsed.success) {
    throw new LearningEngineError(
      'invalid-evidence',
      'Submitted evidence did not match the evidence payload contract.',
      { path: ['response'], cause: parsed.error },
    )
  }

  validateResponseCompatibility(activity, parsed.data)
  return parsed.data
}

function validateResponseCompatibility(
  activity: DeepReadonly<ActivityDefinition>,
  evidence: EvidencePayload,
): void {
  const response = activity.response

  if (response === undefined) {
    if (evidence.kind !== 'manual') {
      throw new LearningEngineError(
        'response-kind-mismatch',
        'This activity only accepts manual completion evidence.',
        { path: ['response', 'kind'], details: { activityId: activity.id } },
      )
    }

    if (
      activity.completionPolicy.kind !== 'manual' &&
      activity.evaluation.kind !== 'manual-completion'
    ) {
      throw new LearningEngineError(
        'response-kind-mismatch',
        'Manual evidence is only accepted for manual completion activities.',
        { path: ['response', 'kind'], details: { activityId: activity.id } },
      )
    }

    return
  }

  if (evidence.kind !== response.kind) {
    throw new LearningEngineError(
      'response-kind-mismatch',
      'Submitted evidence kind does not match the authored response kind.',
      {
        path: ['response', 'kind'],
        details: {
          activityId: activity.id,
          expectedKind: response.kind,
          receivedKind: evidence.kind,
        },
      },
    )
  }

  switch (response.kind) {
    case 'text':
      if (evidence.kind !== 'text') {
        throwKindMismatch(response.kind, evidence.kind, activity.id)
      }
      validateTextConstraints(response, evidence)
      return
    case 'number':
      if (evidence.kind !== 'number') {
        throwKindMismatch(response.kind, evidence.kind, activity.id)
      }
      validateNumberConstraints(response, evidence)
      return
    case 'single-choice':
      if (evidence.kind !== 'single-choice') {
        throwKindMismatch(response.kind, evidence.kind, activity.id)
      }
      validateSingleChoiceConstraints(response, evidence)
      return
    case 'multiple-choice':
      if (evidence.kind !== 'multiple-choice') {
        throwKindMismatch(response.kind, evidence.kind, activity.id)
      }
      validateMultipleChoiceConstraints(response, evidence)
      return
    case 'confidence':
      if (evidence.kind !== 'confidence') {
        throwKindMismatch(response.kind, evidence.kind, activity.id)
      }
      validateConfidenceConstraints(response, evidence)
      return
    case 'code':
      if (evidence.kind !== 'code') {
        throwKindMismatch(response.kind, evidence.kind, activity.id)
      }
      validateCodeConstraints(response, evidence)
      return
  }
}

function throwKindMismatch(
  expectedKind: string,
  receivedKind: string,
  activityId: string,
): never {
  throw new LearningEngineError(
    'response-kind-mismatch',
    'Submitted evidence kind does not match the authored response kind.',
    {
      path: ['response', 'kind'],
      details: { activityId, expectedKind, receivedKind },
    },
  )
}

function validateTextConstraints(
  response: Extract<
    DeepReadonly<ActivityDefinition>['response'],
    { kind: 'text' }
  >,
  evidence: Extract<EvidencePayload, { kind: 'text' }>,
): void {
  if (
    response.minimumLength !== undefined &&
    evidence.value.length < response.minimumLength
  ) {
    throwConstraintError(
      'Text response is shorter than the authored minimum.',
      ['response', 'value'],
    )
  }

  if (
    response.maximumLength !== undefined &&
    evidence.value.length > response.maximumLength
  ) {
    throwConstraintError('Text response is longer than the authored maximum.', [
      'response',
      'value',
    ])
  }
}

function validateNumberConstraints(
  response: Extract<
    DeepReadonly<ActivityDefinition>['response'],
    { kind: 'number' }
  >,
  evidence: Extract<EvidencePayload, { kind: 'number' }>,
): void {
  if (!Number.isFinite(evidence.value)) {
    throwConstraintError('Number response must be finite.', [
      'response',
      'value',
    ])
  }

  if (response.minimum !== undefined && evidence.value < response.minimum) {
    throwConstraintError('Number response is below the authored minimum.', [
      'response',
      'value',
    ])
  }

  if (response.maximum !== undefined && evidence.value > response.maximum) {
    throwConstraintError('Number response is above the authored maximum.', [
      'response',
      'value',
    ])
  }

  if (response.step !== undefined) {
    const base = response.minimum ?? 0
    const quotient = (evidence.value - base) / response.step

    if (Math.abs(quotient - Math.round(quotient)) > 1e-9) {
      throwConstraintError(
        'Number response does not match the authored step.',
        ['response', 'value'],
      )
    }
  }
}

function validateSingleChoiceConstraints(
  response: Extract<
    DeepReadonly<ActivityDefinition>['response'],
    { kind: 'single-choice' }
  >,
  evidence: Extract<EvidencePayload, { kind: 'single-choice' }>,
): void {
  if (!response.options.some((option) => option.id === evidence.optionId)) {
    throwConstraintError('Selected option does not exist for this activity.', [
      'response',
      'optionId',
    ])
  }
}

function validateMultipleChoiceConstraints(
  response: Extract<
    DeepReadonly<ActivityDefinition>['response'],
    { kind: 'multiple-choice' }
  >,
  evidence: Extract<EvidencePayload, { kind: 'multiple-choice' }>,
): void {
  const optionIds = new Set<string>(response.options.map((option) => option.id))

  if (evidence.optionIds.some((optionId) => !optionIds.has(optionId))) {
    throwConstraintError('Selected option does not exist for this activity.', [
      'response',
      'optionIds',
    ])
  }

  if (
    response.minimumSelections !== undefined &&
    evidence.optionIds.length < response.minimumSelections
  ) {
    throwConstraintError('Too few options were selected.', [
      'response',
      'optionIds',
    ])
  }

  if (
    response.maximumSelections !== undefined &&
    evidence.optionIds.length > response.maximumSelections
  ) {
    throwConstraintError('Too many options were selected.', [
      'response',
      'optionIds',
    ])
  }
}

function validateConfidenceConstraints(
  response: Extract<
    DeepReadonly<ActivityDefinition>['response'],
    { kind: 'confidence' }
  >,
  evidence: Extract<EvidencePayload, { kind: 'confidence' }>,
): void {
  if (evidence.value < response.minimum || evidence.value > response.maximum) {
    throwConstraintError('Confidence response is outside authored bounds.', [
      'response',
      'value',
    ])
  }
}

function validateCodeConstraints(
  response: Extract<
    DeepReadonly<ActivityDefinition>['response'],
    { kind: 'code' }
  >,
  evidence: Extract<EvidencePayload, { kind: 'code' }>,
): void {
  if (evidence.language !== response.language) {
    throwConstraintError(
      'Code language does not match the authored response.',
      ['response', 'language'],
    )
  }
}

function throwConstraintError(
  message: string,
  path: readonly (string | number)[],
): never {
  throw new LearningEngineError('response-constraint-violation', message, {
    path,
  })
}
