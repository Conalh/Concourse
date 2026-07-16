import {
  createLogicFoundationsRelease,
  type LearningPackDocuments,
} from '@learnt/learning-pack-contracts'
import {
  canonicalizePackFilesForPacking,
  stableJsonBytes,
  type ArchiveLimits,
  type PackFileRecord,
} from '@learnt/learning-pack-sdk'
import { loadLearningPackFromFilesAsync } from '@learnt/learning-pack-sdk/browser'
import { describe, expect, it } from 'vitest'

import {
  TauriLearningPackSource,
  type TauriCourseFolderScan,
  type TauriLearningPackSourceBridge,
} from './tauri-learning-pack-source'

class InMemoryTauriBridge implements TauriLearningPackSourceBridge {
  selectedRoot: string | null = null
  readonly scans = new Map<string, unknown>()
  choice: string | null = null
  requestedLimits: ArchiveLimits | undefined

  chooseCourseFolder(): Promise<string | null> {
    return Promise.resolve(this.choice)
  }

  loadSelectedCourseFolder(): Promise<string | null> {
    return Promise.resolve(this.selectedRoot)
  }

  saveSelectedCourseFolder(path: string): Promise<void> {
    this.selectedRoot = path
    return Promise.resolve()
  }

  readCourseFolderCandidates(
    path: string,
    limits?: ArchiveLimits,
  ): Promise<unknown> {
    this.requestedLimits = limits
    const scan = this.scans.get(path)
    if (scan === undefined) {
      return Promise.reject(new Error(`No native scan fixture for ${path}.`))
    }
    return Promise.resolve(scan)
  }
}

describe('Tauri learning pack source', () => {
  it('persists a chosen root and reconstructs valid packs through the shared SDK loader', async () => {
    const bridge = new InMemoryTauriBridge()
    bridge.choice = 'C:\\Courses'
    bridge.scans.set(
      'C:\\Courses',
      scan('Courses', [
        candidate('logic', packFiles(createLogicFoundationsRelease('2.0.0'))),
      ]),
    )

    const first = new TauriLearningPackSource(bridge)
    const selected = await first.chooseDirectory()
    expect(selected).toMatchObject({
      sourceName: 'Courses',
      candidates: [
        expect.objectContaining({
          packId: 'learnt.logic-foundations',
          packVersion: '2.0.0',
        }),
      ],
    })
    expect(
      selected?.candidates[0]?.candidate.files.some(
        (file) => file.path === 'pack.json',
      ),
    ).toBe(true)
    expect(bridge.requestedLimits).toEqual({
      maxTotalBytes: 50 * 1024 * 1024,
      maxFileCount: 512,
      maxFileBytes: 10 * 1024 * 1024,
    })

    const reloaded = new TauriLearningPackSource(bridge)
    await expect(reloaded.readSelectedDirectory()).resolves.toMatchObject({
      sourceName: 'Courses',
      candidates: [
        expect.objectContaining({ packId: 'learnt.logic-foundations' }),
      ],
    })
  })

  it('uses the SDK validator unchanged for malformed native candidates', async () => {
    const bridge = new InMemoryTauriBridge()
    const malformedFiles = {
      'pack.json': stableJsonBytes(
        createLogicFoundationsRelease('2.0.0').manifest,
      ),
    }
    bridge.selectedRoot = 'C:\\Courses'
    bridge.scans.set(
      'C:\\Courses',
      scan('Courses', [candidate('broken-pack', malformedFiles)]),
    )
    const sdkResult = await loadLearningPackFromFilesAsync(
      'directory',
      'broken-pack',
      Object.entries(malformedFiles).map(([path, bytes]) => file(path, bytes)),
    )
    if ('documents' in sdkResult) {
      throw new Error('Malformed fixture unexpectedly passed SDK validation.')
    }

    const result = await new TauriLearningPackSource(
      bridge,
    ).readSelectedDirectory()

    expect(result?.candidates).toEqual([])
    expect(result?.rejectedCandidates).toEqual([
      expect.objectContaining({
        directoryName: 'broken-pack',
        status: 'invalid',
        diagnostics: sdkResult.diagnostics,
      }),
    ])
  })

  it('does not read or mutate a source when no native root is selected', async () => {
    const bridge = new InMemoryTauriBridge()

    await expect(
      new TauriLearningPackSource(bridge).readSelectedDirectory(),
    ).resolves.toBeNull()
  })

  it('maps a native scan failure into a rejected source candidate', async () => {
    const bridge = new InMemoryTauriBridge()
    bridge.selectedRoot = 'C:\\Courses'

    await expect(
      new TauriLearningPackSource(bridge).readSelectedDirectory(),
    ).resolves.toMatchObject({
      sourceName: 'Courses',
      scannedDirectoryCount: 0,
      candidates: [],
      rejectedCandidates: [
        expect.objectContaining({
          directoryName: 'Courses',
          status: 'invalid',
          diagnostics: [
            expect.objectContaining({
              code: 'STRUCTURE_INVALID',
              path: 'C:\\Courses',
            }),
          ],
        }),
      ],
    })
  })

  it('maps native containment diagnostics into a rejected source candidate', async () => {
    const bridge = new InMemoryTauriBridge()
    bridge.selectedRoot = 'C:\\Courses'
    bridge.scans.set('C:\\Courses', {
      ...scan('Courses', []),
      diagnostics: [
        {
          code: 'path-outside-selected-root',
          message: 'Candidate C:\\outside resolves outside selected root.',
          path: 'C:\\outside',
        },
      ],
    })

    const result = await new TauriLearningPackSource(
      bridge,
    ).readSelectedDirectory()

    expect(result?.rejectedCandidates).toEqual([
      expect.objectContaining({
        directoryName: 'outside',
        status: 'invalid',
        diagnostics: [
          expect.objectContaining({
            code: 'STRUCTURE_INVALID',
            path: 'C:\\outside',
          }),
        ],
      }),
    ])
  })

  it('maps malformed native payloads into a rejected source candidate', async () => {
    const bridge = new InMemoryTauriBridge()
    bridge.selectedRoot = 'C:\\Courses'
    bridge.scans.set('C:\\Courses', {
      sourceName: 'Courses',
      scannedDirectoryCount: 1,
      candidates: [
        {
          directoryName: 'broken',
          files: [{ relativePath: 'pack.json', bytes: [-1] }],
        },
      ],
      diagnostics: [],
    })

    const result = await new TauriLearningPackSource(
      bridge,
    ).readSelectedDirectory()

    expect(result).toMatchObject({
      sourceName: 'Courses',
      scannedDirectoryCount: 0,
      candidates: [],
      rejectedCandidates: [
        expect.objectContaining({
          directoryName: 'Courses',
          status: 'invalid',
          diagnostics: [
            expect.objectContaining({
              code: 'STRUCTURE_INVALID',
              path: 'C:\\Courses',
            }),
          ],
        }),
      ],
    })
  })
})

function scan(
  sourceName: string,
  candidates: TauriCourseFolderScan['candidates'],
): TauriCourseFolderScan {
  return {
    sourceName,
    scannedDirectoryCount: candidates.length,
    candidates,
    diagnostics: [],
  }
}

function candidate(
  directoryName: string,
  files: Readonly<Record<string, Uint8Array>>,
): TauriCourseFolderScan['candidates'][number] {
  return {
    directoryName,
    files: Object.entries(files).map(([relativePath, bytes]) => ({
      relativePath,
      bytes: [...bytes],
    })),
  }
}

function packFiles(
  pack: LearningPackDocuments,
): Readonly<Record<string, Uint8Array>> {
  const canonical = canonicalizePackFilesForPacking([
    file('pack.json', stableJsonBytes(pack.manifest)),
    file('catalog.json', stableJsonBytes(pack.catalog)),
    file('courses.json', stableJsonBytes(pack.courses)),
    file('items.json', stableJsonBytes(pack.items)),
    file('sets.json', stableJsonBytes(pack.sets)),
    ...(pack.resources === undefined
      ? []
      : [file('resources.json', stableJsonBytes(pack.resources))]),
    ...(pack.theme === undefined
      ? []
      : [file('theme.json', stableJsonBytes(pack.theme))]),
    ...(pack.migrations === undefined
      ? []
      : [file('migrations.json', stableJsonBytes(pack.migrations))]),
    ...pack.manifest.files
      .filter((entry) => entry.role === 'asset')
      .map((entry) =>
        file(entry.path, new TextEncoder().encode(`asset:${entry.path}`)),
      ),
  ])
  if (!('documents' in canonical)) {
    throw new Error('Could not create pack fixture.')
  }
  return Object.fromEntries(
    canonical.files.map((entry) => [entry.path, entry.bytes]),
  )
}

function file(path: string, bytes: Uint8Array): PackFileRecord {
  return {
    path,
    bytes,
    sha256: '',
    size: bytes.byteLength,
  }
}
