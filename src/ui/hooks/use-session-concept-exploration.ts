import { useCallback, useEffect, useRef, useState } from 'react'

import type { SessionConceptExploration } from '../../application'
import type { ConceptId, SessionId } from '../../core/contracts'
import { useLearntApplication } from '../app/learnt-application-context'
import { mapApplicationError, type UiError } from '../errors'
import { latestData, type AsyncState, type CommandState } from './async-state'

export function useSessionConceptExploration(
  sessionId: SessionId,
  conceptId: ConceptId,
): Readonly<{
  state: AsyncState<SessionConceptExploration>
  exploration: SessionConceptExploration | null
  commandState: CommandState
  reload: () => void
  park: () => Promise<boolean>
  unpark: () => Promise<boolean>
}> {
  const application = useLearntApplication()
  const requestId = useRef(0)
  const [reloadToken, setReloadToken] = useState(0)
  const [state, setState] = useState<AsyncState<SessionConceptExploration>>({
    status: 'idle',
  })
  const [commandState, setCommandState] = useState<CommandState>({
    status: 'idle',
  })
  const stateRef = useRef(state)

  const commitState = useCallback(
    (nextState: AsyncState<SessionConceptExploration>) => {
      stateRef.current = nextState
      setState(nextState)
    },
    [],
  )

  const reload = useCallback(() => {
    setReloadToken((value) => value + 1)
  }, [])

  useEffect(() => {
    const currentRequestId = requestId.current + 1
    requestId.current = currentRequestId

    void (async () => {
      setCommandState({ status: 'idle' })
      const previous = latestData(stateRef.current)
      commitState(
        previous === null
          ? { status: 'loading' }
          : { status: 'loading', data: previous },
      )

      try {
        const exploration = await application.getSessionConceptExploration(
          sessionId,
          conceptId,
        )

        if (requestId.current !== currentRequestId) {
          return
        }

        commitState({ status: 'success', data: exploration })
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
  }, [application, commitState, conceptId, reloadToken, sessionId])

  const runConceptCommand = useCallback(
    async (
      command: string,
      action: () => Promise<SessionConceptExploration>,
    ): Promise<boolean> => {
      setCommandState({ status: 'pending', command })

      try {
        const exploration = await action()
        commitState({ status: 'success', data: exploration })
        setCommandState({ status: 'idle' })
        return true
      } catch (error) {
        const mapped: UiError = mapApplicationError(error)
        setCommandState({ status: 'error', command, error: mapped })
        return false
      }
    },
    [commitState],
  )

  const park = useCallback(
    () =>
      runConceptCommand('park concept', () =>
        application.parkConcept({ sessionId, conceptId }),
      ),
    [application, conceptId, runConceptCommand, sessionId],
  )

  const unpark = useCallback(
    () =>
      runConceptCommand('unpark concept', () =>
        application.unparkConcept({ sessionId, conceptId }),
      ),
    [application, conceptId, runConceptCommand, sessionId],
  )

  return {
    state,
    exploration: latestData(state),
    commandState,
    reload,
    park,
    unpark,
  }
}
