import { Component, type ErrorInfo, type ReactNode } from 'react'

import { formatRoute } from '../navigation'

type ErrorBoundaryState = Readonly<{
  hasError: boolean
}>

export class AppErrorBoundary extends Component<
  Readonly<{ children: ReactNode }>,
  ErrorBoundaryState
> {
  override state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  override componentDidCatch(error: unknown, errorInfo: ErrorInfo): void {
    console.error('Unexpected Concourse render failure', error, errorInfo)
  }

  override render() {
    if (this.state.hasError) {
      return (
        <main className="learnt-bootstrap-failure" role="alert">
          <p className="learnt-kicker">Unexpected render failure</p>
          <h1>Concourse could not render this screen</h1>
          <p>
            The application state was not intentionally changed. Return to the
            library or reload the browser window.
          </p>
          <div className="learnt-action-row">
            <a
              className="learnt-button"
              href={formatRoute({ kind: 'library' })}
            >
              Return to library
            </a>
            <button
              className="learnt-button learnt-button-secondary"
              type="button"
              onClick={() => {
                window.location.reload()
              }}
            >
              Reload
            </button>
          </div>
        </main>
      )
    }

    return this.props.children
  }
}
