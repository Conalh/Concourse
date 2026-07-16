import { useCallback, useMemo, useState, type ReactNode } from 'react'

import type { ActivityId, SessionId } from '../../core/contracts'
import { cloneDeep, deepFreeze } from '../../core/foundation'
import {
  ResponseDraftContext,
  type ResponseDraftSnapshot,
  type ResponseDraftStore,
} from './response-draft-store'

type DraftDictionary = Readonly<Record<string, ResponseDraftSnapshot>>

export function ResponseDraftProvider({
  children,
}: Readonly<{ children: ReactNode }>) {
  const [drafts, setDrafts] = useState<DraftDictionary>({})

  const getDraft = useCallback(
    (sessionId: SessionId, activityId: ActivityId) =>
      drafts[draftKey(sessionId, activityId)] ?? null,
    [drafts],
  )

  const setDraft = useCallback(
    (
      sessionId: SessionId,
      activityId: ActivityId,
      draft: ResponseDraftSnapshot,
    ) => {
      const key = draftKey(sessionId, activityId)
      setDrafts((current) => ({
        ...current,
        [key]: freezeSnapshot(draft),
      }))
    },
    [],
  )

  const clearDraft = useCallback(
    (sessionId: SessionId, activityId: ActivityId) => {
      const key = draftKey(sessionId, activityId)
      setDrafts((current) => {
        if (!(key in current)) {
          return current
        }

        return Object.fromEntries(
          Object.entries(current).filter(
            ([candidateKey]) => candidateKey !== key,
          ),
        )
      })
    },
    [],
  )

  const clearSessionDrafts = useCallback((sessionId: SessionId) => {
    const prefix = `${sessionId}:`
    setDrafts((current) => {
      const remaining: Record<string, ResponseDraftSnapshot> = {}
      let changed = false

      for (const [key, value] of Object.entries(current)) {
        if (key.startsWith(prefix)) {
          changed = true
          continue
        }

        remaining[key] = value
      }

      return changed ? remaining : current
    })
  }, [])

  const value = useMemo<ResponseDraftStore>(
    () => ({
      getDraft,
      setDraft,
      clearDraft,
      clearSessionDrafts,
    }),
    [clearDraft, clearSessionDrafts, getDraft, setDraft],
  )

  return (
    <ResponseDraftContext.Provider value={value}>
      {children}
    </ResponseDraftContext.Provider>
  )
}

function draftKey(sessionId: SessionId, activityId: ActivityId): string {
  return `${sessionId}:${activityId}`
}

function freezeSnapshot(
  snapshot: ResponseDraftSnapshot,
): ResponseDraftSnapshot {
  return deepFreeze(cloneDeep(snapshot))
}
