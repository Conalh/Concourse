import {
  LearningPackErrorCode,
  createLogicFoundationsRelease,
  type LearningPackDocuments,
} from '@learnt/learning-pack-contracts'
import {
  canonicalizePackFilesForPacking,
  stableJsonBytes,
  type PackFileRecord,
} from '@learnt/learning-pack-sdk'
import { describe, expect, it } from 'vitest'

import {
  BrowserLearningPackSource,
  readLearningPackSourceDirectory,
  type BrowserLearningPackDirectoryPickerHost,
  type BrowserLearningPackSourceDirectoryHandle,
  type BrowserLearningPackSourceStorePort,
} from '../../infrastructure/learning-packs/browser-learning-pack-source'

class InMemoryBrowserLearningPackSourceStore implements BrowserLearningPackSourceStorePort {
  private selectedDirectory: BrowserLearningPackSourceDirectoryHandle | null =
    null

  loadSelectedDirectory(): Promise<BrowserLearningPackSourceDirectoryHandle | null> {
    return Promise.resolve(this.selectedDirectory)
  }

  saveSelectedDirectory(
    handle: BrowserLearningPackSourceDirectoryHandle,
  ): Promise<void> {
    this.selectedDirectory = handle
    return Promise.resolve()
  }
}

describe('browser learning pack directory import', () => {
  it('imports a direct unpacked canonical pack directory', async () => {
    const result = await readLearningPackSourceDirectory(
      directoryHandle(
        'logic-pack',
        packFiles(createLogicFoundationsRelease('2.0.0')),
      ),
    )

    expect(result.scannedDirectoryCount).toBe(1)
    expect(result.candidates).toHaveLength(1)
    expect(result.rejectedCandidates).toEqual([])
    expect(result.candidates[0]?.packId).toBe('learnt.logic-foundations')
    expect(result.candidates[0]?.packVersion).toBe('2.0.0')
    expect(
      result.candidates[0]?.candidate.files.some(
        (file) => file.path === 'pack.json',
      ),
    ).toBe(true)
  })

  it('scans child pack directories when the selected directory is a source root', async () => {
    const parent = directoryHandle('Courses', {}, [
      directoryHandle(
        'logic-a',
        packFiles(createLogicFoundationsRelease('1.0.0')),
      ),
      directoryHandle(
        'logic-b',
        packFiles(createLogicFoundationsRelease('1.0.1')),
      ),
    ])

    const result = await readLearningPackSourceDirectory(parent)

    expect(result.scannedDirectoryCount).toBe(2)
    expect(result.candidates.map((pack) => pack.packVersion)).toEqual([
      '1.0.0',
      '1.0.1',
    ])
  })

  it('applies limits independently to child packs instead of aggregating the Courses root', async () => {
    const firstFiles = packFiles(createLogicFoundationsRelease('1.0.0'))
    const secondFiles = packFiles(createLogicFoundationsRelease('1.0.1'))
    const parent = directoryHandle('Courses', {}, [
      directoryHandle('logic-a', firstFiles),
      directoryHandle('logic-b', secondFiles),
    ])

    const result = await readLearningPackSourceDirectory(parent, {
      limits: {
        maxFileCount: Math.max(
          Object.keys(firstFiles).length,
          Object.keys(secondFiles).length,
        ),
      },
    })

    expect(result.rejectedCandidates).toEqual([])
    expect(result.candidates.map((pack) => pack.packVersion)).toEqual([
      '1.0.0',
      '1.0.1',
    ])
  })

  it('returns validation diagnostics for malformed pack directories', async () => {
    const pack = createLogicFoundationsRelease('2.0.0')
    const result = await readLearningPackSourceDirectory(
      directoryHandle('broken-pack', {
        'pack.json': stableJsonBytes(pack.manifest),
      }),
    )

    expect(result.candidates).toEqual([])
    expect(result.rejectedCandidates[0]?.status).toBe('invalid')
    expect(result.rejectedCandidates[0]?.diagnostics.length).toBeGreaterThan(0)
    expect(result.rejectedCandidates[0]?.message).toContain(
      'Learning pack validation failed',
    )
  })

  it('rejects a declared README whose bytes do not match its manifest hash', async () => {
    const pack = createLogicFoundationsRelease('2.0.0')
    pack.manifest.files.push({
      assetId: null,
      path: 'README.md',
      role: 'documentation',
      mediaType: 'text/markdown',
      sha256: '0'.repeat(64),
      bytes: 0,
    })
    const completeFiles = packFiles(pack, {
      'README.md': new TextEncoder().encode('# README\n'),
    })
    const result = await readLearningPackSourceDirectory(
      directoryHandle('broken-readme', {
        ...completeFiles,
        'README.md': new TextEncoder().encode('# update\n'),
      }),
    )

    expect(result.candidates).toEqual([])
    expect(result.rejectedCandidates[0]?.status).toBe('invalid')
    expect(result.rejectedCandidates[0]?.diagnostics).toContainEqual(
      expect.objectContaining({
        code: LearningPackErrorCode.FILE_MANIFEST_MISMATCH,
        path: 'pack.json.files.README.md.sha256',
      }),
    )
  })

  it('rejects duplicate relative paths from a selected directory', async () => {
    const source = directoryHandle(
      'duplicated-pack',
      packFiles(createLogicFoundationsRelease('2.0.0')),
    )
    const duplicatePathSource: BrowserLearningPackSourceDirectoryHandle = {
      ...source,
      values: () => ({
        async *[Symbol.asyncIterator]() {
          for await (const entry of source.values()) {
            yield entry
            if (entry.kind === 'file' && entry.name === 'pack.json') {
              yield entry
            }
          }
        },
      }),
    }

    const result = await readLearningPackSourceDirectory(duplicatePathSource)

    expect(result.candidates).toEqual([])
    expect(result.rejectedCandidates[0]?.status).toBe('invalid')
    expect(result.rejectedCandidates[0]?.diagnostics).toContainEqual(
      expect.objectContaining({
        code: LearningPackErrorCode.FILE_MANIFEST_MISMATCH,
        path: 'pack.json',
      }),
    )
  })

  it('does not allocate browser file bytes after size metadata exceeds a limit', async () => {
    let arrayBufferReads = 0
    const oversizedFile = {
      kind: 'file' as const,
      name: 'pack.json',
      getFile: () =>
        Promise.resolve({
          size: 8,
          arrayBuffer: () => {
            arrayBufferReads += 1
            return Promise.resolve(new ArrayBuffer(8))
          },
        }),
    }
    const source: BrowserLearningPackSourceDirectoryHandle = {
      kind: 'directory',
      name: 'oversized-pack',
      getFileHandle: () => Promise.resolve(oversizedFile),
      values: () => ({
        async *[Symbol.asyncIterator]() {
          await Promise.resolve()
          yield oversizedFile
        },
      }),
    }
    const boundedRead = readLearningPackSourceDirectory as unknown as (
      directory: BrowserLearningPackSourceDirectoryHandle,
      options: { limits: { maxFileBytes: number } },
    ) => ReturnType<typeof readLearningPackSourceDirectory>

    const result = await boundedRead(source, {
      limits: { maxFileBytes: 7 },
    })

    expect(arrayBufferReads).toBe(0)
    expect(result.rejectedCandidates[0]?.message).toContain(
      'exceeds per-file limit 7',
    )
  })

  it('reuses the persisted selected directory from a fresh browser source adapter', async () => {
    const sourceStore = new InMemoryBrowserLearningPackSourceStore()
    const directory = directoryHandle('Courses', {}, [
      directoryHandle(
        'logic',
        packFiles(createLogicFoundationsRelease('2.0.0')),
      ),
    ])
    const pickerHost: BrowserLearningPackDirectoryPickerHost = {
      showDirectoryPicker: () => Promise.resolve(directory),
    }
    const first = new BrowserLearningPackSource({
      sourceStore,
      directoryPickerHost: pickerHost,
    })

    await first.chooseDirectory()

    const reloaded = new BrowserLearningPackSource({
      sourceStore,
      directoryPickerHost: pickerHost,
    })
    await expect(reloaded.readSelectedDirectory()).resolves.toMatchObject({
      sourceName: 'Courses',
      candidates: [
        expect.objectContaining({ packId: 'learnt.logic-foundations' }),
      ],
    })
  })

  it('requires directory reselection when the persisted handle no longer permits reads', async () => {
    const sourceStore = new InMemoryBrowserLearningPackSourceStore()
    await sourceStore.saveSelectedDirectory({
      ...directoryHandle(
        'Courses',
        packFiles(createLogicFoundationsRelease('2.0.0')),
      ),
      queryPermission: () => Promise.resolve('denied'),
    })
    const source = new BrowserLearningPackSource({ sourceStore })

    await expect(source.readSelectedDirectory()).rejects.toThrow(
      'Choose the directory again',
    )
  })
})

function packFiles(
  pack: LearningPackDocuments,
  extraFiles: Readonly<Record<string, Uint8Array>> = {},
): Readonly<Record<string, Uint8Array>> {
  const sourceFiles = [
    createFileRecord('pack.json', stableJsonBytes(pack.manifest)),
    createFileRecord('catalog.json', stableJsonBytes(pack.catalog)),
    createFileRecord('courses.json', stableJsonBytes(pack.courses)),
    createFileRecord('items.json', stableJsonBytes(pack.items)),
    createFileRecord('sets.json', stableJsonBytes(pack.sets)),
    ...(pack.resources === undefined
      ? []
      : [createFileRecord('resources.json', stableJsonBytes(pack.resources))]),
    ...(pack.theme === undefined
      ? []
      : [createFileRecord('theme.json', stableJsonBytes(pack.theme))]),
    ...(pack.migrations === undefined
      ? []
      : [
          createFileRecord('migrations.json', stableJsonBytes(pack.migrations)),
        ]),
    ...pack.manifest.files
      .filter((file) => file.role === 'asset')
      .map((file) =>
        createFileRecord(
          file.path,
          new TextEncoder().encode(`asset:${file.path}`),
        ),
      ),
    ...Object.entries(extraFiles).map(([path, bytes]) =>
      createFileRecord(path, bytes),
    ),
  ]
  const canonical = canonicalizePackFilesForPacking(sourceFiles)
  if (!('documents' in canonical)) {
    throw new Error('Could not create pack fixture.')
  }
  return Object.fromEntries(
    canonical.files.map((file) => [file.path, file.bytes]),
  )
}

function createFileRecord(path: string, bytes: Uint8Array): PackFileRecord {
  return {
    path,
    bytes,
    sha256: '',
    size: bytes.byteLength,
  }
}

function directoryHandle(
  name: string,
  files: Readonly<Record<string, Uint8Array>>,
  children: readonly BrowserLearningPackSourceDirectoryHandle[] = [],
): BrowserLearningPackSourceDirectoryHandle {
  const directFiles = new Map<string, Uint8Array>()
  const nestedFiles = new Map<string, Record<string, Uint8Array>>()

  for (const [filePath, bytes] of Object.entries(files)) {
    const [firstPathSegment, ...remainingPath] = filePath.split('/')
    if (firstPathSegment === undefined || firstPathSegment.length === 0) {
      throw new Error(`Invalid fixture file path: ${filePath}`)
    }
    if (remainingPath.length === 0) {
      directFiles.set(firstPathSegment, bytes)
      continue
    }
    const nested = nestedFiles.get(firstPathSegment) ?? {}
    nested[remainingPath.join('/')] = bytes
    nestedFiles.set(firstPathSegment, nested)
  }

  return {
    kind: 'directory',
    name,
    getFileHandle: (fileName) => {
      const bytes = directFiles.get(fileName)
      if (bytes === undefined) {
        throw Object.assign(new Error(`${fileName} was not found.`), {
          name: 'NotFoundError',
        })
      }

      return Promise.resolve(fileHandle(fileName, bytes))
    },
    values: () => ({
      async *[Symbol.asyncIterator]() {
        await Promise.resolve()
        for (const [fileName, bytes] of [...directFiles.entries()].sort(
          ([left], [right]) => left.localeCompare(right),
        )) {
          yield fileHandle(fileName, bytes)
        }
        for (const [directoryName, nested] of [...nestedFiles.entries()].sort(
          ([left], [right]) => left.localeCompare(right),
        )) {
          yield directoryHandle(directoryName, nested)
        }
        yield* children
      },
    }),
  }
}

function fileHandle(name: string, bytes: Uint8Array) {
  return {
    kind: 'file' as const,
    name,
    getFile: () =>
      Promise.resolve({
        size: bytes.byteLength,
        text: () => Promise.resolve(new TextDecoder().decode(bytes)),
        arrayBuffer: () =>
          Promise.resolve(
            bytes.buffer.slice(
              bytes.byteOffset,
              bytes.byteOffset + bytes.byteLength,
            ) as ArrayBuffer,
          ),
      }),
  }
}
