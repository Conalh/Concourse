import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { zipSync } from 'fflate'
import { describe, expect, test, vi } from 'vitest'
import type {
  CoursesDocument,
  CurriculumNode,
  ResourcesDocument,
} from '@learnt/learning-pack-contracts'
import {
  diffLearningPacks,
  inspectArchive,
  loadLearningPackArchive,
  packDirectory,
  readDirectoryFiles,
  resolveArchiveLimits,
  unpackArchive,
  validateLearningPackPath,
} from '../src/index.js'

const execFileAsync = promisify(execFile)
const fixtureRoot = path.resolve(
  '..',
  'learning-pack-contracts',
  'fixtures',
  'logic-foundations',
  'releases',
)

test.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
  'rejects an invalid configurable archive limit (%s)',
  (maxFileBytes) => {
    expect(() => resolveArchiveLimits({ limits: { maxFileBytes } })).toThrow(
      /positive safe integer/,
    )
  },
)

describe('learning-pack-sdk archive tooling', () => {
  test('packs valid source directories into deterministic .learntpack archives', async () => {
    const temp = await makeTempDir()
    const outA = path.join(temp, 'logic-a.learntpack')
    const outB = path.join(temp, 'logic-b.learntpack')

    const resultA = await packDirectory(path.join(fixtureRoot, '1.0.0'), outA)
    const resultB = await packDirectory(path.join(fixtureRoot, '1.0.0'), outB)

    expect(resultA.ok).toBe(true)
    expect(resultA.diagnostics).toEqual([])
    expect(resultB.ok).toBe(true)
    expect(resultB.archiveSha256).toBe(resultA.archiveSha256)
    expect(await fs.readFile(outB)).toEqual(await fs.readFile(outA))
  })

  test('requires the .learntpack archive extension', async () => {
    const temp = await makeTempDir()
    const result = await packDirectory(
      path.join(fixtureRoot, '1.0.0'),
      path.join(temp, 'logic.zip'),
    )

    expect(result.ok).toBe(false)
    expect(result.diagnostics[0]?.code).toBe('FILE_MANIFEST_MISMATCH')
  })

  test('validates archives after unpacking into an atomic install directory', async () => {
    const temp = await makeTempDir()
    const archive = path.join(temp, 'logic.learntpack')
    const outDirectory = path.join(temp, 'installed')
    const packResult = await packDirectory(
      path.join(fixtureRoot, '1.0.0'),
      archive,
    )
    expect(packResult.ok).toBe(true)

    const unpackResult = await unpackArchive(archive, outDirectory)
    expect(unpackResult.ok).toBe(true)
    expect(unpackResult.packId).toBe('learnt.logic-foundations')

    const validation = await validateLearningPackPath(outDirectory)
    expect(validation.ok).toBe(true)
    expect(validation.contentHash).toBe(unpackResult.contentHash)
  })

  test('rejects path traversal and absolute archive paths', async () => {
    const temp = await makeTempDir()
    const traversalArchive = path.join(temp, 'traversal.learntpack')
    const absoluteArchive = path.join(temp, 'absolute.learntpack')
    await fs.writeFile(
      traversalArchive,
      zipSync({ '../evil.txt': new Uint8Array([1]) }),
    )
    await fs.writeFile(
      absoluteArchive,
      zipSync({ '/evil.txt': new Uint8Array([1]) }),
    )

    const traversal = await loadLearningPackArchive(traversalArchive)
    const absolute = await loadLearningPackArchive(absoluteArchive)

    expect('documents' in traversal).toBe(false)
    expect(
      traversal.diagnostics.some(
        (diagnostic) => diagnostic.code === 'FILE_MANIFEST_MISMATCH',
      ),
    ).toBe(true)
    expect('documents' in absolute).toBe(false)
    expect(
      absolute.diagnostics.some(
        (diagnostic) => diagnostic.code === 'FILE_MANIFEST_MISMATCH',
      ),
    ).toBe(true)
  })

  test('rejects symbolic links in source directories', async () => {
    const temp = await makeTempDir()
    const source = path.join(temp, 'source')
    await fs.cp(path.join(fixtureRoot, '1.0.0'), source, { recursive: true })
    const target = path.join(source, 'catalog.json')
    const link = path.join(source, 'catalog-link.json')

    try {
      await fs.symlink(target, link, 'file')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EPERM') {
        return
      }
      throw error
    }

    const result = await packDirectory(
      source,
      path.join(temp, 'logic.learntpack'),
    )
    expect(result.ok).toBe(false)
    expect(
      result.diagnostics.some((diagnostic) =>
        diagnostic.message.includes('Symbolic links'),
      ),
    ).toBe(true)
  })

  test('rejects symbolic link entries in archive central directories', async () => {
    const temp = await makeTempDir()
    const archive = path.join(temp, 'symlink.learntpack')
    const bytes = markFirstCentralDirectoryEntryAsSymlink(
      zipSync({ 'pack.json': new TextEncoder().encode('{}') }),
    )
    await fs.writeFile(archive, bytes)

    const result = await loadLearningPackArchive(archive)

    expect('documents' in result).toBe(false)
    expect(
      result.diagnostics.some((diagnostic) =>
        diagnostic.message.includes('Symbolic link entries'),
      ),
    ).toBe(true)
  })

  test('rejects unsupported executable and browser-code file extensions', async () => {
    const temp = await makeTempDir()
    const source = path.join(temp, 'source')
    await fs.cp(path.join(fixtureRoot, '1.0.0'), source, { recursive: true })
    await fs.writeFile(
      path.join(source, 'assets', 'script.js'),
      "console.log('no');\n",
    )

    const result = await packDirectory(
      source,
      path.join(temp, 'logic.learntpack'),
    )
    expect(result.ok).toBe(false)
    expect(
      result.diagnostics.some(
        (diagnostic) => diagnostic.code === 'INVALID_ASSET_PATH',
      ),
    ).toBe(true)
  })

  test('enforces file count, per-file, and total-size limits', async () => {
    const temp = await makeTempDir()
    const archive = path.join(temp, 'logic.learntpack')
    const source = path.join(fixtureRoot, '1.0.0')

    const fileCount = await packDirectory(source, archive, {
      limits: { maxFileCount: 1 },
    })
    const perFile = await packDirectory(source, archive, {
      limits: { maxFileBytes: 1 },
    })
    const total = await packDirectory(source, archive, {
      limits: { maxTotalBytes: 1 },
    })

    expect(fileCount.ok).toBe(false)
    expect(perFile.ok).toBe(false)
    expect(total.ok).toBe(false)
    expect(fileCount.diagnostics[0]?.code).toBe('FILE_MANIFEST_MISMATCH')
    expect(perFile.diagnostics[0]?.code).toBe('FILE_MANIFEST_MISMATCH')
    expect(total.diagnostics[0]?.code).toBe('FILE_MANIFEST_MISMATCH')
  })

  test('rejects an oversized directory file from metadata before reading bytes', async () => {
    const temp = await makeTempDir()
    const source = path.join(temp, 'source')
    const oversized = path.join(source, 'oversized.bin')
    await fs.mkdir(source)
    await fs.writeFile(oversized, new Uint8Array(8))
    const readFile = vi.spyOn(fs, 'readFile')
    const open = vi.spyOn(fs, 'open')
    const boundedRead = readDirectoryFiles as unknown as (
      root: string,
      options: { limits: { maxFileBytes: number } },
    ) => ReturnType<typeof readDirectoryFiles>

    try {
      const result = await boundedRead(source, {
        limits: { maxFileBytes: 7 },
      })

      expect(
        result.diagnostics.some((diagnostic) =>
          diagnostic.message.includes('exceeds per-file limit 7'),
        ),
      ).toBe(true)
      expect(readFile).not.toHaveBeenCalledWith(oversized)
      expect(open).not.toHaveBeenCalledWith(oversized, 'r')
    } finally {
      readFile.mockRestore()
      open.mockRestore()
    }
  })

  test('rejects oversized compressed archive metadata before opening the file', async () => {
    const temp = await makeTempDir()
    const archive = path.join(temp, 'oversized.learntpack')
    await fs.writeFile(archive, new Uint8Array(8))
    const open = vi.spyOn(fs, 'open')

    try {
      const result = await loadLearningPackArchive(archive, {
        limits: { maxTotalBytes: 7 },
      })

      expect(
        result.diagnostics.some((diagnostic) =>
          diagnostic.message.includes(
            'Compressed archive bytes 8 exceed limit 7',
          ),
        ),
      ).toBe(true)
      expect(open).not.toHaveBeenCalled()
    } finally {
      open.mockRestore()
    }
  })

  test('verifies manifest file hashes on unpacked directories', async () => {
    const temp = await makeTempDir()
    const archive = path.join(temp, 'logic.learntpack')
    const outDirectory = path.join(temp, 'installed')
    await packDirectory(path.join(fixtureRoot, '1.0.0'), archive)
    await unpackArchive(archive, outDirectory)
    await fs.appendFile(path.join(outDirectory, 'catalog.json'), '\n')

    const validation = await validateLearningPackPath(outDirectory)
    expect(validation.ok).toBe(false)
    expect(
      validation.diagnostics.some(
        (diagnostic) => diagnostic.code === 'FILE_MANIFEST_MISMATCH',
      ),
    ).toBe(true)
  })

  test('inspect reports manifest metadata, counts, and the signature extension point', async () => {
    const temp = await makeTempDir()
    const archive = path.join(temp, 'logic.learntpack')
    await packDirectory(path.join(fixtureRoot, '1.1.0'), archive)

    const open = vi.spyOn(fs, 'open')
    try {
      const result = await inspectArchive(archive)
      expect(result.ok).toBe(true)
      expect(result.manifest?.packId).toBe('learnt.logic-foundations')
      expect(result.counts?.items).toBe(8)
      expect(result.counts?.resources).toBe(6)
      expect(result.signatures.status).toBe('reserved-for-future')
      expect(open).toHaveBeenCalledTimes(1)
    } finally {
      open.mockRestore()
    }
  })

  test('diff reports added files, added items, migrations, and mastery-reset revision changes', async () => {
    const temp = await makeTempDir()
    const oldArchive = path.join(temp, 'logic-1.0.0.learntpack')
    const newArchive = path.join(temp, 'logic-2.0.0.learntpack')
    await packDirectory(path.join(fixtureRoot, '1.0.0'), oldArchive)
    await packDirectory(path.join(fixtureRoot, '2.0.0'), newArchive)

    const diff = await diffLearningPacks(oldArchive, newArchive)

    expect(diff.ok).toBe(true)
    expect(diff.changedRelease).toBe(true)
    expect(diff.addedFiles).toContain('migrations.json')
    expect(diff.addedFiles).toContain('resources.json')
    expect(diff.addedItems).toContain('item-conditional-single-choice')
    expect(diff.addedResources).toContain('resource-logic-reading')
    expect(diff.migrations).toHaveLength(1)
    expect(diff.learningRevisionIncreases).toContainEqual({
      itemId: 'item-negation-single-choice',
      fromLearningRevision: 1,
      toLearningRevision: 2,
      masteryMustReset: true,
    })
  })

  test('diff reports resource revision and teaching-layer structural changes', async () => {
    const temp = await makeTempDir()
    const oldSource = path.join(temp, 'old-source')
    const newSource = path.join(temp, 'new-source')
    const oldArchive = path.join(temp, 'logic-old.learntpack')
    const newArchive = path.join(temp, 'logic-new.learntpack')
    await fs.cp(path.join(fixtureRoot, '1.1.0'), oldSource, { recursive: true })
    await fs.cp(path.join(fixtureRoot, '1.1.0'), newSource, { recursive: true })

    const resourcesPath = path.join(newSource, 'resources.json')
    const resources = await readJson<ResourcesDocument>(resourcesPath)
    const video = resources.resources.find(
      (resource) => resource.id === 'resource-negation-video',
    )
    const reading = resources.resources.find(
      (resource) => resource.id === 'resource-logic-reading',
    )
    if (!video || !reading || video.source.kind !== 'external-video') {
      throw new Error(
        'Expected teaching resources are missing from the fixture.',
      )
    }

    video.contentRevision = 2
    video.source = {
      ...video.source,
      mediaId: 'updated-video-id',
      canonicalUrl: 'https://www.youtube.com/watch?v=updated-video-id',
    }
    video.checkpointStudySetIds = ['set-core-quiz']
    video.segments = [
      ...(video.segments ?? []),
      {
        id: 'segment-video-extra',
        title: 'Additional checkpoint',
        startSeconds: 181,
        endSeconds: 240,
        conceptIds: ['concept-truth-values'],
        objectiveIds: ['objective-evaluate-negation'],
        checkpointStudySetIds: ['set-core-quiz'],
        tags: ['checkpoint'],
      },
    ]
    reading.summary = 'Updated local summary for SDK resource diff coverage.'
    await writeJson(resourcesPath, resources)

    const coursesPath = path.join(newSource, 'courses.json')
    const courses = await readJson<CoursesDocument>(coursesPath)
    const node = findNodeById(
      courses.courses.flatMap((course) => course.rootNodes),
      'node-core-truth-values-lesson',
    )
    if (!node?.entries) {
      throw new Error(
        'Expected ordered curriculum entries are missing from the fixture.',
      )
    }
    node.entries = [...node.entries].reverse()
    await writeJson(coursesPath, courses)

    await packDirectory(oldSource, oldArchive)
    await packDirectory(newSource, newArchive)

    const diff = await diffLearningPacks(oldArchive, newArchive)

    expect(diff.ok).toBe(true)
    expect(diff.resourceRevisionIncreases).toContainEqual({
      resourceId: 'resource-negation-video',
      fromContentRevision: 1,
      toContentRevision: 2,
      engagementMayBeStale: true,
    })
    expect(diff.changedResourceMetadata).toContain('resource-logic-reading')
    expect(diff.changedResourceSources).toContain('resource-negation-video')
    expect(diff.changedResourceSegments).toContainEqual({
      resourceId: 'resource-negation-video',
      addedSegmentIds: ['segment-video-extra'],
      removedSegmentIds: [],
      changedSegmentIds: [],
    })
    expect(diff.changedResourceCheckpoints).toContainEqual({
      resourceId: 'resource-negation-video',
      addedCheckpointIds: [
        'resource:set-core-quiz',
        'segment-video-extra:set-core-quiz',
      ],
      removedCheckpointIds: [],
    })
    expect(diff.changedCurriculumOrders).toContain(
      'course-logic-core:node-core-truth-values-lesson',
    )
  })

  test('CLI validate emits structured JSON results', async () => {
    const temp = await makeTempDir()
    const archive = path.join(temp, 'logic.learntpack')
    await packDirectory(path.join(fixtureRoot, '1.0.0'), archive)

    const { stdout } = await execFileAsync(
      'node',
      [path.resolve('dist', 'cli.js'), 'validate', archive],
      { cwd: path.resolve('.') },
    )
    const parsed = JSON.parse(stdout) as { ok: boolean; packId: string }

    expect(parsed.ok).toBe(true)
    expect(parsed.packId).toBe('learnt.logic-foundations')
  })
})

async function makeTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'learntpack-sdk-'))
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await fs.readFile(filePath, 'utf8')) as T
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`)
}

function findNodeById(
  nodes: readonly CurriculumNode[],
  nodeId: string,
): CurriculumNode | undefined {
  for (const node of nodes) {
    if (node.nodeId === nodeId) {
      return node
    }
    const child = findNodeById(node.children, nodeId)
    if (child) {
      return child
    }
  }
  return undefined
}

function markFirstCentralDirectoryEntryAsSymlink(
  bytes: Uint8Array,
): Uint8Array {
  const output = new Uint8Array(bytes)
  const view = new DataView(output.buffer, output.byteOffset, output.byteLength)
  for (let offset = 0; offset <= output.byteLength - 46; offset += 1) {
    if (view.getUint32(offset, true) === 0x02014b50) {
      view.setUint16(offset + 4, (3 << 8) | 20, true)
      view.setUint32(offset + 38, (0o120777 << 16) >>> 0, true)
      return output
    }
  }
  throw new Error('Could not locate ZIP central directory entry.')
}
