import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import {
  LearningPackErrorCode,
  createLogicFoundationsRelease,
  createValidLearningPackFixture,
} from '@learnt/learning-pack-contracts'
import { packDirectory, unpackArchive } from '@learnt/learning-pack-sdk'
import { describe, expect, it } from 'vitest'

import { createSubjectRegistry } from '../app/subject-registry'
import { SubjectIdSchema } from '../core/contracts'
import { evaluateActivityEvidence } from '../core/engine/evaluation-service'
import { parseAndValidateEvidencePayload } from '../core/engine/response-validation'
import { productionSubjectAdapters } from '../subjects'

import {
  type InstalledLearningPack,
  LearningPackInstallError,
  installLearningPackDocuments,
} from './learnt-importer'
import * as archiveInstaller from './learnt-archive-installer'

const goldenReleaseRoot = path.resolve(
  import.meta.dirname,
  '../../packages/learning-pack-contracts',
  'fixtures',
  'logic-foundations',
  'releases',
)
describe('installLearningPackDocuments', () => {
  it('validates and stores canonical golden pack content intact', () => {
    const pack = createLogicFoundationsRelease('2.0.0')
    const installed = installLearningPackDocuments(pack)

    expect(installed.packId).toBe('learnt.logic-foundations')
    expect(installed.packVersion).toBe('2.0.0')
    expect(installed.documents).toEqual(pack)
    expect(installed.documents).not.toBe(pack)
    expect(Object.isFrozen(installed.documents)).toBe(true)
    expect(JSON.stringify(installed.documents)).not.toContain('learnerId')
    expect(JSON.stringify(installed.documents)).not.toContain('sessionId')
    expect(JSON.stringify(installed.documents)).not.toContain('evidenceEvents')
    expect(JSON.stringify(installed.documents)).not.toContain(
      'presentationPolicy',
    )
  })

  it('creates runtime adapters for every golden-pack subject and preserves pack, course, node, and item IDs', () => {
    const pack = createLogicFoundationsRelease('2.0.0')
    const installed = installLearningPackDocuments(pack)

    expect(installed.subjects.map((subject) => subject.subjectId)).toEqual([
      'subject-propositional-logic',
      'subject-proof-strategies',
    ])
    expect(installed.subjects.map((subject) => subject.courseIds)).toEqual([
      ['course-logic-core'],
      ['course-proof-practice'],
    ])
    expect(installed.subjects[0]?.curriculumRootNodes).toEqual(
      pack.courses.courses[0]?.rootNodes,
    )
    expect(installed.subjects[1]?.curriculumRootNodes).toEqual(
      pack.courses.courses[1]?.rootNodes,
    )

    const propositionalLogic = installed.adapters.find(
      (adapter) => adapter.subject.id === 'subject-propositional-logic',
    )?.subject
    const proofStrategies = installed.adapters.find(
      (adapter) => adapter.subject.id === 'subject-proof-strategies',
    )?.subject

    expect(propositionalLogic?.modules.map((module) => module.id)).toContain(
      'node-core-truth-values-lesson',
    )
    expect(
      propositionalLogic?.activities.map((activity) => activity.id),
    ).toEqual(
      expect.arrayContaining([
        'item-truth-values-flashcard',
        'item-negation-single-choice',
        'item-connectives-multiple-choice',
        'item-truth-table-row-count',
      ]),
    )
    expect(proofStrategies?.modules.map((module) => module.id)).toContain(
      'node-proof-soundness-lesson',
    )
    expect(proofStrategies?.activities.map((activity) => activity.id)).toEqual(
      expect.arrayContaining([
        'item-validity-text-recall',
        'item-soundness-manual-read',
      ]),
    )
  })

  it('registers imported subjects beside compiled production subjects without mutating the production catalog', () => {
    const installed = installLearningPackDocuments(
      createLogicFoundationsRelease('2.0.0'),
    )
    const registry = createSubjectRegistry({
      importedLearningPacks: [installed],
    })

    expect(
      productionSubjectAdapters.map((adapter) => adapter.subject.id),
    ).toEqual([
      'logic-basics',
      'movement-planes',
      'machine-learning-foundations',
    ])
    expect(registry.list().map((adapter) => adapter.subject.id)).toEqual([
      'logic-basics',
      'movement-planes',
      'machine-learning-foundations',
      'subject-propositional-logic',
      'subject-proof-strategies',
    ])
  })

  it('warns on unsupported optional capabilities and rejects unsupported required capabilities', () => {
    const optionalCapabilityPack = createValidLearningPackFixture()
    optionalCapabilityPack.manifest.capabilities.optional.push({
      capabilityId: 'vendor.optional-mode',
      version: '1.0',
    })
    const installed = installLearningPackDocuments(optionalCapabilityPack)

    expect(installed.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: LearningPackErrorCode.UNSUPPORTED_OPTIONAL_CAPABILITY,
          severity: 'warning',
        }),
      ]),
    )

    const requiredCapabilityPack = createValidLearningPackFixture()
    requiredCapabilityPack.manifest.capabilities.required.push({
      capabilityId: 'vendor.required-mode',
      version: '1.0',
    })

    expect(() => installLearningPackDocuments(requiredCapabilityPack)).toThrow(
      LearningPackInstallError,
    )
  })

  it('proves golden pack modes through runtime activities backed by canonical response and evaluation fields', () => {
    const installed = installLearningPackDocuments(
      createLogicFoundationsRelease('2.0.0'),
    )

    expect(
      evaluateImportedActivity(installed, {
        subjectId: 'subject-propositional-logic',
        itemId: 'item-truth-values-flashcard',
        response: { kind: 'manual', completed: true },
      }),
    ).toMatchObject({ status: 'passed' })

    expect(
      evaluateImportedActivity(installed, {
        subjectId: 'subject-propositional-logic',
        itemId: 'item-negation-single-choice',
        response: { kind: 'single-choice', optionId: 'option-true' },
      }),
    ).toMatchObject({ status: 'passed', score: 1 })

    expect(
      evaluateImportedActivity(installed, {
        subjectId: 'subject-propositional-logic',
        itemId: 'item-connectives-multiple-choice',
        response: {
          kind: 'multiple-choice',
          optionIds: ['option-and', 'option-or', 'option-if-then'],
        },
      }),
    ).toMatchObject({ status: 'passed', score: 1 })

    expect(
      evaluateImportedActivity(installed, {
        subjectId: 'subject-proof-strategies',
        itemId: 'item-validity-text-recall',
        response: { kind: 'text', value: 'validity' },
      }),
    ).toMatchObject({ status: 'passed', score: 1 })

    expect(
      evaluateImportedActivity(installed, {
        subjectId: 'subject-propositional-logic',
        itemId: 'item-truth-table-row-count',
        response: { kind: 'number', value: 4 },
      }),
    ).toMatchObject({ status: 'passed', score: 1 })

    expect(
      evaluateImportedActivity(installed, {
        subjectId: 'subject-proof-strategies',
        itemId: 'item-soundness-manual-read',
        response: { kind: 'manual', completed: true },
      }),
    ).toMatchObject({ status: 'passed', score: 1 })
  })
})

function evaluateImportedActivity(
  installed: InstalledLearningPack,
  input: Readonly<{
    subjectId: string
    itemId: string
    response: unknown
  }>,
) {
  const subject = installed.adapters.find(
    (adapter) => adapter.subject.id === input.subjectId,
  )?.subject

  if (subject === undefined) {
    throw new Error(`Missing subject ${input.subjectId}.`)
  }

  const activity = subject.activities.find(
    (candidate) => candidate.id === input.itemId,
  )

  if (activity === undefined) {
    throw new Error(`Missing activity ${input.itemId}.`)
  }

  const evidence = parseAndValidateEvidencePayload(activity, input.response)
  return evaluateActivityEvidence(activity, evidence)
}

describe('createSubjectRegistry with imported learning packs', () => {
  it('keeps imported subjects available to the existing registry API', () => {
    const installed = installLearningPackDocuments(
      createLogicFoundationsRelease('2.0.0'),
    )
    const registry = createSubjectRegistry({
      importedLearningPacks: [installed],
    })

    expect(
      registry.has(SubjectIdSchema.parse('subject-proof-strategies')),
    ).toBe(true)
  })
})

describe('learning pack archive candidate loading', () => {
  it('exposes a stateless archive candidate loader', () => {
    expect(
      typeof Reflect.get(archiveInstaller, 'loadLearningPackArchiveCandidate'),
    ).toBe('function')
  })

  it('exposes no state-changing archive or pointer authority', () => {
    expect(archiveInstaller).not.toHaveProperty('installLearningPackArchive')
    expect(archiveInstaller).not.toHaveProperty(
      'readInstalledLearningPackRelease',
    )
    expect(
      typeof Reflect.get(
        archiveInstaller,
        'loadLearningPackDirectoryCandidate',
      ),
    ).toBe('function')
  })

  it('loads canonical files, documents, and content identity without writing state', async () => {
    const temp = await makeTempDir()
    const archiveFile = await packGoldenRelease(temp, '1.0.0')
    const before = await fs.readdir(temp, { recursive: true })
    const loader = Reflect.get(
      archiveInstaller,
      'loadLearningPackArchiveCandidate',
    ) as (input: { archiveFile: string }) => Promise<
      Readonly<{
        contentHash: string
        documents: ReturnType<typeof createLogicFoundationsRelease>
        files: readonly Readonly<{ path: string }>[]
      }>
    >

    const candidate = await loader({ archiveFile })

    expect(candidate.documents.manifest.version).toBe('1.0.0')
    expect(candidate.files.map((file) => file.path)).toContain('pack.json')
    expect(candidate.contentHash).toMatch(/^[a-f0-9]{64}$/)
    await expect(fs.readdir(temp, { recursive: true })).resolves.toEqual(before)
  })
})

describe('learning pack directory candidate loading', () => {
  it('loads an unpacked directory into the same candidate contract', async () => {
    const temp = await makeTempDir()
    const archiveFile = await packGoldenRelease(temp, '2.0.0')
    const unpackedDirectory = path.join(temp, 'unpacked')
    const unpacked = await unpackArchive(archiveFile, unpackedDirectory)
    expect(unpacked.ok).toBe(true)

    const loader = Reflect.get(
      archiveInstaller,
      'loadLearningPackDirectoryCandidate',
    ) as (input: string) => Promise<
      Readonly<{
        documents: ReturnType<typeof createLogicFoundationsRelease>
        files: readonly Readonly<{ path: string }>[]
      }>
    >
    const candidate = await loader(unpackedDirectory)

    expect(candidate.documents.manifest.packId).toBe('learnt.logic-foundations')
    expect(candidate.documents.manifest.version).toBe('2.0.0')
    expect(candidate.files.map((file) => file.path)).toContain('pack.json')
  })
})

async function makeTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'learnt-importer-'))
}

async function packGoldenRelease(
  tempDirectory: string,
  version: string,
): Promise<string> {
  const archiveFile = path.join(tempDirectory, `logic-${version}.learntpack`)
  const result = await packDirectory(
    path.join(goldenReleaseRoot, version),
    archiveFile,
  )

  if (!result.ok) {
    throw new Error(
      `Golden fixture archive failed to pack: ${JSON.stringify(result.diagnostics)}`,
    )
  }

  return archiveFile
}
