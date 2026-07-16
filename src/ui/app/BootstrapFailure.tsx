import type { UiError } from '../errors'

export function BootstrapFailure({ error }: Readonly<{ error: UiError }>) {
  return (
    <main className="learnt-bootstrap-failure" role="alert">
      <p className="learnt-kicker">Bootstrap failure</p>
      <h1>{error.title}</h1>
      <p>{error.message}</p>
      {error.code === undefined ? null : (
        <p className="learnt-code-label">Category: {error.code}</p>
      )}
      <button
        className="learnt-button"
        type="button"
        onClick={() => {
          window.location.reload()
        }}
      >
        Reload
      </button>
    </main>
  )
}
