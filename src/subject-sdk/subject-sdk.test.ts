import { describe, expect, expectTypeOf, it } from 'vitest'

import type { SubjectId } from '../core/contracts'
import {
  SubjectDefinitionError,
  SubjectRegistryError,
  createSubjectAdapter,
  defineSubject,
  SubjectRegistry,
} from './index'
import { validSubjectInput } from './test-fixtures/valid-subject.fixture'

function cloneFixture() {
  return structuredClone(validSubjectInput())
}

function getIssue(error: unknown, code: string) {
  expect(error).toBeInstanceOf(SubjectDefinitionError)
  const definitionError = error as SubjectDefinitionError
  const issue = definitionError.issues.find(
    (candidate) => candidate.code === code,
  )
  expect(issue).toBeDefined()
  return issue
}

function expectDefinitionIssue(input: unknown, code: string) {
  try {
    defineSubject(input)
  } catch (error) {
    return getIssue(error, code)
  }

  throw new Error(`Expected defineSubject to reject with ${code}.`)
}

function requiredItem<T>(items: readonly T[], index: number): T {
  const item = items[index]

  if (item === undefined) {
    throw new Error(`Expected test fixture item at index ${String(index)}.`)
  }

  return item
}

function expectExtensionBlock(block: unknown): {
  readonly kind: 'extension'
  readonly payload: unknown
} {
  if (typeof block !== 'object' || block === null) {
    throw new Error('Expected an extension content block.')
  }

  const candidate = block as {
    readonly kind?: unknown
    readonly payload?: unknown
  }

  if (candidate.kind !== 'extension' || !('payload' in candidate)) {
    throw new Error('Expected an extension content block.')
  }

  return { kind: 'extension', payload: candidate.payload }
}

describe('defineSubject', () => {
  it('accepts a valid complete package through the public SDK barrel', () => {
    const subject = defineSubject(validSubjectInput())

    expect(subject.id).toBe('example-subject')
    expect(subject.modules).toHaveLength(2)
  })

  it('deeply freezes the returned subject without mutating caller input', () => {
    const input = validSubjectInput()
    const subject = defineSubject(input)

    expect(Object.isFrozen(subject)).toBe(true)
    expect(Object.isFrozen(subject.modules)).toBe(true)
    expect(Object.isFrozen(subject.modules[0])).toBe(true)
    expect(Object.isFrozen(subject.activities)).toBe(true)
    expect(Object.isFrozen(subject.activities[0])).toBe(true)

    expect(Object.isFrozen(input)).toBe(false)
    expect(Object.isFrozen(input.modules)).toBe(false)
  })

  it('returns a deeply readonly type', () => {
    const subject = defineSubject(validSubjectInput())
    const readonlyModules: readonly unknown[] = subject.modules

    expect(readonlyModules).toHaveLength(2)
    expectTypeOf(subject.modules).toExtend<readonly unknown[]>()
    expectTypeOf(subject.activities).toExtend<readonly unknown[]>()
  })

  it('converts shape failures into structured SDK issues', () => {
    const issue = expectDefinitionIssue(
      { schemaVersion: '0.2' },
      'invalid-shape',
    )

    expect(issue?.path).toEqual([])
  })
})

describe('entity uniqueness and module order', () => {
  it('rejects duplicate module, concept, objective, and activity IDs', () => {
    const moduleDuplicate = cloneFixture()
    moduleDuplicate.modules.push({ ...moduleDuplicate.modules[0] })
    expectDefinitionIssue(moduleDuplicate, 'duplicate-entity-id')

    const conceptDuplicate = cloneFixture()
    conceptDuplicate.concepts.push({ ...conceptDuplicate.concepts[0] })
    expectDefinitionIssue(conceptDuplicate, 'duplicate-entity-id')

    const objectiveDuplicate = cloneFixture()
    objectiveDuplicate.objectives.push({ ...objectiveDuplicate.objectives[0] })
    expectDefinitionIssue(objectiveDuplicate, 'duplicate-entity-id')

    const activityDuplicate = cloneFixture()
    activityDuplicate.activities.push({ ...activityDuplicate.activities[0] })
    expectDefinitionIssue(activityDuplicate, 'duplicate-entity-id')
  })

  it('allows duplicate textual IDs across different entity categories', () => {
    const input = cloneFixture()
    input.concepts[0].id = 'shared-id'
    input.concepts[0].relatedConceptIds = []
    input.concepts[1].prerequisiteConceptIds = ['shared-id']
    input.objectives[0].conceptIds = ['shared-id', 'decision-rule']
    input.activities[0].conceptIds = ['shared-id']
    input.activities[1].conceptIds[0] = 'shared-id'
    input.modules[0].conceptIds = ['shared-id', 'decision-rule']
    input.modules[1].conceptIds[0] = 'shared-id'
    input.activities[0].id = 'shared-id'
    input.modules[0].activityIds[0] = 'shared-id'
    input.activities[1].nextActivityIds = ['choose-rule-output']

    expect(() => defineSubject(input)).not.toThrow()
  })

  it('accepts unique non-contiguous module orders and rejects duplicates', () => {
    const accepted = cloneFixture()
    accepted.modules[1].order = 20
    expect(() => defineSubject(accepted)).not.toThrow()

    const rejected = cloneFixture()
    rejected.modules[1].order = 0
    expectDefinitionIssue(rejected, 'duplicate-module-order')
  })
})

describe('reference validation', () => {
  it('rejects missing module references', () => {
    const concept = cloneFixture()
    concept.modules[0].conceptIds[0] = 'missing-concept'
    expect(expectDefinitionIssue(concept, 'missing-reference')?.path).toEqual([
      'modules',
      0,
      'conceptIds',
      0,
    ])

    const objective = cloneFixture()
    objective.modules[0].objectiveIds[0] = 'missing-objective'
    expectDefinitionIssue(objective, 'missing-reference')

    const activity = cloneFixture()
    activity.modules[0].activityIds[0] = 'missing-activity'
    expectDefinitionIssue(activity, 'missing-reference')
  })

  it('rejects missing concept references', () => {
    const prerequisite = cloneFixture()
    prerequisite.concepts[1].prerequisiteConceptIds[0] = 'missing-concept'
    expectDefinitionIssue(prerequisite, 'missing-reference')

    const related = cloneFixture()
    related.concepts[0].relatedConceptIds[0] = 'missing-concept'
    expectDefinitionIssue(related, 'missing-reference')
  })

  it('rejects missing objective and activity references', () => {
    const objectiveConcept = cloneFixture()
    objectiveConcept.objectives[0].conceptIds[0] = 'missing-concept'
    expectDefinitionIssue(objectiveConcept, 'missing-reference')

    const activityModule = cloneFixture()
    activityModule.activities[0].moduleId = 'missing-module'
    expectDefinitionIssue(activityModule, 'missing-reference')

    const activityConcept = cloneFixture()
    activityConcept.activities[0].conceptIds[0] = 'missing-concept'
    expectDefinitionIssue(activityConcept, 'missing-reference')

    const activityObjective = cloneFixture()
    activityObjective.activities[0].objectiveIds[0] = 'missing-objective'
    expectDefinitionIssue(activityObjective, 'missing-reference')

    const nextActivity = cloneFixture()
    nextActivity.activities[0].nextActivityIds[0] = 'missing-activity'
    expectDefinitionIssue(nextActivity, 'missing-reference')
  })
})

describe('module and activity ownership', () => {
  it('rejects an activity absent from its declared module', () => {
    const input = cloneFixture()
    input.modules[0].activityIds = input.modules[0].activityIds.filter(
      (id) => id !== 'orient-input-signal',
    )

    expectDefinitionIssue(input, 'module-activity-mismatch')
  })

  it('rejects an activity listed by another module or by multiple modules', () => {
    const wrongModule = cloneFixture()
    wrongModule.modules[0].activityIds =
      wrongModule.modules[0].activityIds.filter(
        (id) => id !== 'orient-input-signal',
      )
    wrongModule.modules[1].activityIds.push('orient-input-signal')
    expectDefinitionIssue(wrongModule, 'module-activity-mismatch')

    const multipleModules = cloneFixture()
    multipleModules.modules[1].activityIds.push('orient-input-signal')
    expectDefinitionIssue(multipleModules, 'activity-listed-multiple-times')
  })

  it('rejects a module listing an activity whose moduleId differs', () => {
    const input = cloneFixture()
    input.activities[0].moduleId = 'transfer'

    expectDefinitionIssue(input, 'module-activity-mismatch')
  })
})

describe('concept prerequisite graph', () => {
  it('accepts acyclic prerequisites and related-concept cycles', () => {
    expect(() => defineSubject(validSubjectInput())).not.toThrow()

    const relatedCycle = cloneFixture()
    relatedCycle.concepts[2].relatedConceptIds = ['input-signal']
    expect(() => defineSubject(relatedCycle)).not.toThrow()
  })

  it('rejects two-node and longer prerequisite cycles with readable paths', () => {
    const twoNode = cloneFixture()
    twoNode.concepts[0].prerequisiteConceptIds = ['decision-rule']
    const twoNodeIssue = expectDefinitionIssue(
      twoNode,
      'concept-prerequisite-cycle',
    )
    expect(twoNodeIssue?.message).toContain('input-signal')
    expect(twoNodeIssue?.message).toContain('decision-rule')

    const longer = cloneFixture()
    longer.concepts[0].prerequisiteConceptIds = ['transfer-context']
    const longerIssue = expectDefinitionIssue(
      longer,
      'concept-prerequisite-cycle',
    )
    expect(longerIssue?.message).toContain('input-signal')
    expect(longerIssue?.message).toContain('transfer-context')
  })
})

describe('activity sequence graph', () => {
  it('accepts linear, branching, merging, cross-module, and terminal activity graphs', () => {
    expect(() => defineSubject(validSubjectInput())).not.toThrow()

    const branching = cloneFixture()
    branching.activities[0].nextActivityIds = [
      'predict-rule-output',
      'choose-rule-output',
    ]
    expect(() => defineSubject(branching)).not.toThrow()

    const merging = cloneFixture()
    merging.activities[0].nextActivityIds = [
      'predict-rule-output',
      'choose-rule-output',
    ]
    merging.activities[1].nextActivityIds = ['transfer-rule']
    merging.activities[2].nextActivityIds = ['transfer-rule']
    expect(() => defineSubject(merging)).not.toThrow()
  })

  it('rejects two-activity and longer sequence cycles', () => {
    const twoNode = cloneFixture()
    twoNode.activities[0].nextActivityIds = ['predict-rule-output']
    twoNode.activities[1].nextActivityIds = ['orient-input-signal']
    expectDefinitionIssue(twoNode, 'activity-sequence-cycle')

    const longer = cloneFixture()
    longer.activities[3].nextActivityIds = ['predict-rule-output']
    const issue = expectDefinitionIssue(longer, 'activity-sequence-cycle')
    expect(issue?.message).toContain('predict-rule-output')
    expect(issue?.message).toContain('transfer-rule')
  })
})

describe('choice integrity', () => {
  it('rejects invalid choice answer references and counts', () => {
    const missing = cloneFixture()
    missing.activities[2].evaluation.correctOptionIds = ['option-missing']
    expectDefinitionIssue(missing, 'invalid-choice-answer-reference')

    const singleMultiple = cloneFixture()
    singleMultiple.activities[2].evaluation.correctOptionIds = [
      'option-output',
      'option-ignore',
    ]
    expectDefinitionIssue(singleMultiple, 'invalid-choice-answer-reference')

    const tooFewForMinimum = cloneFixture()
    tooFewForMinimum.activities[2].response = {
      kind: 'multiple-choice',
      options: [
        { id: 'option-a', label: 'A' },
        { id: 'option-b', label: 'B' },
        { id: 'option-c', label: 'C' },
      ],
      minimumSelections: 3,
    }
    tooFewForMinimum.activities[2].evaluation.correctOptionIds = [
      'option-a',
      'option-b',
    ]
    expectDefinitionIssue(tooFewForMinimum, 'invalid-choice-answer-reference')
  })

  it('accepts valid single-choice and multiple-choice activities', () => {
    expect(() => defineSubject(validSubjectInput())).not.toThrow()

    const multipleChoice = cloneFixture()
    multipleChoice.activities[2].response = {
      kind: 'multiple-choice',
      options: [
        { id: 'option-a', label: 'A' },
        { id: 'option-b', label: 'B' },
        { id: 'option-c', label: 'C' },
      ],
      minimumSelections: 1,
      maximumSelections: 2,
    }
    multipleChoice.activities[2].evaluation.correctOptionIds = [
      'option-a',
      'option-b',
    ]
    expect(() => defineSubject(multipleChoice)).not.toThrow()
  })
})

describe('extension manifest integrity', () => {
  it('accepts declared renderer and evaluator keys with opaque payloads', () => {
    const input = cloneFixture()
    input.extensions = [
      { kind: 'renderer', key: 'example-subject.signal-card' },
      { kind: 'evaluator', key: 'example-subject.rule-check' },
      { kind: 'renderer', key: 'example-subject.unused' },
    ]
    input.activities[0].blocks.push({
      kind: 'extension',
      rendererKey: 'example-subject.signal-card',
      payload: { nested: { value: 1 } },
    })
    input.activities[3].evaluation = {
      kind: 'extension',
      evaluatorKey: 'example-subject.rule-check',
      payload: { opaque: true },
    }

    const subject = defineSubject(input)

    const extensionBlock = expectExtensionBlock(
      requiredItem(requiredItem(subject.activities, 0).blocks, 1),
    )
    expect(Object.isFrozen(extensionBlock.payload)).toBe(true)
  })

  it('rejects undeclared or wrong-kind renderer and evaluator keys', () => {
    const undeclaredRenderer = cloneFixture()
    undeclaredRenderer.activities[0].blocks.push({
      kind: 'extension',
      rendererKey: 'example-subject.signal-card',
      payload: {},
    })
    expectDefinitionIssue(undeclaredRenderer, 'undeclared-renderer-extension')

    const wrongKindRenderer = cloneFixture()
    wrongKindRenderer.extensions = [
      { kind: 'evaluator', key: 'example-subject.signal-card' },
    ]
    wrongKindRenderer.activities[0].blocks.push({
      kind: 'extension',
      rendererKey: 'example-subject.signal-card',
      payload: {},
    })
    expectDefinitionIssue(wrongKindRenderer, 'undeclared-renderer-extension')

    const undeclaredEvaluator = cloneFixture()
    undeclaredEvaluator.activities[3].evaluation = {
      kind: 'extension',
      evaluatorKey: 'example-subject.rule-check',
      payload: {},
    }
    expectDefinitionIssue(undeclaredEvaluator, 'undeclared-evaluator-extension')
  })
})

describe('error aggregation', () => {
  it('returns one SubjectDefinitionError with multiple independent issues', () => {
    const input = cloneFixture()
    input.modules[1].order = 0
    input.modules[0].conceptIds[0] = 'missing-concept'
    input.activities[2].evaluation.correctOptionIds = ['option-missing']

    try {
      defineSubject(input)
    } catch (error) {
      expect(error).toBeInstanceOf(SubjectDefinitionError)
      const definitionError = error as SubjectDefinitionError

      expect(definitionError.issues.length).toBeGreaterThanOrEqual(3)
      expect(definitionError.issues.map((issue) => issue.code)).toContain(
        'duplicate-module-order',
      )
      expect(definitionError.issues.map((issue) => issue.code)).toContain(
        'missing-reference',
      )
      expect(definitionError.issues.map((issue) => issue.code)).toContain(
        'invalid-choice-answer-reference',
      )
      return
    }

    throw new Error('Expected aggregated subject definition error.')
  })
})

describe('subject adapter and registry', () => {
  it('wraps a defined subject in a frozen adapter', () => {
    const subject = defineSubject(validSubjectInput())
    const adapter = createSubjectAdapter(subject)

    expect(adapter.subject).toBe(subject)
    expect(Object.isFrozen(adapter)).toBe(true)
    expect(Object.isFrozen(adapter.subject)).toBe(true)
  })

  it('registers adapters, preserves order, and returns readonly snapshots', () => {
    const registry = new SubjectRegistry()
    const first = createSubjectAdapter(defineSubject(validSubjectInput()))
    const secondInput = cloneFixture()
    secondInput.id = 'second-subject'
    secondInput.title = 'Second Subject'
    const second = createSubjectAdapter(defineSubject(secondInput))

    registry.register(first)
    registry.register(second)

    expect(registry.has(first.subject.id)).toBe(true)
    expect(registry.get(first.subject.id)).toBe(first)
    expect(registry.get('missing-subject' as SubjectId)).toBeUndefined()
    expect(registry.list().map((adapter) => adapter.subject.id)).toEqual([
      'example-subject',
      'second-subject',
    ])

    const list = registry.list()
    expect(Object.isFrozen(list)).toBe(true)
  })

  it('rejects duplicate registrations without replacing the original', () => {
    const registry = new SubjectRegistry()
    const original = createSubjectAdapter(defineSubject(validSubjectInput()))
    const duplicateInput = cloneFixture()
    duplicateInput.version = '0.2.0'
    const duplicate = createSubjectAdapter(defineSubject(duplicateInput))

    registry.register(original)

    expect(() => {
      registry.register(duplicate)
    }).toThrow(SubjectRegistryError)
    expect(registry.get(original.subject.id)).toBe(original)
  })
})
