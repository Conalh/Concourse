import { useCallback, useEffect, useRef, useState } from 'react'

import type { SessionLibrarySnapshot, SubjectOverview } from '../../application'
import type { SubjectId } from '../../core/contracts'
import { mapApplicationError } from '../errors'
import { useLearntApplication } from '../app/learnt-application-context'
import { latestData, type AsyncState } from './async-state'

export type SubjectOverviewData = Readonly<{
  overview: SubjectOverview
  sessionLibrary: SessionLibrarySnapshot
}>

export function useSubjectOverview(subjectId: SubjectId): Readonly<{
  state: AsyncState<SubjectOverviewData>
  reload: () => void
}> {
  const application = useLearntApplication()
  const requestId = useRef(0)
  const [reloadToken, setReloadToken] = useState(0)
  const [state, setState] = useState<AsyncState<SubjectOverviewData>>({
    status: 'idle',
  })
  const stateRef = useRef(state)

  function commitState(nextState: AsyncState<SubjectOverviewData>) {
    stateRef.current = nextState
    setState(nextState)
  }

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
        const overview = application.getSubjectOverview(subjectId)
        const sessionLibrary = await application.listSessions()

        if (requestId.current !== currentRequestId) {
          return
        }

        commitState({
          status: 'success',
          data: { overview, sessionLibrary },
        })
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
  }, [application, reloadToken, subjectId])

  return { state, reload }
}
