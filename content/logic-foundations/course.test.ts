import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { loadLearningPackDirectory } from '@learnt/learning-pack-sdk'
import { describe, expect, it } from 'vitest'

import {
  buildLogicFoundationsPack,
  logicFoundationsModules,
  writeLogicFoundationsPack,
} from './course'

describe('Logic Foundations source', () => {
  it('preserves the Module 1 authoring boundary', () => {
    const module = logicFoundationsModules[0]
    expect(module?.code).toBe('1.0')

    const lessons = module?.lessons ?? []

    expect(lessons).toHaveLength(3)
    expect(
      lessons
        .flatMap((lesson) => lesson.chapters)
        .sort((left, right) => left - right),
    ).toEqual([1, 2, 3])

    const pack = buildLogicFoundationsPack()

    expect(pack.manifest.version).toBe('1.0.0')
    expect(
      pack.items.items.filter((item) =>
        item.itemId.startsWith('item-logic-1-'),
      ),
    ).toHaveLength(12)
    expect(
      pack.sets.sets.filter((set) => set.setId.startsWith('set-logic-1-')),
    ).toHaveLength(2)
    expect(
      pack.resources?.resources.filter(
        (resource) =>
          resource.id.startsWith('resource-logic-1-') &&
          resource.source.kind === 'bibliographic-reference',
      ),
    ).toHaveLength(3)
    expect(buildLogicFoundationsPack()).toEqual(pack)
    expect(
      pack.manifest.files.every(
        (file) => file.bytes > 0 && /^[a-f0-9]{64}$/.test(file.sha256),
      ),
    ).toBe(true)
  })

  it('generates the complete propositional-logic half', () => {
    expect(
      logicFoundationsModules.slice(0, 6).map((module) => module.code),
    ).toEqual(['1.0', '2.0', '3.0', '4.0', '5.0', '6.0'])

    const lessons = logicFoundationsModules
      .slice(0, 6)
      .flatMap((module) => module.lessons)
    expect(lessons).toHaveLength(22)
    expect(
      lessons
        .flatMap((lesson) => lesson.chapters)
        .sort((left, right) => left - right),
    ).toEqual(Array.from({ length: 22 }, (_, index) => index + 1))
    expect(logicFoundationsModules[1]?.prerequisiteConceptIds).toContain(
      'logical-relations',
    )

    const pack = buildLogicFoundationsPack()
    expect(pack.manifest.version).toBe('1.0.0')
    expect(pack.courses.courses[0]?.rootNodes.slice(0, 6)).toHaveLength(6)
    expect(
      pack.items.items.filter((item) => /^item-logic-[1-6]-/.test(item.itemId)),
    ).toHaveLength(72)
    expect(
      pack.sets.sets.filter((set) => /^set-logic-[1-6]-/.test(set.setId)),
    ).toHaveLength(12)
    expect(
      pack.resources?.resources.every(
        (resource) => resource.provenance?.license === 'CC-BY-4.0',
      ),
    ).toBe(true)
    expect(
      pack.items.items.every(
        (item) => item.conceptIds.length > 0 && item.objectiveIds.length > 0,
      ),
    ).toBe(true)
  })

  it('preserves each module item allocation and StudySet selection', () => {
    const pack = buildLogicFoundationsPack()
    const expected = [
      { lessons: 3, orientation: 1, review: 2, checkpoint: 3 },
      { lessons: 5, orientation: 0, review: 1, checkpoint: 1 },
      { lessons: 4, orientation: 1, review: 2, checkpoint: 1 },
      { lessons: 3, orientation: 1, review: 2, checkpoint: 3 },
      { lessons: 3, orientation: 1, review: 2, checkpoint: 3 },
      { lessons: 4, orientation: 1, review: 2, checkpoint: 1 },
      { lessons: 4, orientation: 1, review: 2, checkpoint: 1 },
      { lessons: 3, orientation: 1, review: 2, checkpoint: 3 },
      { lessons: 3, orientation: 1, review: 2, checkpoint: 3 },
      { lessons: 3, orientation: 1, review: 2, checkpoint: 3 },
      { lessons: 4, orientation: 1, review: 2, checkpoint: 1 },
      { lessons: 5, orientation: 0, review: 1, checkpoint: 1 },
    ] as const

    expected.forEach((allocation, index) => {
      const moduleNumber = String(index + 1)
      const itemPrefix = `item-logic-${moduleNumber}-`
      const moduleItems = pack.items.items.filter((item) =>
        item.itemId.startsWith(itemPrefix),
      )
      const moduleSets = pack.sets.sets.filter((set) =>
        set.setId.startsWith(`set-logic-${moduleNumber}-`),
      )

      expect(moduleItems).toHaveLength(12)
      expect(
        moduleItems.filter((item) => item.itemId.endsWith('-guided')),
      ).toHaveLength(allocation.lessons)
      expect(
        moduleItems.filter((item) => item.itemId.endsWith('-independent')),
      ).toHaveLength(allocation.lessons)
      expect(
        moduleItems.filter((item) => item.itemId.endsWith('-orientation')),
      ).toHaveLength(allocation.orientation)
      expect(
        moduleItems.filter((item) => item.itemId.includes('-review-')),
      ).toHaveLength(allocation.review)
      expect(
        moduleItems.filter((item) => item.itemId.includes('-checkpoint-')),
      ).toHaveLength(allocation.checkpoint)
      expect(moduleSets).toHaveLength(2)

      const deck = moduleSets.find((set) => set.kind === 'deck')
      const checkpoint = moduleSets.find((set) => set.kind === 'quiz')
      expect(deck?.selection.kind).toBe('explicit')
      expect(checkpoint?.selection.kind).toBe('explicit')
      if (
        deck?.selection.kind === 'explicit' &&
        checkpoint?.selection.kind === 'explicit'
      ) {
        expect(deck.selection.itemIds).toHaveLength(allocation.lessons * 2)
        expect(checkpoint.selection.itemIds).toHaveLength(
          allocation.orientation + allocation.review + allocation.checkpoint,
        )
      }
    })
  })

  it('aligns guided and duplicated review feedback with their choice prompts', () => {
    const pack = buildLogicFoundationsPack()
    const cases = [
      {
        guidedId: 'item-logic-1-1-arguments-guided',
        reviewId: 'item-logic-1-0-review-1',
        correctOption: 'This response should be refreshed.',
        independentAnswer:
          'Example: “Unreviewed changes can hide defects” is a premise.',
        commonMistake:
          'A topic is not automatically a conclusion. The conclusion is the claim the other statements are meant to support.',
      },
      {
        guidedId: 'item-logic-7-1-building-blocks-fol-guided',
        reviewId: 'item-logic-7-0-review-1',
        correctOption: '∃xOx',
        independentAnswer: 'The domain fixes what x may range over',
        commonMistake:
          'A quantified variable ranges over the entire stated domain, not merely the objects that happen to have names.',
      },
      {
        guidedId: 'item-logic-11-1-basic-rules-fol-guided',
        reviewId: 'item-logic-11-0-review-1',
        correctOption: 'From ∀xPx infer Pa by ∀E.',
        independentAnswer: 'Reviewed derivation: 1. ∀x(Px → Qx)',
        commonMistake:
          'A name used for ∀I must be arbitrary, and a name introduced inside ∃E must be fresh; a convenient letter is not automatically eligible.',
      },
    ] as const

    for (const expected of cases) {
      const guided = pack.items.items.find(
        (item) => item.itemId === expected.guidedId,
      )
      const review = pack.items.items.find(
        (item) => item.itemId === expected.reviewId,
      )
      const guidedSolution =
        guided?.reviewedSolutionBlocks.map((block) => block.text).join('\n') ??
        ''
      const reviewSolution =
        review?.reviewedSolutionBlocks.map((block) => block.text).join('\n') ??
        ''

      expect(guidedSolution).toContain(
        `Correct answer: “${expected.correctOption}”`,
      )
      expect(guidedSolution).toContain(
        `Common-mistake guidance: ${expected.commonMistake}`,
      )
      expect(guidedSolution).not.toContain(expected.independentAnswer)
      expect(reviewSolution).toBe(guidedSolution)
    }
  })

  it('teaches and assesses the extensional limitation of FOL', () => {
    const lesson = logicFoundationsModules[8]?.lessons[0]
    expect(lesson?.code).toBe('9.1')
    expect(lesson?.learnerJob).toMatch(/same extension.*meaning/i)
    expect(lesson?.explanation).toMatch(
      /extensional.*same extension.*cannot distinguish.*meaning/i,
    )
    expect(lesson?.workedExample).toMatch(/same extension.*different meanings/i)
    expect(lesson?.guidedPrompt).toMatch(/same extension/i)

    const correctOptionIndex = lesson?.guidedOptions.findIndex(
      (_, index) =>
        `item-logic-9-1-extensionality-guided-option-${String(index + 1)}` ===
        lesson.guidedCorrectOptionId,
    )
    const correctOption =
      correctOptionIndex === undefined
        ? undefined
        : lesson?.guidedOptions[correctOptionIndex]
    expect(correctOption).toMatch(/cannot distinguish.*meaning/i)
  })

  it('uses sparse prerequisites that resolve to earlier authored concepts', () => {
    const pack = buildLogicFoundationsPack()
    const authoredConceptIds = logicFoundationsModules.flatMap((module) =>
      module.lessons.flatMap((lesson) => lesson.conceptIds),
    )
    const authoredIndex = new Map(
      authoredConceptIds.map((conceptId, index) => [conceptId, index]),
    )
    const conceptsById = new Map(
      pack.catalog.concepts.map((concept) => [concept.conceptId, concept]),
    )
    const expectedTaskThreePrerequisites = {
      'fol-building-blocks': ['tfl-syntax'],
      'quantifier-symbolization': [
        'fol-building-blocks',
        'truth-functional-connectives',
      ],
      'multiple-generality': ['quantifier-symbolization'],
      'fol-identity': ['multiple-generality'],
      'fol-syntax': ['fol-building-blocks'],
      'definite-descriptions': ['fol-identity', 'quantifier-symbolization'],
      'fol-scope-ambiguity': ['fol-syntax', 'multiple-generality'],
      'fol-extensions': ['fol-syntax'],
      'truth-in-fol': ['fol-extensions', 'quantifier-symbolization'],
      'fol-semantic-concepts': ['truth-in-fol', 'logical-relations'],
      'counter-interpretations': ['fol-semantic-concepts', 'fol-extensions'],
      'interpretation-reasoning': ['counter-interpretations'],
      'relation-properties': ['multiple-generality', 'fol-semantic-concepts'],
      'fol-quantifier-rules': ['proof-strategy', 'quantifier-symbolization'],
      'quantifier-proof-strategy': ['fol-quantifier-rules', 'proof-strategy'],
      'quantifier-conversion': [
        'fol-quantifier-rules',
        'truth-functional-connectives',
      ],
      'identity-proof-rules': ['fol-identity', 'fol-quantifier-rules'],
      'fol-derived-rules': ['quantifier-conversion', 'derived-rules'],
      'proofs-and-semantics': ['fol-derived-rules', 'fol-semantic-concepts'],
      'normal-forms': ['complete-truth-tables', 'tfl-semantic-properties'],
      'functional-completeness': [
        'normal-forms',
        'truth-functional-connectives',
      ],
      'equivalence-transformations': [
        'normal-forms',
        'functional-completeness',
      ],
    } as const

    for (const concept of pack.catalog.concepts) {
      const conceptIndex = authoredIndex.get(concept.conceptId)
      expect(conceptIndex).toBeDefined()
      if (conceptIndex === undefined) {
        throw new Error(`Missing authored index for ${concept.conceptId}`)
      }
      for (const prerequisiteId of concept.prerequisiteConceptIds) {
        expect(conceptsById.has(prerequisiteId)).toBe(true)
        const prerequisiteIndex = authoredIndex.get(prerequisiteId)
        expect(prerequisiteIndex).toBeDefined()
        if (prerequisiteIndex === undefined) {
          throw new Error(`Missing authored index for ${prerequisiteId}`)
        }
        expect(prerequisiteIndex).toBeLessThan(conceptIndex)
      }
    }

    for (const [conceptId, expectedPrerequisites] of Object.entries(
      expectedTaskThreePrerequisites,
    )) {
      const concept = conceptsById.get(conceptId)
      expect(concept?.prerequisiteConceptIds).toEqual(expectedPrerequisites)
      expect(concept?.prerequisiteConceptIds.length).toBeLessThanOrEqual(2)
      expect(concept?.relatedConceptIds.length).toBeLessThanOrEqual(4)
      expect(
        concept?.relatedConceptIds.every((relatedId) =>
          conceptsById.has(relatedId),
        ),
      ).toBe(true)
    }
  })

  it('preserves authored decks and shuffled mixed quizzes for Modules 7-10', () => {
    const pack = buildLogicFoundationsPack()

    for (const moduleNumber of ['7', '8', '9', '10']) {
      const deck = pack.sets.sets.find(
        (set) => set.setId === `set-logic-${moduleNumber}-deck`,
      )
      const quiz = pack.sets.sets.find(
        (set) => set.setId === `set-logic-${moduleNumber}-checkpoint`,
      )

      expect(deck).toMatchObject({
        kind: 'deck',
        selection: { kind: 'explicit' },
        ordering: 'authored',
        playModes: ['flashcard'],
      })
      expect(quiz).toMatchObject({
        kind: 'quiz',
        selection: { kind: 'explicit' },
        ordering: 'shuffle',
        playModes: ['single-choice-quiz', 'self-grade-review'],
      })
    }
  })

  it('adds first-order language and interpretations without prerequisite cycles', () => {
    const expectedModules = [
      {
        code: '7.0',
        title: 'First-Order Language',
        lessons: [
          ['7.1', 'Building Blocks of FOL'],
          ['7.2', 'Sentences with One Quantifier'],
          ['7.3', 'Multiple Generality'],
          ['7.4', 'Identity'],
        ],
      },
      {
        code: '8.0',
        title: 'Expressing First-Order Claims',
        lessons: [
          ['8.1', 'Sentences of FOL'],
          ['8.2', 'Definite Descriptions'],
          ['8.3', 'Ambiguity'],
        ],
      },
      {
        code: '9.0',
        title: 'Interpretations',
        lessons: [
          ['9.1', 'Extensionality'],
          ['9.2', 'Truth in FOL'],
          ['9.3', 'Semantic Concepts'],
        ],
      },
      {
        code: '10.0',
        title: 'Relational Reasoning',
        lessons: [
          ['10.1', 'Using Interpretations'],
          ['10.2', 'Reasoning About Interpretations'],
          ['10.3', 'Properties of Relations'],
        ],
      },
    ] as const

    expect(
      logicFoundationsModules.slice(6, 10).map((module) => ({
        code: module.code,
        title: module.title,
        lessons: module.lessons.map((lesson) => [lesson.code, lesson.title]),
      })),
    ).toEqual(expectedModules)

    const pack = buildLogicFoundationsPack()
    expect(pack.manifest).toMatchObject({
      packId: 'logic',
      version: '1.0.0',
      releasedAt: '2026-07-11T00:00:00.000Z',
    })
    expect(pack.courses.courses[0]?.rootNodes).toHaveLength(12)
    expect(pack.items.items).toHaveLength(144)
    expect(pack.sets.sets).toHaveLength(26)

    const newRootNodes = pack.courses.courses[0]?.rootNodes.slice(6) ?? []
    expectedModules.forEach((expectedModule, index) => {
      const moduleNumber = expectedModule.code.slice(0, -2)
      const rootNode = newRootNodes[index]
      expect(rootNode?.title).toBe(
        `${expectedModule.code} ${expectedModule.title}`,
      )
      expect(rootNode?.children.map((node) => node.title)).toEqual([
        ...expectedModule.lessons.map(([code, title]) => `${code} ${title}`),
        `${moduleNumber}.8 Review`,
        `${moduleNumber}.9 Checkpoint`,
      ])

      const moduleItems = pack.items.items.filter((item) =>
        item.itemId.startsWith(`item-logic-${moduleNumber}-`),
      )
      const moduleSets = pack.sets.sets.filter((set) =>
        set.setId.startsWith(`set-logic-${moduleNumber}-`),
      )
      expect(moduleItems).toHaveLength(12)
      expect(
        moduleItems.filter((item) => item.itemId.endsWith('-guided')),
      ).toHaveLength(expectedModule.lessons.length)
      expect(
        moduleItems.filter((item) => item.itemId.endsWith('-independent')),
      ).toHaveLength(expectedModule.lessons.length)
      expect(
        moduleItems.filter((item) => item.itemId.endsWith('-orientation')),
      ).toHaveLength(1)
      expect(
        moduleItems.filter((item) => item.itemId.includes('-review-')),
      ).toHaveLength(2)
      expect(
        moduleItems.filter((item) => item.itemId.includes('-checkpoint-')),
      ).toHaveLength(expectedModule.lessons.length === 4 ? 1 : 3)
      expect(moduleItems.every((item) => item.learningRevision === 1)).toBe(
        true,
      )
      expect(moduleSets.map((set) => set.kind).sort()).toEqual(['deck', 'quiz'])
    })

    const newSourceResources =
      pack.resources?.resources.filter(
        (resource) =>
          resource.source.kind === 'bibliographic-reference' &&
          /resource-logic-(?:7|8|9|10)-/.test(resource.id),
      ) ?? []
    expect(
      newSourceResources.map((resource) =>
        resource.source.kind === 'bibliographic-reference'
          ? resource.source.canonicalUrl
          : undefined,
      ),
    ).toEqual(
      Array.from(
        { length: 13 },
        (_, index) =>
          `https://forallx.openlogicproject.org/html/Ch${String(index + 23)}.html`,
      ),
    )
    expect(
      pack.resources?.resources
        .filter((resource) => /resource-logic-(?:7|8|9|10)-/.test(resource.id))
        .every((resource) => resource.contentRevision === 1),
    ).toBe(true)

    const conceptsById = new Map(
      pack.catalog.concepts.map((concept) => [concept.conceptId, concept]),
    )
    const visited = new Set<string>()
    const visiting = new Set<string>()
    const visit = (conceptId: string): void => {
      if (visited.has(conceptId)) return
      if (visiting.has(conceptId)) {
        throw new Error(`Prerequisite cycle at ${conceptId}`)
      }
      visiting.add(conceptId)
      for (const prerequisiteId of conceptsById.get(conceptId)
        ?.prerequisiteConceptIds ?? []) {
        visit(prerequisiteId)
      }
      visiting.delete(conceptId)
      visited.add(conceptId)
    }
    expect(() => {
      for (const conceptId of conceptsById.keys()) visit(conceptId)
    }).not.toThrow()
    expect(buildLogicFoundationsPack()).toEqual(pack)
  })

  it('uses authored catalog copy and sparse concept relationships', () => {
    const pack = buildLogicFoundationsPack()

    expect(
      pack.catalog.concepts.some((concept) =>
        concept.summary.startsWith('A core Logic Foundations concept:'),
      ),
    ).toBe(false)
    expect(
      pack.catalog.objectives.some((objective) => {
        const fallbackTitle = objective.objectiveId
          .split('-')
          .map((word) =>
            word === 'tfl'
              ? 'TFL'
              : `${word.charAt(0).toUpperCase()}${word.slice(1)}`,
          )
          .join(' ')
        return objective.statement === `Apply ${fallbackTitle}.`
      }),
    ).toBe(false)
    expect(
      pack.catalog.objectives.some((objective) =>
        objective.successCriteria.some((criterion) =>
          criterion.startsWith('Demonstrates '),
        ),
      ),
    ).toBe(false)
    expect(
      pack.catalog.concepts.every(
        (concept) => concept.relatedConceptIds.length <= 6,
      ),
    ).toBe(true)

    const sentenceForm = pack.catalog.concepts.find(
      (concept) => concept.conceptId === 'sentence-form',
    )
    expect(sentenceForm?.relatedConceptIds).toContain(
      'truth-functional-connectives',
    )
    expect(sentenceForm?.relatedConceptIds).toContain('logical-relations')
    expect(sentenceForm?.relatedConceptIds).not.toContain(
      'soundness-completeness',
    )
  })

  it('links every lesson to its canonical source chapter', () => {
    const pack = buildLogicFoundationsPack()
    const sourceUrls =
      pack.resources?.resources.flatMap((resource) =>
        resource.source.kind === 'bibliographic-reference' &&
        resource.source.canonicalUrl !== undefined
          ? [resource.source.canonicalUrl]
          : [],
      ) ?? []

    expect(sourceUrls).toEqual([
      ...Array.from(
        { length: 41 },
        (_, index) =>
          `https://forallx.openlogicproject.org/html/Ch${String(index + 1)}.html`,
      ),
      'https://forallx.openlogicproject.org/html/Ch45.html',
      'https://forallx.openlogicproject.org/html/Ch46.html',
      'https://forallx.openlogicproject.org/html/Ch47.html',
    ])
  })

  it('builds the declared twelve-module release with stable final IDs', () => {
    const expectedFinalModules = [
      {
        code: '11.0',
        nodeId: 'node-logic-11-0-quantifier-identity-proofs',
        title: 'Quantifier and Identity Proofs',
        lessons: [
          [
            '11.1',
            'node-logic-11-1-basic-rules-fol',
            'Basic Rules for FOL',
            36,
          ],
          [
            '11.2',
            'node-logic-11-2-proofs-quantifiers',
            'Proofs with Quantifiers',
            37,
          ],
          [
            '11.3',
            'node-logic-11-3-conversion-quantifiers',
            'Conversion of Quantifiers',
            38,
          ],
          ['11.4', 'node-logic-11-4-rules-identity', 'Rules for Identity', 39],
        ],
      },
      {
        code: '12.0',
        nodeId: 'node-logic-12-0-proof-mastery',
        title: 'Proof Mastery',
        lessons: [
          ['12.1', 'node-logic-12-1-derived-rules', 'Derived Rules', 40],
          [
            '12.2',
            'node-logic-12-2-proofs-semantics',
            'Proofs and Semantics',
            41,
          ],
          ['12.3', 'node-logic-12-3-normal-forms', 'Normal Forms', 45],
          [
            '12.4',
            'node-logic-12-4-functional-completeness',
            'Functional Completeness',
            46,
          ],
          [
            '12.5',
            'node-logic-12-5-proving-equivalences',
            'Proving Equivalences',
            47,
          ],
        ],
      },
    ] as const

    expect(
      logicFoundationsModules.slice(10).map((module) => ({
        code: module.code,
        nodeId: module.nodeId,
        title: module.title,
        lessons: module.lessons.map((lesson) => [
          lesson.code,
          lesson.nodeId,
          lesson.title,
          lesson.chapters[0],
        ]),
      })),
    ).toEqual(expectedFinalModules)

    const pack = buildLogicFoundationsPack()
    expect(pack.manifest).toMatchObject({
      packId: 'logic',
      version: '1.0.0',
      releasedAt: '2026-07-11T00:00:00.000Z',
    })
    expect(pack.courses.courses[0]?.rootNodes).toHaveLength(12)
    expect(
      pack.courses.courses[0]?.rootNodes.flatMap((node) => node.children),
    ).toHaveLength(68)
    expect(pack.items.items).toHaveLength(144)
    expect(pack.sets.sets).toHaveLength(26)
    expect(pack.catalog.concepts).toHaveLength(44)
    expect(pack.catalog.objectives).toHaveLength(44)

    expectedFinalModules.forEach((expectedModule, moduleIndex) => {
      const rootNode = pack.courses.courses[0]?.rootNodes[moduleIndex + 10]
      const moduleNumber = expectedModule.code.slice(0, -2)
      expect(rootNode?.nodeId).toBe(expectedModule.nodeId)
      expect(rootNode?.title).toBe(
        `${expectedModule.code} ${expectedModule.title}`,
      )
      expect(rootNode?.children.map((node) => node.title)).toEqual([
        ...expectedModule.lessons.map(([code, , title]) => `${code} ${title}`),
        `${moduleNumber}.8 Review`,
        `${moduleNumber}.9 Checkpoint`,
      ])
      expect(
        pack.items.items.filter((item) =>
          item.itemId.startsWith(`item-logic-${moduleNumber}-`),
        ),
      ).toHaveLength(12)
      expect(
        pack.sets.sets.filter((set) =>
          set.setId.startsWith(`set-logic-${moduleNumber}-`),
        ),
      ).toHaveLength(2)
    })

    expect(buildLogicFoundationsPack()).toEqual(pack)
    expect(
      pack.manifest.files.map((file) => [file.path, file.bytes, file.sha256]),
    ).toEqual(
      buildLogicFoundationsPack().manifest.files.map((file) => [
        file.path,
        file.bytes,
        file.sha256,
      ]),
    )
  })

  it('adds meaningful cumulative review and mixed final transfer sets', () => {
    const pack = buildLogicFoundationsPack()
    const cumulative = pack.sets.sets.find(
      (set) => set.setId === 'set-logic-cumulative-review',
    )
    const transfer = pack.sets.sets.find(
      (set) => set.setId === 'set-logic-final-transfer',
    )

    expect(cumulative).toMatchObject({
      kind: 'deck',
      title: 'Logic Foundations Cumulative Review',
      ordering: 'authored',
      playModes: ['flashcard'],
      selection: {
        kind: 'explicit',
        itemIds: [
          'item-logic-1-1-arguments-guided',
          'item-logic-2-1-first-steps-symbolization-guided',
          'item-logic-3-1-characteristic-truth-tables-guided',
          'item-logic-4-1-limitations-of-tfl-guided',
          'item-logic-5-1-idea-natural-deduction-guided',
          'item-logic-6-1-additional-rules-tfl-guided',
          'item-logic-7-1-building-blocks-fol-guided',
          'item-logic-8-1-sentences-fol-guided',
          'item-logic-9-1-extensionality-guided',
          'item-logic-10-1-using-interpretations-guided',
          'item-logic-11-1-basic-rules-fol-guided',
          'item-logic-12-1-derived-rules-guided',
        ],
      },
    })
    expect(transfer).toMatchObject({
      kind: 'quiz',
      title: 'Logic Foundations Final Mixed Transfer',
      ordering: 'shuffle',
      playModes: ['single-choice-quiz', 'self-grade-review'],
      selection: {
        kind: 'explicit',
        itemIds: [
          'item-logic-1-0-checkpoint-1',
          'item-logic-2-2-connectives-guided',
          'item-logic-3-0-checkpoint-1',
          'item-logic-4-2-truth-table-shortcuts-guided',
          'item-logic-5-0-checkpoint-1',
          'item-logic-6-2-proof-theoretic-concepts-guided',
          'item-logic-7-0-checkpoint-1',
          'item-logic-8-2-definite-descriptions-guided',
          'item-logic-9-0-checkpoint-1',
          'item-logic-10-2-reasoning-about-interpretations-guided',
          'item-logic-11-2-proofs-quantifiers-independent',
          'item-logic-11-3-conversion-quantifiers-independent',
          'item-logic-12-3-normal-forms-independent',
          'item-logic-12-4-functional-completeness-independent',
          'item-logic-12-5-proving-equivalences-independent',
        ],
      },
    })
  })

  it('orders and diagnoses proof work deterministically with explicit manual rubrics', () => {
    const quantifierStrategy = logicFoundationsModules[10]?.lessons[1]
    expect(quantifierStrategy).toMatchObject({
      code: '11.2',
      guidedPrompt:
        'To prove ∀x(Px → Qx) from ∀xPx and ∀xQx, which ordered plan is legitimate?',
      guidedOptions: [
        'Choose a fresh name a; derive Pa and Qa by ∀E; assume Pa; reiterate Qa; close with →I; conclude ∀x(Px → Qx) by ∀I.',
        'Conclude ∀x(Px → Qx) first, then choose a name that appears in a premise.',
        'Use ∃E on ∀xPx and skip the conditional subproof.',
      ],
      guidedCorrectOptionId:
        'item-logic-11-2-proofs-quantifiers-guided-option-1',
    })

    const pack = buildLogicFoundationsPack()
    const finalGuidedItems = pack.items.items.filter(
      (item) =>
        /^item-logic-(?:11|12)-/.test(item.itemId) &&
        item.itemId.endsWith('-guided'),
    )
    const finalManualItems = pack.items.items.filter(
      (item) =>
        /^item-logic-(?:11|12)-/.test(item.itemId) &&
        (item.itemId.endsWith('-independent') ||
          item.itemId.includes('-checkpoint-')),
    )

    expect(finalGuidedItems).toHaveLength(9)
    expect(
      finalGuidedItems.every((item) =>
        item.reviewedSolutionBlocks.some(
          (block) =>
            block.text.includes('Correct answer:') &&
            block.text.includes('Common-mistake guidance:'),
        ),
      ),
    ).toBe(true)
    expect(finalManualItems).toHaveLength(11)
    expect(
      finalManualItems.every(
        (item) =>
          item.response.kind === 'self-grade' &&
          item.evaluation.kind === 'self-grade' &&
          item.reviewedSolutionBlocks.some(
            (block) =>
              block.text.includes('Self-check rubric:') &&
              block.text.includes('A different derivation is acceptable if'),
          ),
      ),
    ).toBe(true)
  })

  it('uses non-circular metatheory explanations and precise normal-form language', () => {
    const derivedRules = logicFoundationsModules[11]?.lessons[0]
    const proofsAndSemantics = logicFoundationsModules[11]?.lessons[1]
    const normalForms = logicFoundationsModules[11]?.lessons[2]
    const functionalCompleteness = logicFoundationsModules[11]?.lessons[3]

    expect(derivedRules?.workedExample).not.toMatch(
      /convert.*using basic quantifier reasoning/i,
    )
    expect(derivedRules?.workedExample).toContain(
      '1. ¬∀xPx Premise. 2. Assume ¬∃x¬Px for indirect proof.',
    )
    expect(derivedRules?.workedExample).toContain(
      '4. Assume ¬Pa. 5. Infer ∃x¬Px by ∃I',
    )
    expect(derivedRules?.workedExample).toContain(
      '7. Discharge the nested assumption by ¬I to obtain ¬¬Pa. 8. Infer Pa by DNE.',
    )
    expect(derivedRules?.workedExample).toContain(
      '9. Infer ∀xPx by ∀I; a occurs in no premise or undischarged assumption.',
    )
    expect(derivedRules?.workedExample).toContain(
      '11. Discharge assumption 2 by ¬I to obtain ¬¬∃x¬Px. 12. Infer ∃x¬Px by DNE.',
    )

    expect(proofsAndSemantics?.explanation).not.toMatch(
      /counter-interpretation is a finite certificate/i,
    )
    expect(proofsAndSemantics?.explanation).toContain(
      'One interpretation refutes entailment',
    )
    expect(proofsAndSemantics?.explanation).toContain(
      'a counter-interpretation may have any nonempty domain allowed by FOL',
    )
    expect(proofsAndSemantics?.explanation).toContain(
      'establishing entailment semantically must cover every interpretation',
    )

    const functionalCompletenessText = [
      functionalCompleteness?.explanation,
      functionalCompleteness?.workedExample,
      functionalCompleteness?.independentSolution,
    ].join('\n')
    expect(functionalCompletenessText).toContain('A ∨ B ≡ ¬(¬A ∧ ¬B)')
    expect(functionalCompletenessText).toContain(
      'the recovered {¬, ∧, ∨} normal-form basis is functionally complete',
    )
    expect(functionalCompletenessText).not.toMatch(
      /¬ and ∧ (?:already )?(?:generate every DNF|can construct every truth function through DNF)/i,
    )

    expect(normalForms?.independentSolution).toContain(
      '¬A ∨ B contains two literals',
    )
    expect(normalForms?.independentSolution).toContain(
      'DNF as a disjunction of one-literal conjunctions',
    )
    expect(normalForms?.independentSolution).toContain(
      'CNF as one disjunctive clause',
    )
    expect(normalForms?.independentSolution).not.toContain(
      'a single literal is a degenerate conjunction/disjunction',
    )
  })

  it('keeps aggregate review and transfer selections disjoint and capstone-complete', () => {
    const pack = buildLogicFoundationsPack()
    const cumulative = pack.sets.sets.find(
      (set) => set.setId === 'set-logic-cumulative-review',
    )
    const transfer = pack.sets.sets.find(
      (set) => set.setId === 'set-logic-final-transfer',
    )

    expect(cumulative?.selection.kind).toBe('explicit')
    expect(transfer).toMatchObject({
      ordering: 'shuffle',
      playModes: ['single-choice-quiz', 'self-grade-review'],
      selection: {
        kind: 'explicit',
        itemIds: [
          'item-logic-1-0-checkpoint-1',
          'item-logic-2-2-connectives-guided',
          'item-logic-3-0-checkpoint-1',
          'item-logic-4-2-truth-table-shortcuts-guided',
          'item-logic-5-0-checkpoint-1',
          'item-logic-6-2-proof-theoretic-concepts-guided',
          'item-logic-7-0-checkpoint-1',
          'item-logic-8-2-definite-descriptions-guided',
          'item-logic-9-0-checkpoint-1',
          'item-logic-10-2-reasoning-about-interpretations-guided',
          'item-logic-11-2-proofs-quantifiers-independent',
          'item-logic-11-3-conversion-quantifiers-independent',
          'item-logic-12-3-normal-forms-independent',
          'item-logic-12-4-functional-completeness-independent',
          'item-logic-12-5-proving-equivalences-independent',
        ],
      },
    })

    if (
      cumulative?.selection.kind !== 'explicit' ||
      transfer?.selection.kind !== 'explicit'
    ) {
      throw new Error('Expected explicit aggregate set selections.')
    }
    const cumulativeItemIds = cumulative.selection.itemIds
    expect(
      transfer.selection.itemIds.filter((itemId) =>
        cumulativeItemIds.includes(itemId),
      ),
    ).toEqual([])

    const itemsById = new Map(
      pack.items.items.map((item) => [item.itemId, item]),
    )
    const transferObjectives = new Set(
      transfer.selection.itemIds.flatMap(
        (itemId) => itemsById.get(itemId)?.objectiveIds ?? [],
      ),
    )
    expect([...transferObjectives]).toEqual(
      expect.arrayContaining([
        'construct-quantifier-proofs',
        'apply-quantifier-conversion',
        'construct-normal-forms',
        'evaluate-functional-completeness',
        'prove-equivalence-chain',
      ]),
    )
  })

  it('writes a complete canonical pack directory', async () => {
    const outputDirectory = await mkdtemp(join(tmpdir(), 'concourse-logic-'))

    try {
      await writeFile(join(outputDirectory, 'stale.json'), '{}\n', 'utf8')
      await writeLogicFoundationsPack(outputDirectory)

      expect((await readdir(outputDirectory)).sort()).toEqual([
        'README.md',
        'catalog.json',
        'courses.json',
        'items.json',
        'pack.json',
        'resources.json',
        'sets.json',
        'theme.json',
      ])

      const loaded = await loadLearningPackDirectory(outputDirectory)
      expect('documents' in loaded).toBe(true)
      expect(loaded.diagnostics).toEqual([])

      const writtenManifest = JSON.parse(
        await readFile(join(outputDirectory, 'pack.json'), 'utf8'),
      ) as unknown

      expect(writtenManifest).toEqual(buildLogicFoundationsPack().manifest)
      const writtenReadme = await readFile(
        join(outputDirectory, 'README.md'),
        'utf8',
      )
      expect(writtenReadme).toContain('forall x: Calgary')
      expect(writtenReadme).toContain(
        'https://creativecommons.org/licenses/by/4.0/',
      )
      expect(writtenReadme).toContain(
        'adapted the organization, examples, and learning activities',
      )
      expect(writtenReadme).toContain('release 1.0.0')
      expect(writtenReadme).toContain('Modules 1 through 12')
      expect(writtenReadme).toContain('Chapters 1 through 41 and 45 through 47')
      expect(writtenReadme).toContain(
        'Chapters 42 through 44 and 48 are optional follow-on material and are not included',
      )
    } finally {
      await rm(outputDirectory, { force: true, recursive: true })
    }
  })
})
