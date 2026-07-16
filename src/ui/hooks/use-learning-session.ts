import { useCallback, useEffect, useRef, useState } from 'react'

import type {
  LearntSubmissionResult,
  LearningResourceLinkReference,
  LearningSessionContext,
} from '../../application'
import type {
  ActivityId,
  ConceptId,
  EvidencePayload,
  InteractionMode,
  SessionId,
} from '../../core/contracts'
import { mapApplicationError, type UiError } from '../errors'
import { useLearntApplication } from '../app/learnt-application-context'
import { latestData, type AsyncState, type CommandState } from './async-state'

export type SubmitDraftInput = Readonly<{
  activityId: ActivityId
  response: EvidencePayload
  confidence?: number
  hintsUsed?: number
}>

export function useLearningSession(sessionId: SessionId): Readonly<{
  state: AsyncState<LearningSessionContext>
  context: LearningSessionContext | null
  lastSubmission: LearntSubmissionResult | null
  supportResources: readonly LearningResourceLinkReference[]
  commandState: CommandState
  reload: () => void
  submitEvidence: (input: SubmitDraftInput) => Promise<boolean>
  advance: (nextActivityId?: ActivityId) => Promise<boolean>
  changeMode: (interactionMode: InteractionMode) => Promise<boolean>
  unparkConcept: (conceptId: ConceptId) => Promise<boolean>
  abandon: () => Promise<boolean>
}> {
  const application = useLearntApplication()
  const requestId = useRef(0)
  const [reloadToken, setReloadToken] = useState(0)
  const [state, setState] = useState<AsyncState<LearningSessionContext>>({
    status: 'idle',
  })
  const [lastSubmission, setLastSubmission] =
    useState<LearntSubmissionResult | null>(null)
  const [supportResources, setSupportResources] = useState<
    readonly LearningResourceLinkReference[]
  >([])
  const [commandState, setCommandState] = useState<CommandState>({
    status: 'idle',
  })
  const stateRef = useRef(state)
  const supportRequestId = useRef(0)

  const commitState = useCallback(
    (nextState: AsyncState<LearningSessionContext>) => {
      stateRef.current = nextState
      setState(nextState)
    },
    [],
  )

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

  const reload = useCallback(() => {
    setReloadToken((value) => value + 1)
  }, [])

  const refreshSupportResources = useCallback(
    async (context: LearningSessionContext) => {
      const currentRequestId = supportRequestId.current + 1
      supportRequestId.current = currentRequestId

      if (context.currentActivity === null) {
        setSupportResources([])
        return
      }

      try {
        const resources = await application.getEligibleSupportResources({
          sessionId,
          activityId: context.currentActivity.id,
        })

        if (supportRequestId.current === currentRequestId) {
          setSupportResources(resources)
        }
      } catch {
        if (supportRequestId.current === currentRequestId) {
          setSupportResources([])
        }
      }
    },
    [application, sessionId],
  )

  useEffect(() => {
    const currentRequestId = requestId.current + 1
    requestId.current = currentRequestId
    supportRequestId.current += 1

    void (async () => {
      setLastSubmission(null)
      setSupportResources([])
      setCommandState({ status: 'idle' })
      const previous = latestData(stateRef.current)
      commitState(
        previous === null
          ? { status: 'loading' }
          : { status: 'loading', data: previous },
      )

      try {
        const context = await application.getSessionContext(sessionId)

        if (requestId.current !== currentRequestId) {
          return
        }

        commitState({ status: 'success', data: context })
        await refreshSupportResources(context)
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
    refreshSupportResources,
    reloadToken,
    sessionId,
  ])

  const submitEvidence = useCallback(
    async (input: SubmitDraftInput) => {
      return runCommand('submit evidence', async () => {
        const result = await application.submitEvidence({
          sessionId,
          activityId: input.activityId,
          response: input.response,
          ...(input.confidence === undefined
            ? {}
            : { confidence: input.confidence }),
          ...(input.hintsUsed === undefined
            ? {}
            : { hintsUsed: input.hintsUsed }),
        })

        setLastSubmission(result)
        commitState({ status: 'success', data: result.context })
        await refreshSupportResources(result.context)
      })
    },
    [application, commitState, refreshSupportResources, runCommand, sessionId],
  )

  const advance = useCallback(
    async (nextActivityId?: ActivityId) => {
      return runCommand('advance session', async () => {
        const context = await application.advanceSession({
          sessionId,
          ...(nextActivityId === undefined ? {} : { nextActivityId }),
        })
        setLastSubmission(null)
        commitState({ status: 'success', data: context })
        await refreshSupportResources(context)
      })
    },
    [application, commitState, refreshSupportResources, runCommand, sessionId],
  )

  const changeMode = useCallback(
    async (interactionMode: InteractionMode) => {
      return runCommand('change mode', async () => {
        const context = await application.changeInteractionMode({
          sessionId,
          interactionMode,
        })
        commitState({ status: 'success', data: context })
        await refreshSupportResources(context)
      })
    },
    [application, commitState, refreshSupportResources, runCommand, sessionId],
  )

  const unparkConcept = useCallback(
    async (conceptId: ConceptId) => {
      return runCommand('unpark concept', async () => {
        await application.unparkConcept({ sessionId, conceptId })
        const context = await application.getSessionContext(sessionId)
        commitState({ status: 'success', data: context })
        await refreshSupportResources(context)
      })
    },
    [application, commitState, refreshSupportResources, runCommand, sessionId],
  )

  const abandon = useCallback(async () => {
    return runCommand('end session', async () => {
      const context = await application.abandonSession({ sessionId })
      setLastSubmission(null)
      commitState({ status: 'success', data: context })
      setSupportResources([])
    })
  }, [application, commitState, runCommand, sessionId])

  return {
    state,
    context: latestData(state),
    lastSubmission,
    supportResources,
    commandState,
    reload,
    submitEvidence,
    advance,
    changeMode,
    unparkConcept,
    abandon,
  }
}
