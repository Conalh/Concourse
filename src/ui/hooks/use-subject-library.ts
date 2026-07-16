import { useCallback, useEffect, useRef, useState } from 'react'

import type {
  LearnerSummary,
  LearningPackDirectoryInstallResult,
  LearningPackLibraryFilters,
  LearningPackLibrarySnapshot,
  SessionLibrarySnapshot,
  SubjectSummary,
} from '../../application'
import { mapApplicationError } from '../errors'
import { useLearntApplication } from '../app/learnt-application-context'
import { latestData, type AsyncState } from './async-state'

export type SubjectLibraryData = Readonly<{
  learner: LearnerSummary
  subjects: readonly SubjectSummary[]
  sessionLibrary: SessionLibrarySnapshot
  learningPackLibrary: LearningPackLibrarySnapshot
}>

export function useSubjectLibrary(): Readonly<{
  state: AsyncState<SubjectLibraryData>
  reload: () => void
  chooseAndInstallLearningPackDirectory: () => Promise<LearningPackDirectoryInstallResult | null>
  syncSelectedLearningPackDirectory: () => Promise<LearningPackDirectoryInstallResult | null>
  filters: LearningPackLibraryFilters
  setFilters: (filters: LearningPackLibraryFilters) => void
}> {
  const application = useLearntApplication()
  const requestId = useRef(0)
  const [reloadToken, setReloadToken] = useState(0)
  const [filters, setFilters] = useState<LearningPackLibraryFilters>({})
  const [state, setState] = useState<AsyncState<SubjectLibraryData>>({
    status: 'idle',
  })
  const stateRef = useRef(state)

  function commitState(nextState: AsyncState<SubjectLibraryData>) {
    stateRef.current = nextState
    setState(nextState)
  }

  const reload = useCallback(() => {
    setReloadToken((value) => value + 1)
  }, [])

  const chooseAndInstallLearningPackDirectory = useCallback(async () => {
    const result = await application.chooseAndInstallLearningPackDirectory()
    if (result !== null) {
      reload()
    }
    return result
  }, [application, reload])

  const syncSelectedLearningPackDirectory = useCallback(async () => {
    const result = await application.syncSelectedLearningPackDirectory()
    if (result !== null) {
      reload()
    }
    return result
  }, [application, reload])

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
        const learner = application.getLearner()
        const subjects = application.listSubjects()
        const [sessionLibrary, learningPackLibrary] = await Promise.all([
          application.listSessions(),
          application.getLearningPackLibrary(filters),
        ])

        if (requestId.current !== currentRequestId) {
          return
        }

        commitState({
          status: 'success',
          data: { learner, subjects, sessionLibrary, learningPackLibrary },
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
  }, [application, filters, reloadToken])

  return {
    state,
    reload,
    chooseAndInstallLearningPackDirectory,
    syncSelectedLearningPackDirectory,
    filters,
    setFilters,
  }
}
