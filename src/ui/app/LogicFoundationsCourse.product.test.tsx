import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { IDBFactory } from 'fake-indexeddb'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'

import { composeLearntApplication } from '../../app'
import type {
  Clock,
  LearningIdGenerator,
  ProductVocabularyMode,
  ProductVocabularyPreferenceStore,
} from '../../core/ports'
import {
  BrowserLearningPackSource,
  BrowserLearningPackStateStore,
  LocalStorageLearningRepository,
  type StorageLike,
} from '../../infrastructure'
import type {
  BrowserLearningPackDirectoryPickerHost,
  BrowserLearningPackSourceDirectoryHandle,
  BrowserLearningPackSourceStorePort,
} from '../../infrastructure/learning-packs/browser-learning-pack-source'
import {
  buildLogicFoundationsPack,
  writeLogicFoundationsPack,
} from '../../../content/logic-foundations/course'
import { App } from './App'
import { LearntApplicationProvider } from './LearntApplicationProvider'

class FakeStorage implements StorageLike {
  private readonly values = new Map<string, string>()

  get length(): number {
    return this.values.size
  }

  key(index: number): string | null {
    return [...this.values.keys()].sort()[index] ?? null
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }
}

class SequenceClock implements Clock {
  private index = 0

  now(): Date {
    const value = new Date(
      `2026-07-11T12:${String(this.index).padStart(2, '0')}:00.000Z`,
    )
    this.index += 1
    return value
  }
}

class SequenceIds implements LearningIdGenerator {
  private sessionIndex = 0
  private evidenceIndex = 0

  createSessionId(): string {
    const id = `session-logic-${String(this.sessionIndex)}`
    this.sessionIndex += 1
    return id
  }

  createEvidenceId(): string {
    const id = `evidence-logic-${String(this.evidenceIndex)}`
    this.evidenceIndex += 1
    return id
  }
}

class InMemoryProductVocabularyPreferenceStore implements ProductVocabularyPreferenceStore {
  private mode: ProductVocabularyMode = 'plain'

  getProductVocabularyMode(): ProductVocabularyMode {
    return this.mode
  }

  setProductVocabularyMode(mode: ProductVocabularyMode): void {
    this.mode = mode
  }
}

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

function createApplication(input: {
  storage: StorageLike
  packStore: BrowserLearningPackStateStore
  packSource: BrowserLearningPackSource
}) {
  return composeLearntApplication({
    clock: new SequenceClock(),
    idGenerator: new SequenceIds(),
    repository: new LocalStorageLearningRepository(input.storage),
    productVocabularyPreferenceStore:
      new InMemoryProductVocabularyPreferenceStore(),
    installedLearningPackStore: input.packStore,
    learningPackSource: input.packSource,
  })
}

function renderProduct(application: ReturnType<typeof createApplication>) {
  return render(
    <LearntApplicationProvider application={application}>
      <App />
    </LearntApplicationProvider>,
  )
}

describe('Logic Foundations final course product flow', () => {
  beforeEach(() => {
    window.location.hash = '#/'
  })

  it('imports Logic Foundations, opens 1.1, completes 1.9, and restores it after reload', async () => {
    const outputDirectory = await mkdtemp(
      join(tmpdir(), 'concourse-logic-product-'),
    )

    try {
      await writeLogicFoundationsPack(outputDirectory)
      const generatedFiles = await readGeneratedFiles(outputDirectory)
      const generatedPack = buildLogicFoundationsPack()
      const indexedDB = new IDBFactory()
      const databaseName = 'logic-foundations-final-product'
      const learningStorage = new FakeStorage()
      const sourceStore = new InMemoryBrowserLearningPackSourceStore()
      const coursesDirectory = directoryHandle('Courses', {}, [
        directoryHandle('logic-foundations', generatedFiles),
      ])
      const pickerHost: BrowserLearningPackDirectoryPickerHost = {
        showDirectoryPicker: () => Promise.resolve(coursesDirectory),
      }
      const firstPackStore = new BrowserLearningPackStateStore({
        indexedDB,
        databaseName,
      })
      const first = createApplication({
        storage: learningStorage,
        packStore: firstPackStore,
        packSource: new BrowserLearningPackSource({
          sourceStore,
          directoryPickerHost: pickerHost,
        }),
      })
      const rendered = renderProduct(first)
      const user = userEvent.setup()

      await user.click(await screen.findByRole('link', { name: 'Library' }))
      await screen.findByRole('heading', { name: 'Your content' })
      await user.click(
        screen.getByRole('button', { name: 'Choose pack directory' }),
      )

      expect(await screen.findByText(/Selected: Courses/i)).toBeInTheDocument()
      expect(
        screen.getByText(/Installed 1 learning packs from Courses/i),
      ).toBeInTheDocument()

      const library = await first.getLearningPackLibrary()
      const installedPack = library.packs.find(
        (pack) => pack.packId === 'logic',
      )
      const argumentsNode = installedPack?.subjects
        .flatMap((subject) => subject.courses)
        .flatMap((course) => course.rootNodes)
        .flatMap(flattenNodes)
        .find((node) => node.nodeId === 'node-logic-1-1-arguments')
      expect(argumentsNode?.title).toBe('1.1 Arguments')

      const argumentsHeading = screen
        .getAllByRole('heading', { name: '1.1 Arguments' })
        .find((heading) => heading.id.includes('node-logic-1-1-arguments'))
      if (argumentsHeading === undefined) {
        throw new Error('Expected the 1.1 Arguments node heading.')
      }
      expect(argumentsHeading.id).toContain('node-logic-1-1-arguments')
      const argumentsArticle = argumentsHeading.closest('article')
      if (argumentsArticle === null) {
        throw new Error('Expected the 1.1 Arguments curriculum node.')
      }
      const teachingRow = within(argumentsArticle)
        .getByRole('heading', {
          name: '1.1 Arguments: explanation and worked example',
        })
        .closest('li')
      if (teachingRow === null) {
        throw new Error('Expected the 1.1 generated teaching resource row.')
      }
      await user.click(
        within(teachingRow).getByRole('link', { name: 'Open resource' }),
      )

      expect(
        await screen.findByRole('heading', {
          name: '1.1 Arguments: explanation and worked example',
        }),
      ).toBeInTheDocument()

      await user.click(screen.getByRole('link', { name: 'Return to courses' }))
      await user.click(await screen.findByRole('link', { name: 'Library' }))
      await screen.findByRole('heading', { name: 'Your content' })

      const resolvedCheckpoint = await first.resolveStudySet({
        packId: 'logic',
        studySetId: 'set-logic-1-checkpoint',
      })
      expect(resolvedCheckpoint.studySetId).toBe('set-logic-1-checkpoint')
      const checkpointHeading = screen
        .getAllByRole('heading', { name: '1.9 Checkpoint' })
        .find((heading) => heading.tagName === 'H5')
      const checkpointArticle = checkpointHeading?.closest('article')
      if (checkpointArticle === null || checkpointArticle === undefined) {
        throw new Error('Expected the authored 1.9 Checkpoint node.')
      }
      expect(
        within(checkpointArticle).getByRole('heading', {
          name: '1.0 Logic, Arguments, and Meaning Checkpoint',
        }),
      ).toBeInTheDocument()
      await user.click(
        within(checkpointArticle).getByRole('button', {
          name: 'Start flashcard set',
        }),
      )

      await waitFor(() => {
        expect(window.location.hash).toMatch(/^#\/sessions\//)
      })
      const firstSessions = await first.listSessions()
      const sessionId = firstSessions.sessions[0]?.sessionId
      if (sessionId === undefined) {
        throw new Error('Expected the Logic checkpoint session.')
      }
      const startedContext = await first.getSessionContext(sessionId)
      const currentItemId = startedContext.record.session.currentActivityId
      if (currentItemId === null) {
        throw new Error('Expected a current Logic checkpoint item.')
      }
      expect(resolvedCheckpoint.itemIds).toContain(currentItemId)
      const currentItem = generatedPack.items.items.find(
        (item) => item.itemId === currentItemId,
      )
      if (currentItem === undefined) {
        throw new Error('Expected the first resolved checkpoint item.')
      }
      expect(
        await screen.findByRole('heading', {
          level: 1,
          name: currentItem.title,
        }),
      ).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Reveal solution' }))
      await user.click(screen.getByRole('button', { name: 'Good' }))
      expect(
        await screen.findByText('Recorded self-grade: Good'),
      ).toBeInTheDocument()
      const firstContext = await first.getSessionContext(sessionId)
      expect(
        firstContext.record.session.exploration.learningFlow,
      ).toMatchObject({
        kind: 'practice-plan',
        packId: 'logic',
        packVersion: '1.0.0',
        title: '1.0 Logic, Arguments, and Meaning Checkpoint',
      })
      expect(firstContext.record.evidenceEvents).toHaveLength(1)

      rendered.unmount()
      const reloadedPackStore = new BrowserLearningPackStateStore({
        indexedDB,
        databaseName,
      })
      const reloaded = createApplication({
        storage: learningStorage,
        packStore: reloadedPackStore,
        packSource: new BrowserLearningPackSource({
          sourceStore,
          directoryPickerHost: pickerHost,
        }),
      })
      await reloaded.restoreInstalledLearningPacks(reloadedPackStore)

      const restoredPacks = reloaded.getInstalledLearningPacksForRuntime()
      expect(restoredPacks).toHaveLength(1)
      expect(restoredPacks[0]).toMatchObject({
        packId: 'logic',
        packVersion: '1.0.0',
      })
      const restoredContext = await reloaded.getSessionContext(sessionId)
      expect(restoredContext.record.evidenceEvents).toHaveLength(1)
      expect(restoredContext.record.session.activityProgress).toContainEqual(
        expect.objectContaining({
          activityId: currentItemId,
          status: 'completed',
        }),
      )

      window.location.hash = `#/sessions/${sessionId}`
      renderProduct(reloaded)
      await waitFor(() => {
        expect(
          screen.getByText('Recorded self-grade: Good'),
        ).toBeInTheDocument()
      })
    } finally {
      await rm(outputDirectory, { force: true, recursive: true })
    }
  }, 15_000)
})

type LibraryNode = Awaited<
  ReturnType<ReturnType<typeof createApplication>['getLearningPackLibrary']>
>['packs'][number]['subjects'][number]['courses'][number]['rootNodes'][number]

function flattenNodes(node: LibraryNode): LibraryNode[] {
  return [node, ...node.children.flatMap(flattenNodes)]
}

async function readGeneratedFiles(
  directory: string,
): Promise<Readonly<Record<string, Uint8Array>>> {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = await Promise.all(
    entries
      .filter((entry) => entry.isFile())
      .map(async (entry) => {
        const bytes = await readFile(join(directory, entry.name))
        return [entry.name, new Uint8Array(bytes)] as const
      }),
  )
  return Object.fromEntries(files)
}

function directoryHandle(
  name: string,
  files: Readonly<Record<string, Uint8Array>>,
  children: readonly BrowserLearningPackSourceDirectoryHandle[] = [],
): BrowserLearningPackSourceDirectoryHandle {
  const directFiles = new Map(Object.entries(files))

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
