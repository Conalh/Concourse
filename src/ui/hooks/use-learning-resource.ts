import { useCallback, useEffect, useRef, useState } from 'react'

import type {
  LearningResourceTeachingContext,
  PackAssetSaveResult,
  StudySetSessionStartResult,
} from '../../application'
import type { LearningFlowOrigin } from '../../core/contracts'
import { useLearntApplication } from '../app/learnt-application-context'
import { mapApplicationError, type UiError } from '../errors'
import { latestData, type AsyncState, type CommandState } from './async-state'

export type PackAssetDownloadState =
  | { status: 'idle' }
  | { status: 'pending' }
  | { status: 'saved' }
  | { status: 'cancelled' }
  | { status: 'error'; error: UiError }

export function useLearningResource(
  packId: string,
  resourceId: string,
  segmentId?: string,
): Readonly<{
  state: AsyncState<LearningResourceTeachingContext>
  resource: LearningResourceTeachingContext | null
  commandState: CommandState
  assetDownloadState: PackAssetDownloadState
  reload: () => void
  markComplete: () => Promise<boolean>
  leaveResource: () => Promise<boolean>
  recordExternalOpen: () => Promise<boolean>
  downloadAsset: () => Promise<PackAssetSaveResult | null>
  startCheckpoint: (
    studySetId: string,
    origin: LearningFlowOrigin,
  ) => Promise<StudySetSessionStartResult | null>
}> {
  const application = useLearntApplication()
  const requestId = useRef(0)
  const openedKey = useRef<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const [state, setState] = useState<
    AsyncState<LearningResourceTeachingContext>
  >({
    status: 'idle',
  })
  const [commandState, setCommandState] = useState<CommandState>({
    status: 'idle',
  })
  const [assetDownloadState, setAssetDownloadState] =
    useState<PackAssetDownloadState>({ status: 'idle' })
  const stateRef = useRef(state)

  const commitState = useCallback(
    (nextState: AsyncState<LearningResourceTeachingContext>) => {
      stateRef.current = nextState
      setState(nextState)
    },
    [],
  )

  const loadResource = useCallback(async () => {
    return application.getLearningResource({
      packId,
      resourceId,
      ...(segmentId === undefined ? {} : { segmentId }),
    })
  }, [application, packId, resourceId, segmentId])

  const reload = useCallback(() => {
    setReloadToken((value) => value + 1)
  }, [])

  const runCommand = useCallback(
    async (command: string, action: () => Promise<void>): Promise<boolean> => {
      setCommandState({ status: 'pending', command })

      try {
        await action()
        setCommandState({ status: 'idle' })
        return true
      } catch (error) {
        const mapped: UiError = mapApplicationError(error)
        setCommandState({ status: 'error', command, error: mapped })
        return false
      }
    },
    [],
  )

  useEffect(() => {
    const currentRequestId = requestId.current + 1
    requestId.current = currentRequestId

    void (async () => {
      const previous = latestData(stateRef.current)
      commitState(
        previous === null
          ? { status: 'loading' }
          : { status: 'loading', data: previous },
      )

      try {
        let resource = await loadResource()
        const key = `${packId}\u0000${resourceId}\u0000${segmentId ?? ''}`

        if (openedKey.current !== key) {
          openedKey.current = key
          await application.recordResourceEngagement({
            packId,
            resourceId,
            ...(segmentId === undefined ? {} : { segmentId }),
            action:
              resource.progressState === 'unseen' ? 'opened' : 'revisited',
            measurement:
              resource.sourceKind === 'embedded-content'
                ? 'reader-observed'
                : 'unknown',
          })
          resource = await loadResource()
        }

        if (requestId.current !== currentRequestId) {
          return
        }

        commitState({ status: 'success', data: resource })
      } catch (error) {
        if (requestId.current !== currentRequestId) {
          return
        }

        const mapped = mapApplicationError(error)
        commitState(
          previous === null
            ? { status: 'error', error: mapped }
            : { status: 'error', error: mapped, data: previous },
        )
      }
    })()
  }, [
    application,
    commitState,
    loadResource,
    packId,
    reloadToken,
    resourceId,
    segmentId,
  ])

  const markComplete = useCallback(async () => {
    return runCommand('mark resource complete', async () => {
      await application.recordResourceEngagement({
        packId,
        resourceId,
        ...(segmentId === undefined ? {} : { segmentId }),
        action: 'marked-complete',
        measurement: 'self-reported',
      })
      commitState({ status: 'success', data: await loadResource() })
    })
  }, [
    application,
    commitState,
    loadResource,
    packId,
    resourceId,
    runCommand,
    segmentId,
  ])

  const leaveResource = useCallback(async () => {
    return runCommand('leave resource', async () => {
      await application.recordResourceEngagement({
        packId,
        resourceId,
        ...(segmentId === undefined ? {} : { segmentId }),
        action: 'abandoned',
        measurement: 'unknown',
      })
      commitState({ status: 'success', data: await loadResource() })
    })
  }, [
    application,
    commitState,
    loadResource,
    packId,
    resourceId,
    runCommand,
    segmentId,
  ])

  const recordExternalOpen = useCallback(async () => {
    return runCommand('open external resource', async () => {
      await application.recordResourceEngagement({
        packId,
        resourceId,
        ...(segmentId === undefined ? {} : { segmentId }),
        action: 'opened',
        measurement: 'unknown',
      })
      commitState({ status: 'success', data: await loadResource() })
    })
  }, [
    application,
    commitState,
    loadResource,
    packId,
    resourceId,
    runCommand,
    segmentId,
  ])

  const downloadAsset = useCallback(async () => {
    setAssetDownloadState({ status: 'pending' })

    try {
      const result = await application.downloadLearningPackAsset({
        packId,
        resourceId,
      })
      setAssetDownloadState({ status: result })
      return result
    } catch (error) {
      setAssetDownloadState({
        status: 'error',
        error: mapApplicationError(error),
      })
      return null
    }
  }, [application, packId, resourceId])

  const startCheckpoint = useCallback(
    async (studySetId: string, origin: LearningFlowOrigin) => {
      let result: StudySetSessionStartResult | null = null
      const committed = await runCommand('start checkpoint', async () => {
        result = await application.startStudySetSession({
          packId,
          studySetId,
          origin,
        })
      })

      return committed ? result : null
    },
    [application, packId, runCommand],
  )

  return {
    state,
    resource: latestData(state),
    commandState,
    assetDownloadState,
    reload,
    markComplete,
    leaveResource,
    recordExternalOpen,
    downloadAsset,
    startCheckpoint,
  }
}
