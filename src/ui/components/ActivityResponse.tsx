import { useEffect, useState } from 'react'

import type {
  ActivityDefinition,
  EvidencePayload,
  SessionId,
} from '../../core/contracts'
import type { DeepReadonly } from '../../core/foundation'
import {
  buildEvidencePayload,
  createInitialResponseDraft,
  toggleMultipleChoiceOption,
  type ResponseDraft,
  type ResponseDraftSnapshot,
  useOptionalResponseDraftStore,
} from '../responses'

export function ActivityResponse({
  sessionId,
  activity,
  latestEvidence,
  isCompleted,
  isSubmitting,
  showConfidenceMetadata,
  onSubmit,
}: Readonly<{
  sessionId?: SessionId
  activity: DeepReadonly<ActivityDefinition>
  latestEvidence?: DeepReadonly<EvidencePayload>
  isCompleted: boolean
  isSubmitting: boolean
  showConfidenceMetadata: boolean
  onSubmit: (
    payload: EvidencePayload,
    metadata: Readonly<{ confidence?: number; hintsUsed: number }>,
  ) => void
}>) {
  const [draftState, setDraftState] = useState(() => ({
    activityId: activity.id,
    draft: createInitialResponseDraft(activity, latestEvidence),
  }))
  const [confidenceState, setConfidenceState] = useState(() => ({
    activityId: activity.id,
    confidence: '',
  }))
  const [issueState, setIssueState] = useState<{
    activityId: ActivityDefinition['id']
    issue: string | null
  }>(() => ({ activityId: activity.id, issue: null }))
  const draft =
    draftState.activityId === activity.id
      ? draftState.draft
      : createInitialResponseDraft(activity, latestEvidence)
  const draftStore = useOptionalResponseDraftStore()
  const expectedResponseKind = responseKindForActivity(activity)
  const storedDraft =
    sessionId === undefined || draftStore === null
      ? null
      : draftStore.getDraft(sessionId, activity.id)
  const routeDraft =
    !isCompleted && storedDraft?.responseKind === expectedResponseKind
      ? storedDraft
      : null
  const committedDraft = isCompleted
    ? createInitialResponseDraft(activity, latestEvidence)
    : null
  const activeDraft = committedDraft ?? routeDraft?.draft ?? draft
  const localConfidence =
    confidenceState.activityId === activity.id ? confidenceState.confidence : ''
  const confidence = routeDraft?.confidence ?? localConfidence
  const issue = issueState.activityId === activity.id ? issueState.issue : null
  const response = activity.response
  const canSubmit = !isCompleted && !isSubmitting

  useEffect(() => {
    if (
      sessionId !== undefined &&
      draftStore !== null &&
      storedDraft !== null &&
      storedDraft.responseKind !== expectedResponseKind
    ) {
      draftStore.clearDraft(sessionId, activity.id)
    }
  }, [activity.id, draftStore, expectedResponseKind, sessionId, storedDraft])

  function setDraft(nextDraft: ResponseDraft) {
    if (sessionId !== undefined && draftStore !== null) {
      draftStore.setDraft(
        sessionId,
        activity.id,
        snapshot(nextDraft, confidence),
      )
      return
    }

    setDraftState({ activityId: activity.id, draft: nextDraft })
  }

  function setConfidence(nextConfidence: string) {
    if (sessionId !== undefined && draftStore !== null) {
      draftStore.setDraft(
        sessionId,
        activity.id,
        snapshot(activeDraft, nextConfidence),
      )
      return
    }

    setConfidenceState({
      activityId: activity.id,
      confidence: nextConfidence,
    })
  }

  function submitForm() {
    const built = buildEvidencePayload(activity, activeDraft)

    if (built.status === 'invalid') {
      setIssueState({ activityId: activity.id, issue: built.issue })
      return
    }

    setIssueState({ activityId: activity.id, issue: null })
    const parsedConfidence =
      confidence.trim().length === 0 ? undefined : Number(confidence)

    onSubmit(built.payload, {
      ...(parsedConfidence === undefined
        ? {}
        : { confidence: parsedConfidence }),
      hintsUsed: 0,
    })
  }

  return (
    <form
      className="learnt-response"
      onSubmit={(event) => {
        event.preventDefault()
        if (canSubmit) {
          submitForm()
        }
      }}
    >
      {renderDraftControl({
        activity,
        draft: activeDraft,
        setDraft: (nextDraft) => {
          setDraft(nextDraft)
        },
        isCompleted,
      })}
      {showConfidenceMetadata && response?.kind !== 'confidence' ? (
        <div className="learnt-field">
          <label htmlFor={`${activity.id}-confidence`}>
            Optional response confidence
          </label>
          <select
            id={`${activity.id}-confidence`}
            value={confidence}
            disabled={isCompleted || isSubmitting}
            onChange={(event) => {
              setConfidence(event.currentTarget.value)
            }}
          >
            <option value="">Not provided</option>
            <option value="1">1, low confidence</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4">4</option>
            <option value="5">5, high confidence</option>
          </select>
        </div>
      ) : null}
      {issue === null ? null : (
        <p className="learnt-form-issue" role="alert">
          {issue}
        </p>
      )}
      {isCompleted ? (
        <p className="learnt-inline-status">
          Response saved for this activity.
        </p>
      ) : (
        <button className="learnt-button" type="submit" disabled={!canSubmit}>
          {isSubmitting ? 'Submitting' : submitLabel(activity)}
        </button>
      )}
    </form>
  )
}

function responseKindForActivity(
  activity: DeepReadonly<ActivityDefinition>,
): ResponseDraft['kind'] {
  return activity.response?.kind ?? 'manual'
}

function snapshot(
  draft: ResponseDraft,
  confidence: string,
): ResponseDraftSnapshot {
  return {
    responseKind: draft.kind,
    draft,
    confidence,
  }
}

function renderDraftControl({
  activity,
  draft,
  setDraft,
  isCompleted,
}: Readonly<{
  activity: DeepReadonly<ActivityDefinition>
  draft: ResponseDraft
  setDraft: (draft: ResponseDraft) => void
  isCompleted: boolean
}>) {
  const response = activity.response

  if (response === undefined || draft.kind === 'manual') {
    return (
      <p className="learnt-inline-status">
        This activity records manual completion.
      </p>
    )
  }

  switch (response.kind) {
    case 'text':
      return draft.kind === 'text' ? (
        <div className="learnt-field">
          <label htmlFor={`${activity.id}-text-response`}>Response</label>
          {response.multiline ? (
            <textarea
              id={`${activity.id}-text-response`}
              value={draft.value}
              minLength={response.minimumLength}
              maxLength={response.maximumLength}
              placeholder={response.placeholder}
              readOnly={isCompleted}
              onChange={(event) => {
                setDraft({ kind: 'text', value: event.currentTarget.value })
              }}
            />
          ) : (
            <input
              id={`${activity.id}-text-response`}
              value={draft.value}
              minLength={response.minimumLength}
              maxLength={response.maximumLength}
              placeholder={response.placeholder}
              readOnly={isCompleted}
              onChange={(event) => {
                setDraft({ kind: 'text', value: event.currentTarget.value })
              }}
            />
          )}
          {response.minimumLength !== undefined ||
          response.maximumLength !== undefined ? (
            <small>
              {response.minimumLength ?? 1} to{' '}
              {response.maximumLength ?? 'unlimited'} characters
            </small>
          ) : null}
        </div>
      ) : null
    case 'number':
      return draft.kind === 'number' ? (
        <div className="learnt-field">
          <label htmlFor={`${activity.id}-number-response`}>
            Number response
          </label>
          <input
            id={`${activity.id}-number-response`}
            type="number"
            inputMode="decimal"
            value={draft.rawValue}
            min={response.minimum}
            max={response.maximum}
            step={response.step}
            readOnly={isCompleted}
            onChange={(event) => {
              setDraft({ kind: 'number', rawValue: event.currentTarget.value })
            }}
          />
        </div>
      ) : null
    case 'single-choice':
      return draft.kind === 'single-choice' ? (
        <fieldset className="learnt-option-group">
          <legend>Choose one option</legend>
          {response.options.map((option) => (
            <label key={option.id}>
              <input
                type="radio"
                name={`${activity.id}-choice`}
                value={option.id}
                checked={draft.optionId === option.id}
                disabled={isCompleted}
                onChange={() => {
                  setDraft({ kind: 'single-choice', optionId: option.id })
                }}
              />
              <span>
                {option.label}
                {option.description === undefined ? null : (
                  <small>{option.description}</small>
                )}
              </span>
            </label>
          ))}
        </fieldset>
      ) : null
    case 'multiple-choice':
      return draft.kind === 'multiple-choice' ? (
        <fieldset className="learnt-option-group">
          <legend>Choose all that apply</legend>
          <p>
            {selectionGuidance(
              response.minimumSelections,
              response.maximumSelections,
            )}
          </p>
          {response.options.map((option) => {
            const checked = draft.optionIds.includes(option.id)
            const maxReached =
              response.maximumSelections !== undefined &&
              draft.optionIds.length >= response.maximumSelections

            return (
              <label key={option.id}>
                <input
                  type="checkbox"
                  value={option.id}
                  checked={checked}
                  disabled={isCompleted || (maxReached && !checked)}
                  onChange={() => {
                    setDraft(
                      toggleMultipleChoiceOption(
                        draft,
                        option.id,
                        response.maximumSelections,
                      ),
                    )
                  }}
                />
                <span>
                  {option.label}
                  {option.description === undefined ? null : (
                    <small>{option.description}</small>
                  )}
                </span>
              </label>
            )
          })}
        </fieldset>
      ) : null
    case 'confidence':
      return draft.kind === 'confidence' ? (
        <div className="learnt-field">
          <label htmlFor={`${activity.id}-confidence-response`}>
            Confidence response
          </label>
          <input
            id={`${activity.id}-confidence-response`}
            type="range"
            min={response.minimum}
            max={response.maximum}
            value={draft.value}
            disabled={isCompleted}
            onChange={(event) => {
              setDraft({
                kind: 'confidence',
                value: Number(event.currentTarget.value),
              })
            }}
          />
          <output>{draft.value}</output>
          <small>
            {response.lowLabel ?? 'Low'} to {response.highLabel ?? 'High'}
          </small>
        </div>
      ) : null
    case 'code':
      return draft.kind === 'code' ? (
        <div className="learnt-field">
          <label htmlFor={`${activity.id}-code-response`}>
            Code response, {response.language}
          </label>
          <textarea
            id={`${activity.id}-code-response`}
            className="learnt-code-input"
            value={draft.source}
            readOnly={isCompleted}
            spellCheck={false}
            onChange={(event) => {
              setDraft({ kind: 'code', source: event.currentTarget.value })
            }}
          />
        </div>
      ) : null
  }
}

function selectionGuidance(
  minimumSelections: number | undefined,
  maximumSelections: number | undefined,
): string {
  if (minimumSelections === undefined && maximumSelections === undefined) {
    return 'Select one or more options.'
  }

  if (minimumSelections !== undefined && maximumSelections !== undefined) {
    return `Select ${String(minimumSelections)} to ${String(maximumSelections)} options.`
  }

  if (minimumSelections !== undefined) {
    return `Select at least ${String(minimumSelections)} options.`
  }

  return `Select no more than ${String(maximumSelections)} options.`
}

function submitLabel(activity: DeepReadonly<ActivityDefinition>): string {
  if (
    activity.response === undefined ||
    activity.completionPolicy.kind === 'manual'
  ) {
    return activity.kind === 'orient' || activity.kind === 'explain'
      ? 'Continue'
      : 'Mark activity complete'
  }

  return 'Submit response'
}
