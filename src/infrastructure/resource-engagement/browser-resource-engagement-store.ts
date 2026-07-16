import type { ResourceEngagementEvent } from '@learnt/learning-pack-contracts'

import { cloneDeep } from '../../core/foundation'
import type {
  ResourceEngagementEventFilter,
  ResourceEngagementStore,
} from '../../core/ports'
import type { StorageLike } from '../persistence'
import {
  compareResourceEvents,
  eventIdentity,
  eventMatchesFilter,
  parseResourceEngagementEvent,
} from './in-memory-resource-engagement-store'

const resourceEngagementStorageKey = 'learnt:resource-engagement-events'

export class BrowserResourceEngagementStore implements ResourceEngagementStore {
  private readonly storage: StorageLike
  private readonly storageKey: string

  constructor(
    storage: StorageLike,
    options: Readonly<{ storageKey?: string }> = {},
  ) {
    this.storage = storage
    this.storageKey = options.storageKey ?? resourceEngagementStorageKey
  }

  async listResourceEngagementEvents(
    filter: ResourceEngagementEventFilter = {},
  ): Promise<readonly ResourceEngagementEvent[]> {
    await Promise.resolve()

    return cloneDeep(
      this.readEvents()
        .filter((event) => eventMatchesFilter(event, filter))
        .sort(compareResourceEvents),
    )
  }

  async appendResourceEngagementEvent(
    event: ResourceEngagementEvent,
  ): Promise<ResourceEngagementEvent> {
    await Promise.resolve()
    const parsed = parseResourceEngagementEvent(event)
    const events = this.readEvents()
    const existing = events.find(
      (candidate) => eventIdentity(candidate) === eventIdentity(parsed),
    )

    if (existing !== undefined) {
      if (JSON.stringify(existing) !== JSON.stringify(parsed)) {
        throw new Error(
          `Conflicting resource engagement event replay for ${eventIdentity(parsed)}.`,
        )
      }

      return cloneDeep(existing)
    }

    const nextEvents = [...events, parsed].sort(compareResourceEvents)
    this.writeEvents(nextEvents)

    return cloneDeep(parsed)
  }

  private readEvents(): ResourceEngagementEvent[] {
    const raw = this.storage.getItem(this.storageKey)

    if (raw === null) {
      return []
    }

    let parsedJson: unknown
    try {
      parsedJson = JSON.parse(raw) as unknown
    } catch (error) {
      throw new Error('Stored resource engagement events are not valid JSON.', {
        cause: error,
      })
    }

    if (!Array.isArray(parsedJson)) {
      throw new Error('Stored resource engagement events must be an array.')
    }

    return parsedJson.map((value) => parseResourceEngagementEvent(value))
  }

  private writeEvents(events: readonly ResourceEngagementEvent[]): void {
    this.storage.setItem(this.storageKey, JSON.stringify(events))
  }
}

export function createBrowserResourceEngagementStore(): BrowserResourceEngagementStore {
  const storage = (globalThis as { localStorage?: StorageLike }).localStorage

  if (storage === undefined) {
    throw new Error('Browser localStorage is unavailable.')
  }

  return new BrowserResourceEngagementStore(storage)
}
