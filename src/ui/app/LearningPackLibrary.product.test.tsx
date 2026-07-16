import {
  LearningPackErrorCode,
  createLogicFoundationsRelease,
  makeDiagnostic,
  type LearningPackDocuments,
} from '@learnt/learning-pack-contracts'
import {
  canonicalizePackFilesForPacking,
  stableJsonBytes,
  type PackFileRecord,
} from '@learnt/learning-pack-sdk'
import { IDBFactory } from 'fake-indexeddb'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'

import { composeLearntApplication } from '../../app'
import type {
  InstalledLearningPackStore,
  LearningPackLibraryStateEntry,
  LearningPackSourcePort,
} from '../../application'
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
import { installLearningPackDocuments } from '../../learning-packs/learnt-importer'
import type {
  BrowserLearningPackDirectoryPickerHost,
  BrowserLearningPackSourceDirectoryHandle,
  BrowserLearningPackSourceStorePort,
} from '../../infrastructure/learning-packs/browser-learning-pack-source'
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
      `2026-06-22T12:${String(this.index).padStart(2, '0')}:00.000Z`,
    )
    this.index += 1
    return value
  }
}

class SequenceIds implements LearningIdGenerator {
  private sessionIndex = 0
  private evidenceIndex = 0

  createSessionId(): string {
    const id = `session-${String(this.sessionIndex)}`
    this.sessionIndex += 1
    return id
  }

  createEvidenceId(): string {
    const id = `evidence-${String(this.evidenceIndex)}`
    this.evidenceIndex += 1
    return id
  }
}

class InMemoryProductVocabularyPreferenceStore implements ProductVocabularyPreferenceStore {
  private mode: ProductVocabularyMode

  constructor(mode: ProductVocabularyMode = 'plain') {
    this.mode = mode
  }

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

function createApplication(
  input: Readonly<{
    installedLearningPacks?: Parameters<
      typeof composeLearntApplication
    >[0]['installedLearningPacks']
    installedLearningPackStore?: InstalledLearningPackStore
    learningPackSource?: LearningPackSourcePort
    learningPackLibraryStates?: readonly LearningPackLibraryStateEntry[]
  }> = {},
) {
  return composeLearntApplication({
    clock: new SequenceClock(),
    idGenerator: new SequenceIds(),
    repository: new LocalStorageLearningRepository(new FakeStorage()),
    productVocabularyPreferenceStore:
      new InMemoryProductVocabularyPreferenceStore(),
    ...(input.installedLearningPacks === undefined
      ? {}
      : { installedLearningPacks: input.installedLearningPacks }),
    ...(input.installedLearningPackStore === undefined
      ? {}
      : { installedLearningPackStore: input.installedLearningPackStore }),
    ...(input.learningPackSource === undefined
      ? {}
      : { learningPackSource: input.learningPackSource }),
    ...(input.learningPackLibraryStates === undefined
      ? {}
      : { learningPackLibraryStates: input.learningPackLibraryStates }),
  })
}

function renderProduct(application: ReturnType<typeof createApplication>) {
  return render(
    <LearntApplicationProvider application={application}>
      <App />
    </LearntApplicationProvider>,
  )
}

function packFiles(
  pack: LearningPackDocuments,
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

describe('Learning Pack library UI', () => {
  beforeEach(() => {
    window.location.hash = '#/'
  })

  it('renders the canonical hierarchy and filters items by mode', async () => {
    const user = userEvent.setup()
    renderProduct(
      createApplication({
        installedLearningPacks: [
          installLearningPackDocuments(createLogicFoundationsRelease('2.0.0')),
        ],
      }),
    )

    expect(
      await screen.findByRole('heading', { name: 'Your courses' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Concourse home' }),
    ).toHaveAttribute('href', '#/')
    expect(
      screen.getByLabelText(/Open profile menu for Demo learner/i),
    ).toBeInTheDocument()

    await openCourseMaterials(user)
    const packLibrary = screen.getByRole('region', {
      name: 'Your content',
    })

    expect(
      within(packLibrary).getAllByRole('heading', {
        name: 'Logic Foundations',
      }).length,
    ).toBeGreaterThan(0)
    expect(
      within(packLibrary).getByRole('heading', { name: 'Propositional Logic' }),
    ).toBeInTheDocument()
    expect(
      within(packLibrary).getByRole('heading', { name: 'Logic Core' }),
    ).toBeInTheDocument()
    expect(
      within(packLibrary).getByRole('heading', { name: 'Core Logic Module' }),
    ).toBeInTheDocument()
    expect(
      within(packLibrary).getByRole('heading', { name: 'Truth Values Lesson' }),
    ).toBeInTheDocument()
    expect(
      within(packLibrary).getAllByRole('heading', { name: 'Logic Flashcards' })
        .length,
    ).toBeGreaterThan(0)
    expect(
      within(packLibrary).getByRole('heading', { name: 'Truth Values' }),
    ).toBeInTheDocument()
    expect(
      within(packLibrary).getAllByText('Visual style: Logic Foundations')
        .length,
    ).toBeGreaterThan(0)

    await user.click(within(packLibrary).getByText('Filters'))
    await user.selectOptions(
      screen.getByLabelText('Item mode'),
      'multiple-choice-quiz',
    )

    await waitFor(() => {
      const filteredLibrary = screen.getByRole('region', {
        name: 'Your content',
      })
      expect(
        within(filteredLibrary).getByRole('heading', {
          name: 'Identify Binary Connectives',
        }),
      ).toBeInTheDocument()
    })
    const filteredLibrary = screen.getByRole('region', {
      name: 'Your content',
    })
    expect(
      within(filteredLibrary).queryByRole('heading', { name: 'Truth Values' }),
    ).not.toBeInTheDocument()
  })

  it('imports a source directory, opens its route, and restores the active release after reload', async () => {
    const user = userEvent.setup()
    const indexedDB = new IDBFactory()
    const databaseName = 'product-import-reload'
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
    const firstPackStore = new BrowserLearningPackStateStore({
      indexedDB,
      databaseName,
    })
    const first = createApplication({
      installedLearningPackStore: firstPackStore,
      learningPackSource: new BrowserLearningPackSource({
        sourceStore,
        directoryPickerHost: pickerHost,
      }),
    })
    const rendered = renderProduct(first)

    await openCourseMaterials(user)
    await user.click(
      screen.getByRole('button', { name: 'Choose pack directory' }),
    )

    expect(await screen.findByText(/Selected: Courses/i)).toBeInTheDocument()
    expect(
      screen.getByText(/Installed 1 learning packs from Courses/i),
    ).toBeInTheDocument()

    const packLibrary = screen.getByRole('region', {
      name: 'Your content',
    })
    expect(
      within(packLibrary).getAllByRole('heading', {
        name: 'Logic Foundations',
      }).length,
    ).toBeGreaterThan(0)

    await user.click(screen.getByRole('link', { name: 'Concourse home' }))
    expect(
      await screen.findByRole('heading', { name: 'Your courses' }),
    ).toBeInTheDocument()
    const subjectCard = screen
      .getByRole('heading', { name: 'Propositional Logic' })
      .closest('article')
    if (subjectCard === null) {
      throw new Error('Expected the installed Propositional Logic route card.')
    }
    await user.click(
      within(subjectCard).getByRole('link', { name: 'View course' }),
    )
    expect(
      await screen.findByRole('heading', { name: 'Propositional Logic' }),
    ).toBeInTheDocument()

    rendered.unmount()
    const reloadedPackStore = new BrowserLearningPackStateStore({
      indexedDB,
      databaseName,
    })
    const reloaded = createApplication({
      installedLearningPackStore: reloadedPackStore,
      learningPackSource: new BrowserLearningPackSource({
        sourceStore,
        directoryPickerHost: pickerHost,
      }),
    })
    await reloaded.restoreInstalledLearningPacks(reloadedPackStore)
    await expect(
      reloaded.syncSelectedLearningPackDirectory(),
    ).resolves.toMatchObject({
      sourceName: 'Courses',
      outcomes: [expect.objectContaining({ status: 'reinstalled' })],
    })

    window.location.hash = '#/'
    renderProduct(reloaded)
    expect(
      await screen.findByRole('heading', { name: 'Propositional Logic' }),
    ).toBeInTheDocument()
  })

  it('opens an embedded teaching resource from the ordered pack sequence', async () => {
    const user = userEvent.setup()
    renderProduct(
      createApplication({
        installedLearningPacks: [
          installLearningPackDocuments(createLogicFoundationsRelease('2.0.0')),
        ],
      }),
    )

    await openCourseMaterials(user)
    const packLibrary = screen.getByRole('region', {
      name: 'Your content',
    })
    const resourceRow = within(packLibrary)
      .getByRole('heading', { name: 'Five-Minute Logic Reading' })
      .closest('li')

    if (resourceRow === null) {
      throw new Error('Expected a resource row for the embedded reading.')
    }

    await user.click(
      within(resourceRow).getByRole('link', { name: 'Open resource' }),
    )

    expect(
      await screen.findByRole('heading', {
        name: 'Five-Minute Logic Reading',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'A proposition is a statement that can be evaluated as true or false.',
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Negation flips the truth value of a proposition.'),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Mark complete' }))
    expect(
      await screen.findByRole('button', { name: 'Completed' }),
    ).toBeInTheDocument()
  })

  it('starts flashcard practice from the temporary Flashcards route and records self-grade evidence', async () => {
    const user = userEvent.setup()
    const application = createApplication({
      installedLearningPacks: [
        installLearningPackDocuments(createLogicFoundationsRelease('2.0.0')),
      ],
    })
    window.location.hash = '#/practice'

    renderProduct(application)

    expect(
      await screen.findByRole('heading', { name: 'Retrieve & reinforce' }),
    ).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Mode'), 'flashcard')
    await user.selectOptions(
      screen.getByLabelText('Selection'),
      'authored-order',
    )
    await user.click(screen.getByRole('button', { name: 'Start practice' }))

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Truth Values' }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Reveal solution' }))
    await user.click(screen.getByRole('button', { name: 'Good' }))

    expect(
      await screen.findByText('Recorded self-grade: Good'),
    ).toBeInTheDocument()
    const summary = await application.getPracticeSummary({
      packId: 'learnt.logic-foundations',
    })
    expect(summary.items['item-truth-values-flashcard']).toMatchObject({
      attempts: 1,
      selfGrades: { again: 0, hard: 0, good: 1, easy: 0 },
    })
  })

  it('starts native practice directly from route and StudySet library controls', async () => {
    const user = userEvent.setup()
    const first = renderProduct(
      createApplication({
        installedLearningPacks: [
          installLearningPackDocuments(createLogicFoundationsRelease('2.0.0')),
        ],
      }),
    )

    await openCourseMaterials(user)
    const packLibrary = screen.getByRole('region', {
      name: 'Your content',
    })
    const routeSection = within(packLibrary)
      .getByRole('heading', { name: 'Logic Core' })
      .closest('section')

    if (routeSection === null) {
      throw new Error('Expected the Logic Core route section.')
    }

    await user.click(
      within(routeSection).getByRole('button', { name: 'Practice route' }),
    )

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Truth Values' }),
    ).toBeInTheDocument()
    first.unmount()
    window.location.hash = '#/'

    renderProduct(
      createApplication({
        installedLearningPacks: [
          installLearningPackDocuments(createLogicFoundationsRelease('2.0.0')),
        ],
      }),
    )

    await openCourseMaterials(user)
    const nextPackLibrary = screen.getByRole('region', {
      name: 'Your content',
    })
    const studySet = within(nextPackLibrary)
      .getAllByRole('heading', { name: 'Logic Flashcards' })[0]
      ?.closest('article')

    if (studySet === null || studySet === undefined) {
      throw new Error('Expected the Logic Flashcards StudySet card.')
    }

    await user.click(
      within(studySet).getByRole('button', { name: 'Start flashcard set' }),
    )

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Truth Values' }),
    ).toBeInTheDocument()
  })

  it('starts a StudySet checkpoint from a resource and returns to that resource after completion', async () => {
    const user = userEvent.setup()
    renderProduct(
      createApplication({
        installedLearningPacks: [
          installLearningPackDocuments(createLogicFoundationsRelease('2.0.0')),
        ],
      }),
    )

    await openFiveMinuteLogicReading(user)
    await user.click(screen.getByRole('button', { name: 'Start Checkpoint' }))

    await answerCurrentCheckpointItem(user)
    await user.click(screen.getByRole('button', { name: /Continue to /i }))
    await answerCurrentCheckpointItem(user)
    await user.click(screen.getByRole('button', { name: 'Complete session' }))

    expect(
      await screen.findByRole('heading', {
        name: "Nice work - here's the evidence.",
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Reinforced' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Needs another look' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/No mastery claimed/i)).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Back to resource' }),
    ).toHaveAttribute(
      'href',
      '#/packs/learnt.logic-foundations/resources/resource-logic-reading',
    )

    await user.click(screen.getByRole('link', { name: 'Back to resource' }))
    expect(
      await screen.findByRole('heading', {
        name: 'Five-Minute Logic Reading',
      }),
    ).toBeInTheDocument()
  })

  it('shows empty and app-owned pack state labels without installed pack content', async () => {
    const user = userEvent.setup()
    const empty = renderProduct(createApplication())

    await openCourseMaterials(user)
    expect(
      await screen.findByRole('heading', {
        name: 'Nothing here yet',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Choose pack directory' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Sync selected directory' }),
    ).toBeEnabled()
    expect(
      screen.queryByText(String.raw`C:\Projects\Learning\Courses`),
    ).not.toBeInTheDocument()
    empty.unmount()

    renderProduct(
      createApplication({
        learningPackLibraryStates: [
          {
            packId: 'broken-pack',
            title: 'Broken Pack',
            state: 'invalid-pack',
            message: 'Required canonical files are missing.',
            diagnostics: [
              makeDiagnostic(
                LearningPackErrorCode.REQUIRED_FILE_MISSING,
                'error',
                'catalog.json',
                'catalog.json is required.',
              ),
            ],
          },
          {
            packId: 'capability-pack',
            title: 'Capability Pack',
            state: 'unsupported-capability',
            message: 'A required capability is not supported.',
          },
          {
            packId: 'update-pack',
            title: 'Update Pack',
            state: 'update-available',
            message: 'A newer release is available.',
          },
          {
            packId: 'partial-pack',
            title: 'Partial Pack',
            state: 'partially-supported',
            message: 'Optional capabilities are unavailable.',
          },
        ],
      }),
    )

    await openCourseMaterials(user)
    expect(
      await screen.findByRole('heading', { name: 'Broken Pack' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Invalid pack')).toBeInTheDocument()
    expect(screen.getByText('Unsupported capability')).toBeInTheDocument()
    expect(screen.getByText('Update available')).toBeInTheDocument()
    expect(screen.getByText('Partially supported')).toBeInTheDocument()
    expect(screen.getByText(/REQUIRED_FILE_MISSING/)).toBeInTheDocument()
  })
})

async function openFiveMinuteLogicReading(
  user: ReturnType<typeof userEvent.setup>,
) {
  await openCourseMaterials(user)
  const packLibrary = screen.getByRole('region', {
    name: 'Your content',
  })
  const resourceRow = within(packLibrary)
    .getByRole('heading', { name: 'Five-Minute Logic Reading' })
    .closest('li')

  if (resourceRow === null) {
    throw new Error('Expected a resource row for the embedded reading.')
  }

  await user.click(
    within(resourceRow).getByRole('link', { name: 'Open resource' }),
  )
  expect(
    await screen.findByRole('heading', {
      name: 'Five-Minute Logic Reading',
    }),
  ).toBeInTheDocument()
}

async function openCourseMaterials(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('link', { name: 'Library' }))
  await screen.findByRole('heading', { name: 'Your content' })
}

async function answerCurrentCheckpointItem(
  user: ReturnType<typeof userEvent.setup>,
) {
  const heading = await screen.findByRole('heading', {
    level: 1,
    name: /Identify Binary Connectives|Conditional False Case/,
  })

  if (heading.textContent.includes('Identify Binary Connectives')) {
    await user.click(screen.getByRole('checkbox', { name: 'AND' }))
    await user.click(screen.getByRole('checkbox', { name: 'OR' }))
    await user.click(screen.getByRole('checkbox', { name: 'IF-THEN' }))
  } else {
    await user.click(
      screen.getByRole('radio', { name: 'P is true and Q is false' }),
    )
  }

  await user.click(screen.getByRole('button', { name: 'Submit response' }))
  expect(
    await screen.findByRole('heading', { name: 'Passed' }),
  ).toBeInTheDocument()
}
