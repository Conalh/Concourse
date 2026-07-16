import {
  validateResourceEngagementEvent,
  type ResourceEngagementEvent,
} from '@learnt/learning-pack-contracts'

import { cloneDeep } from '../../core/foundation'
import type {
  ResourceEngagementEventFilter,
  ResourceEngagementStore,
} from '../../core/ports'

export class InMemoryResourceEngagementStore implements ResourceEngagementStore {
  private readonly eventsByIdentity = new Map<string, ResourceEngagementEvent>()

  async listResourceEngagementEvents(
    filter: ResourceEngagementEventFilter = {},
  ): Promise<readonly ResourceEngagementEvent[]> {
    await Promise.resolve()

    const events = [...this.eventsByIdentity.values()]
      .filter((event) => eventMatchesFilter(event, filter))
      .sort(compareResourceEvents)

    return cloneDeep(events)
  }

  async appendResourceEngagementEvent(
    event: ResourceEngagementEvent,
  ): Promise<ResourceEngagementEvent> {
    await Promise.resolve()
    const parsed = parseResourceEngagementEvent(event)
    const key = eventIdentity(parsed)
    const existing = this.eventsByIdentity.get(key)

    if (existing !== undefined) {
      if (!sameEvent(existing, parsed)) {
        throw new Error(
          `Conflicting resource engagement event replay for ${key}.`,
        )
      }

      return cloneDeep(existing)
    }

    this.eventsByIdentity.set(key, cloneDeep(parsed))
    return cloneDeep(parsed)
  }
}

export function parseResourceEngagementEvent(
  value: unknown,
): ResourceEngagementEvent {
  const validation = validateResourceEngagementEvent(value)

  if (!validation.ok || validation.value === undefined) {
    const diagnostics = validation.diagnostics
      .map(
        (diagnostic) =>
          `${diagnostic.code} at ${diagnostic.path}: ${diagnostic.message}`,
      )
      .join('; ')

    throw new Error(
      diagnostics.length === 0
        ? 'Resource engagement event is invalid.'
        : `Resource engagement event is invalid: ${diagnostics}`,
    )
  }

  return cloneDeep(validation.value)
}

export function eventMatchesFilter(
  event: ResourceEngagementEvent,
  filter: ResourceEngagementEventFilter,
): boolean {
  if (filter.packId !== undefined && event.packId !== filter.packId) {
    return false
  }
  if (
    filter.resourceId !== undefined &&
    event.resourceId !== filter.resourceId
  ) {
    return false
  }
  if (filter.segmentId !== undefined && event.segmentId !== filter.segmentId) {
    return false
  }
  if (
    filter.sourceInstanceId !== undefined &&
    event.sourceInstanceId !== filter.sourceInstanceId
  ) {
    return false
  }

  return true
}

export function compareResourceEvents(
  left: ResourceEngagementEvent,
  right: ResourceEngagementEvent,
): number {
  const timeDifference =
    Date.parse(left.occurredAt) - Date.parse(right.occurredAt)

  if (timeDifference !== 0) {
    return timeDifference
  }

  const sourceDifference = left.sourceInstanceId.localeCompare(
    right.sourceInstanceId,
  )

  if (sourceDifference !== 0) {
    return sourceDifference
  }

  return left.eventId.localeCompare(right.eventId)
}

export function eventIdentity(event: ResourceEngagementEvent): string {
  return `${event.sourceInstanceId}\u0000${event.eventId}`
}

function sameEvent(
  left: ResourceEngagementEvent,
  right: ResourceEngagementEvent,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}
