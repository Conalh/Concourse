import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

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

describe('LearningResourceScreen pack asset convergence', () => {
  it('offers the verified pack asset as an explicit download', async () => {
    const fixture = createPackAssetTestFixture()
    const activeRecord = {
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
        readSnapshot: () =>
          Promise.resolve({ records: [activeRecord], issues: [] }),
        write: () => Promise.resolve(),
      },
      packAssetDelivery: new SuccessfulDelivery(),
    })

    render(
      <LearntApplicationProvider application={application}>
        <ProductVocabularyProvider mode="branded">
          <LearningResourceScreen
            packId={fixture.installedPack.packId}
            resourceId="resource-lab-01-notebook"
          />
        </ProductVocabularyProvider>
      </LearntApplicationProvider>,
    )

    expect(
      await screen.findByRole('button', {
        name: /download module-01-lab\.ipynb/i,
      }),
    ).toHaveTextContent('Download lab file')
    expect(screen.getByText('application/x-ipynb+json')).toBeInTheDocument()
    expect(
      screen.getByText(/inspect it before running it.*third party/i),
    ).toBeInTheDocument()
  })
})

class SuccessfulDelivery {
  save(): Promise<PackAssetSaveResult> {
    return Promise.resolve('saved')
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
