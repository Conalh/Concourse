import { useCallback, useEffect, useRef, useState } from 'react'

import type { SessionRecap } from '../../application'
import type { SessionId } from '../../core/contracts'
import { mapApplicationError } from '../errors'
import { useLearntApplication } from '../app/learnt-application-context'
import { latestData, type AsyncState } from './async-state'

export function useSessionRecap(sessionId: SessionId): Readonly<{
  state: AsyncState<SessionRecap>
  recap: SessionRecap | null
  reload: () => void
}> {
  const application = useLearntApplication()
  const requestId = useRef(0)
  const [reloadToken, setReloadToken] = useState(0)
  const [state, setState] = useState<AsyncState<SessionRecap>>({
    status: 'idle',
  })
  const stateRef = useRef(state)

  const commitState = useCallback((nextState: AsyncState<SessionRecap>) => {
    stateRef.current = nextState
    setState(nextState)
  }, [])

  const reload = useCallback(() => {
    setReloadToken((value) => value + 1)
  }, [])

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
        const recap = await application.getSessionRecap(sessionId)

        if (requestId.current !== currentRequestId) {
          return
        }

        commitState({ status: 'success', data: recap })
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
  }, [application, commitState, reloadToken, sessionId])

  return { state, recap: latestData(state), reload }
}
