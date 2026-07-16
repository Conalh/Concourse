import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import {
  ActivityDefinitionSchema,
  ActivityIdSchema,
  ModuleIdSchema,
  ObjectiveIdSchema,
  OptionIdSchema,
  type ActivityDefinition,
  type EvidencePayload,
} from '../../core/contracts'
import { ActivityResponse } from './ActivityResponse'

function makeActivity(
  input: Partial<ActivityDefinition> & Pick<ActivityDefinition, 'response'>,
): ActivityDefinition {
  return ActivityDefinitionSchema.parse({
    id: ActivityIdSchema.parse('response-activity'),
    moduleId: ModuleIdSchema.parse('response-module'),
    conceptIds: ['response-concept'],
    objectiveIds: [ObjectiveIdSchema.parse('response-objective')],
    title: 'Response activity',
    kind: 'predict',
    scaffoldLevel: 'guided',
    blocks: [{ kind: 'text', body: 'Respond.' }],
    evaluation:
      input.response?.kind === 'number'
        ? { kind: 'numerical-tolerance', expected: 1, absoluteTolerance: 0 }
        : input.response?.kind === 'single-choice' ||
            input.response?.kind === 'multiple-choice'
          ? {
              kind: 'choice-selection',
              correctOptionIds: [OptionIdSchema.parse('option-a')],
            }
          : input.response?.kind === 'confidence'
            ? { kind: 'manual-completion' }
            : {
                kind: 'rubric-assisted-text',
                criteria: [
                  {
                    id: 'criterion-a',
                    description: 'Any response.',
                    required: true,
                  },
                ],
              },
    completionPolicy: { kind: 'submission' },
    nextActivityIds: [],
    ...input,
  })
}

describe('ActivityResponse', () => {
  it('submits single-choice evidence through the callback without inspecting correctness', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn<(payload: EvidencePayload) => void>()
    const activity = makeActivity({
      response: {
        kind: 'single-choice',
        options: [
          { id: OptionIdSchema.parse('option-a'), label: 'True' },
          { id: OptionIdSchema.parse('option-b'), label: 'False' },
        ],
      },
    })

    render(
      <ActivityResponse
        activity={activity}
        isCompleted={false}
        isSubmitting={false}
        showConfidenceMetadata={false}
        onSubmit={(payload) => {
          onSubmit(payload)
        }}
      />,
    )

    await user.click(screen.getByRole('radio', { name: 'False' }))
    await user.click(screen.getByRole('button', { name: 'Submit response' }))

    expect(onSubmit).toHaveBeenCalledWith({
      kind: 'single-choice',
      optionId: 'option-b',
    })
  })

  it('preserves text draft after retry and disables editing after completion', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn<(payload: EvidencePayload) => void>()
    const activity = makeActivity({
      response: {
        kind: 'text',
        multiline: true,
        minimumLength: 2,
        maximumLength: 40,
      },
    })

    const { rerender } = render(
      <ActivityResponse
        activity={activity}
        isCompleted={false}
        isSubmitting={false}
        showConfidenceMetadata={false}
        onSubmit={(payload) => {
          onSubmit(payload)
        }}
      />,
    )
    const responseBox = screen.getByLabelText('Response')
    await user.type(responseBox, 'draft answer')
    await user.click(screen.getByRole('button', { name: 'Submit response' }))

    expect(responseBox).toHaveValue('draft answer')
    expect(onSubmit).toHaveBeenCalledWith({
      kind: 'text',
      value: 'draft answer',
    })

    rerender(
      <ActivityResponse
        activity={activity}
        isCompleted
        isSubmitting={false}
        showConfidenceMetadata={false}
        latestEvidence={{ kind: 'text', value: 'draft answer' }}
        onSubmit={(payload) => {
          onSubmit(payload)
        }}
      />,
    )

    expect(screen.getByLabelText('Response')).toHaveAttribute('readonly')
    expect(screen.getByText(/response saved/i)).toBeInTheDocument()
  })

  it('keeps number input unsubmitted when empty and supports optional confidence metadata separately', async () => {
    const user = userEvent.setup()
    const onSubmit =
      vi.fn<
        (
          payload: EvidencePayload,
          metadata: Readonly<{ confidence?: number; hintsUsed: number }>,
        ) => void
      >()
    const activity = makeActivity({
      response: { kind: 'number', minimum: 0, maximum: 10 },
    })

    render(
      <ActivityResponse
        activity={activity}
        isCompleted={false}
        isSubmitting={false}
        showConfidenceMetadata
        onSubmit={onSubmit}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Submit response' }))
    expect(screen.getByRole('alert')).toHaveTextContent(/enter a number/i)
    expect(onSubmit).not.toHaveBeenCalled()

    await user.type(screen.getByLabelText('Number response'), '4')
    await user.selectOptions(
      screen.getByLabelText('Optional response confidence'),
      '5',
    )
    await user.click(screen.getByRole('button', { name: 'Submit response' }))

    expect(onSubmit).toHaveBeenCalledWith(
      { kind: 'number', value: 4 },
      { confidence: 5, hintsUsed: 0 },
    )
  })

  it('supports multiple choice, code, confidence, and manual evidence controls', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn<(payload: EvidencePayload) => void>()
    const multiple = makeActivity({
      response: {
        kind: 'multiple-choice',
        maximumSelections: 1,
        options: [
          { id: OptionIdSchema.parse('option-a'), label: 'A' },
          { id: OptionIdSchema.parse('option-b'), label: 'B' },
        ],
      },
    })
    const { rerender } = render(
      <ActivityResponse
        activity={multiple}
        isCompleted={false}
        isSubmitting={false}
        showConfidenceMetadata={false}
        onSubmit={(payload) => {
          onSubmit(payload)
        }}
      />,
    )
    await user.click(screen.getByRole('checkbox', { name: 'A' }))
    expect(screen.getByRole('checkbox', { name: 'B' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Submit response' }))
    expect(onSubmit).toHaveBeenLastCalledWith({
      kind: 'multiple-choice',
      optionIds: ['option-a'],
    })

    rerender(
      <ActivityResponse
        activity={makeActivity({
          id: ActivityIdSchema.parse('code-response-activity'),
          response: {
            kind: 'code',
            language: 'ts',
            starterCode: 'const x = 1',
          },
        })}
        isCompleted={false}
        isSubmitting={false}
        showConfidenceMetadata={false}
        onSubmit={(payload) => {
          onSubmit(payload)
        }}
      />,
    )
    const codeBox = screen.getByLabelText(/code response/i)
    expect(codeBox).toHaveValue('const x = 1')

    rerender(
      <ActivityResponse
        activity={makeActivity({
          id: ActivityIdSchema.parse('confidence-response-activity'),
          response: {
            kind: 'confidence',
            minimum: 1,
            maximum: 5,
            lowLabel: 'Low',
            highLabel: 'High',
          },
        })}
        isCompleted={false}
        isSubmitting={false}
        showConfidenceMetadata
        onSubmit={(payload) => {
          onSubmit(payload)
        }}
      />,
    )
    expect(screen.queryByLabelText('Optional response confidence')).toBeNull()

    const manual = ActivityDefinitionSchema.parse({
      ...makeActivity({ response: { kind: 'text', multiline: false } }),
      id: ActivityIdSchema.parse('manual-response-activity'),
      kind: 'orient',
      response: undefined,
      evaluation: { kind: 'manual-completion' },
      completionPolicy: { kind: 'manual' },
    })
    rerender(
      <ActivityResponse
        activity={manual}
        isCompleted={false}
        isSubmitting={false}
        showConfidenceMetadata={false}
        onSubmit={(payload) => {
          onSubmit(payload)
        }}
      />,
    )
    await user.click(screen.getByRole('button', { name: /continue/i }))
    expect(onSubmit).toHaveBeenLastCalledWith({
      kind: 'manual',
      completed: true,
    })
  })
})
