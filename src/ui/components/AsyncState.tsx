import type { ReactNode } from 'react'

import type { UiError } from '../errors'
import type { AsyncState } from '../hooks'

export function AsyncStateView<T>({
  state,
  loadingLabel,
  retryLabel = 'Retry loading',
  onRetry,
  children,
}: Readonly<{
  state: AsyncState<T>
  loadingLabel: string
  retryLabel?: string
  onRetry: () => void
  children: (data: T) => ReactNode
}>) {
  if (state.status === 'success') {
    return <>{children(state.data)}</>
  }

  if (state.status === 'loading' && state.data !== undefined) {
    return (
      <>
        <div className="learnt-inline-status" role="status" aria-live="polite">
          {loadingLabel}
        </div>
        {children(state.data)}
      </>
    )
  }

  if (state.status === 'loading' || state.status === 'idle') {
    return (
      <div className="learnt-loading" role="status" aria-busy="true">
        <span>{loadingLabel}</span>
      </div>
    )
  }

  return (
    <RecoverableError
      error={state.error}
      actionLabel={retryLabel}
      onAction={onRetry}
    />
  )
}

export function RecoverableError({
  error,
  actionLabel,
  onAction,
}: Readonly<{
  error: UiError
  actionLabel?: string
  onAction?: () => void
}>) {
  return (
    <section
      className="learnt-alert"
      role="alert"
      aria-labelledby="ui-error-title"
    >
      <p className="learnt-kicker">Recoverable state</p>
      <h2 id="ui-error-title">{error.title}</h2>
      <p>{error.message}</p>
      {error.code !== undefined ? (
        <p className="learnt-code-label">Code: {error.code}</p>
      ) : null}
      {actionLabel !== undefined && onAction !== undefined ? (
        <button
          className="learnt-button learnt-button-secondary"
          onClick={onAction}
        >
          {actionLabel}
        </button>
      ) : null}
    </section>
  )
}

export function EmptyState({
  title,
  message,
}: Readonly<{ title: string; message: string }>) {
  return (
    <section
      className="learnt-empty"
      role="status"
      aria-labelledby="empty-title"
    >
      <h2 id="empty-title">{title}</h2>
      <p>{message}</p>
    </section>
  )
}
