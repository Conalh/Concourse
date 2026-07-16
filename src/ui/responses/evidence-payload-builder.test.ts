import { describe, expect, it } from 'vitest'

import {
  ActivityDefinitionSchema,
  ActivityIdSchema,
  ModuleIdSchema,
  ObjectiveIdSchema,
  OptionIdSchema,
  type ActivityDefinition,
} from '../../core/contracts'
import type { DeepReadonly } from '../../core/foundation'
import { createProductionSubjectRegistry } from '../../app/subject-registry'
import {
  buildEvidencePayload,
  createInitialResponseDraft,
  restoreDraftFromEvidence,
  toggleMultipleChoiceOption,
} from './evidence-payload-builder'

function activityById(activityId: string): DeepReadonly<ActivityDefinition> {
  const activity = createProductionSubjectRegistry()
    .list()
    .flatMap((adapter) => adapter.subject.activities)
    .find((candidate) => candidate.id === activityId)

  if (activity === undefined) {
    throw new Error(`Missing activity fixture ${activityId}.`)
  }

  return activity
}

function numberActivity(): ActivityDefinition {
  return ActivityDefinitionSchema.parse({
    id: ActivityIdSchema.parse('number-activity'),
    moduleId: ModuleIdSchema.parse('number-module'),
    conceptIds: ['number-concept'],
    objectiveIds: [ObjectiveIdSchema.parse('number-objective')],
    title: 'Number activity',
    kind: 'predict',
    scaffoldLevel: 'guided',
    blocks: [{ kind: 'text', body: 'Enter a finite number.' }],
    response: { kind: 'number' },
    evaluation: {
      kind: 'numerical-tolerance',
      expected: 2,
      absoluteTolerance: 0,
    },
    completionPolicy: { kind: 'passing-evaluation' },
    nextActivityIds: [],
  })
}

describe('evidence payload builder', () => {
  it('builds single-choice evidence only after a selection exists', () => {
    const activity = activityById('predict-negation')
    const empty = createInitialResponseDraft(activity)

    expect(buildEvidencePayload(activity, empty)).toMatchObject({
      status: 'invalid',
    })

    expect(
      buildEvidencePayload(activity, {
        kind: 'single-choice',
        optionId: OptionIdSchema.parse('option-false'),
      }),
    ).toEqual({
      status: 'success',
      payload: { kind: 'single-choice', optionId: 'option-false' },
    })
  })

  it('preserves unparsed number drafts until submit', () => {
    const activity = numberActivity()

    expect(
      buildEvidencePayload(activity, {
        kind: 'number',
        rawValue: '',
      }),
    ).toMatchObject({ status: 'invalid' })
  })

  it('preserves multiple-choice order as selected evidence without treating order as correctness', () => {
    const activity = activityById('recall-boolean-values')
    const first = toggleMultipleChoiceOption(
      { kind: 'multiple-choice', optionIds: [] },
      OptionIdSchema.parse('option-false'),
    )
    const second = toggleMultipleChoiceOption(
      first,
      OptionIdSchema.parse('option-true'),
    )

    expect(buildEvidencePayload(activity, second)).toEqual({
      status: 'success',
      payload: {
        kind: 'multiple-choice',
        optionIds: ['option-false', 'option-true'],
      },
    })
  })

  it('creates manual evidence for manual completion activities', () => {
    const activity = activityById('orient-boolean-values')

    expect(buildEvidencePayload(activity, { kind: 'manual' })).toEqual({
      status: 'success',
      payload: { kind: 'manual', completed: true },
    })
  })

  it('restores compatible drafts from latest evidence after refresh', () => {
    const activity = activityById('predict-negation')

    expect(
      restoreDraftFromEvidence(activity, {
        kind: 'single-choice',
        optionId: OptionIdSchema.parse('option-false'),
      }),
    ).toEqual({ kind: 'single-choice', optionId: 'option-false' })
  })
})
