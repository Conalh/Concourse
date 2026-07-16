import type {
  RecapEvaluation,
  SessionActivityRecap,
  SessionAttemptRecap,
  SessionCurrentThread,
  SessionModuleRecap,
  SessionRecap,
} from '../../application'
import type { SessionId } from '../../core/contracts'
import {
  AsyncStateView,
  ParkedPathList,
  ProgressSummary,
  RecapEvidenceResponse,
  activityStatusLabel,
  evaluationStatusLabel,
  formatDateTime,
  interactionModeLabel,
  sessionStatusLabel,
} from '../components'
import { useRouteFocus, useSessionRecap } from '../hooks'
import { formatRoute } from '../navigation'
import { useProductVocabulary } from '../vocabulary'

export function SessionRecapScreen({
  sessionId,
}: Readonly<{ sessionId: SessionId }>) {
  const vocabulary = useProductVocabulary()
  const { state, reload } = useSessionRecap(sessionId)

  return (
    <AsyncStateView
      state={state}
      loadingLabel={`Loading ${vocabulary.routeLabels.sessionRecap.toLowerCase()}`}
      retryLabel={`Reload ${vocabulary.routeLabels.sessionRecap.toLowerCase()}`}
      onRetry={reload}
    >
      {(recap) => <SessionRecapContent recap={recap} />}
    </AsyncStateView>
  )
}

function SessionRecapContent({ recap }: Readonly<{ recap: SessionRecap }>) {
  const vocabulary = useProductVocabulary()
  const headingRef = useRouteFocus<HTMLHeadingElement>(
    `recap-${recap.sessionId}-${String(recap.revision)}`,
  )

  return (
    <div className="learnt-screen learnt-recap-screen">
      <section className="learnt-recap-header" aria-labelledby="recap-title">
        <div>
          <p className="learnt-kicker">{vocabulary.routeLabels.sessionRecap}</p>
          <h1 id="recap-title" ref={headingRef} tabIndex={-1}>
            {recap.subject.title}
          </h1>
          <p>{recap.subject.summary}</p>
        </div>
        <ProgressSummary progress={recap.progress} />
      </section>

      <section className="learnt-recap-overview" aria-label="Recap overview">
        <dl className="learnt-detail-grid">
          <div>
            <dt>Status</dt>
            <dd>{sessionStatusLabel(recap.sessionStatus)}</dd>
          </div>
          <div>
            <dt>{vocabulary.terms.modeSelector}</dt>
            <dd>{interactionModeLabel(recap.interactionMode)}</dd>
          </div>
          <div>
            <dt>Evidence</dt>
            <dd>{recap.evidenceCount}</dd>
          </div>
          <div>
            <dt>Hints used</dt>
            <dd>{recap.totalHintsUsed}</dd>
          </div>
          <div>
            <dt>Started</dt>
            <dd>
              <time dateTime={recap.startedAt}>
                {formatDateTime(recap.startedAt)}
              </time>
            </dd>
          </div>
          <div>
            <dt>Last active</dt>
            <dd>
              <time dateTime={recap.lastActiveAt}>
                {formatDateTime(recap.lastActiveAt)}
              </time>
            </dd>
          </div>
        </dl>
      </section>

      {recap.currentThread === null ? null : (
        <CurrentThreadCard
          sessionId={recap.sessionId}
          thread={recap.currentThread}
        />
      )}

      <section className="learnt-panel" aria-labelledby="recap-parked-paths">
        <h2 id="recap-parked-paths">Parked paths</h2>
        <p>Concepts saved for later exploration.</p>
        <ParkedPathList sessionId={recap.sessionId} paths={recap.parkedPaths} />
      </section>

      <ActivityTrail modules={recap.modules} />
      <ConceptEncounters recap={recap} />
      <Timeline recap={recap} />
    </div>
  )
}

function CurrentThreadCard({
  sessionId,
  thread,
}: Readonly<{ sessionId: SessionId; thread: SessionCurrentThread }>) {
  return (
    <section className="learnt-panel" aria-labelledby="current-thread-title">
      <p className="learnt-kicker">Current thread</p>
      <h2 id="current-thread-title">{thread.activityTitle}</h2>
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
        {thread.action === 'continue-after-completion'
          ? 'Continue Session'
          : 'Resume Activity'}
      </a>
    </section>
  )
}

function ActivityTrail({
  modules,
}: Readonly<{ modules: readonly SessionModuleRecap[] }>) {
  return (
    <section aria-labelledby="activity-trail-title">
      <h2 id="activity-trail-title">Activity trail</h2>
      <div className="learnt-recap-module-list">
        {modules.map((module, index) => (
          <section
            className="learnt-recap-module"
            key={module.moduleId}
            aria-labelledby={`module-${module.moduleId}`}
          >
            <div>
              <p className="learnt-kicker">Module {index + 1}</p>
              <h3 id={`module-${module.moduleId}`}>{module.title}</h3>
              <p>{module.summary}</p>
            </div>
            <div className="learnt-recap-activity-list">
              {module.activities.map((activity) => (
                <ActivityRecapCard
                  activity={activity}
                  key={activity.activityId}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  )
}

function ActivityRecapCard({
  activity,
}: Readonly<{ activity: SessionActivityRecap }>) {
  return (
    <article className="learnt-recap-activity">
      <header>
        <div>
          <h4>{activity.title}</h4>
          <p>
            {activity.kind} / {activity.scaffoldLevel}
          </p>
        </div>
        <span className="learnt-current-label">
          {activityStatusLabel(activity.status)}
        </span>
      </header>

      <dl className="learnt-detail-grid">
        <div>
          <dt>Attempts</dt>
          <dd>{activity.attemptCount}</dd>
        </div>
        <div>
          <dt>Hints</dt>
          <dd>{activity.totalHintsUsed}</dd>
        </div>
        <div>
          <dt>Latest result</dt>
          <dd>
            {activity.latestEvaluation === null
              ? 'No response recorded'
              : evaluationStatusLabel(activity.latestEvaluation.status)}
          </dd>
        </div>
      </dl>

      <ReferenceList
        label="Objectives"
        values={activity.objectives.map((objective) => objective.statement)}
      />
      <ReferenceList
        label="Concepts"
        values={activity.concepts.map((concept) => concept.title)}
      />

      {activity.latestEvaluation === null ? null : (
        <EvaluationSummary evaluation={activity.latestEvaluation} />
      )}

      {activity.attempts.length === 0 ? null : (
        <div className="learnt-recap-attempts">
          <p className="learnt-muted">
            Try to reconstruct your reasoning before opening the attempt
            history.
          </p>
          <details>
            <summary>Show previous attempts</summary>
            <div className="learnt-recap-attempt-list">
              {activity.attempts.map((attempt) => (
                <AttemptCard attempt={attempt} key={attempt.evidenceId} />
              ))}
            </div>
          </details>
        </div>
      )}
    </article>
  )
}

function AttemptCard({ attempt }: Readonly<{ attempt: SessionAttemptRecap }>) {
  return (
    <article className="learnt-recap-attempt">
      <header>
        <h5>Attempt {attempt.attemptNumber}</h5>
        <time dateTime={attempt.timestamp}>
          {formatDateTime(attempt.timestamp)}
        </time>
      </header>
      <RecapEvidenceResponse response={attempt.response} />
      <dl className="learnt-detail-grid">
        <div>
          <dt>Result</dt>
          <dd>{evaluationStatusLabel(attempt.evaluation.status)}</dd>
        </div>
        <div>
          <dt>Confidence</dt>
          <dd>{attempt.confidence ?? 'Not recorded'}</dd>
        </div>
        <div>
          <dt>Hints</dt>
          <dd>{attempt.hintsUsed}</dd>
        </div>
      </dl>
      <EvaluationSummary evaluation={attempt.evaluation} />
    </article>
  )
}

function EvaluationSummary({
  evaluation,
}: Readonly<{ evaluation: RecapEvaluation }>) {
  return (
    <div className="learnt-recap-evaluation">
      <strong>{evaluationStatusLabel(evaluation.status)}</strong>
      {evaluation.score === null ? null : (
        <span>{formatScore(evaluation.score)}</span>
      )}
      {evaluation.feedback === null ? null : <p>{evaluation.feedback}</p>}
    </div>
  )
}

function ReferenceList({
  label,
  values,
}: Readonly<{ label: string; values: readonly string[] }>) {
  if (values.length === 0) {
    return null
  }

  return (
    <div className="learnt-recap-reference-list">
      <strong>{label}</strong>
      <ul>
        {values.map((value) => (
          <li key={value}>{value}</li>
        ))}
      </ul>
    </div>
  )
}

function ConceptEncounters({ recap }: Readonly<{ recap: SessionRecap }>) {
  return (
    <section className="learnt-panel" aria-labelledby="concept-encounters">
      <h2 id="concept-encounters">Encountered concepts</h2>
      {recap.conceptEncounters.length === 0 ? (
        <p className="learnt-muted">No submitted evidence yet.</p>
      ) : (
        <div className="learnt-recap-concept-list">
          {recap.conceptEncounters.map((concept) => (
            <article key={concept.conceptId}>
              <h3>{concept.title}</h3>
              <dl className="learnt-detail-grid">
                <div>
                  <dt>Evidence</dt>
                  <dd>{concept.evidenceCount}</dd>
                </div>
                <div>
                  <dt>Activities</dt>
                  <dd>{concept.activityIds.length}</dd>
                </div>
                <div>
                  <dt>First seen</dt>
                  <dd>
                    <time dateTime={concept.firstEncounterAt}>
                      {formatDateTime(concept.firstEncounterAt)}
                    </time>
                  </dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

function Timeline({ recap }: Readonly<{ recap: SessionRecap }>) {
  return (
    <section className="learnt-panel" aria-labelledby="recap-timeline">
      <h2 id="recap-timeline">Timeline</h2>
      {recap.timeline.length === 0 ? (
        <p className="learnt-muted">No submitted evidence yet.</p>
      ) : (
        <ol className="learnt-recap-timeline">
          {recap.timeline.map((entry) => (
            <li
              key={`${entry.activityId}-${String(entry.attemptNumber)}-${entry.timestamp}`}
            >
              <time dateTime={entry.timestamp}>
                {formatDateTime(entry.timestamp)}
              </time>
              <span>
                {entry.moduleTitle} / {entry.activityTitle} / Attempt{' '}
                {entry.attemptNumber} /{' '}
                {evaluationStatusLabel(entry.evaluationStatus)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

function formatScore(score: number): string {
  return `${String(Math.round(score * 100))}%`
}
