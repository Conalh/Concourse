import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  createContractValidatorConformanceAdapter,
  createLogicFoundationsGoldenFixture,
  expectedLogicFoundationsGlobalEntityKeys,
  runLearningPackConformanceChecks,
  validateLearningPackDocuments,
} from '../src/index.js'

describe('logic foundations golden fixture', () => {
  it('validates every release', () => {
    const fixture = createLogicFoundationsGoldenFixture()

    for (const [version, pack] of Object.entries(fixture.releases)) {
      const result = validateLearningPackDocuments(pack)
      expect(result.diagnostics, version).toEqual([])
      expect(result.ok, version).toBe(true)
    }
  })

  it('validates every checked-in logic-foundations release directory', () => {
    for (const version of ['1.0.0', '1.0.1', '1.1.0', '2.0.0'] as const) {
      const pack = readReleaseFixture(version)
      const result = validateLearningPackDocuments(pack)

      expect(result.diagnostics, version).toEqual([])
      expect(result.ok, version).toBe(true)
    }
  })

  it('rejects checked-in invalid logic-foundations packs', () => {
    const missingReference = readLogicFixture(
      'invalid/missing-reference-pack.json',
    )
    const embeddedProgress = readLogicFixture(
      'invalid/embedded-progress-pack.json',
    )

    expect(validateLearningPackDocuments(missingReference).ok).toBe(false)
    expect(validateLearningPackDocuments(embeddedProgress).ok).toBe(false)
  })

  it('exercises the complete v0.1 fixture shape', () => {
    const pack = createLogicFoundationsGoldenFixture().releases['2.0.0']

    expect(pack.catalog.subjects).toHaveLength(2)
    expect(pack.courses.courses).toHaveLength(2)
    expect(pack.theme).toBeDefined()
    expect(pack.migrations?.migrations).toHaveLength(1)
    expect(
      pack.manifest.files.filter((file) => file.role === 'asset'),
    ).toHaveLength(2)

    const nodeKinds = pack.courses.courses.flatMap((course) =>
      flattenKinds(course.rootNodes),
    )
    expect(nodeKinds).toEqual(
      expect.arrayContaining(['module', 'chapter', 'lesson']),
    )

    expect(
      pack.courses.courses.every((course) =>
        course.rootNodes.some((node) =>
          node.conceptIds.includes('concept-truth-values'),
        ),
      ),
    ).toBe(true)

    expect(
      pack.items.items.some((item) =>
        item.allowedPlayModes.includes('flashcard'),
      ),
    ).toBe(true)
    expect(
      pack.items.items.some((item) =>
        item.allowedPlayModes.includes('single-choice-quiz'),
      ),
    ).toBe(true)
    expect(
      pack.items.items.some((item) =>
        item.allowedPlayModes.includes('multiple-choice-quiz'),
      ),
    ).toBe(true)
    expect(
      pack.items.items.some((item) =>
        item.allowedPlayModes.includes('text-recall'),
      ),
    ).toBe(true)
    expect(
      pack.items.items.some((item) =>
        item.allowedPlayModes.includes('number-recall'),
      ),
    ).toBe(true)
    expect(
      pack.items.items.some((item) =>
        item.allowedPlayModes.includes('manual-read'),
      ),
    ).toBe(true)
    expect(
      pack.items.items.every((item) => item.reviewedSolutionBlocks.length > 0),
    ).toBe(true)
  })

  it('documents the progress-reset migration example', () => {
    const fixture = createLogicFoundationsGoldenFixture()
    const mapping = fixture.releases[
      '2.0.0'
    ].migrations!.migrations[0]!.entityMappings.find(
      (entry) => entry.fromId === fixture.masteryResetExample.itemId,
    )

    expect(mapping).toMatchObject({
      entityKind: 'item',
      fromLearningRevision: 1,
      toLearningRevision: 2,
      progressPolicy: 'reset-mastery',
    })
  })

  it('creates expected projection snapshots', () => {
    const snapshots = createLogicFoundationsGoldenFixture().projectionSnapshots

    expect(snapshots.flashcardMode.cards.map((card) => card.itemId)).toEqual([
      'item-truth-values-flashcard',
      'item-negation-single-choice',
      'item-connectives-multiple-choice',
      'item-validity-text-recall',
      'item-truth-table-row-count',
      'item-conditional-single-choice',
      'item-validity-flashcard',
    ])
    expect(
      snapshots.quizMode.questions.map((question) => question.playMode),
    ).toEqual([
      'single-choice-quiz',
      'multiple-choice-quiz',
      'text-recall',
      'number-recall',
      'single-choice-quiz',
    ])
    expect(snapshots.curriculumNavigation.courses).toHaveLength(2)
    expect(
      snapshots.subjectFiltering.subjects.find(
        (subject) => subject.subjectId === 'subject-proof-strategies',
      )?.itemIds,
    ).toContain('item-soundness-manual-read')
    expect(
      snapshots.studySetSelection.sets.find(
        (set) => set.setId === 'set-core-quiz',
      )?.resolvedItemIds,
    ).toEqual([
      'item-connectives-multiple-choice',
      'item-conditional-single-choice',
    ])
  })

  it('keeps checked-in projection snapshots in sync with the typed fixture', () => {
    const snapshots = createLogicFoundationsGoldenFixture().projectionSnapshots

    expect(readLogicFixture('snapshots/flashcard-mode.json')).toEqual(
      snapshots.flashcardMode,
    )
    expect(readLogicFixture('snapshots/quiz-mode.json')).toEqual(
      snapshots.quizMode,
    )
    expect(readLogicFixture('snapshots/curriculum-navigation.json')).toEqual(
      snapshots.curriculumNavigation,
    )
    expect(readLogicFixture('snapshots/subject-filtering.json')).toEqual(
      snapshots.subjectFiltering,
    )
    expect(readLogicFixture('snapshots/study-set-selection.json')).toEqual(
      snapshots.studySetSelection,
    )
  })

  it('keeps checked-in update and migration expectations in sync', () => {
    const fixture = createLogicFoundationsGoldenFixture()

    expect(readLogicFixture('expected-mastery-reset.json')).toEqual(
      fixture.masteryResetExample,
    )
    expect(readLogicFixture('expected-update-plans.json')).toEqual(
      fixture.updateScenarios,
    )
  })

  it('runs the reusable conformance helper against the package validator adapter', async () => {
    const report = await runLearningPackConformanceChecks(
      createContractValidatorConformanceAdapter(),
    )

    expect(report.checks.map((check) => [check.name, check.passed])).toEqual(
      report.checks.map((check) => [check.name, true]),
    )
    expect(report.ok).toBe(true)
  })

  it('returns stable global entity keys for consuming app identity checks', () => {
    const pack100 = createLogicFoundationsGoldenFixture().releases['1.0.0']
    const pack101 = createLogicFoundationsGoldenFixture().releases['1.0.1']

    expect(expectedLogicFoundationsGlobalEntityKeys(pack101)).toEqual(
      expect.arrayContaining(expectedLogicFoundationsGlobalEntityKeys(pack100)),
    )
  })
})

function flattenKinds(
  nodes: {
    kind: string
    children: Array<{ kind: string; children: never[] }>
  }[],
): string[] {
  return nodes.flatMap((node) => [node.kind, ...flattenKinds(node.children)])
}

function readReleaseFixture(version: string) {
  const base = `releases/${version}`
  const pack = {
    manifest: readLogicFixture(`${base}/pack.json`),
    catalog: readLogicFixture(`${base}/catalog.json`),
    courses: readLogicFixture(`${base}/courses.json`),
    items: readLogicFixture(`${base}/items.json`),
    sets: readLogicFixture(`${base}/sets.json`),
    resources: readOptionalLogicFixture(`${base}/resources.json`),
    theme: readLogicFixture(`${base}/theme.json`),
  }

  if (version === '2.0.0') {
    return {
      ...pack,
      migrations: readLogicFixture(`${base}/migrations.json`),
    }
  }

  return pack
}

function readLogicFixture(path: string): unknown {
  const url = new URL(`../fixtures/logic-foundations/${path}`, import.meta.url)
  return JSON.parse(readFileSync(url, 'utf8')) as unknown
}

function readOptionalLogicFixture(path: string): unknown | undefined {
  const url = new URL(`../fixtures/logic-foundations/${path}`, import.meta.url)
  if (!existsSync(url)) {
    return undefined
  }

  return JSON.parse(readFileSync(url, 'utf8')) as unknown
}
