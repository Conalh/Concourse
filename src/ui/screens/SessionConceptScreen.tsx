import type { SessionConceptExploration } from '../../application'
import type { ConceptId, SessionId } from '../../core/contracts'
import {
  AsyncStateView,
  ConceptActivityList,
  ConceptRelationshipList,
  CurrentThreadAnchor,
  ParkedPathList,
  RecoverableError,
  interactionModeLabel,
  sessionStatusLabel,
} from '../components'
import type { UiError } from '../errors'
import { useRouteFocus, useSessionConceptExploration } from '../hooks'
import { formatRoute } from '../navigation'
import { useProductVocabulary } from '../vocabulary'

export function SessionConceptScreen({
  sessionId,
  conceptId,
}: Readonly<{ sessionId: SessionId; conceptId: ConceptId }>) {
  const controller = useSessionConceptExploration(sessionId, conceptId)

  return (
    <AsyncStateView
      state={controller.state}
      loadingLabel="Loading concept exploration"
      retryLabel="Reload concept"
      onRetry={controller.reload}
    >
      {(exploration) => (
        <SessionConceptContent
          exploration={exploration}
          commandState={controller.commandState}
          onPark={() => {
            void controller.park()
          }}
          onUnpark={() => {
            void controller.unpark()
          }}
          onReload={controller.reload}
        />
      )}
    </AsyncStateView>
  )
}

function SessionConceptContent({
  exploration,
  commandState,
  onPark,
  onUnpark,
  onReload,
}: Readonly<{
  exploration: SessionConceptExploration
  commandState: ReturnType<typeof useSessionConceptExploration>['commandState']
  onPark: () => void
  onUnpark: () => void
  onReload: () => void
}>) {
  const vocabulary = useProductVocabulary()
  const headingRef = useRouteFocus<HTMLHeadingElement>(
    `concept-${exploration.sessionId}-${exploration.concept.conceptId}`,
  )
  const isActive = exploration.sessionStatus === 'active'
  const isPending = commandState.status === 'pending'

  return (
    <div className="learnt-screen learnt-concept-screen">
      <section className="learnt-concept-hero" aria-labelledby="concept-title">
        <div>
          <p className="learnt-kicker">{exploration.subject.title}</p>
          <h1 id="concept-title" ref={headingRef} tabIndex={-1}>
            {exploration.concept.title}
          </h1>
          <p>{exploration.concept.summary}</p>
          <dl className="learnt-detail-grid">
            <div>
              <dt>Session</dt>
              <dd>{sessionStatusLabel(exploration.sessionStatus)}</dd>
            </div>
            <div>
              <dt>{vocabulary.terms.modeSelector}</dt>
              <dd>{interactionModeLabel(exploration.interactionMode)}</dd>
            </div>
          </dl>
        </div>
        <div className="learnt-action-row">
          <a
            className="learnt-button learnt-button-secondary"
            href={formatRoute({
              kind: 'session',
              sessionId: exploration.sessionId,
            })}
          >
            Return to {vocabulary.routeLabels.session.toLowerCase()}
          </a>
          <a
            className="learnt-button learnt-button-secondary"
            href={formatRoute({
              kind: 'session-recap',
              sessionId: exploration.sessionId,
            })}
          >
            Return to {vocabulary.routeLabels.sessionRecap.toLowerCase()}
          </a>
        </div>
      </section>

      {exploration.currentThread === null ? null : (
        <CurrentThreadAnchor
          sessionId={exploration.sessionId}
          thread={exploration.currentThread}
        />
      )}

      <section className="learnt-panel learnt-park-control">
        <h2>Park control</h2>
        <p>
          {exploration.isParked
            ? 'This concept is parked for later exploration.'
            : 'This concept is not parked.'}
        </p>
        {isActive ? (
          <button
            className="learnt-button"
            type="button"
            disabled={isPending}
            aria-label={
              exploration.isParked
                ? `Remove ${exploration.concept.title} from parked paths`
                : `Park ${exploration.concept.title} for later`
            }
            onClick={exploration.isParked ? onUnpark : onPark}
          >
            {isPending
              ? 'Saving'
              : exploration.isParked
                ? 'Remove from parked paths'
                : 'Park for later'}
          </button>
        ) : (
          <p className="learnt-muted">Parked paths are read-only here.</p>
        )}
        {isPending ? (
          <p className="learnt-inline-status" aria-live="polite">
            Saving parked paths.
          </p>
        ) : null}
        {commandState.status === 'error' ? (
          <ConceptCommandError error={commandState.error} onReload={onReload} />
        ) : null}
      </section>

      <section className="learnt-panel" aria-labelledby="concept-summary-title">
        <h2 id="concept-summary-title">Concept summary</h2>
        <p>{exploration.concept.summary}</p>
        <ul className="learnt-tag-list">
          {exploration.concept.tags.map((tag) => (
            <li key={tag}>{tag}</li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="relationships-title">
        <h2 id="relationships-title">Concept system context</h2>
        <ConceptRelationshipList
          sessionId={exploration.sessionId}
          prerequisites={exploration.prerequisiteConcepts}
          dependents={exploration.dependentConcepts}
          related={exploration.relatedConcepts}
        />
      </section>

      <section className="learnt-panel" aria-labelledby="objectives-title">
        <h2 id="objectives-title">Observable objectives</h2>
        {exploration.objectives.length === 0 ? (
          <p className="learnt-muted">
            No authored objectives reference this concept.
          </p>
        ) : (
          <ul>
            {exploration.objectives.map((objective) => (
              <li key={objective.objectiveId}>{objective.statement}</li>
            ))}
          </ul>
        )}
      </section>

      <section
        className="learnt-panel"
        aria-labelledby="concept-resources-title"
      >
        <h2 id="concept-resources-title">Teaching resources</h2>
        {exploration.resources.length === 0 ? (
          <p className="learnt-muted">
            No authored teaching resources reference this concept.
          </p>
        ) : (
          <ul className="learnt-learning-item-list">
            {exploration.resources.map((resource) => (
              <li
                key={`${resource.resourceId}-${resource.segmentId ?? 'whole'}`}
              >
                <div>
                  <p className="learnt-kicker">{resource.linkRole}</p>
                  <h3>{resource.title}</h3>
                  {resource.summary === null ? null : <p>{resource.summary}</p>}
                  <ul
                    className="learnt-tag-list"
                    aria-label={`${resource.title} details`}
                  >
                    <li>{resource.modality}</li>
                    <li>{resource.sourceKind}</li>
                    {resource.estimatedDurationSeconds === null ? null : (
                      <li>
                        {formatResourceDuration(
                          resource.estimatedDurationSeconds,
                        )}
                      </li>
                    )}
                  </ul>
                </div>
                <a
                  className="learnt-button learnt-button-secondary"
                  href={formatRoute({
                    kind: 'resource',
                    packId: resource.packId,
                    resourceId: resource.resourceId,
                    ...(resource.segmentId === null
                      ? {}
                      : { segmentId: resource.segmentId }),
                  })}
                >
                  Open resource
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        className="learnt-panel"
        aria-labelledby="concept-activities-title"
      >
        <h2 id="concept-activities-title">Activities involving this concept</h2>
        <ConceptActivityList activities={exploration.activities} />
      </section>

      <section className="learnt-panel" aria-labelledby="parked-paths-title">
        <h2 id="parked-paths-title">Parked paths</h2>
        <p>Concepts saved for later exploration.</p>
        <ParkedPathList
          sessionId={exploration.sessionId}
          paths={exploration.parkedPaths}
          currentConceptId={exploration.concept.conceptId}
        />
      </section>
    </div>
  )
}

function formatResourceDuration(seconds: number): string {
  if (seconds < 60) {
    return `${String(seconds)} sec`
  }

  return `${String(Math.round(seconds / 60))} min`
}

function ConceptCommandError({
  error,
  onReload,
}: Readonly<{ error: UiError; onReload: () => void }>) {
  if (error.code === 'revision-conflict') {
    return (
      <div className="learnt-error" role="alert">
        <h3>Saved session changed</h3>
        <p>
          This session changed in another application instance. Reload the
          latest saved state before changing parked paths.
        </p>
        <button
          className="learnt-button learnt-button-secondary"
          type="button"
          onClick={onReload}
        >
          Reload concept
        </button>
      </div>
    )
  }

  return (
    <RecoverableError
      error={error}
      actionLabel="Reload concept"
      onAction={onReload}
    />
  )
}
