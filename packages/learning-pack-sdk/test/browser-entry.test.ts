import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {
  LearningPackErrorCode,
  createValidLearningPackFixture,
  type LearningPackDiagnostic,
} from '@learnt/learning-pack-contracts'
import { describe, expect, test } from 'vitest'
import { zipSync } from 'fflate'
import {
  inspectArchiveBytes,
  loadLearningPackArchiveBytes,
} from '../src/browser.js'
import * as browserSdk from '../src/browser.js'
import {
  canonicalizePackFilesForPacking,
  loadLearningPackFromFiles,
  packDirectory,
  sha256Hex,
  stableJsonBytes,
  type PackFileRecord,
} from '../src/index.js'

const fixtureRoot = path.resolve(
  '..',
  'learning-pack-contracts',
  'fixtures',
  'logic-foundations',
  'releases',
)

describe('learning-pack-sdk browser archive entry', () => {
  test('loads and inspects canonical .learntpack archive bytes', async () => {
    const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'learntpack-browser-'))
    const archivePath = path.join(temp, 'logic.learntpack')
    const packed = await packDirectory(
      path.join(fixtureRoot, '1.1.0'),
      archivePath,
    )
    expect(packed.ok).toBe(true)

    const archiveBytes = await fs.readFile(archivePath)
    const inspect = await inspectArchiveBytes(archiveBytes, 'logic.learntpack')
    const loaded = await loadLearningPackArchiveBytes(
      archiveBytes,
      'logic.learntpack',
    )

    expect(inspect.ok).toBe(true)
    expect(inspect.manifest?.packId).toBe('learnt.logic-foundations')
    expect(inspect.counts?.items).toBe(8)
    expect(inspect.counts?.resources).toBe(6)
    expect('documents' in loaded).toBe(true)
    if ('documents' in loaded) {
      expect(loaded.documents.manifest.packId).toBe('learnt.logic-foundations')
      expect(loaded.documents.resources?.resources).toHaveLength(6)
      expect(loaded.files.some((file) => file.path === 'pack.json')).toBe(true)
    }
  })

  test('exports a browser file-set loader with Node parity for README validation', async () => {
    const loader = (browserSdk as Record<string, unknown>)
      .loadLearningPackFromFilesAsync as BrowserFileLoader | undefined
    expect(loader).toBeTypeOf('function')
    if (!loader) {
      return
    }

    const validFiles = createCanonicalReadmeFiles()
    const nodeValid = loadLearningPackFromFiles(
      'directory',
      'fixture',
      validFiles,
    )
    const browserValid = await loader('directory', 'fixture', validFiles)

    expect('documents' in nodeValid).toBe(true)
    expect('documents' in browserValid).toBe(true)
    expect(diagnosticSummary(browserValid)).toEqual(
      diagnosticSummary(nodeValid),
    )

    const invalidFiles = validFiles.map((file) =>
      file.path === 'README.md'
        ? createFileRecord(file.path, new TextEncoder().encode('# update\n'))
        : file,
    )
    const nodeInvalid = loadLearningPackFromFiles(
      'directory',
      'fixture',
      invalidFiles,
    )
    const browserInvalid = await loader('directory', 'fixture', invalidFiles)

    expect('documents' in nodeInvalid).toBe(false)
    expect('documents' in browserInvalid).toBe(false)
    expect(diagnosticSummary(browserInvalid)).toEqual(
      diagnosticSummary(nodeInvalid),
    )
    expect(diagnosticSummary(browserInvalid)).toContainEqual([
      LearningPackErrorCode.FILE_MANIFEST_MISMATCH,
      'pack.json.files.README.md.sha256',
    ])
  })

  test('rejects excessive central-directory metadata before starting extraction', async () => {
    const bytes = setFirstLocalCompressionMethod(
      zipSync({
        'first.txt': new Uint8Array([1]),
        'second.txt': new Uint8Array([2]),
      }),
      99,
    )

    const loaded = await loadLearningPackArchiveBytes(
      bytes,
      'limited.learntpack',
      { limits: { maxFileCount: 1 } },
    )

    expect('documents' in loaded).toBe(false)
    expect(
      loaded.diagnostics.map((diagnostic) => diagnostic.message),
    ).toContain('File count 2 exceeds limit 1.')
    expect(
      loaded.diagnostics.some((diagnostic) =>
        diagnostic.message.includes('Could not read learning pack archive'),
      ),
    ).toBe(false)
  })

  test('rejects compressed input, declared per-file bytes, and declared total bytes at preflight', async () => {
    const bytes = zipSync({
      'first.txt': new Uint8Array(1024),
      'second.txt': new Uint8Array(1024),
    })

    const compressed = await loadLearningPackArchiveBytes(
      bytes,
      'compressed-limit.learntpack',
      { limits: { maxTotalBytes: bytes.byteLength - 1 } },
    )
    const perFile = await loadLearningPackArchiveBytes(
      bytes,
      'file-limit.learntpack',
      { limits: { maxFileBytes: 1023 } },
    )
    const total = await loadLearningPackArchiveBytes(
      bytes,
      'total-limit.learntpack',
      { limits: { maxTotalBytes: 2047 } },
    )

    expect(
      compressed.diagnostics.some((diagnostic) =>
        diagnostic.message.includes('Compressed archive bytes'),
      ),
    ).toBe(true)
    expect(
      perFile.diagnostics.some((diagnostic) =>
        diagnostic.message.includes('exceeds per-file limit 1023'),
      ),
    ).toBe(true)
    expect(
      total.diagnostics.some((diagnostic) =>
        diagnostic.message.includes(
          'Total declared file bytes 2048 exceeds limit 2047',
        ),
      ),
    ).toBe(true)
  })

  test('rejects encrypted and ZIP64 central-directory entries explicitly', async () => {
    const source = zipSync({ 'pack.json': new TextEncoder().encode('{}') })
    const encrypted = mutateFirstCentralEntry(source, (view, offset) => {
      view.setUint16(offset + 8, view.getUint16(offset + 8, true) | 1, true)
    })
    const zip64 = mutateFirstCentralEntry(source, (view, offset) => {
      view.setUint32(offset + 24, 0xffffffff, true)
    })

    const encryptedResult = await loadLearningPackArchiveBytes(
      encrypted,
      'encrypted.learntpack',
    )
    const zip64Result = await loadLearningPackArchiveBytes(
      zip64,
      'zip64.learntpack',
    )

    expect(
      encryptedResult.diagnostics.some((diagnostic) =>
        diagnostic.message.includes('Encrypted ZIP entries are not supported'),
      ),
    ).toBe(true)
    expect(
      zip64Result.diagnostics.some((diagnostic) =>
        diagnostic.message.includes('ZIP64 archives are not supported'),
      ),
    ).toBe(true)
  })

  test('aborts when actual inflated output exceeds declared metadata', async () => {
    const bytes = setFirstDeclaredSize(
      zipSync({ 'payload.txt': new Uint8Array(1024) }),
      1,
    )

    const loaded = await loadLearningPackArchiveBytes(
      bytes,
      'forged-size.learntpack',
    )

    expect('documents' in loaded).toBe(false)
    expect(
      loaded.diagnostics.some((diagnostic) =>
        diagnostic.message.includes(
          'Actual output bytes 1024 exceed declared size 1',
        ),
      ),
    ).toBe(true)
  })

  test('rejects a local ZIP header that disagrees with central metadata', async () => {
    const bytes = setFirstLocalCompressionMethod(
      zipSync({ 'pack.json': new TextEncoder().encode('{}') }),
      99,
    )

    const loaded = await loadLearningPackArchiveBytes(
      bytes,
      'header-mismatch.learntpack',
    )

    expect(
      loaded.diagnostics.some((diagnostic) =>
        diagnostic.message.includes(
          'Local ZIP header does not match central directory',
        ),
      ),
    ).toBe(true)
  })

  test('accepts a valid pack exactly at file-count and uncompressed-byte limits', async () => {
    const files = createCanonicalReadmeFiles()
    const totalBytes = files.reduce((sum, file) => sum + file.size, 0)
    const maxFileBytes = Math.max(...files.map((file) => file.size))
    const archive = zipSync(
      Object.fromEntries(files.map((file) => [file.path, file.bytes])),
      { level: 6 },
    )
    expect(archive.byteLength).toBeLessThanOrEqual(totalBytes)

    const loaded = await loadLearningPackArchiveBytes(
      archive,
      'exact-limits.learntpack',
      {
        limits: {
          maxFileCount: files.length,
          maxFileBytes,
          maxTotalBytes: totalBytes,
        },
      },
    )

    expect('documents' in loaded).toBe(true)
  })
})

type BrowserFileLoadResult = Readonly<{
  diagnostics: readonly LearningPackDiagnostic[]
}>

type BrowserFileLoader = (
  sourceKind: 'directory',
  sourcePath: string,
  files: readonly PackFileRecord[],
) => Promise<BrowserFileLoadResult>

function createCanonicalReadmeFiles(): PackFileRecord[] {
  const pack = createValidLearningPackFixture()
  pack.manifest.files.push({
    assetId: null,
    path: 'README.md',
    role: 'documentation',
    mediaType: 'text/markdown',
    sha256: '0'.repeat(64),
    bytes: 0,
  })

  const sourceFiles = [
    createFileRecord('pack.json', stableJsonBytes(pack.manifest)),
    createFileRecord('catalog.json', stableJsonBytes(pack.catalog)),
    createFileRecord('courses.json', stableJsonBytes(pack.courses)),
    createFileRecord('items.json', stableJsonBytes(pack.items)),
    createFileRecord('sets.json', stableJsonBytes(pack.sets)),
    createFileRecord('assets/cover.png', new Uint8Array([137, 80, 78, 71])),
    createFileRecord('README.md', new TextEncoder().encode('# README\n')),
  ]
  const canonical = canonicalizePackFilesForPacking(sourceFiles)
  if (!('documents' in canonical)) {
    throw new Error(`Could not create README fixture: ${canonical.diagnostics}`)
  }
  return canonical.files
}

function createFileRecord(path: string, bytes: Uint8Array): PackFileRecord {
  return {
    path,
    bytes,
    sha256: sha256Hex(bytes),
    size: bytes.byteLength,
  }
}

function diagnosticSummary(
  result: BrowserFileLoadResult,
): Array<[LearningPackErrorCode, string]> {
  return result.diagnostics.map((diagnostic) => [
    diagnostic.code,
    diagnostic.path,
  ])
}

function setFirstLocalCompressionMethod(
  bytes: Uint8Array,
  method: number,
): Uint8Array {
  const output = new Uint8Array(bytes)
  const view = new DataView(output.buffer)
  if (view.getUint32(0, true) !== 0x04034b50) {
    throw new Error('Could not locate first local ZIP header.')
  }
  view.setUint16(8, method, true)
  return output
}

function mutateFirstCentralEntry(
  bytes: Uint8Array,
  mutate: (view: DataView, offset: number) => void,
): Uint8Array {
  const output = new Uint8Array(bytes)
  const view = new DataView(output.buffer)
  for (let offset = 0; offset <= output.byteLength - 46; offset += 1) {
    if (view.getUint32(offset, true) === 0x02014b50) {
      mutate(view, offset)
      return output
    }
  }
  throw new Error('Could not locate ZIP central directory entry.')
}

function setFirstDeclaredSize(bytes: Uint8Array, size: number): Uint8Array {
  const output = mutateFirstCentralEntry(bytes, (view, offset) => {
    view.setUint32(offset + 24, size, true)
  })
  const view = new DataView(output.buffer)
  if (view.getUint32(0, true) !== 0x04034b50) {
    throw new Error('Could not locate first local ZIP header.')
  }
  view.setUint32(22, size, true)
  return output
}
