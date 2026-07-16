import { formatRoute } from '../navigation'
import { useRouteFocus } from '../hooks'

export function NotFoundScreen({
  attemptedHash,
}: Readonly<{ attemptedHash?: string }>) {
  const headingRef = useRouteFocus<HTMLHeadingElement>(
    `not-found-${attemptedHash ?? ''}`,
  )

  return (
    <section className="learnt-screen learnt-narrow-screen">
      <p className="learnt-kicker">Route not found</p>
      <h1 ref={headingRef} tabIndex={-1}>
        This workspace route is not available
      </h1>
      <p>
        The URL does not match a Concourse subject or session route. No learning
        state was changed.
      </p>
      <a className="learnt-button" href={formatRoute({ kind: 'library' })}>
        Return to library
      </a>
    </section>
  )
}
