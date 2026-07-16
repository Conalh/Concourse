import type {
  ConceptExplorationReference,
  SessionConceptActivityReference,
  SessionConceptCurrentThread,
  SessionConceptReference,
} from '../../application'
import type { ConceptId, SessionId } from '../../core/contracts'
import { formatRoute } from '../navigation'
import { activityStatusLabel } from './format'

export function ConceptReferenceLink({
  sessionId,
  concept,
}: Readonly<{
  sessionId: SessionId
  concept: Pick<ConceptExplorationReference, 'conceptId' | 'title'>
}>) {
  return (
    <a
      className="learnt-concept-link"
      href={formatRoute({
        kind: 'session-concept',
        sessionId,
        conceptId: concept.conceptId,
      })}
    >
      {concept.title}
    </a>
  )
}

export function ParkedPathList({
  sessionId,
  paths,
  currentConceptId,
  onRemove,
  pendingConceptId,
  disabled = false,
}: Readonly<{
  sessionId: SessionId
  paths: readonly ConceptExplorationReference[]
  currentConceptId?: ConceptId
  onRemove?: (conceptId: ConceptId) => void
  pendingConceptId?: ConceptId | null
  disabled?: boolean
}>) {
  if (paths.length === 0) {
    return <p className="learnt-muted">No parked paths yet.</p>
  }

  return (
    <ul className="learnt-parked-path-list">
      {paths.map((path) => {
        const isCurrent = currentConceptId === path.conceptId
        const isPending = pendingConceptId === path.conceptId

        return (
          <li key={path.conceptId}>
            <div>
              <ConceptReferenceLink sessionId={sessionId} concept={path} />
              {isCurrent ? (
                <span className="learnt-current-label">Current concept</span>
              ) : null}
              <p>{path.summary}</p>
            </div>
            {onRemove === undefined ? null : (
              <button
                className="learnt-button learnt-button-secondary"
                type="button"
                disabled={disabled || isPending}
                aria-label={`Remove ${path.title} from parked paths`}
                onClick={() => {
                  onRemove(path.conceptId)
                }}
              >
                {isPending ? 'Removing' : 'Remove'}
              </button>
            )}
          </li>
        )
      })}
    </ul>
  )
}

export function CurrentThreadAnchor({
  sessionId,
  thread,
}: Readonly<{
  sessionId: SessionId
  thread: SessionConceptCurrentThread
}>) {
  const actionLabel =
    thread.action === 'continue-after-completion'
      ? 'Continue Session'
      : 'Return to Activity'

  return (
    <section
      className="learnt-current-thread-anchor"
      aria-labelledby="current-thread-anchor-title"
    >
      <p className="learnt-kicker">Current thread</p>
      <h2 id="current-thread-anchor-title">{thread.activityTitle}</h2>
      <dl className="learnt-detail-grid">
        <div>
          <dt>Module</dt>
          <dd>{thread.moduleTitle}</dd>
        </div>
        <div>
          <dt>Activity</dt>
          <dd>{thread.activityKind}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{activityStatusLabel(thread.activityStatus)}</dd>
        </div>
      </dl>
      <a
        className="learnt-button"
        href={formatRoute({ kind: 'session', sessionId })}
      >
        {actionLabel}
      </a>
    </section>
  )
}

export function ConceptRelationshipList({
  sessionId,
  prerequisites,
  dependents,
  related,
}: Readonly<{
  sessionId: SessionId
  prerequisites: readonly SessionConceptReference[]
  dependents: readonly SessionConceptReference[]
  related: readonly SessionConceptReference[]
}>) {
  return (
    <div className="learnt-relationship-grid">
      <RelationshipSection
        title="Prerequisites"
        emptyText="No authored prerequisites."
        sessionId={sessionId}
        concepts={prerequisites}
      />
      <RelationshipSection
        title="Builds into"
        emptyText="No authored dependent concepts."
        sessionId={sessionId}
        concepts={dependents}
      />
      <RelationshipSection
        title="Related concepts"
        emptyText="No authored related concepts."
        sessionId={sessionId}
        concepts={related}
      />
    </div>
  )
}

export function ConceptActivityList({
  activities,
}: Readonly<{ activities: readonly SessionConceptActivityReference[] }>) {
  if (activities.length === 0) {
    return (
      <p className="learnt-muted">
        This concept is not referenced by any authored activity.
      </p>
    )
  }

  return (
    <ul className="learnt-concept-activity-list">
      {activities.map((activity) => (
        <li key={activity.activityId}>
          <div>
            <strong>{activity.activityTitle}</strong>
            {activity.isCurrentThread ? (
              <span className="learnt-current-label">Current Thread</span>
            ) : null}
          </div>
          <p>
            {activity.moduleTitle} / {activity.activityKind} /{' '}
            {activityStatusLabel(activity.status)}
          </p>
        </li>
      ))}
    </ul>
  )
}

function RelationshipSection({
  title,
  emptyText,
  sessionId,
  concepts,
}: Readonly<{
  title: string
  emptyText: string
  sessionId: SessionId
  concepts: readonly SessionConceptReference[]
}>) {
  return (
    <section className="learnt-panel" aria-labelledby={sectionId(title)}>
      <h3 id={sectionId(title)}>{title}</h3>
      {concepts.length === 0 ? (
        <p className="learnt-muted">{emptyText}</p>
      ) : (
        <ul className="learnt-concept-reference-list">
          {concepts.map((concept) => (
            <li key={concept.conceptId}>
              <ConceptReferenceLink sessionId={sessionId} concept={concept} />
              <p>{concept.summary}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function sectionId(title: string): string {
  return title.toLowerCase().replaceAll(' ', '-')
}
