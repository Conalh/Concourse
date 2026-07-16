import { createContext, useContext } from 'react'

import type { ActivityId, SessionId } from '../../core/contracts'
import type { ResponseDraft } from './response-draft'

export type ResponseDraftSnapshot = Readonly<{
  responseKind: ResponseDraft['kind']
  draft: ResponseDraft
  confidence: string
}>

export type ResponseDraftStore = Readonly<{
  getDraft: (
    sessionId: SessionId,
    activityId: ActivityId,
  ) => ResponseDraftSnapshot | null
  setDraft: (
    sessionId: SessionId,
    activityId: ActivityId,
    draft: ResponseDraftSnapshot,
  ) => void
  clearDraft: (sessionId: SessionId, activityId: ActivityId) => void
  clearSessionDrafts: (sessionId: SessionId) => void
}>

export const ResponseDraftContext = createContext<ResponseDraftStore | null>(
  null,
)

export function useResponseDraftStore(): ResponseDraftStore {
  const store = useContext(ResponseDraftContext)

  if (store === null) {
    throw new Error(
      'useResponseDraftStore must be used inside ResponseDraftProvider.',
    )
  }

  return store
}

export function useOptionalResponseDraftStore(): ResponseDraftStore | null {
  return useContext(ResponseDraftContext)
}
