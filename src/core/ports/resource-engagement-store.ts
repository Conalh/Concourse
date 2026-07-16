import type { ResourceEngagementEvent } from '@learnt/learning-pack-contracts'

export type ResourceEngagementEventFilter = Readonly<{
  packId?: string
  resourceId?: string
  segmentId?: string | null
  sourceInstanceId?: string
}>

export interface ResourceEngagementStore {
  listResourceEngagementEvents(
    filter?: ResourceEngagementEventFilter,
  ): Promise<readonly ResourceEngagementEvent[]>

  appendResourceEngagementEvent(
    event: ResourceEngagementEvent,
  ): Promise<ResourceEngagementEvent>
}
