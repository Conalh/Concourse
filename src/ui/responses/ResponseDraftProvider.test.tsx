import { act, render, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import {
  ActivityIdSchema,
  OptionIdSchema,
  SessionIdSchema,
} from '../../core/contracts'
import { ResponseDraftProvider } from './ResponseDraftProvider'
import {
  useResponseDraftStore,
  type ResponseDraftStore,
} from './response-draft-store'

const sessionA = SessionIdSchema.parse('session-0')
const sessionB = SessionIdSchema.parse('session-1')
const activityA = ActivityIdSchema.parse('activity-a')
const activityB = ActivityIdSchema.parse('activity-b')
const optionA = OptionIdSchema.parse('option-a')

function StoreProbe({
  onStore,
}: Readonly<{ onStore: (store: ResponseDraftStore) => void }>) {
  const store = useResponseDraftStore()
  onStore(store)
  return <p>Draft probe</p>
}

function requireStore(store: ResponseDraftStore | null): ResponseDraftStore {
  if (store === null) {
    throw new Error('Expected captured response draft store.')
  }

  return store
}

describe('ResponseDraftProvider', () => {
  it('stores drafts by session and activity, including confidence metadata', async () => {
    let store: ResponseDraftStore | null = null
    render(
      <ResponseDraftProvider>
        <StoreProbe
          onStore={(nextStore) => {
            store = nextStore
          }}
        />
      </ResponseDraftProvider>,
    )

    act(() => {
      store?.setDraft(sessionA, activityA, {
        responseKind: 'text',
        draft: { kind: 'text', value: 'route draft' },
        confidence: '4',
      })
    })

    await waitFor(() => {
      expect(requireStore(store).getDraft(sessionA, activityA)).toMatchObject({
        responseKind: 'text',
        draft: { kind: 'text', value: 'route draft' },
        confidence: '4',
      })
    })
    expect(requireStore(store).getDraft(sessionA, activityB)).toBeNull()
    expect(requireStore(store).getDraft(sessionB, activityA)).toBeNull()
  })

  it('preserves drafts across route component unmounts while the provider remains mounted', async () => {
    let store: ResponseDraftStore | null = null
    const { rerender } = render(
      <ResponseDraftProvider>
        <StoreProbe
          onStore={(nextStore) => {
            store = nextStore
          }}
        />
      </ResponseDraftProvider>,
    )

    act(() => {
      store?.setDraft(sessionA, activityA, {
        responseKind: 'number',
        draft: { kind: 'number', rawValue: '7' },
        confidence: '',
      })
    })
    rerender(
      <ResponseDraftProvider>
        <p>Other route</p>
      </ResponseDraftProvider>,
    )
    rerender(
      <ResponseDraftProvider>
        <StoreProbe
          onStore={(nextStore) => {
            store = nextStore
          }}
        />
      </ResponseDraftProvider>,
    )

    await waitFor(() => {
      expect(store?.getDraft(sessionA, activityA)?.draft).toEqual({
        kind: 'number',
        rawValue: '7',
      })
    })
  })

  it('clears one draft or all drafts for a session without mutating stored snapshots', async () => {
    let store: ResponseDraftStore | null = null
    render(
      <ResponseDraftProvider>
        <StoreProbe
          onStore={(nextStore) => {
            store = nextStore
          }}
        />
      </ResponseDraftProvider>,
    )

    act(() => {
      store?.setDraft(sessionA, activityA, {
        responseKind: 'multiple-choice',
        draft: { kind: 'multiple-choice', optionIds: [optionA] },
        confidence: '',
      })
      store?.setDraft(sessionA, activityB, {
        responseKind: 'text',
        draft: { kind: 'text', value: 'second' },
        confidence: '',
      })
      store?.setDraft(sessionB, activityA, {
        responseKind: 'text',
        draft: { kind: 'text', value: 'other session' },
        confidence: '',
      })
    })

    await waitFor(() => {
      const stored = requireStore(store).getDraft(sessionA, activityA)
      if (stored === null) {
        throw new Error('Expected stored draft.')
      }

      expect(Object.isFrozen(stored)).toBe(true)
      expect(Object.isFrozen(stored.draft)).toBe(true)
      expect(() => {
        const draft = stored.draft as unknown as { optionIds: string[] }
        draft.optionIds.push('option-b')
      }).toThrow(TypeError)
    })

    act(() => {
      store?.clearDraft(sessionA, activityA)
    })
    await waitFor(() => {
      expect(store?.getDraft(sessionA, activityA)).toBeNull()
      expect(store?.getDraft(sessionA, activityB)).not.toBeNull()
    })

    act(() => {
      store?.clearSessionDrafts(sessionA)
    })
    await waitFor(() => {
      expect(store?.getDraft(sessionA, activityB)).toBeNull()
      expect(store?.getDraft(sessionB, activityA)).not.toBeNull()
    })
  })

  it('does not use browser storage', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem')
    const setItem = vi.spyOn(Storage.prototype, 'setItem')

    try {
      render(
        <ResponseDraftProvider>
          <StoreProbe onStore={() => undefined} />
        </ResponseDraftProvider>,
      )

      expect(getItem).not.toHaveBeenCalled()
      expect(setItem).not.toHaveBeenCalled()
    } finally {
      getItem.mockRestore()
      setItem.mockRestore()
    }
  })
})
