import type { UiError } from '../errors'

export type AsyncState<T> =
  | { status: 'idle' }
  | { status: 'loading'; data?: T }
  | { status: 'success'; data: T }
  | { status: 'error'; error: UiError; data?: T }

export type CommandState =
  | { status: 'idle' }
  | { status: 'pending'; command: string }
  | { status: 'error'; command: string; error: UiError }

export function latestData<T>(state: AsyncState<T>): T | null {
  if (state.status === 'success') {
    return state.data
  }

  if ('data' in state && state.data !== undefined) {
    return state.data
  }

  return null
}
