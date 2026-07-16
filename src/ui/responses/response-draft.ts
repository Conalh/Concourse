import type {
  ActivityDefinition,
  CodeEvidence,
  ConfidenceEvidence,
  EvidencePayload,
  MultipleChoiceEvidence,
  NumberEvidence,
  OptionId,
  SingleChoiceEvidence,
  TextEvidence,
} from '../../core/contracts'
import type { DeepReadonly } from '../../core/foundation'

type UiActivityDefinition = DeepReadonly<ActivityDefinition>

export type ResponseDraft =
  | { kind: 'text'; value: string }
  | { kind: 'number'; rawValue: string }
  | { kind: 'single-choice'; optionId: OptionId | null }
  | { kind: 'multiple-choice'; optionIds: readonly OptionId[] }
  | { kind: 'confidence'; value: number }
  | { kind: 'code'; source: string }
  | { kind: 'manual' }

export type EvidenceBuildResult =
  | { status: 'success'; payload: EvidencePayload }
  | { status: 'invalid'; issue: string }

export function createInitialResponseDraft(
  activity: UiActivityDefinition,
  latestEvidence?: DeepReadonly<EvidencePayload>,
): ResponseDraft {
  const restored =
    latestEvidence === undefined
      ? null
      : restoreDraftFromEvidence(activity, latestEvidence)

  if (restored !== null) {
    return restored
  }

  const response = activity.response

  if (response === undefined) {
    return { kind: 'manual' }
  }

  switch (response.kind) {
    case 'text':
      return { kind: 'text', value: '' }
    case 'number':
      return { kind: 'number', rawValue: '' }
    case 'single-choice':
      return { kind: 'single-choice', optionId: null }
    case 'multiple-choice':
      return { kind: 'multiple-choice', optionIds: [] }
    case 'confidence':
      return { kind: 'confidence', value: response.minimum }
    case 'code':
      return { kind: 'code', source: response.starterCode ?? '' }
  }
}

export function restoreDraftFromEvidence(
  activity: UiActivityDefinition,
  evidence: DeepReadonly<EvidencePayload>,
): ResponseDraft | null {
  const response = activity.response

  if (response === undefined) {
    return evidence.kind === 'manual' ? { kind: 'manual' } : null
  }

  switch (response.kind) {
    case 'text':
      return restoreText(evidence)
    case 'number':
      return restoreNumber(evidence)
    case 'single-choice':
      return restoreSingleChoice(evidence)
    case 'multiple-choice':
      return restoreMultipleChoice(evidence)
    case 'confidence':
      return restoreConfidence(evidence)
    case 'code':
      return restoreCode(evidence)
  }
}

export function buildEvidencePayload(
  activity: UiActivityDefinition,
  draft: ResponseDraft,
): EvidenceBuildResult {
  const response = activity.response

  if (response === undefined) {
    return draft.kind === 'manual'
      ? { status: 'success', payload: { kind: 'manual', completed: true } }
      : { status: 'invalid', issue: 'This activity needs manual completion.' }
  }

  switch (response.kind) {
    case 'text':
      return draft.kind === 'text'
        ? buildTextPayload(response, draft)
        : mismatch()
    case 'number':
      return draft.kind === 'number' ? buildNumberPayload(draft) : mismatch()
    case 'single-choice':
      return draft.kind === 'single-choice'
        ? buildSingleChoicePayload(draft)
        : mismatch()
    case 'multiple-choice':
      return draft.kind === 'multiple-choice'
        ? buildMultipleChoicePayload(response, draft)
        : mismatch()
    case 'confidence':
      return draft.kind === 'confidence'
        ? buildConfidencePayload(response, draft)
        : mismatch()
    case 'code':
      return draft.kind === 'code'
        ? { status: 'success', payload: codePayloadFromDraft(response, draft) }
        : mismatch()
  }
}

export function toggleMultipleChoiceOption(
  draft: Extract<ResponseDraft, { kind: 'multiple-choice' }>,
  optionId: OptionId,
  maximumSelections?: number,
): Extract<ResponseDraft, { kind: 'multiple-choice' }> {
  const selected = draft.optionIds.includes(optionId)

  if (selected) {
    return {
      kind: 'multiple-choice',
      optionIds: draft.optionIds.filter((id) => id !== optionId),
    }
  }

  if (
    maximumSelections !== undefined &&
    draft.optionIds.length >= maximumSelections
  ) {
    return draft
  }

  return {
    kind: 'multiple-choice',
    optionIds: [...draft.optionIds, optionId],
  }
}

function restoreText(
  evidence: DeepReadonly<EvidencePayload>,
): ResponseDraft | null {
  return evidence.kind === 'text'
    ? { kind: 'text', value: evidence.value }
    : null
}

function restoreNumber(
  evidence: DeepReadonly<EvidencePayload>,
): ResponseDraft | null {
  return evidence.kind === 'number'
    ? { kind: 'number', rawValue: String(evidence.value) }
    : null
}

function restoreSingleChoice(
  evidence: DeepReadonly<EvidencePayload>,
): ResponseDraft | null {
  return evidence.kind === 'single-choice'
    ? { kind: 'single-choice', optionId: evidence.optionId }
    : null
}

function restoreMultipleChoice(
  evidence: DeepReadonly<EvidencePayload>,
): ResponseDraft | null {
  return evidence.kind === 'multiple-choice'
    ? { kind: 'multiple-choice', optionIds: evidence.optionIds }
    : null
}

function restoreConfidence(
  evidence: DeepReadonly<EvidencePayload>,
): ResponseDraft | null {
  return evidence.kind === 'confidence'
    ? { kind: 'confidence', value: evidence.value }
    : null
}

function restoreCode(
  evidence: DeepReadonly<EvidencePayload>,
): ResponseDraft | null {
  return evidence.kind === 'code'
    ? { kind: 'code', source: evidence.source }
    : null
}

function buildTextPayload(
  response: NonNullable<UiActivityDefinition['response']> & { kind: 'text' },
  draft: Extract<ResponseDraft, { kind: 'text' }>,
): EvidenceBuildResult {
  const length = draft.value.length

  if (length === 0) {
    return { status: 'invalid', issue: 'Enter a response before submitting.' }
  }

  if (response.minimumLength !== undefined && length < response.minimumLength) {
    return {
      status: 'invalid',
      issue: `Enter at least ${String(response.minimumLength)} characters.`,
    }
  }

  if (response.maximumLength !== undefined && length > response.maximumLength) {
    return {
      status: 'invalid',
      issue: `Enter no more than ${String(response.maximumLength)} characters.`,
    }
  }

  return {
    status: 'success',
    payload: { kind: 'text', value: draft.value } satisfies TextEvidence,
  }
}

function mismatch(): EvidenceBuildResult {
  return {
    status: 'invalid',
    issue: 'The current draft does not match this activity response.',
  }
}

function buildNumberPayload(
  draft: Extract<ResponseDraft, { kind: 'number' }>,
): EvidenceBuildResult {
  if (draft.rawValue.trim().length === 0) {
    return { status: 'invalid', issue: 'Enter a number before submitting.' }
  }

  const value = Number(draft.rawValue)

  if (!Number.isFinite(value)) {
    return { status: 'invalid', issue: 'Enter a finite number.' }
  }

  return {
    status: 'success',
    payload: { kind: 'number', value } satisfies NumberEvidence,
  }
}

function buildSingleChoicePayload(
  draft: Extract<ResponseDraft, { kind: 'single-choice' }>,
): EvidenceBuildResult {
  if (draft.optionId === null) {
    return { status: 'invalid', issue: 'Choose one option before submitting.' }
  }

  return {
    status: 'success',
    payload: {
      kind: 'single-choice',
      optionId: draft.optionId,
    } satisfies SingleChoiceEvidence,
  }
}

function buildMultipleChoicePayload(
  response: NonNullable<UiActivityDefinition['response']> & {
    kind: 'multiple-choice'
  },
  draft: Extract<ResponseDraft, { kind: 'multiple-choice' }>,
): EvidenceBuildResult {
  if (draft.optionIds.length === 0) {
    return {
      status: 'invalid',
      issue: 'Choose at least one option before submitting.',
    }
  }

  if (
    response.minimumSelections !== undefined &&
    draft.optionIds.length < response.minimumSelections
  ) {
    return {
      status: 'invalid',
      issue: `Choose at least ${String(response.minimumSelections)} options.`,
    }
  }

  if (
    response.maximumSelections !== undefined &&
    draft.optionIds.length > response.maximumSelections
  ) {
    return {
      status: 'invalid',
      issue: `Choose no more than ${String(response.maximumSelections)} options.`,
    }
  }

  return {
    status: 'success',
    payload: {
      kind: 'multiple-choice',
      optionIds: [...draft.optionIds],
    } satisfies MultipleChoiceEvidence,
  }
}

function buildConfidencePayload(
  response: NonNullable<UiActivityDefinition['response']> & {
    kind: 'confidence'
  },
  draft: Extract<ResponseDraft, { kind: 'confidence' }>,
): EvidenceBuildResult {
  if (draft.value < response.minimum || draft.value > response.maximum) {
    return {
      status: 'invalid',
      issue: 'Choose a confidence value inside the authored range.',
    }
  }

  return {
    status: 'success',
    payload: {
      kind: 'confidence',
      value: draft.value,
    } satisfies ConfidenceEvidence,
  }
}

export function codePayloadFromDraft(
  response: NonNullable<UiActivityDefinition['response']> & { kind: 'code' },
  draft: Extract<ResponseDraft, { kind: 'code' }>,
): CodeEvidence {
  return {
    kind: 'code',
    language: response.language,
    source: draft.source,
  }
}
