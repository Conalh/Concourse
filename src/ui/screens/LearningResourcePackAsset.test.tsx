import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { composeLearntApplication } from '../../app'
import type { PackAssetSaveResult } from '../../application'
import type { Clock, LearningIdGenerator } from '../../core/ports'
import {
  LocalStorageLearningRepository,
  type StorageLike,
} from '../../infrastructure'
import { createPackAssetTestFixture } from '../../test/pack-asset-fixture'
import { LearntApplicationProvider } from '../app/LearntApplicationProvider'
import { ProductVocabularyProvider } from '../vocabulary'
import { LearningResourceScreen } from './LearningResourceScreen'

describe('LearningResourceScreen pack assets', () => {
  it('shows the filename, media type, explicit action, and code inspection warning', async () => {
    renderPackAssetScreen(new RecordingDelivery())

    expect(
      await screen.findByRole('heading', {
        name: 'Module 1 learner notebook',
      }),
    ).toBeInTheDocument()
    expect(screen.getByText('module-01-lab.ipynb')).toBeInTheDocument()
    expect(screen.getByText('application/x-ipynb+json')).toBeInTheDocument()
    expect(
      screen.getByRole('button', {
        name: /download module-01-lab\.ipynb/i,
      }),
    ).toHaveTextContent('Download lab file')
    expect(
      screen.getByText(/inspect it before running it.*third party/i),
    ).toBeInTheDocument()
  })

  it('disables the action while pending and reports cancellation neutrally', async () => {
    const user = userEvent.setup()
    const delivery = new DeferredDelivery()
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    renderPackAssetScreen(delivery)
    const button = await screen.findByRole('button', {
      name: /download module-01-lab\.ipynb/i,
    })

    await user.click(button)

    await waitFor(() => {
      expect(button).toBeDisabled()
    })
    expect(delivery.requests).toHaveLength(1)
    expect(open).not.toHaveBeenCalled()

    delivery.resolve('cancelled')

    expect(await screen.findByText(/save cancelled/i)).toBeInTheDocument()
    expect(button).toBeEnabled()
    open.mockRestore()
  })

  it('renders a visible retryable error when delivery fails', async () => {
    const user = userEvent.setup()
    const delivery = new RecordingDelivery()
    delivery.error = new Error('disk write failed')
    renderPackAssetScreen(delivery)
    const button = await screen.findByRole('button', {
      name: /download module-01-lab\.ipynb/i,
    })

    await user.click(button)

    expect(
      await screen.findByRole('heading', {
        name: 'Unexpected application error',
      }),
    ).toBeInTheDocument()
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('clears the previous download outcome when the resource changes', async () => {
    const user = userEvent.setup()
    const view = renderPackAssetScreen(new RecordingDelivery())
    const notebookButton = await screen.findByRole('button', {
      name: /download module-01-lab\.ipynb/i,
    })

    await user.click(notebookButton)
    expect(
      await screen.findByText(/save request completed/i),
    ).toBeInTheDocument()

    view.showResource('resource-lab-01-data')

    expect(
      await screen.findByRole('button', {
        name: /download module-01-data\.csv/i,
      }),
    ).toBeEnabled()
    expect(
      screen.queryByText(/save request completed/i),
    ).not.toBeInTheDocument()
  })
})

type SaveRequest = Readonly<{
  suggestedFileName: string
  mediaType: string
  bytes: Uint8Array
}>

class RecordingDelivery {
  readonly requests: SaveRequest[] = []
  error: Error | null = null

  save(request: SaveRequest): Promise<PackAssetSaveResult> {
    this.requests.push(request)
    return this.error === null
      ? Promise.resolve('saved')
      : Promise.reject(this.error)
  }
}

class DeferredDelivery extends RecordingDelivery {
  private settle: ((result: PackAssetSaveResult) => void) | null = null

  override save(request: SaveRequest): Promise<PackAssetSaveResult> {
    this.requests.push(request)
    return new Promise((resolve) => {
      this.settle = resolve
    })
  }

  resolve(result: PackAssetSaveResult): void {
    this.settle?.(result)
  }
}

function renderPackAssetScreen(delivery: RecordingDelivery): Readonly<{
  showResource(resourceId: string): void
}> {
  const fixture = createPackAssetTestFixture()
  const record = {
    packId: fixture.installedPack.packId,
    activeReleaseId: fixture.activeRelease.releaseId,
    rollbackReleaseId: null,
    releases: [fixture.activeRelease],
  }
  const application = composeLearntApplication({
    clock: new FixedClock(),
    idGenerator: new FixedIds(),
    repository: new LocalStorageLearningRepository(new FakeStorage()),
    installedLearningPacks: [fixture.installedPack],
    installedLearningPackStore: {
      readSnapshot: () => Promise.resolve({ records: [record], issues: [] }),
      write: () => Promise.resolve(),
    },
    packAssetDelivery: delivery,
  })

  const resourceScreen = (resourceId: string) => (
    <LearntApplicationProvider application={application}>
      <ProductVocabularyProvider mode="branded">
        <LearningResourceScreen
          packId={fixture.installedPack.packId}
          resourceId={resourceId}
        />
      </ProductVocabularyProvider>
    </LearntApplicationProvider>
  )
  const view = render(resourceScreen('resource-lab-01-notebook'))

  return {
    showResource(resourceId) {
      view.rerender(resourceScreen(resourceId))
    },
  }
}

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

class FixedClock implements Clock {
  now(): Date {
    return new Date('2026-07-11T00:00:00.000Z')
  }
}

class FixedIds implements LearningIdGenerator {
  createSessionId(): string {
    return 'session-pack-asset'
  }

  createEvidenceId(): string {
    return 'evidence-pack-asset'
  }
}
